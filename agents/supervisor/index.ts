import { GoogleGenAI, FunctionDeclaration, Type, Content } from '@google/genai';
import { agentRegistry } from '../../lib/registry';
import { Session, SupervisorResult } from '../../lib/types';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * The SupervisorAgent is the entry point for all user messages.
 * 
 * Its ONLY job is:
 * 1. Understand the user's intent
 * 2. Decide which specialized agent should handle it (or respond directly)
 * 
 * It NEVER processes domain-specific tasks itself.
 */
export class SupervisorAgent {
  private model = 'gemini-3.1-flash-lite';

  /**
   * Route a user message to the appropriate agent, or respond directly.
   */
  async route(session: Session, userMessage: string): Promise<SupervisorResult> {
    const systemPrompt = this.buildSystemPrompt();
    const tools = this.buildTools();
    const history = this.buildHistory(session);

    const response = await ai.models.generateContent({
      model: this.model,
      contents: [
        ...history,
        { role: 'user', parts: [{ text: userMessage }] },
      ],
      config: {
        systemInstruction: systemPrompt,
        tools: [{ functionDeclarations: tools }],
      },
    });

    const functionCalls = response.functionCalls;

    // If the model called delegate_to_agent
    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0]; // Take the first function call

      if (call.name === 'delegate_to_agent') {
        const args = call.args as { agent_id: string; task_summary: string };
        
        // Validate the agent exists
        const agent = agentRegistry.getAgent(args.agent_id);
        if (!agent) {
          return {
            type: 'direct_response',
            response: { message: `I tried to use the "${args.agent_id}" agent, but it's not available. Let me try to help you differently.` },
          };
        }

        return {
          type: 'delegation',
          delegation: {
            agentId: args.agent_id,
            taskSummary: args.task_summary,
          },
        };
      }

      if (call.name === 'respond_directly') {
        return {
          type: 'direct_response',
          response: { message: (call.args as { message: string }).message },
        };
      }
    }

    // Fallback: model responded with text (no tool call)
    return {
      type: 'direct_response',
      response: { message: response.text || "I'm not sure how to help with that. Try /help to see what I can do." },
    };
  }

  /**
   * Build the Supervisor's system prompt.
   * The agent listing is auto-generated from the registry.
   */
  private buildSystemPrompt(): string {
    const agentContext = agentRegistry.generateSupervisorContext();

    return `You are the Supervisor of a multi-agent system. Your role is to understand the user's intent and delegate tasks to the appropriate specialized agent.

## Your Rules
1. You NEVER perform domain-specific tasks yourself. You ONLY route.
2. Analyze the user's message carefully to determine intent.
3. If a specialized agent matches the user's intent, call \`delegate_to_agent\` with the agent_id and a clear task_summary.
4. If no agent matches (e.g., greetings, meta-questions, help requests), call \`respond_directly\`.
5. The task_summary you provide to the agent should be a clear, concise instruction — not the raw user message. Add relevant context.
6. If the user's intent is ambiguous, call \`respond_directly\` and ask for clarification.

## Available Agents
${agentContext}

## Examples
- User: "Extract action items from my meeting notes" → delegate_to_agent(agent_id: "notion_agent", task_summary: "Extract action items from the user's meeting notes and prepare them for Notion")
- User: "Hello!" → respond_directly(message: "Hello! I can help you with...")
- User: "What can you do?" → respond_directly(message: "I have access to the following agents: ...")`;
  }

  /**
   * Build the Supervisor's tool declarations.
   */
  private buildTools(): FunctionDeclaration[] {
    const agentIds = agentRegistry.getAllAgentIds();

    return [
      {
        name: 'delegate_to_agent',
        description: 'Hand off the user\'s request to a specialized agent. Use this when the user\'s intent matches one of the available agents.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            agent_id: {
              type: Type.STRING,
              description: `The ID of the agent to delegate to. Must be one of: ${agentIds.join(', ')}`,
            },
            task_summary: {
              type: Type.STRING,
              description: 'A clear, concise summary of what the agent should do. This is the instruction the agent receives.',
            },
          },
          required: ['agent_id', 'task_summary'],
        },
      },
      {
        name: 'respond_directly',
        description: 'Respond to the user directly without delegating to any agent. Use for greetings, help requests, clarification questions, or when no agent matches.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            message: {
              type: Type.STRING,
              description: 'The message to send to the user.',
            },
          },
          required: ['message'],
        },
      },
    ];
  }

  /**
   * Convert session messages to Gemini Content format.
   */
  private buildHistory(session: Session): Content[] {
    const contents: Content[] = [];
    
    // Skip the last message (it's the current one we're routing)
    const history = session.messages.slice(0, -1);
    
    for (const msg of history) {
      if (msg.role === 'user') {
        contents.push({ role: 'user', parts: [{ text: msg.content }] });
      } else if (msg.role === 'assistant') {
        // Include agent ID for context
        const prefix = msg.agentId ? `[${msg.agentId}] ` : '';
        contents.push({ role: 'model', parts: [{ text: prefix + msg.content }] });
      }
    }

    return contents;
  }
}

// Singleton
const globalForSupervisor = global as unknown as { supervisorAgent: SupervisorAgent };
export const supervisorAgent = globalForSupervisor.supervisorAgent || new SupervisorAgent();
if (process.env.NODE_ENV !== 'production') {
  globalForSupervisor.supervisorAgent = supervisorAgent;
}
