# `src/lib/` — Server-Side Utilities

The `lib` folder contains shared server-side utilities used by the API routes. These are not specific to any single route — they provide reusable infrastructure like database connectivity, authentication, session tracking, and chat memory processing.

---

## Directory Structure

```
src/lib/
├── auth.ts             # JWT creation and verification
├── mongodb.ts          # MongoDB connection singleton
├── session-manager.ts  # Per-user session state (stage, threadId)
├── chat-memory.ts      # Stage transition logic + reply extraction
│
└── embeddings/
    ├── embeddings.ts           # Embedding model wrapper
    └── policyVectorStore.ts    # RAG: store + search policy documents
```

---

## Files

### `mongodb.ts` — Database Connection
A **singleton** that creates and caches a single Mongoose connection to MongoDB Atlas. All models and API routes import from here to avoid creating multiple connections per serverless invocation.

```ts
import dbConnect from '@/lib/mongodb';
await dbConnect(); // idempotent — safe to call multiple times
```

---

### `auth.ts` — JWT Authentication
Utilities for:
- `signToken(payload)` — Signs a JWT with the app secret and an expiry.
- `verifyToken(token)` — Verifies and decodes a JWT; throws if invalid.

Used by `/api/auth` to issue tokens, and by `/api/chat` to guard routes.

---

### `session-manager.ts` — Session State
Manages an **in-memory server session** per authenticated user. The session stores:

| Field       | Type     | Description                                 |
|-------------|----------|---------------------------------------------|
| `stage`     | `string` | Current pipeline stage (`sales`, `kyc`, etc.) |
| `threadId`  | `string` | Mastra memory thread ID for this user session |

Sessions are keyed by user ID (from the JWT). Because this is in-memory, sessions reset on server restart — this is intentional for a prototype context.

---

### `chat-memory.ts` — Stage Transition Logic
Contains two functions used directly by `/api/chat`:

#### `processToolResults(session, toolResults)`
Inspects the list of tools that fired during an agent turn and advances the session `stage` accordingly. This is the **state machine** controller.

| Tool Result              | Stage Transition                                       |
|--------------------------|--------------------------------------------------------|
| `updateProfile` called   | `sales` → `kyc`                                       |
| `verifyKYC` → pass       | `kyc` → `credit`                                      |
| `verifyKYC` → fail       | `kyc` → `done`                                        |
| `getCreditScore` → low   | any → `done`                                           |
| `calculateFOIR` → eligible | `credit` → `loan_selection`                         |
| `getAvailableLoans`      | stays at `loan_selection`                              |
| `generateLoanPDF` → PDF  | any → `done`                                           |

#### `resolveReply(result)`
Extracts the final user-facing text from the Mastra agent result object. Handles cases where the agent responded with:
- A plain `text` property.
- A tool result (returns the last tool's `result.explanation` or `result.message`).
- Falls back to `"I've processed your request."` if nothing else.

---

## Sub-Folder

| Folder       | Documentation |
|--------------|---------------|
| `embeddings/` | [embeddings/docs/README.md](embeddings/docs/README.md) |
