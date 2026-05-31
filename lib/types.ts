import { FunctionDeclaration } from '@google/genai';

// ---- Agent Tool System ----

/**
 * A tool that an agent's LLM can invoke via function calling.
 * 
 * `declaration` is passed to Gemini's `functionDeclarations` config.
 * `execute` is the backend function that runs when Gemini calls this tool.
 */
export interface AgentTool {
  /** Gemini function declaration (name, description, parameters schema) */
  declaration: FunctionDeclaration;

  /**
   * Execute this tool with the arguments Gemini provided.
   * @param args - The parsed JSON arguments from Gemini's function call
   * @param context - The current agent execution context (session, chatId, etc.)
   * @returns The result to feed back to Gemini as a FunctionResponse
   */
  execute: (args: Record<string, unknown>, context: AgentContext) => Promise<Record<string, unknown>>;
}

// ---- Agent Manifest (Registry Metadata) ----

/**
 * Declarative metadata about an agent.
 * Used by the Supervisor to build its routing prompt.
 */
export interface AgentManifest {
  /** Unique identifier, e.g. 'notion_agent', 'market_agent' */
  id: string;
  /** Human-readable name */
  name: string;
  /** 1-2 sentence description of what this agent does. The Supervisor reads this. */
  description: string;
  /** List of capability keywords, e.g. ['extract_data', 'push_to_notion'] */
  capabilities: string[];
  /**
   * Example user messages that should trigger this agent.
   * The Supervisor uses these as few-shot examples for routing.
   */
  triggerExamples: string[];
  /** Gemini model ID to use for this agent. Default: 'gemini-2.5-flash' */
  model?: string;
  /** Required env vars for this agent to function */
  requiredEnvVars?: string[];
}

// ---- Agent Execution Context ----

/**
 * Everything an agent receives when it's invoked.
 * This is the agent's view of the world.
 */
export interface AgentContext {
  /** Telegram chat ID */
  chatId: number;
  /** Session thread ID (string form of chatId) */
  threadId: string;
  /** The user's latest message text */
  userMessage: string;
  /** Full conversation history for this session (all messages, all agents) */
  conversationHistory: SessionMessage[];
  /** The Supervisor's summary of what this agent should do */
  taskSummary: string;
}

// ---- Agent Response ----

/**
 * Standardized response every agent must return.
 */
export interface AgentResponse {
  /** Whether the agent completed its task successfully */
  success: boolean;
  /** Human-readable message to show the user (supports Markdown) */
  message: string;
  /** Optional structured data (agent-specific, for programmatic use) */
  data?: Record<string, unknown>;
  /**
   * If true, the agent needs more input from the user.
   * The session will keep this agent as `activeAgentId` so the next
   * user message routes directly back to this agent.
   */
  requiresFollowUp: boolean;
  /** The question to ask the user (required when requiresFollowUp = true) */
  followUpQuestion?: string;
}

// ---- Agent Interface ----

/**
 * The interface every agent must implement.
 * Agents are registered with the AgentRegistry at startup.
 */
export interface IAgent {
  /** Agent metadata for routing and discovery */
  manifest: AgentManifest;
  /** Tools this agent's LLM can call */
  tools: AgentTool[];
  /** Execute the agent's task */
  execute(context: AgentContext): Promise<AgentResponse>;
}

// ---- Session Types ----

/**
 * A single message in the session conversation.
 */
export interface SessionMessage {
  /** Who sent this message */
  role: 'user' | 'assistant' | 'system';
  /** The message text */
  content: string;
  /** Which agent generated this message (null for user/system messages) */
  agentId?: string;
  /** Unix timestamp in milliseconds */
  timestamp: number;
}

/**
 * Active session state for a chat.
 * Lives in memory. Cleared when session completes.
 */
export interface Session {
  /** Unique session ID (UUID) */
  id: string;
  /** Telegram chat ID */
  chatId: number;
  /** All messages in this session */
  messages: SessionMessage[];
  /** 
   * Which agent is currently handling the conversation.
   * If set, the next user message bypasses the Supervisor and goes
   * directly to this agent (for follow-up flows).
   * If null, the Supervisor routes the next message.
   */
  activeAgentId: string | null;
  /** Agents that have been used in this session (for summary) */
  agentsUsed: Array<{ agentId: string; taskSummary: string; success: boolean }>;
  /** Session start time (Unix ms) */
  startedAt: number;
  /** Last activity time (Unix ms) — updated on every message */
  lastActivityAt: number;
}

/**
 * Persisted summary of a completed session.
 * Written to disk as JSON after session ends.
 */
export interface SessionSummary {
  /** Session ID */
  sessionId: string;
  /** Telegram chat ID */
  chatId: number;
  /** Start and end timestamps */
  startedAt: number;
  completedAt: number;
  /** Duration in seconds */
  durationSeconds: number;
  /** How the session ended */
  outcome: 'completed' | 'failed' | 'abandoned' | 'timed_out';
  /** LLM-generated 1-2 sentence summary of what happened */
  summary: string;
  /** Agents that were used */
  agentsUsed: Array<{ agentId: string; taskSummary: string; success: boolean }>;
  /** Total number of messages exchanged */
  messageCount: number;
  /** The original user intent (first user message or LLM-classified) */
  userIntent: string;
}

// ---- Supervisor Types ----

/**
 * The result of the Supervisor's routing decision.
 */
export interface DelegationResult {
  /** Which agent to delegate to */
  agentId: string;
  /** Clear summary of what the agent should do */
  taskSummary: string;
}

/**
 * When the Supervisor decides to respond directly (no delegation).
 */
export interface DirectResponse {
  /** The response message to send to the user */
  message: string;
}

/**
 * Union type for Supervisor output.
 */
export type SupervisorResult =
  | { type: 'delegation'; delegation: DelegationResult }
  | { type: 'direct_response'; response: DirectResponse };

// ---- Pending Approval Store Type ----

/**
 * Data stored when an agent wants to show the WebApp approval table.
 * Keyed by threadId. Read by /table page and /api/approve route.
 */
export interface PendingApproval {
  threadId: string;
  agentId: string;
  extractedData: {
    summary: string;
    rows: Record<string, any>[];
    confidence: number;
  };
  notionSchema: Record<string, any>;
  notionDatabaseId: string;
  createdAt: number;
}

// ---- Legacy types (backward compat during migration) ----

export type WorkflowType = 'meeting_tasks' | 'prd_generator' | 'grocery_list';

export interface ProcessedOutput {
  summary: string;
  rows: Record<string, any>[];
  confidence: number;
}
