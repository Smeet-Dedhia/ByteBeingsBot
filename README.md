<div align="center">

<table>
<tr>
<td width="32%" valign="top">

<img src="./ByteBeingsBot-Demo.gif" alt="ByteBeingsBot Demo" width="100%"/>

</td>
<td valign="top" style="padding-left: 24px">

# ByteBeingsBot

### Multi-Agent Telegram Bot

**Route natural language to specialized AI agents. Automate daily tasks without building a cross-platform app.**

Built with **Next.js · TypeScript · Telegraf · Google Gemini**

---

> **🚧 Work In Progress**
> The following integrations are currently under active development:
> **Notion Workflows** · **File Handler** · **Google Calendar Integration**

---

[Features](#-key-features) · [Architecture](#-architecture) · [Innovations](#-core-innovations) · [Getting Started](#-getting-started) · [Add an Agent](#-registering-a-new-agent)

</td>
</tr>
</table>

</div>

---

## ✨ Key Features

| Feature | Description |
|---|---|
| 🧠 **Intelligent Router** | A `SupervisorAgent` powered by Gemini function-calling reads every message and picks the right agent to handle it. No slash commands needed. |
| 🤖 **Specialist Subagents** | Independent agents for nutrition tracking, link saving, content summarization, Notion databases, and Google Calendar. Each has its own tools and system prompt. |
| 🔁 **Multi-Turn Conversations** | Sessions stay alive in memory across multiple messages, so agents keep context within a thread without you repeating yourself. |
| 📲 **Telegram Mini Web Apps** | When an agent needs structured input (e.g. picking rows before saving to Notion), it opens a Next.js UI right inside Telegram. No separate app needed. |
| 💾 **Persistent Session History** | When a conversation ends, Gemini writes a structured summary to disk. Future sessions can load it back for long-term context. |
| 🔌 **Easy to Extend** | Adding a new agent takes three steps and touches two files. The router picks it up automatically at startup. |

---

## 🏗 Architecture

```
                    ┌─────────────────────────┐
                    │      User (Telegram)    │
                    └────────────┬────────────┘
                                 │  Natural Language
                                 ▼
                    ┌─────────────────────────┐
                    │    Telegram Webhook     │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │     SessionManager      │  <- in-memory chat state
                    │   (multi-turn memory)   │     + disk-persisted history
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │     SupervisorAgent     │  <- Gemini function-calling router
                    └────────────┬────────────┘
                                 │  routes to...
        ┌──────────┬─────────────┼──────────────┬──────────┐
        ▼          ▼             ▼               ▼          ▼
 ┌───────────┐ ┌────────┐ ┌──────────┐ ┌────────────┐ ┌─────────┐
 │  Notion   │ │  Save  │ │Nutrition │ │ Summarizer │ │Calendar │
 │  Agent    │ │ Later  │ │  Agent   │ │   Agent    │ │  Agent  │ 🚧
 └───────────┘ └────────┘ └──────────┘ └────────────┘ └─────────┘
                                 │
                      (when approval needed)
                                 ▼
                    ┌─────────────────────────┐
                    │  Telegram Mini Web App  │  <- Next.js UI inside Telegram
                    └─────────────────────────┘
```

### How the Router Works

Every message hits the `SupervisorAgent` first. It builds its routing prompt on the fly by reading the **manifest** of every registered agent: their `id`, `description`, `capabilities`, and `triggerExamples`. Gemini picks the right agent via function-calling, or handles it directly for things like greetings and meta-questions.

There is no hard-coded if/else routing logic anywhere. Adding a new agent automatically updates the Supervisor's view of the system.

---

## 💡 Core Innovations

### 1. Declarative Agent Registration

Each agent publishes a manifest describing what it does and what kinds of messages should trigger it:

```typescript
manifest: AgentManifest = {
  id: 'nutrition_agent',
  name: 'Nutrition Tracker',
  description: 'Logs meals, calculates macros, and tracks daily calorie intake.',
  capabilities: ['log_meal', 'get_daily_summary'],
  triggerExamples: [
    'I just had a chicken sandwich',
    'How many calories have I eaten today?',
  ],
  requiredEnvVars: ['NOTION_DATABASE_ID'],
};
```

The `SupervisorAgent` reads all registered manifests at startup and builds its routing instructions from them. You never touch the router when adding or removing an agent.

---

### 2. Shared State + Persisted History

The `SessionManager` handles everything to do with memory.

**Within a session (in-memory):**
- Full message history is shared across every agent that handles a turn in that conversation.
- The `activeAgentId` field enables sticky routing: a follow-up message goes straight back to the same agent without hitting the Supervisor again.
- Every agent invocation and its outcome is recorded in `agentsUsed[]`.

**When a session ends (written to disk):**
- Gemini generates a natural-language summary of the conversation.
- The summary is saved as a JSON file under `data/session_history/`, keyed by `chatId` and timestamp.
- Past summaries can be loaded back to give future sessions context about what a user has done before.

```
data/
└── session_history/
    └── {chatId}_{timestamp}_{sessionId}.json
```

---

### 3. Telegram as a Cross-Platform UI Layer

Instead of building and shipping a native iOS/Android app, ByteBeingsBot uses **Telegram Mini Apps** for any interaction that needs a real UI.

When an agent needs structured input from the user (e.g. previewing and selecting rows before pushing to Notion), it generates a one-time approval URL and attaches it as an inline button. Tapping it opens a full **Next.js interface** rendered inside Telegram's built-in browser. No App Store. No separate login. No platform-specific code.

```
Bot sends inline button -> User taps -> Next.js Mini App opens inside Telegram
       ^                                              |
  Approval stored <-- -- -- -- -- -- --  User selects rows & confirms
```

One codebase, every platform Telegram runs on.

---

## 🚀 Getting Started

### 1. Environment Variables

Create a `.env.local` file in the project root:

```env
TELEGRAM_BOT_TOKEN="your-telegram-bot-token"
TELEGRAM_WEBHOOK_SECRET="optional-webhook-secret-token"
GEMINI_API_KEY="your-gemini-api-key"
NOTION_API_KEY="your-notion-api-key"
NOTION_DATABASE_ID="your-default-notion-database-id"
NEXT_PUBLIC_APP_URL="your-tunnel-or-deployment-url"
```

> You need a public HTTPS URL for the Telegram webhook. Use [ngrok](https://ngrok.com) or any deployment platform during local development.

### 2. Install & Run

```bash
npm install
npm run dev        # starts the Next.js dev server
```

### 3. Register the Webhook

Once the server is up and reachable, point Telegram at it:

```
POST https://api.telegram.org/bot<TOKEN>/setWebhook
Body: { "url": "https://<your-url>/api/webhook/telegram" }
```

### 4. Run Tests

```bash
npm run test
```

---

## 🔌 Registering a New Agent

Adding a new specialist takes three steps and touches two files.

### Step 1 - Create the Agent Class

```typescript
// agents/my-custom-agent/index.ts
import { BaseAgent } from '../base';
import { AgentManifest, AgentTool } from '../../lib/types';
import { Type } from '@google/genai';

export class MyCustomAgent extends BaseAgent {
  manifest: AgentManifest = {
    id: 'custom_agent',
    name: 'My Custom Agent',
    description: 'What your agent does, in a sentence or two.',
    capabilities: ['do_something'],
    triggerExamples: [
      'Example phrase that should route here',
      'Another trigger phrase',
    ],
    requiredEnvVars: ['CUSTOM_API_KEY'],
  };

  tools: AgentTool[] = [
    {
      declaration: {
        name: 'do_something_tool',
        description: 'What this tool does.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            arg1: { type: Type.STRING, description: 'Parameter description' },
          },
          required: ['arg1'],
        },
      },
      execute: async (args, context) => {
        // implementation goes here
        return { result: 'Success' };
      },
    },
  ];

  getSystemPrompt(): string {
    return 'Role, instructions, and constraints for your agent.';
  }
}
```

### Step 2 - Register the Agent

```typescript
// agents/index.ts
import { MyCustomAgent } from './my-custom-agent';

export function registerAllAgents(): void {
  if (agentRegistry.getAllAgentIds().length > 0) return;

  agentRegistry.register(new NotionAgent());
  agentRegistry.register(new MyCustomAgent()); // <- add this
}
```

### Step 3 - Done

The `SupervisorAgent` picks up the new manifest on next startup. Routing logic, the `/agents` command, and the system prompt all reflect the change with no further edits.

---

## 🗂 Project Structure

```
ByteBeingsBot/
├── agents/
│   ├── base.ts              # BaseAgent abstract class
│   ├── index.ts             # registers all agents at startup
│   ├── supervisor/          # SupervisorAgent (router)
│   ├── notion/              # Notion database agent
│   ├── save-later/          # link saving agent
│   ├── nutrition/           # meal & macro tracking agent
│   ├── summarizer/          # content summarization agent
│   └── calendar/            # 🚧 Google Calendar agent (WIP)
├── lib/
│   ├── session.ts           # SessionManager: memory + persistence
│   ├── registry.ts          # agent registry
│   ├── types.ts             # shared TypeScript types
│   ├── gemini.ts            # Gemini SDK client
│   ├── notion.ts            # Notion API client
│   └── telegram.ts          # Telegram/Telegraf helpers
├── app/
│   └── api/
│       └── webhook/         # Next.js API route for Telegram webhook
├── data/
│   └── session_history/     # persisted session summaries (JSON)
└── __tests__/               # unit tests (Vitest)
```

---

<div align="center">
  <sub>Built with ❤️ by <a href="https://ByteBeings.com">ByteBeings</a></sub>
</div>
