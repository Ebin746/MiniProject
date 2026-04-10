# loanCopilot — Project Overview

loanCopilot is an AI-powered loanCopilot built with **Next.js (App Router)** and the **Mastra AI agent framework**. Users can sign up, chat with an intelligent agent ("Aria"), and be guided through a fully automated loan application flow — from identity verification to loan PDF generation.

---

## Tech Stack

| Layer        | Technology                             |
|--------------|----------------------------------------|
| Frontend     | Next.js 15, React, Tailwind CSS        |
| Backend      | Next.js API Routes (Edge-compatible)   |
| AI Agent     | Mastra (`@mastra/core`), Google Gemini |
| Database     | MongoDB Atlas (via Mongoose)           |
| Vector Search| MongoDB Atlas Vector Search + embeddings |
| Auth         | JWT stored in HTTP-only cookies        |

---

## High-Level Project Flow

```
User (Browser)
    │
    ▼
┌───────────────────────────────────────────┐
│            Next.js Frontend               │
│  Landing Page → Login/Signup → Chat UI   │
└──────────────┬────────────────────────────┘
               │  HTTP API calls
               ▼
┌───────────────────────────────────────────┐
│          Next.js API Routes               │
│  /api/auth  /api/chat  /api/ocr           │
│  /api/policy  /api/test                   │
└──────────────┬────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────┐
│            Mastra Master Agent                 │
│  Stage-aware prompt + 7 pluggable tools        │
│  Memory: Mastra LibSQL working memory          │
└──────┬─────────────────────────────────────────┘
       │  reads/writes
       ▼
┌──────────────────────────────┐    ┌──────────────────────────────┐
│        MongoDB Atlas          │    │   MongoDB Vector Store        │
│  Users, Loans, KYC, Credits  │    │  Policy document chunks +     │
│  PolicyDocuments              │    │  vector_index_1               │
└──────────────────────────────┘    └──────────────────────────────┘
```

---

## Loan Application Pipeline (6 Stages)

The agent advances the user through these stages automatically based on tool results:

```
sales → kyc → credit → loan_selection → docs → done
```

| Stage           | What Happens                                                        |
|-----------------|---------------------------------------------------------------------|
| `sales`         | Collect name + monthly income; call `updateProfile`                 |
| `kyc`           | Collect Aadhaar + DOB; call `verifyKYC` (pass/fail gate)           |
| `credit`        | Run `getCreditScore` (PAN) → `calculateFOIR` (pass/fail gate)      |
| `loan_selection`| Call `getAvailableLoans`, user picks one, generate PDF              |
| `docs`          | Confirmation / graceful close                                        |
| `done`          | Warm close message; only `searchLoanPolicy` allowed                 |

Stage transitions are managed by **`src/lib/chat-memory.ts`** based on tool results returned by the agent.

---

## Folder Map

| Folder                     | Purpose                                     |
|----------------------------|---------------------------------------------|
| `src/app/`                 | All Next.js pages and API routes            |
| `src/app/api/`             | REST API endpoints (auth, chat, OCR, policy)|
| `src/mastra/`              | AI agent configuration (agent, tools, prompts, memory) |
| `src/mastra/agents/`       | Master agent definition                     |
| `src/mastra/tools/`        | 7 agent-callable tools                      |
| `src/mastra/prompts/`      | Stage-aware system prompt                   |
| `src/mastra/memory/`       | Mastra memory/thread config                 |
| `src/lib/`                 | Server utilities (DB, auth, session, memory)|
| `src/lib/embeddings/`      | RAG vector store for policy search          |
| `src/models/`              | Mongoose schemas (User, Loan, KYC, Credit, PolicyDocument) |
| `test/`                    | Manual/automated test scenarios             |
| `public/`                  | Static assets (SVG icons)                   |
| `docs/`                    | This documentation                          |

---

## Key Design Decisions

- **Stage machine in memory, not DB**: The active stage lives in the server-side session (`src/lib/session-manager.ts`) and is promoted by `processToolResults()` after each agent turn, keeping latency low.
- **Single agent, many tools**: One `masterAgent` is reused across all stages; the active stage changes only the system prompt, avoiding multiple agent classes.
- **RAG for policy QA**: Policy PDF documents are chunked and stored as embeddings in MongoDB Atlas. `searchLoanPolicy` runs a `$vectorSearch` aggregation to answer user questions at any stage.
