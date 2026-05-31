import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { SessionManager } from '../lib/session';

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  const testChatId = 123456789;
  const HISTORY_DIR = path.join(process.cwd(), 'data', 'session_history');

  beforeEach(() => {
    sessionManager = new SessionManager();
    // Clean up any test files in HISTORY_DIR if they exist
    if (fs.existsSync(HISTORY_DIR)) {
      const files = fs.readdirSync(HISTORY_DIR).filter(f => f.startsWith(`${testChatId}_`));
      for (const file of files) {
        fs.unlinkSync(path.join(HISTORY_DIR, file));
      }
    }
  });

  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(HISTORY_DIR)) {
      const files = fs.readdirSync(HISTORY_DIR).filter(f => f.startsWith(`${testChatId}_`));
      for (const file of files) {
        fs.unlinkSync(path.join(HISTORY_DIR, file));
      }
    }
  });

  it('should create a new session with the correct shape', () => {
    const session = sessionManager.getOrCreateSession(testChatId);
    expect(session).toBeDefined();
    expect(session.chatId).toBe(testChatId);
    expect(session.id).toBeTypeOf('string');
    expect(session.messages).toEqual([]);
    expect(session.activeAgentId).toBeNull();
    expect(session.agentsUsed).toEqual([]);
    expect(session.startedAt).toBeLessThanOrEqual(Date.now());
    expect(session.lastActivityAt).toBeLessThanOrEqual(Date.now());
  });

  it('should return the existing session for the same chatId', () => {
    const session1 = sessionManager.getOrCreateSession(testChatId);
    const session2 = sessionManager.getOrCreateSession(testChatId);
    expect(session1.id).toBe(session2.id);
  });

  it('should append messages to session.messages with correct fields', () => {
    sessionManager.addMessage(testChatId, 'user', 'Hello Agent');
    sessionManager.addMessage(testChatId, 'assistant', 'Hello User', 'test_agent');

    const session = sessionManager.getSession(testChatId);
    expect(session).not.toBeNull();
    expect(session!.messages.length).toBe(2);
    expect(session!.messages[0]).toMatchObject({
      role: 'user',
      content: 'Hello Agent',
      agentId: undefined,
    });
    expect(session!.messages[1]).toMatchObject({
      role: 'assistant',
      content: 'Hello User',
      agentId: 'test_agent',
    });
    expect(session!.messages[0].timestamp).toBeTypeOf('number');
  });

  it('should update activeAgentId when setActiveAgent is called', () => {
    sessionManager.getOrCreateSession(testChatId);
    sessionManager.setActiveAgent(testChatId, 'test_agent');
    
    let session = sessionManager.getSession(testChatId);
    expect(session!.activeAgentId).toBe('test_agent');

    sessionManager.setActiveAgent(testChatId, null);
    session = sessionManager.getSession(testChatId);
    expect(session!.activeAgentId).toBeNull();
  });

  it('should complete session, persist summary to disk, and clear in-memory session', async () => {
    sessionManager.getOrCreateSession(testChatId);
    sessionManager.addMessage(testChatId, 'user', 'Need Notion help');
    sessionManager.recordAgentUsage(testChatId, 'notion_agent', 'Help with meeting tasks', true);

    const summary = await sessionManager.completeSession(
      testChatId,
      'completed',
      'User requested Notion assistance which was successfully handled by Notion Agent.'
    );

    expect(summary).not.toBeNull();
    expect(summary!.chatId).toBe(testChatId);
    expect(summary!.outcome).toBe('completed');
    expect(summary!.summary).toBe('User requested Notion assistance which was successfully handled by Notion Agent.');
    expect(summary!.agentsUsed).toEqual([{ agentId: 'notion_agent', taskSummary: 'Help with meeting tasks', success: true }]);
    expect(summary!.messageCount).toBe(1);

    // Verify session is removed from memory
    const activeSession = sessionManager.getSession(testChatId);
    expect(activeSession).toBeNull();

    // Verify file exists on disk
    const filename = `${testChatId}_${summary!.completedAt}_${summary!.sessionId}.json`;
    const filepath = path.join(HISTORY_DIR, filename);
    expect(fs.existsSync(filepath)).toBe(true);

    const content = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    expect(content.sessionId).toBe(summary!.sessionId);
    expect(content.summary).toBe(summary!.summary);
  });

  it('should load past session summaries via getSessionHistory', async () => {
    const session1 = sessionManager.getOrCreateSession(testChatId);
    const summary1 = await sessionManager.completeSession(testChatId, 'completed', 'Summary one');

    // Small delay to ensure order
    await new Promise(resolve => setTimeout(resolve, 50));

    const session2 = sessionManager.getOrCreateSession(testChatId);
    const summary2 = await sessionManager.completeSession(testChatId, 'completed', 'Summary two');

    const history = sessionManager.getSessionHistory(testChatId);
    expect(history.length).toBe(2);
    expect(history[0].summary).toBe('Summary two');
    expect(history[1].summary).toBe('Summary one');
  });
});
