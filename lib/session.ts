import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Session, SessionMessage, SessionSummary } from './types';

// Where completed session summaries are stored
const HISTORY_DIR = path.join(process.cwd(), 'data', 'session_history');

/**
 * SessionManager handles the lifecycle of chat sessions.
 * 
 * Active sessions live in-memory (Map<chatId, Session>).
 * Completed sessions are summarized and persisted to JSON files.
 */
export class SessionManager {
  private sessions: Map<number, Session> = new Map();
  private readonly SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

  /**
   * Get the active session for a chat, or create a new one.
   */
  getOrCreateSession(chatId: number): Session {
    let session = this.sessions.get(chatId);
    if (!session) {
      session = {
        id: randomUUID(),
        chatId,
        messages: [],
        activeAgentId: null,
        agentsUsed: [],
        startedAt: Date.now(),
        lastActivityAt: Date.now(),
      };
      this.sessions.set(chatId, session);
    }
    session.lastActivityAt = Date.now();
    return session;
  }

  /**
   * Add a message to the session.
   */
  addMessage(chatId: number, role: SessionMessage['role'], content: string, agentId?: string): void {
    const session = this.getOrCreateSession(chatId);
    session.messages.push({
      role,
      content,
      agentId,
      timestamp: Date.now(),
    });
    session.lastActivityAt = Date.now();
  }

  /**
   * Record that an agent was used in this session.
   */
  recordAgentUsage(chatId: number, agentId: string, taskSummary: string, success: boolean): void {
    const session = this.sessions.get(chatId);
    if (session) {
      session.agentsUsed.push({ agentId, taskSummary, success });
    }
  }

  /**
   * Set the active agent for follow-up routing.
   * Pass null to clear (agent is done, next message goes to Supervisor).
   */
  setActiveAgent(chatId: number, agentId: string | null): void {
    const session = this.sessions.get(chatId);
    if (session) {
      session.activeAgentId = agentId;
    }
  }

  /**
   * Get the active session (or null if none exists).
   */
  getSession(chatId: number): Session | null {
    return this.sessions.get(chatId) || null;
  }

  /**
   * Complete a session: generate summary and persist to disk.
   * 
   * @param chatId - The chat to complete
   * @param outcome - How the session ended
   * @param summaryText - LLM-generated summary (call generateSessionSummary() first)
   */
  async completeSession(
    chatId: number,
    outcome: SessionSummary['outcome'],
    summaryText: string
  ): Promise<SessionSummary | null> {
    const session = this.sessions.get(chatId);
    if (!session) return null;

    const now = Date.now();
    const summary: SessionSummary = {
      sessionId: session.id,
      chatId: session.chatId,
      startedAt: session.startedAt,
      completedAt: now,
      durationSeconds: Math.round((now - session.startedAt) / 1000),
      outcome,
      summary: summaryText,
      agentsUsed: session.agentsUsed,
      messageCount: session.messages.length,
      userIntent: session.messages.find(m => m.role === 'user')?.content || 'Unknown',
    };

    // Persist to disk
    await this.persistSummary(summary);

    // Clear the active session
    this.sessions.delete(chatId);

    return summary;
  }

  /**
   * Check all sessions for timeout and complete them.
   * Call this periodically (e.g., every 5 minutes).
   */
  async checkTimeouts(): Promise<void> {
    const now = Date.now();
    for (const [chatId, session] of this.sessions.entries()) {
      if (now - session.lastActivityAt > this.SESSION_TIMEOUT_MS) {
        await this.completeSession(chatId, 'timed_out', 'Session timed out due to inactivity.');
      }
    }
  }

  /**
   * Write a session summary to a JSON file.
   */
  private async persistSummary(summary: SessionSummary): Promise<void> {
    try {
      if (!fs.existsSync(HISTORY_DIR)) {
        fs.mkdirSync(HISTORY_DIR, { recursive: true });
      }

      const filename = `${summary.chatId}_${summary.completedAt}_${summary.sessionId}.json`;
      const filepath = path.join(HISTORY_DIR, filename);
      fs.writeFileSync(filepath, JSON.stringify(summary, null, 2));
    } catch (error) {
      console.error('Failed to persist session summary:', error);
    }
  }

  /**
   * Load past session summaries for a chat (for context/history features).
   */
  getSessionHistory(chatId: number, limit: number = 10): SessionSummary[] {
    try {
      if (!fs.existsSync(HISTORY_DIR)) return [];

      const files = fs.readdirSync(HISTORY_DIR)
        .filter(f => f.startsWith(`${chatId}_`) && f.endsWith('.json'))
        .sort()
        .reverse()
        .slice(0, limit);

      return files.map(f => {
        const content = fs.readFileSync(path.join(HISTORY_DIR, f), 'utf-8');
        return JSON.parse(content) as SessionSummary;
      });
    } catch (error) {
      console.error('Failed to load session history:', error);
      return [];
    }
  }
}

// Singleton — survives hot reloads in Next.js dev mode
const globalForSession = global as unknown as { sessionManager: SessionManager };
export const sessionManager = globalForSession.sessionManager || new SessionManager();
if (process.env.NODE_ENV !== 'production') {
  globalForSession.sessionManager = sessionManager;
}
