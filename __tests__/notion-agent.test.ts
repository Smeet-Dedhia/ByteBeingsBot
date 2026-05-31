import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotionAgent } from '../agents/notion';
import { AgentContext } from '../lib/types';
import { approvalStore } from '../lib/approval-store';

// Use vi.hoisted to ensure mockGenerateContent is initialized before vi.mock executes
const { mockGenerateContent } = vi.hoisted(() => {
  return {
    mockGenerateContent: vi.fn(),
  };
});

vi.mock('@google/genai', () => {
  class MockGoogleGenAI {
    models = {
      generateContent: mockGenerateContent,
    };
  }
  return {
    GoogleGenAI: MockGoogleGenAI,
    Type: {
      OBJECT: 'OBJECT',
      STRING: 'STRING',
      BOOLEAN: 'BOOLEAN',
      ARRAY: 'ARRAY',
      NUMBER: 'NUMBER',
    },
  };
});

// Mock lib/notion functions
vi.mock('../lib/notion', () => {
  return {
    getDatabaseSchema: vi.fn().mockResolvedValue({
      Task: { type: 'title' },
      Owner: { type: 'select', options: ['Smeet', 'John'] },
    }),
    dynamicPushToNotion: vi.fn().mockResolvedValue(true),
  };
});

describe('NotionAgent', () => {
  let agent: NotionAgent;
  let context: AgentContext;

  beforeEach(() => {
    agent = new NotionAgent();
    context = {
      chatId: 12345,
      threadId: '12345',
      userMessage: 'Extract action items',
      conversationHistory: [],
      taskSummary: 'Extract tasks to Notion',
    };
    mockGenerateContent.mockReset();
    approvalStore.delete('12345');
  });

  it('should have the correct manifest and tools', () => {
    expect(agent.manifest.id).toBe('notion_agent');
    expect(agent.tools.some(t => t.declaration.name === 'get_notion_schema')).toBe(true);
    expect(agent.tools.some(t => t.declaration.name === 'push_rows_to_notion')).toBe(true);
    expect(agent.tools.some(t => t.declaration.name === 'store_pending_approval')).toBe(true);
  });

  it('should successfully run through tool execution for Notion extraction', async () => {
    // 1st LLM call: invokes get_notion_schema
    // 2nd LLM call: invokes store_pending_approval
    // 3rd LLM call: invokes respond_to_user
    mockGenerateContent
      .mockResolvedValueOnce({
        functionCalls: [{ name: 'get_notion_schema', args: { database_id: 'db_123' } }],
      })
      .mockResolvedValueOnce({
        functionCalls: [{
          name: 'store_pending_approval',
          args: {
            summary: 'Meeting Action Items',
            rows: [{ Task: 'Build Homepage', Owner: 'Smeet' }],
            confidence: 90,
            schema: { Task: { type: 'title' }, Owner: { type: 'select' } },
            database_id: 'db_123',
          },
        }],
      })
      .mockResolvedValueOnce({
        functionCalls: [{ name: 'respond_to_user', args: { success: true, message: 'Extracted task: Build Homepage' } }],
      });

    const response = await agent.execute(context);

    // Verify it stored pending approval in the store
    expect(approvalStore.has('12345')).toBe(true);
    const stored = approvalStore.get('12345');
    expect(stored!.extractedData.summary).toBe('Meeting Action Items');
    expect(stored!.extractedData.rows).toEqual([{ Task: 'Build Homepage', Owner: 'Smeet' }]);

    // Verify final response
    expect(response).toEqual({
      success: true,
      message: 'Extracted task: Build Homepage',
      requiresFollowUp: false,
    });
  });
});
