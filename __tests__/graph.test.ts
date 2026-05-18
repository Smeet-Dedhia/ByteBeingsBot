import { describe, it, expect, vi } from 'vitest';
import { workflowGraph } from '../lib/graph';
import * as gemini from '../lib/gemini';

vi.mock('../lib/gemini', () => ({
  processWorkflow: vi.fn(),
  generateClarification: vi.fn(),
}));

describe('LangGraph Workflow', () => {
  it('should process text, extract data, and pause before action', async () => {
    vi.mocked(gemini.processWorkflow).mockResolvedValue({
      summary: 'Test Summary',
      tasks: ['Test Task'],
      confidence: 90,
    });

    const threadId = 'test-thread-1';
    
    // Invoke graph
    const finalState = await workflowGraph.invoke(
      { workflowType: 'meeting_tasks', rawInput: 'test input', chatId: 123 },
      { configurable: { thread_id: threadId } }
    );

    // It should extract data
    expect(finalState.extractedData).toEqual({
      summary: 'Test Summary',
      tasks: ['Test Task'],
      confidence: 90,
    });

    // It should check confidence
    expect(finalState.requiresReview).toBe(false);

    // It should pause before action
    const state = await workflowGraph.getState({ configurable: { thread_id: threadId } });
    expect(state.next).toContain('action');

    // Simulate approval and resume
    await workflowGraph.updateState({ configurable: { thread_id: threadId } }, { approved: true });
    await workflowGraph.invoke(null, { configurable: { thread_id: threadId } });

    // It should reach the end
    const resumedState = await workflowGraph.getState({ configurable: { thread_id: threadId } });
    expect(resumedState.next).toHaveLength(0);
  });

  it('should handle clarification loop when confidence is low', async () => {
    vi.mocked(gemini.processWorkflow)
      .mockResolvedValueOnce({
        summary: 'Incomplete Summary',
        tasks: ['Task without owner'],
        confidence: 50, // Low confidence
      })
      .mockResolvedValueOnce({
        summary: 'Complete Summary',
        tasks: ['Task with owner'],
        confidence: 95, // High confidence after clarification
      });

    vi.mocked(gemini.generateClarification).mockResolvedValue('Who is the owner?');

    const threadId = 'test-thread-2';

    // 1. Initial invoke
    const finalState = await workflowGraph.invoke(
      { workflowType: 'meeting_tasks', rawInput: 'test input', chatId: 456 },
      { configurable: { thread_id: threadId } }
    );

    // Should pause at waitForClarification
    let state = await workflowGraph.getState({ configurable: { thread_id: threadId } });
    expect(state.next).toContain('waitForClarification');
    expect(finalState.clarificationQuestion).toBe('Who is the owner?');

    // 2. Provide clarification response and resume
    await workflowGraph.updateState({ configurable: { thread_id: threadId } }, { clarificationResponse: 'Sarah is the owner' });
    const resumedState = await workflowGraph.invoke(null, { configurable: { thread_id: threadId } });

    // 3. Should loop back, re-extract with high confidence, and pause at action
    state = await workflowGraph.getState({ configurable: { thread_id: threadId } });
    expect(state.next).toContain('action');
    expect(resumedState.extractedData).toEqual({
      summary: 'Complete Summary',
      tasks: ['Task with owner'],
      confidence: 95,
    });
    
    // Check that input was appended
    expect(resumedState.rawInput).toContain('User Clarification: Sarah is the owner');
  });
});
