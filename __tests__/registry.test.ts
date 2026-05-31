import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentRegistry } from '../lib/registry';
import { IAgent, AgentContext, AgentResponse } from '../lib/types';

describe('AgentRegistry', () => {
  let registry: AgentRegistry;

  const mockAgent1: IAgent = {
    manifest: {
      id: 'agent_one',
      name: 'Agent One',
      description: 'First test agent.',
      capabilities: ['cap_1'],
      triggerExamples: ['do item one'],
    },
    tools: [],
    execute: async (context: AgentContext): Promise<AgentResponse> => {
      return { success: true, message: 'one', requiresFollowUp: false };
    },
  };

  const mockAgent2: IAgent = {
    manifest: {
      id: 'agent_two',
      name: 'Agent Two',
      description: 'Second test agent.',
      capabilities: ['cap_2'],
      triggerExamples: ['do item two'],
      requiredEnvVars: ['TEST_ENV_VAR_REQUIRED'],
    },
    tools: [],
    execute: async (context: AgentContext): Promise<AgentResponse> => {
      return { success: true, message: 'two', requiresFollowUp: false };
    },
  };

  beforeEach(() => {
    registry = new AgentRegistry();
  });

  it('should register an agent and retrieve it by id', () => {
    registry.register(mockAgent1);
    expect(registry.getAgent('agent_one')).toBe(mockAgent1);
    expect(registry.getAllAgentIds()).toEqual(['agent_one']);
  });

  it('should reject register with duplicate agent ids', () => {
    registry.register(mockAgent1);
    expect(() => registry.register(mockAgent1)).toThrowError('Agent "agent_one" is already registered.');
  });

  it('should unregister an agent', () => {
    registry.register(mockAgent1);
    registry.unregister('agent_one');
    expect(registry.getAgent('agent_one')).toBeUndefined();
    expect(registry.getAllAgentIds()).toEqual([]);
  });

  it('should return all registered manifests', () => {
    registry.register(mockAgent1);
    const manifests = registry.getAllManifests();
    expect(manifests.length).toBe(1);
    expect(manifests[0].id).toBe('agent_one');
  });

  it('should generate appropriate context when no agents are registered', () => {
    const context = registry.generateSupervisorContext();
    expect(context).toContain('No specialized agents are currently available.');
  });

  it('should generate properly formatted supervisor context when agents are registered', () => {
    registry.register(mockAgent1);
    const context = registry.generateSupervisorContext();
    expect(context).toContain('You have access to the following specialized agents:');
    expect(context).toContain('Agent One');
    expect(context).toContain('agent_one');
    expect(context).toContain('First test agent.');
    expect(context).toContain('Capabilities: cap_1');
    expect(context).toContain('- "do item one"');
    expect(context).toContain('Agent IDs for delegation: ["agent_one"]');
  });

  it('should log a warning if registering an agent with missing env vars', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    // Ensure the env var is not defined
    const originalEnv = process.env.TEST_ENV_VAR_REQUIRED;
    delete process.env.TEST_ENV_VAR_REQUIRED;

    registry.register(mockAgent2);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Agent "agent_two" registered but missing env vars: TEST_ENV_VAR_REQUIRED')
    );

    // Restore env & spy
    if (originalEnv) {
      process.env.TEST_ENV_VAR_REQUIRED = originalEnv;
    }
    warnSpy.mockRestore();
  });
});
