# `src/mastra/` — AI Agent Layer

This folder contains everything related to the **Mastra AI agent framework**. It is the brain of the application, responsible for natural language conversation, tool execution, and memory management.

---

## Directory Structure

```
src/mastra/
├── llms.ts             # LLM model configuration (Google Gemini)
│
├── agents/
│   └── master.ts       # The single Master Agent definition
│
├── prompts/
│   └── master.ts       # Stage-aware system prompt builder
│
├── tools/
│   ├── index.ts        # Barrel export for all tools
│   ├── calculateFOIR.ts
│   ├── generateLoanPDF.ts
│   ├── getAvailableLoans.ts
│   ├── getCreditScore.ts
│   ├── searchLoanPolicy.ts
│   ├── updateProfile.ts
│   └── verifyKYC.ts
│
└── memory/
    └── index.ts        # Mastra memory/thread configuration
```

---

## How It Works

The Mastra layer exposes a single `masterAgent(stage)` factory. Each chat turn:

1. The **`/api/chat`** route calls `masterAgent(currentStage)` to get a stage-configured agent instance.
2. The agent receives the user message + the full Mastra **working memory thread** (via `threadId`).
3. Mastra automatically decides which tools to call (up to `maxSteps: 7`).
4. Tool results are returned to the agent for reasoning, and finally a text reply is produced.
5. The `processToolResults()` utility then inspects those results to advance the session stage.

---

## Sub-Folder Docs

| Folder          | Documentation                                 |
|-----------------|-----------------------------------------------|
| `agents/`        | [agents/docs/README.md](agents/docs/README.md) |
| `tools/`         | [tools/docs/README.md](tools/docs/README.md)   |
| `prompts/`       | [prompts/docs/README.md](prompts/docs/README.md)|
| `memory/`        | [memory/docs/README.md](memory/docs/README.md) |
