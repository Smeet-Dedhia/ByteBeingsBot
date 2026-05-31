import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SupervisorAgent } from '../agents/supervisor';
import { agentRegistry } from '../lib/registry';
import { Session, IAgent } from '../lib/types';

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

// A mock agent class for registration testing
const mockAgent: IAgent = {
  manifest: {
    id: 'notion_agent',
    name: 'Notion Agent',
    description: 'Handles Notion workflows.',
    capabilities: ['notion'],
    triggerExamples: ['save tasks'],
  },
  tools: [],
  execute: vi.fn().mockResolvedValue({ success: true, message: 'Done' }),
};

describe('SupervisorAgent', () => {
  let supervisor: SupervisorAgent;
  let session: Session;

  beforeEach(() => {
    supervisor = new SupervisorAgent();
    session = {
      id: 'session_123',
      chatId: 12345,
      messages: [
        { role: 'user', content: 'Hi', timestamp: Date.now() },
        { role: 'assistant', content: 'Hello! How can I help?', timestamp: Date.now() },
        { role: 'user', content: 'Help me save some tasks', timestamp: Date.now() },
      ],
      activeAgentId: null,
      agentsUsed: [],
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    mockGenerateContent.mockReset();
    agentRegistry.unregister('notion_agent');
  });

  it('should delegate to notion_agent when LLM triggers delegate_to_agent', async () => {
    // Register mock agent
    agentRegistry.register(mockAgent);

    mockGenerateContent.mockResolvedValue({
      functionCalls: [{
        name: 'delegate_to_agent',
        args: { agent_id: 'notion_agent', task_summary: 'Extract meeting tasks' },
      }],
    });

    const result = await supervisor.route(session, 'Help me save some tasks');

    expect(result).toEqual({
      type: 'delegation',
      delegation: {
        agentId: 'notion_agent',
        taskSummary: 'Extract meeting tasks',
      },
    });
  });

  it('should respond directly when LLM triggers respond_directly', async () => {
    mockGenerateContent.mockResolvedValue({
      functionCalls: [{
        name: 'respond_directly',
        args: { message: 'Hello! I am a helper robot.' },
      }],
    });

    const result = await supervisor.route(session, 'Hi');

    expect(result).toEqual({
      type: 'direct_response',
      response: {
        message: 'Hello! I am a helper robot.',
      },
    });
  });

  it('should fall back to direct response if no function calls are made', async () => {
    mockGenerateContent.mockResolvedValue({
      text: 'Direct plain text fallback response.',
      functionCalls: [],
    });

    const result = await supervisor.route(session, 'Something random');

    expect(result).toEqual({
      type: 'direct_response',
      response: {
        message: 'Direct plain text fallback response.',
      },
    });
  });
});
