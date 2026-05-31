import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseAgent } from '../agents/base';
import { AgentManifest, AgentTool, AgentContext, AgentResponse } from '../lib/types';

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

// Concrete class extending BaseAgent for testing
class TestAgent extends BaseAgent {
  manifest: AgentManifest = {
    id: 'test_agent',
    name: 'Test Agent',
    description: 'A test agent.',
    capabilities: ['test'],
    triggerExamples: ['run test'],
  };

  tools: AgentTool[] = [
    {
      declaration: {
        name: 'custom_tool',
        description: 'A custom tool.',
      },
      execute: vi.fn().mockResolvedValue({ status: 'tool_success' }),
    },
  ];

  getSystemPrompt(): string {
    return 'You are a test assistant.';
  }
}

describe('BaseAgent', () => {
  let agent: TestAgent;
  let context: AgentContext;

  beforeEach(() => {
    agent = new TestAgent();
    context = {
      chatId: 12345,
      threadId: '12345',
      userMessage: 'Run my test please',
      conversationHistory: [
        { role: 'user', content: 'Initial message', timestamp: Date.now() },
      ],
      taskSummary: 'Run the test',
    };
    mockGenerateContent.mockReset();
    (agent.tools[0].execute as any).mockClear();
  });

  it('should return direct text response if no function calls are made', async () => {
    mockGenerateContent.mockResolvedValue({
      text: 'Direct text answer.',
      functionCalls: [],
    });

    const response = await agent.execute(context);
    expect(response).toEqual({
      success: true,
      message: 'Direct text answer.',
      requiresFollowUp: false,
    });
  });

  it('should call custom tool and feed result back to LLM', async () => {
    // 1st LLM call: invokes custom_tool
    // 2nd LLM call: invokes respond_to_user
    mockGenerateContent
      .mockResolvedValueOnce({
        functionCalls: [{ name: 'custom_tool', args: { arg1: 'val1' } }],
      })
      .mockResolvedValueOnce({
        functionCalls: [{ name: 'respond_to_user', args: { success: true, message: 'Task is complete!' } }],
      });

    const response = await agent.execute(context);

    // Verify custom tool was executed with correct arguments
    expect(agent.tools[0].execute).toHaveBeenCalledWith({ arg1: 'val1' }, context);

    // Verify final agent response
    expect(response).toEqual({
      success: true,
      message: 'Task is complete!',
      requiresFollowUp: false,
    });

    // Check content flow fed back to Gemini (should have function call and response in history)
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  it('should handle request_followup built-in tool', async () => {
    mockGenerateContent.mockResolvedValue({
      functionCalls: [{ name: 'request_followup', args: { question: 'What type of test?' } }],
    });

    const response = await agent.execute(context);
    expect(response).toEqual({
      success: true,
      message: 'What type of test?',
      requiresFollowUp: true,
      followUpQuestion: 'What type of test?',
    });
  });

  it('should force stop if tool iterations exceed max iterations', async () => {
    // Make generateContent always return custom_tool call, causing infinite loop
    mockGenerateContent.mockResolvedValue({
      functionCalls: [{ name: 'custom_tool', args: {} }],
    });

    const response = await agent.execute(context);
    expect(response.success).toBe(false);
    expect(response.message).toContain('too many steps');
  });
});
