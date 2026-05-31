import { IAgent, AgentManifest } from './types';

/**
 * AgentRegistry is the central directory of all available agents.
 * 
 * At startup, all agents register themselves here.
 * The Supervisor queries this registry to:
 * 1. Get the list of available agents (for its routing prompt)
 * 2. Look up an agent by ID (to execute delegation)
 * 
 * The registry also generates the Supervisor's routing context
 * automatically from the registered manifests.
 */
export class AgentRegistry {
  private agents: Map<string, IAgent> = new Map();

  /**
   * Register an agent. Call this at application startup.
   * Validates that the agent has a unique ID and required env vars.
   */
  register(agent: IAgent): void {
    const { id, requiredEnvVars } = agent.manifest;

    if (this.agents.has(id)) {
      throw new Error(`Agent "${id}" is already registered.`);
    }

    // Validate required env vars
    if (requiredEnvVars) {
      const missing = requiredEnvVars.filter(v => !process.env[v]);
      if (missing.length > 0) {
        console.warn(
          `⚠️  Agent "${id}" registered but missing env vars: ${missing.join(', ')}. ` +
          `Agent may fail at runtime.`
        );
      }
    }

    this.agents.set(id, agent);
    console.log(`✅ Agent registered: ${agent.manifest.name} (${id})`);
  }

  /**
   * Unregister an agent by ID.
   */
  unregister(agentId: string): void {
    this.agents.delete(agentId);
  }

  /**
   * Get an agent instance by ID.
   */
  getAgent(agentId: string): IAgent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get all registered agent manifests.
   */
  getAllManifests(): AgentManifest[] {
    return Array.from(this.agents.values()).map(a => a.manifest);
  }

  /**
   * Get all registered agent IDs.
   */
  getAllAgentIds(): string[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Auto-generate the Supervisor's routing context.
   * 
   * This is called every time the Supervisor needs to route a message.
   * The output is injected into the Supervisor's system prompt.
   * 
   * When a new agent is registered, this output automatically includes it.
   * No manual prompt editing required.
   */
  generateSupervisorContext(): string {
    const manifests = this.getAllManifests();

    if (manifests.length === 0) {
      return 'No specialized agents are currently available. Respond to the user directly.';
    }

    const agentDescriptions = manifests.map((m, i) => {
      const examples = m.triggerExamples.map(e => `  - "${e}"`).join('\n');
      return (
        `${i + 1}. **${m.name}** (id: \`${m.id}\`)\n` +
        `   ${m.description}\n` +
        `   Capabilities: ${m.capabilities.join(', ')}\n` +
        `   Example triggers:\n${examples}`
      );
    }).join('\n\n');

    return (
      `You have access to the following specialized agents:\n\n` +
      `${agentDescriptions}\n\n` +
      `Agent IDs for delegation: [${manifests.map(m => `"${m.id}"`).join(', ')}]`
    );
  }
}

// Singleton
const globalForRegistry = global as unknown as { agentRegistry: AgentRegistry };
export const agentRegistry = globalForRegistry.agentRegistry || new AgentRegistry();
if (process.env.NODE_ENV !== 'production') {
  globalForRegistry.agentRegistry = agentRegistry;
}
