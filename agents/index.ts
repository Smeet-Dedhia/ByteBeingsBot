import { agentRegistry } from '../lib/registry';
import { NotionAgent } from './notion';
import { SaveLaterAgent } from './save-later';
import { CalendarAgent } from './calendar';
import { NutritionAgent } from './nutrition';
import { SummarizerAgent } from './summarizer';

/**
 * Register all agents with the registry.
 * Called once at application startup.
 */
export function registerAllAgents(): void {
  // Prevent double-registration on hot reload
  if (agentRegistry.getAllAgentIds().length > 0) return;

  agentRegistry.register(new NotionAgent());
  agentRegistry.register(new SaveLaterAgent());
  agentRegistry.register(new CalendarAgent());
  agentRegistry.register(new NutritionAgent());
  agentRegistry.register(new SummarizerAgent());

  console.log(`\n📋 Agent Registry: ${agentRegistry.getAllAgentIds().length} agents registered.\n`);
}
