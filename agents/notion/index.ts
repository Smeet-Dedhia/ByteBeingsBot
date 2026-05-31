import { BaseAgent } from '../base';
import { AgentManifest, AgentTool } from '../../lib/types';
import { Type } from '@google/genai';
import { getDatabaseSchema, dynamicPushToNotion } from '../../lib/notion';
import { approvalStore } from '../../lib/approval-store';

export class NotionAgent extends BaseAgent {
  manifest: AgentManifest = {
    id: 'notion_agent',
    name: 'Notion Workflow Agent',
    description: 'Extracts structured data from text (meeting notes, PRDs, grocery lists, etc.) and pushes it to Notion databases. Can also query Notion database schemas.',
    capabilities: ['extract_structured_data', 'push_to_notion', 'query_notion_schema'],
    triggerExamples: [
      'Extract action items from my meeting notes',
      'Create a PRD for the new checkout feature',
      'Add groceries to my shopping list',
      'Push these tasks to Notion',
      'What columns does my Notion database have?',
    ],
    model: 'gemini-3.1-flash-lite',
    requiredEnvVars: ['NOTION_API_KEY', 'NOTION_DATABASE_ID'],
  };

  tools: AgentTool[] = [
    {
      declaration: {
        name: 'get_notion_schema',
        description: 'Fetch the column schema of the target Notion database. Call this first to understand what columns are available before extracting data.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            database_id: {
              type: Type.STRING,
              description: 'The Notion database ID. If not provided, uses the default from environment.',
            },
          },
        },
      },
      execute: async (args) => {
        const dbId = (args.database_id as string) || process.env.NOTION_DATABASE_ID || '';
        const schema = await getDatabaseSchema(dbId);
        if (!schema) return { error: 'Failed to fetch Notion schema' };
        return { schema, database_id: dbId };
      },
    },
    {
      declaration: {
        name: 'push_rows_to_notion',
        description: 'Push extracted rows to a Notion database. Each row is a JSON object mapping column names to values. Call get_notion_schema first to know the valid columns.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            database_id: { type: Type.STRING, description: 'The Notion database ID.' },
            rows: {
              type: Type.ARRAY,
              items: { type: Type.OBJECT, description: 'A row mapping column names to values.' },
              description: 'Array of rows to push. Each row is { columnName: value }.',
            },
            schema: {
              type: Type.OBJECT,
              description: 'The Notion schema object (from get_notion_schema). Required for type mapping.',
            },
          },
          required: ['database_id', 'rows', 'schema'],
        },
      },
      execute: async (args) => {
        try {
          await dynamicPushToNotion(
            args.database_id as string,
            args.rows as Record<string, any>[],
            args.schema as Record<string, any>
          );
          return { success: true, rowsCreated: (args.rows as any[]).length };
        } catch (error: any) {
          return { error: error.message || 'Failed to push to Notion' };
        }
      },
    },
    {
      declaration: {
        name: 'store_pending_approval',
        description: 'Store extracted rows in the pending approval store so the user can review them in a visual table before pushing. ALWAYS call this when extracting rows for approval.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: 'A short summary of the extracted tasks/items.' },
            rows: {
              type: Type.ARRAY,
              items: { type: Type.OBJECT, description: 'A row mapping column names to values.' },
              description: 'Array of extracted rows to present to the user.',
            },
            confidence: { type: Type.NUMBER, description: 'Confidence score from 0 to 100.' },
            schema: { type: Type.OBJECT, description: 'The Notion schema object used for extraction.' },
            database_id: { type: Type.STRING, description: 'The Notion database ID.' },
          },
          required: ['summary', 'rows', 'confidence', 'schema', 'database_id'],
        },
      },
      execute: async (args, context) => {
        const approvalData = {
          threadId: context.threadId,
          agentId: 'notion_agent',
          extractedData: {
            summary: args.summary as string,
            rows: args.rows as Record<string, any>[],
            confidence: args.confidence as number,
          },
          notionSchema: args.schema as Record<string, any>,
          notionDatabaseId: args.database_id as string,
          createdAt: Date.now(),
        };
        approvalStore.set(context.threadId, approvalData);
        return { success: true, message: 'Extracted data stored successfully. Waiting for user approval.' };
      },
    },
  ];

  getSystemPrompt(): string {
    return `You are a Notion workflow assistant. Your job is to extract structured data from the user's text and push it to their Notion database.

## Your Process
1. First, call \`get_notion_schema\` to understand the target database's columns and types.
2. Analyze the user's text and extract structured rows that match the schema.
3. Call \`store_pending_approval\` to store the extracted rows for visual review.
4. Respond to the user using the \`respond_to_user\` tool with a message explaining that their data has been extracted and is ready for approval. In the response message, provide a formatted text preview of the extracted rows.

## Rules
- Always fetch the schema first — don't assume column names.
- Extract one row per actionable item.
- For select/status columns, only use valid options from the schema.
- Show a formatted preview of the extracted rows in your final response message.
- If anything is unclear or the confidence is low, call \`request_followup\` to ask the user.`;
  }
}
