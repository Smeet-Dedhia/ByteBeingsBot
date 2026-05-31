# Telegram AI Workflow Operator — MVP Build Plan

## Goal
Build a minimal but expandable AI workflow orchestration system using:
- Telegram as the interface
- Gemini Flash Lite as the LLM
- LangGraph.js for orchestration
- Langfuse for observability
- Notion for workflow actions

Core philosophy:
- Minimal code
- Maximum extensibility
- Reuse existing infrastructure
- Focus on operational workflows
- Ship fast

---

# Final MVP User Experience

User opens Telegram bot.

User selects workflow:
- Meeting Tasks
- PRD Generator
- Grocery List
- Add to Sprint

User sends text or voice note.

Bot:
1. Processes input
2. Runs workflow graph
3. Extracts structured output
4. Asks clarification if confidence is low
5. Shows human approval step
6. Pushes approved output to Notion
7. Logs traces and token usage

---

# Tech Stack

## Core
- Next.js (App Router)
- TypeScript
- Node.js

## Telegram
- Telegraf.js

## AI
- Gemini 2.0 Flash Lite API

## Agent Orchestration
- LangGraph.js

## Observability
- Langfuse

## Integrations
- Notion API

## Deployment
- Vercel

---

# High-Level Architecture

```txt
Telegram
    ↓
Telegraf Webhook
    ↓
Workflow Router
    ↓
LangGraph Executor
    ↓
Gemini Flash Lite
    ↓
Human Approval Layer
    ↓
Notion Actions
    ↓
Langfuse Logging
```

---

# Folder Structure

```txt
/app
  /api
    /telegram
      route.ts

/lib
  telegram.ts
  workflows.ts
  prompts.ts
  notion.ts
  gemini.ts
  langfuse.ts
  graph.ts
  types.ts

/workflows
  meeting.ts
  prd.ts
  groceries.ts
```

---

# PHASE 1 — Telegram Connector + Basic Workflow

## Goal
Get end-to-end Telegram → AI → Telegram working.

## Deliverables
- Telegram bot receives text
- Workflow selector buttons
- Workflow router
- Gemini API call
- Structured JSON response
- Telegram formatted reply

## Features
### Telegram Inline Keyboard

```txt
Choose Workflow:

[ Meeting Tasks ]
[ PRD Generator ]
[ Grocery List ]
```

---

## Workflow Routing

Simple mapping:

```ts
const workflows = {
  meeting: meetingWorkflow,
  prd: prdWorkflow,
  groceries: groceryWorkflow,
}
```

---

## Minimal State

Store in-memory only:

```ts
userSession = {
  selectedWorkflow,
  pendingApproval,
}
```

No DB yet.

---

## Gemini Output Format

Use schema-in-prompt approach.

Example:

```json
{
  "summary": "",
  "tasks": [
    {
      "task": "",
      "owner": "",
      "priority": "",
      "deadline": ""
    }
  ],
  "confidence": 0.91
}
```

---

## Telegram Response Format

```txt
🧠 Workflow: Meeting Tasks

Summary:
Launch planning discussion.

Tasks:
1. Sarah → Landing Page → High Priority
2. Mike → Review Ad Copy → Medium Priority

Confidence: 91%

[Approve]
[Retry]
```

---

# PHASE 2 — LangGraph Orchestration

## Goal
Introduce reusable workflow execution graph.

## Important Constraint
DO NOT build arbitrary dynamic graph builders.

Build ONE reusable graph template.

---

## Graph Structure

```txt
Input
  ↓
Preprocess
  ↓
Classification
  ↓
Extraction
  ↓
Confidence Check
  ↓
Human Review
  ↓
Action Execution
```

---

## LangGraph State

```ts
interface WorkflowState {
  workflowType: string
  rawInput: string
  extractedData: any
  confidence: number
  requiresReview: boolean
  approved: boolean
}
```

---

## Required Nodes

### preprocessNode
- clean text
- normalize transcript

### extractNode
- call Gemini
- parse JSON

### confidenceNode
- determine if human review required

### approvalNode
- send Telegram approval buttons

### actionNode
- push to Notion

---

# PHASE 3 — Human In The Loop

## Goal
Add AI uncertainty handling.

---

## Trigger Conditions

```ts
if confidence < 0.75
```

OR:

```ts
if missingOwner
```

---

## Example Clarification

```txt
I could not identify task ownership.

Who owns:
"Finalize launch assets"

[Sarah]
[Mike]
[Custom Reply]
```

---

## Approval Step

```txt
Approve pushing these tasks to Notion?

[Approve]
[Edit]
[Reject]
```

---

# PHASE 4 — Notion Integration

## Goal
Persist approved actions.

---

## Minimal Setup

Single Notion database:

Columns:
- Task
- Owner
- Priority
- Deadline
- Workflow
- Status

---

## Minimal Actions

### Meeting Workflow
- create tasks

### Grocery Workflow
- append grocery item

### PRD Workflow
- create PRD page

---

## IMPORTANT
Do NOT implement:
- sync
- updates
- querying
- auth UI
- multiple workspaces

Only:

```txt
Create database entries
```

---

# PHASE 5 — Observability + Prompt Management

## Goal
Add traces and logs.

---

## Use Langfuse

Track:
- prompts
- traces
- token usage
- latency
- workflow runs
- errors
- approval events

---

## Prompt Organization

```ts
export const prompts = {
  meeting: "...",
  prd: "...",
  groceries: "..."
}
```

---

## Prompt Versioning

All prompts should:
- have stable IDs
- be easy to swap
- remain workflow-specific

---

# PHASE 6 — Audio Input (Optional)

## Goal
Support voice notes.

---

## Flow

```txt
Telegram Voice Note
    ↓
Download Audio
    ↓
Gemini Transcription
    ↓
Workflow Pipeline
```

---

## Important
Skip:
- speaker diarization
- advanced audio cleanup
- realtime streaming

Simple transcription only.

---

# NON-GOALS

DO NOT BUILD:

- Autonomous agents
- Multi-agent debates
- Memory systems
- Vector DBs
- RAG pipelines
- Browser agents
- Visual graph editors
- Auth systems
- Workflow DSLs
- Background workers
- Realtime sockets
- Custom observability systems
- Databases beyond Notion

---

# Core Design Philosophy

The system should feel:
- operational
- agentic
- extensible
- workflow-native
- human-supervised

But implementation should remain:
- lightweight
- deterministic
- prompt-driven
- easy to debug

---

# Final MVP Scope

The MVP is successful if:

1. Telegram bot works
2. User selects workflow
3. User sends text
4. Gemini extracts structured data
5. Human approves output
6. Result gets pushed to Notion
7. Langfuse logs traces

That alone is sufficient.

---

# Future Expansion Ideas

## Additional Workflows
- CRM updates
- Customer support triage
- Social content generation
- Expense tracking
- Sprint planning
- Recruiting workflows

## Additional Integrations
- Slack
- Google Calendar
- Gmail
- Airtable
- Linear
- Jira

## Additional Features
- Workflow chaining
- Scheduled workflows
- Retrieval memory
- Team approvals
- Analytics dashboard

These should remain future enhancements only.
