# `src/mastra/memory/` — Agent Memory Configuration

This folder configures the **persistent working memory** that the Mastra agent uses to remember conversation history and user data across chat turns.

---

## `index.ts`

Exports the `memory` object that is passed directly to the `Agent` constructor in `agents/master.ts`.

Mastra's memory uses **LibSQL** (SQLite-compatible) to persist:
- **Thread history** — full message history tied to a `threadId`.
- **Working memory** — a structured key-value store that the agent can read/write within a thread (e.g., storing `name`, `income`, `pan`, `creditScore`, `selectedLoan`).

Each user session is assigned a unique `threadId` (stored in the server-side session via `src/lib/session-manager.ts`). This `threadId` is passed to `agent.generate()` on every turn, allowing Mastra to load the correct context.

---

## Relationship to Session

```
User Session (src/lib/session-manager.ts)
  ├─ stage: "kyc"                    ← Stage machine (app logic)
  └─ threadId: "abc-123"             ← Mastra memory thread ID

Mastra LibSQL Memory (threadId = "abc-123")
  ├─ message history: [...]          ← Full chat log
  └─ working memory: { name, pan, income, ... }  ← User data
```

The **session** manages the stage state (application logic), while **Mastra memory** manages the conversational state (what the AI remembers). These are deliberately separate.

---

## Why Persistent Memory?

Without persistent memory, the agent would forget everything the user said in previous messages within the same conversation. Using LibSQL threads means the agent can recall that the user's name is "Rahul" and income is ₹50,000 even when generating the PDF at the very end of the pipeline — without the frontend ever having to re-send that data.
