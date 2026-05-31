# ByteBeingsBot — Supervisor-Worker Multi-Agent System

A modular and highly extensible Telegram bot architecture built with Next.js, TypeScript, Telegraf, and the Google Gemini SDK. The bot utilizes a Supervisor-Worker topology to understand user intents in natural language and delegate tasks dynamically to specialized agent instances.

## Architecture

```
                    ┌────────────────────────┐
                    │     User (Telegram)    │
                    └───────────┬────────────┘
                                │
                                ▼
                    ┌────────────────────────┐
                    │    Telegram Webhook    │
                    └───────────┬────────────┘
                                │
                                ▼
                    ┌────────────────────────┐
                    │     SessionManager     │
                    └───────────┬────────────┘
                                │
                                ▼
                    ┌────────────────────────┐
                    │    SupervisorAgent     │
                    └───────────┬────────────┘
                                │ (Routes via LLM)
          ┌─────────────────────┴─────────────────────┐
          ▼                                           ▼
┌───────────────────┐                       ┌───────────────────┐
│    NotionAgent    │                       │    FutureAgent    │
│ (Workflow Worker) │                       │  (Worker Class)   │
└───────────────────┘                       └───────────────────┘
```

1. **SupervisorAgent**: Uses Gemini function calling to decide whether to handle the user's message directly (greetings, meta-questions) or delegate it to a registered specialized agent. It holds a registry of manifests and trigger examples to dynamically generate its routing prompt.
2. **Specialized Worker Agents**: Independent agent instances extending `BaseAgent` and equipped with custom system instructions and tools.
3. **SessionManager**: Epicenter of multi-turn chat memory and session persistence. Active sessions run in-memory, while finished sessions are summarized by Gemini and saved to disk.
4. **Interactive Approval WebApp**: Bridges the Telegram bot to a Next.js interface for manual row selection and preview before saving data to Notion databases.

---

## Getting Started

### 1. Environment Variables

Create a `.env.local` file in the root directory:

```env
TELEGRAM_BOT_TOKEN="your-telegram-bot-token"
TELEGRAM_WEBHOOK_SECRET="optional-webhook-secret-token"
GEMINI_API_KEY="your-gemini-api-key"
NOTION_API_KEY="your-notion-api-key"
NOTION_DATABASE_ID="your-default-notion-database-id"
NEXT_PUBLIC_APP_URL="your-tunnelling-or-deployment-url"
```

### 2. Install Dependencies & Build

```bash
npm install
npm run build
```

### 3. Run Development Server

```bash
npm run dev
```

### 4. Running Unit Tests

```bash
npm run test
```

---

## Adding a New Specialized Agent

Once the infrastructure is live, registering a new specialized worker agent requires only three steps:

### Step 1: Create the Agent Class

Create a new file `agents/my-custom-agent/index.ts` and extend `BaseAgent`:

```typescript
import { BaseAgent } from '../base';
import { AgentManifest, AgentTool } from '../../lib/types';
import { Type } from '@google/genai';

export class MyCustomAgent extends BaseAgent {
  manifest: AgentManifest = {
    id: 'custom_agent',
    name: 'My Custom Agent',
    description: 'Describe what your specialized agent does in 1-2 clear sentences.',
    capabilities: ['do_something'],
    triggerExamples: [
      'Trigger command example one',
      'Trigger command example two',
    ],
    requiredEnvVars: ['CUSTOM_API_KEY'],
  };

  tools: AgentTool[] = [
    {
      declaration: {
        name: 'do_something_tool',
        description: 'Explain what this tool does.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            arg1: { type: Type.STRING, description: 'Parameter description' },
          },
          required: ['arg1'],
        },
      },
      execute: async (args, context) => {
        // Implement backend logic
        return { result: 'Success' };
      },
    },
  ];

  getSystemPrompt(): string {
    return 'Personality, role, instructions, and safety constraints for your agent.';
  }
}
```

### Step 2: Register the Agent

In `agents/index.ts`, import your new class and register it:

```typescript
import { MyCustomAgent } from './my-custom-agent';

export function registerAllAgents(): void {
  if (agentRegistry.getAllAgentIds().length > 0) return;

  agentRegistry.register(new NotionAgent());
  agentRegistry.register(new MyCustomAgent()); // <-- Add this line
}
```

### Step 3: Done!

The **SupervisorAgent** will automatically read the new manifest and trigger examples from the registry at startup. The routing instructions, system prompt, and Telegram `/agents` list update automatically.
