# 🤖 `src/mastra/` — AI Agent Layer

This folder contains everything related to the **Mastra AI agent framework**. It is the brain of the application, responsible for natural language conversation, tool execution, and persistent memory management across conversation turns.

---

## Directory Structure

```
src/mastra/
├── llms.ts               # LLM model configuration (Google Gemini)
│
├── agents/
│   └── master.ts         # The single Master Agent factory function
│
├── prompts/
│   └── master.ts         # Stage-aware system prompt builder
│
├── tools/
│   ├── index.ts          # Barrel export for all tools
│   ├── calculateFOIR.ts
│   ├── generateLoanPDF.ts
│   ├── getAvailableLoans.ts
│   ├── getCreditScore.ts
│   ├── searchLoanPolicy.ts
│   ├── updateProfile.ts
│   └── verifyKYC.ts
│
└── memory/
    └── index.ts          # Mastra LibSQL memory/thread configuration
```

---

## Mastra Framework Overview

**Mastra** (`@mastra/core`) is an agentic AI framework for TypeScript. It provides:

- **Agent abstraction** — wraps LLM calls with tool registration and multi-step reasoning
- **Working memory** — persistent thread-based memory using LibSQL (SQLite-compatible)
- **Tool system** — Zod-validated, typed tool definitions that the LLM can call
- **Multi-step execution** — the agent can call multiple tools in a single turn (`maxSteps: 7`)

---

## Component Architecture

```mermaid
graph TD
    ChatAPI["/api/chat Route Handler"]
    AgentFactory["masterAgent(stage)\nfactory function"]
    LLM["Google Gemini LLM\n(via llms.ts)"]
    Prompt["MasterAgentPrompt(stage)\n(via prompts/master.ts)"]
    Memory["LibSQL Memory\n(via memory/index.ts)"]
    Tools["7 Tools\n(via tools/index.ts)"]
    MongoDB["MongoDB Atlas\n(tool targets)"]

    ChatAPI --> AgentFactory
    AgentFactory --> LLM
    AgentFactory --> Prompt
    AgentFactory --> Memory
    AgentFactory --> Tools
    Tools --> MongoDB

    style AgentFactory fill:#6366f1,color:#fff
    style LLM fill:#8b5cf6,color:#fff
```

---

## How a Single Chat Turn Works

```mermaid
sequenceDiagram
    participant ChatRoute as /api/chat
    participant Agent as masterAgent(stage)
    participant LLM as Google Gemini
    participant Memory as LibSQL Thread
    participant Tool as Tool (e.g. verifyKYC)
    participant DB as MongoDB

    ChatRoute->>Agent: agent.generate(message, { threadId })
    Agent->>Memory: Load thread history
    Memory-->>Agent: Previous messages + working memory
    Agent->>LLM: System prompt + history + new message
    LLM-->>Agent: Decide: call verifyKYC(aadhaar, dob)?
    Agent->>Tool: Execute verifyKYC({ aadhaar, dob })
    Tool->>DB: KYC.findOne({ aadhaar, dob })
    DB-->>Tool: { found: true } or { found: false }
    Tool-->>Agent: { kycPassed: true, message: "KYC verified" }
    Agent->>LLM: Tool result → compose final reply
    LLM-->>Agent: "Great! Your identity has been verified..."
    Agent->>Memory: Append turn to thread history
    Agent-->>ChatRoute: { text, toolResults }
    ChatRoute->>ChatRoute: processToolResults() → kyc → credit
```

---

## `llms.ts` — LLM Configuration

Defines and exports the LLM model instance(s) used by the agent.

| Export | Model | Provider | Purpose |
|---|---|---|---|
| `PRIMARY_MODEL` | `gemini-1.5-flash` | Google Gemini | Main reasoning model for the agent |

The model is configured with appropriate parameters for the loanCopilot use case:
- `temperature: 0.5` — Balanced between creativity and consistency
- `maxTokens: 600` — Keeps responses concise (enforced in prompts too)

---

## Sub-Folder Documentation

| Folder | Documentation |
|---|---|
| `agents/` | [agents.md](./agents.md) |
| `tools/` | [tools.md](./tools.md) |
| `prompts/` | [prompts.md](./prompts.md) |
| `memory/` | [memory.md](./memory.md) |

---

## Full Mastra Layer Data Flow

```mermaid
flowchart TD
    subgraph "Mastra Layer (src/mastra/)"
        AgentFactory["masterAgent(stage)"]
        LLM["Google Gemini LLM\nllms.ts"]
        PromptBuilder["MasterAgentPrompt(stage)\nprompts/master.ts"]
        MemoryConfig["memory\nmemory/index.ts"]
        ToolSet["7 Tools\ntools/"]
    end

    subgraph "External"
        DB["MongoDB Atlas"]
        LibSQL["LibSQL Storage\n(local SQLite)"]
        GoogleAI["Google AI API\n(LLM + Embeddings)"]
    end

    subgraph "Calling Layer"
        ChatRoute["/api/chat"]
        Session["session-manager.ts"]
    end

    ChatRoute --> AgentFactory
    ChatRoute --> Session
    AgentFactory --> LLM
    AgentFactory --> PromptBuilder
    AgentFactory --> MemoryConfig
    AgentFactory --> ToolSet
    LLM --> GoogleAI
    MemoryConfig --> LibSQL
    ToolSet --> DB
```

---

## Why a Single Agent?

One `masterAgent` is used across all six pipeline stages rather than separate agents per stage. This design choice:

- **Simplifies maintenance** — one agent class to update, not six
- **Ensures personality consistency** — Aria's tone and style are the same throughout
- **Reduces complexity** — stage-specific behaviour is encoded only in the system prompt via `STAGE_INSTRUCTIONS`
- **Enables cross-stage tools** — `searchLoanPolicy` works at any stage without routing logic
