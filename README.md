<div align="center">

<table>
<tr>
<td width="32%" valign="top">

<img src="./ByteBeingsBot-Demo.gif" alt="ByteBeingsBot Demo" width="100%"/>

</td>
<td valign="top" style="padding-left: 24px">

# ByteBeingsBot

### Multi-Agent Telegram Bot

**Route natural language to specialized AI agents. Automate your daily tasks — without building a cross-platform app.**

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
| 🧠 **Intelligent Router** | A `SupervisorAgent` powered by Gemini function-calling interprets every user message and routes it to the right specialized agent — no slash commands needed. |
| 🤖 **Specialist Subagents** | Independent agents for Nutrition tracking, link saving, content summarization, Notion databases, and Google Calendar handle their domains with purpose-built tools and system prompts. |
| 🔁 **Multi-Turn Conversations** | Sessions persist in-memory across multiple messages, so agents remember context within a conversation thread without re-prompting. |
| 📲 **Telegram Mini Web Apps** | Complex approval flows (e.g. selecting rows before saving to Notion) surface as interactive Telegram Web Apps — no separate mobile app required. |
| 💾 **Persistent Session History** | When a conversation ends, Gemini generates a structured summary that is persisted to disk and is available for future context retrieval. |
| 🔌 **Zero-Friction Extensibility** | Registering a new agent takes three steps and zero changes to routing logic. The Supervisor auto-discovers agents via a manifest at startup. |

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
                    │     SessionManager      │  ← In-memory chat state
                    │   (multi-turn memory)   │    + disk-persisted history
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │     SupervisorAgent     │  ← Gemini function-calling router
                    └────────────┬────────────┘
                                 │  LLM-Driven Routing
        ┌──────────┬─────────────┼──────────────┬──────────┐
        ▼          ▼             ▼               ▼          ▼
 ┌───────────┐ ┌────────┐ ┌──────────┐ ┌────────────┐ ┌─────────┐
 │  Notion   │ │  Save  │ │Nutrition │ │ Summarizer │ │Calendar │
 │  Agent   │ │ Later  │ │  Agent   │ │   Agent    │ │  Agent  │ 🚧
 └───────────┘ └────────┘ └──────────┘ └────────────┘ └─────────┘
                                 │
                      (when approval needed)
                                 ▼
                    ┌─────────────────────────┐
                    │  Telegram Mini Web App  │  ← Next.js UI embedded in Telegram
                    └─────────────────────────┘
```

### How the Router Works

Every inbound message passes through a single decision layer — the `SupervisorAgent`. It dynamically builds its routing prompt by reading the **manifest** of every registered agent: their `id`, `description`, `capabilities`, and `triggerExamples`. Gemini then selects the right agent via function-calling, or handles the message directly (greetings, meta-questions, ambiguous intents).

This means the router has zero hard-coded if/else logic. Adding a new agent automatically updates the Supervisor's understanding of the system.

---

## 💡 Core Innovations

### 1 — Fully Declarative Agent Registration

Agents are self-describing. Each one publishes a manifest:

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

The `SupervisorAgent` reads all registered manifests at startup and auto-generates its routing instructions. No changes to the router are ever needed when an agent is added or removed. This makes the system **open for extension, closed for modification**.

---

### 2 — Shared State, Persisted History

The `SessionManager` is the memory spine of the system.

**Within a session (in-memory):**
- Full message history is accessible to every agent that handles a turn.
- The `activeAgentId` field enables sticky routing — a follow-up message is routed straight back to the same agent without re-invoking the Supervisor.
- All agents used and their task outcomes are recorded in `agentsUsed[]`.

**At session end (persisted to disk):**
- Gemini generates a structured natural-language summary of the conversation.
- The summary is written as a JSON file to `data/session_history/` keyed by `chatId` and timestamp.
- Past summaries can be loaded back to give future sessions long-term context about a user's history.

```
data/
└── session_history/
    └── {chatId}_{timestamp}_{sessionId}.json   ← Gemini-generated summary
```

---

### 3 — Telegram as a Cross-Platform Runtime

Rather than building and maintaining native iOS/Android/web apps, ByteBeingsBot uses **Telegram Mini Apps** as its UI layer for complex interactions.

When an agent needs structured user input (e.g., previewing and approving rows before they are saved to a Notion database), it generates a one-time approval URL and sends it as an inline button. Tapping the button opens a full **Next.js web interface** rendered inside Telegram's built-in browser — no app store, no separate login, no cross-platform code.

```
Bot sends inline button → User taps → Next.js Mini App opens inside Telegram
       ↑                                              ↓
  Approval stored ← ─ ─ ─ ─ ─ ─ ─ ─  User selects rows & confirms
```

This gives the bot a rich, interactive UI on every platform Telegram supports — with a single codebase.

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

> You'll need a public HTTPS URL for the Telegram webhook. Use [ngrok](https://ngrok.com) or a deployment platform for local development.

### 2. Install & Run

```bash
npm install
npm run dev        # Development server (Next.js)
```

### 3. Register the Webhook

Once your server is running and publicly accessible, register the webhook with Telegram:

```
POST https://api.telegram.org/bot<TOKEN>/setWebhook
Body: { "url": "https://<your-url>/api/webhook/telegram" }
```

### 4. Run Unit Tests

```bash
npm run test
```

---

## 🔌 Registering a New Agent

Extending the bot with a new specialist takes **three steps** and touches only two files.

### Step 1 — Create the Agent Class

```typescript
// agents/my-custom-agent/index.ts
import { BaseAgent } from '../base';
import { AgentManifest, AgentTool } from '../../lib/types';
import { Type } from '@google/genai';

export class MyCustomAgent extends BaseAgent {
  manifest: AgentManifest = {
    id: 'custom_agent',
    name: 'My Custom Agent',
    description: 'What your agent does, in one or two sentences.',
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
        // Your backend logic here
        return { result: 'Success' };
      },
    },
  ];

  getSystemPrompt(): string {
    return 'Role, personality, instructions, and safety constraints for your agent.';
  }
}
```

### Step 2 — Register the Agent

```typescript
// agents/index.ts
import { MyCustomAgent } from './my-custom-agent';

export function registerAllAgents(): void {
  if (agentRegistry.getAllAgentIds().length > 0) return;

  agentRegistry.register(new NotionAgent());
  agentRegistry.register(new MyCustomAgent()); // ← Add this line
}
```

### Step 3 — Done

The **SupervisorAgent** reads the new manifest at startup. Routing instructions, the `/agents` command output, and the system prompt all update automatically. No other changes are needed.

---

## 🗂 Project Structure

```
ByteBeingsBot/
├── agents/
│   ├── base.ts              # BaseAgent abstract class
│   ├── index.ts             # Agent registry bootstrapper
│   ├── supervisor/          # SupervisorAgent (router)
│   ├── notion/              # Notion database agent
│   ├── save-later/          # Link saving agent
│   ├── nutrition/           # Meal & macro tracking agent
│   ├── summarizer/          # Content summarization agent
│   └── calendar/            # 🚧 Google Calendar agent (WIP)
├── lib/
│   ├── session.ts           # SessionManager — memory + persistence
│   ├── registry.ts          # Agent registry
│   ├── types.ts             # Shared TypeScript types
│   ├── gemini.ts            # Gemini SDK client
│   ├── notion.ts            # Notion API client
│   └── telegram.ts          # Telegram/Telegraf helpers
├── app/
│   └── api/
│       └── webhook/         # Next.js API route for Telegram webhook
├── data/
│   └── session_history/     # Persisted session summaries (JSON)
└── __tests__/               # Unit tests (Vitest)
```

---

<div align="center">
  <sub>Built with ❤️ by <a href="https://ByteBeings.com">ByteBeings</a></sub>
</div>
