import { GoogleGenAI, FunctionDeclaration, Content, Part, Type } from '@google/genai';
import { IAgent, AgentManifest, AgentTool, AgentContext, AgentResponse } from '../lib/types';
import { dataStore } from '../lib/data-store';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * BaseAgent provides the default tool-calling execution loop.
 * 
 * Subclasses define their manifest, tools, and system prompt.
 * The base class handles:
 * - Building the Gemini request with tool definitions
 * - The tool-call → execute → feed-result-back loop
 * - Converting session history to Gemini Content format
 * - Error handling and max-iteration safety
 * 
 * Subclasses CAN override execute() entirely for custom pipelines
 * (e.g., LangGraph-based agents, external API agents).
 */
export abstract class BaseAgent implements IAgent {
  abstract manifest: AgentManifest;
  abstract tools: AgentTool[];

  /** Max tool-calling iterations before force-stopping */
  protected maxToolIterations: number = 10;

  /**
   * The system prompt for this agent's LLM.
   * This is where the agent's personality, instructions, and constraints live.
   */
  abstract getSystemPrompt(): string;

  /**
   * Default execution: tool-calling loop with Gemini.
   * 
   * Override this method for completely custom execution logic
   * (e.g., a LangGraph pipeline, or calling an external API).
   */
  async execute(context: AgentContext): Promise<AgentResponse> {
    const model = this.manifest.model || 'gemini-3.1-flash-lite';
    const systemPrompt = this.getSystemPrompt();

    // Build Gemini function declarations from our tools
    const functionDeclarations: FunctionDeclaration[] = this.tools.map(t => t.declaration);

    // Add the built-in tools
    functionDeclarations.push(
      {
        name: 'respond_to_user',
        description: 'Send a final response to the user. Call this when you have completed the task or have a final answer.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            message: { type: Type.STRING, description: 'The message to display to the user (Markdown supported).' },
            success: { type: Type.BOOLEAN, description: 'Whether the task was completed successfully.' },
          },
          required: ['message', 'success'],
        },
      },
      {
        name: 'request_followup',
        description: 'Ask the user a follow-up question when you need more information to complete the task.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING, description: 'The question to ask the user.' },
          },
          required: ['question'],
        },
      },
      {
        name: 'save_to_collection',
        description: 'Save structured data to a named persistent local collection.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            collection: { type: Type.STRING, description: 'Collection name (e.g. saved_links, saved_files, grocery_logs, nutrition_entries, content_summaries, calendar_events).' },
            data: { type: Type.OBJECT, description: 'The JSON record payload to save.' },
          },
          required: ['collection', 'data'],
        },
      },
      {
        name: 'query_collection',
        description: 'Query records from a persistent local collection. Use to fetch recently saved items.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            collection: { type: Type.STRING, description: 'Collection name.' },
            limit: { type: Type.NUMBER, description: 'Maximum number of items to return.' },
          },
          required: ['collection'],
        },
      }
    );

    // Convert session history to Gemini Content format
    const history = this.buildGeminiHistory(context);

    // Build the initial user message (includes task summary for context)
    const userContent = context.taskSummary
      ? `Task: ${context.taskSummary}\n\nUser message: ${context.userMessage}`
      : context.userMessage;

    // Start the conversation
    const contents: Content[] = [
      ...history,
      { role: 'user', parts: [{ text: userContent }] },
    ];

    // Tool-calling loop
    for (let iteration = 0; iteration < this.maxToolIterations; iteration++) {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: systemPrompt,
          tools: [{ functionDeclarations }],
        },
      });

      const functionCalls = response.functionCalls;

      // No function calls → the model responded with text
      if (!functionCalls || functionCalls.length === 0) {
        // If the model just returned text without using our tools,
        // treat it as a direct response
        return {
          success: true,
          message: response.text || 'Task completed.',
          requiresFollowUp: false,
        };
      }

      // Check first if there are any immediate terminal responses (respond_to_user / request_followup)
      for (const call of functionCalls) {
        if (call.name === 'respond_to_user') {
          return {
            success: (call.args as any).success ?? true,
            message: (call.args as any).message || 'Done.',
            requiresFollowUp: false,
          };
        }

        if (call.name === 'request_followup') {
          return {
            success: true,
            message: (call.args as any).question || 'Could you provide more details?',
            requiresFollowUp: true,
            followUpQuestion: (call.args as any).question,
          };
        }
      }

      // Append the complete model candidate content to contents history to preserve thought_signature, thoughts, etc.
      const modelContent = response.candidates?.[0]?.content;
      if (modelContent) {
        contents.push(modelContent);
      } else {
        contents.push({ role: 'model', parts: [] });
      }

      // Process and execute all function calls, collecting their results into a single user response turn
      const responseParts: Part[] = [];
      for (const call of functionCalls) {
        if (call.name === 'save_to_collection') {
          const args = call.args as { collection: string; data: Record<string, any> };
          const record = await dataStore.insert(args.collection, args.data);
          responseParts.push({
            functionResponse: {
              name: call.name,
              response: { success: true, id: record.id }
            }
          } as Part);
        } else if (call.name === 'query_collection') {
          const args = call.args as { collection: string; limit?: number };
          const records = await dataStore.getAll(args.collection, args.limit);
          responseParts.push({
            functionResponse: {
              name: call.name,
              response: { records }
            }
          } as Part);
        } else {
          const tool = this.tools.find(t => t.declaration.name === call.name);
          if (!tool) {
            responseParts.push({
              functionResponse: {
                name: call.name,
                response: { error: `Unknown tool: ${call.name}` }
              }
            } as Part);
          } else {
            let toolResult: Record<string, unknown>;
            try {
              toolResult = await tool.execute(call.args as Record<string, unknown>, context);
            } catch (error: any) {
              toolResult = { error: error.message || 'Tool execution failed' };
            }
            responseParts.push({
              functionResponse: {
                name: call.name,
                response: toolResult
              }
            } as Part);
          }
        }
      }

      // Append the collected tool execution responses back as a single user turn
      contents.push({ role: 'user', parts: responseParts });
    }

    // Max iterations reached
    return {
      success: false,
      message: 'I ran into too many steps trying to complete this task. Please try again with a simpler request.',
      requiresFollowUp: false,
    };
  }

  /**
   * Convert session messages to Gemini Content format.
   * This gives the agent visibility into the full session conversation.
   */
  protected buildGeminiHistory(context: AgentContext): Content[] {
    const contents: Content[] = [];

    for (const msg of context.conversationHistory) {
      // Skip the latest user message (we add it separately with task context)
      if (msg === context.conversationHistory[context.conversationHistory.length - 1] && msg.role === 'user') {
        continue;
      }

      if (msg.role === 'user') {
        contents.push({ role: 'user', parts: [{ text: msg.content }] });
      } else if (msg.role === 'assistant') {
        contents.push({ role: 'model', parts: [{ text: msg.content }] });
      }
      // System messages are skipped (they're internal bookkeeping)
    }

    return contents;
  }
}
