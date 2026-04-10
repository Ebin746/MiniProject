# 🗄️ `src/lib/` — Server-Side Utilities

The `lib` folder contains shared server-side utilities used by the API routes. These are not specific to any single route — they provide reusable infrastructure like database connectivity, authentication, session tracking, and chat memory processing.

---

## Directory Structure

```
src/lib/
├── auth.ts              # JWT creation and verification
├── mongodb.ts           # MongoDB connection singleton
├── session-manager.ts   # Per-user in-memory session state
├── chat-memory.ts       # Stage transition logic + reply extraction
│
└── embeddings/
    ├── embeddings.ts           # Google text-embedding model wrapper
    └── policyVectorStore.ts    # RAG: store + search policy documents
```

---

## Dependency Map

```mermaid
graph TD
    ChatRoute["/api/chat"]
    AuthRoute["/api/auth/*"]
    PolicyRoute["/api/policy"]

    AuthLib["auth.ts\n(JWT sign/verify)"]
    MongoDB["mongodb.ts\n(DB singleton)"]
    Session["session-manager.ts\n(per-user stage + threadId)"]
    ChatMem["chat-memory.ts\n(stage transitions)"]
    Embeddings["embeddings/embeddings.ts\n(Google embedding)"]
    VectorStore["embeddings/policyVectorStore.ts\n(RAG store + search)"]

    ChatRoute --> AuthLib
    ChatRoute --> Session
    ChatRoute --> ChatMem
    AuthRoute --> AuthLib
    AuthRoute --> MongoDB
    PolicyRoute --> VectorStore
    VectorStore --> Embeddings
    VectorStore --> MongoDB
    Session --> MongoDB
    ChatMem --> Session
```

---

## `mongodb.ts` — Database Connection Singleton

A **connection singleton** that creates and caches a single Mongoose connection to MongoDB Atlas. All models and API routes import from here to avoid creating multiple connections per serverless invocation.

```typescript
import dbConnect from '@/lib/mongodb';
await dbConnect(); // idempotent — safe to call multiple times
```

**Why a singleton?**

Next.js runs in a serverless/edge environment where each request may spin up a new module context. Without caching, each request would open a new MongoDB connection, quickly exhausting Atlas's connection pool limit.

```mermaid
sequenceDiagram
    participant Route as API Route
    participant dbConnect as dbConnect()
    participant Cache as Module-level cache
    participant MongoDB as MongoDB Atlas

    Route->>dbConnect: await dbConnect()
    dbConnect->>Cache: Check cached.conn
    alt Already connected
        Cache-->>dbConnect: Return existing connection
        dbConnect-->>Route: ✅ Connected (no-op)
    else Not connected
        dbConnect->>MongoDB: mongoose.connect(MONGODB_URI)
        MongoDB-->>dbConnect: Connection established
        dbConnect->>Cache: Store connection
        dbConnect-->>Route: ✅ Connected
    end
```

---

## `auth.ts` — JWT Authentication Utilities

Provides two core functions for JWT-based stateless authentication.

| Function | Input | Output | Description |
|---|---|---|---|
| `signToken(payload)` | `{ userId, email }` | JWT string | Signs token with `JWT_SECRET`, 7-day expiry |
| `verifyToken(token)` | JWT string | `{ userId, email }` | Verifies and decodes; throws on invalid/expired |

**JWT Lifecycle:**

```mermaid
sequenceDiagram
    participant Client
    participant AuthAPI as /api/auth
    participant ChatAPI as /api/chat

    Client->>AuthAPI: POST credentials
    AuthAPI->>AuthAPI: signToken({ userId })
    AuthAPI-->>Client: Set-Cookie: auth=<JWT> (httpOnly)

    Client->>ChatAPI: POST message + Cookie
    ChatAPI->>ChatAPI: verifyToken(cookie)
    alt Token valid
        ChatAPI->>ChatAPI: Extract userId, proceed
    else Token invalid/expired
        ChatAPI-->>Client: 401 Unauthorized
    end
```

---

## `session-manager.ts` — Per-User Session State

Manages an **in-memory server session** per authenticated user. The session stores the current pipeline stage and the Mastra memory thread ID.

### Session Object

| Field | Type | Description |
|---|---|---|
| `stage` | `string` | Current pipeline stage (`sales`, `kyc`, `credit`, `loan_selection`, `done`) |
| `threadId` | `string` | Mastra LibSQL thread ID — links this session to the AI's memory |

### Session Lifecycle

```mermaid
flowchart TD
    FirstRequest["First request from user"]
    CheckCache{"Session in\nMemory Cache?"}
    CreateSession["Create new session\nstage = 'sales'\nthreadId = uuid()"]
    ReturnSession["Return existing session"]
    UpdateStage["Stage updated by\nchat-memory.ts"]
    SessionLost["Session lost on\nserver restart\n(by design for prototype)"]

    FirstRequest --> CheckCache
    CheckCache -->|No| CreateSession
    CheckCache -->|Yes| ReturnSession
    CreateSession --> ReturnSession
    ReturnSession --> UpdateStage
    UpdateStage -->|Next request| CheckCache
    ReturnSession -.->|Server restarted| SessionLost
```

> **Note**: Sessions are keyed by user ID (from the JWT). Because this is in-memory, sessions reset on server restart — this is intentional for a prototype context. In production, sessions would be persisted in Redis or MongoDB.

---

## `chat-memory.ts` — Stage Transition Logic

Contains two critical functions used directly by `/api/chat`.

### `processToolResults(session, toolResults)`

The **state machine controller**. Inspects the list of tools that fired during an agent turn and advances the session stage accordingly.

```mermaid
stateDiagram-v2
    [*] --> sales : New session
    sales --> kyc : updateProfile called
    kyc --> credit : verifyKYC → pass
    kyc --> done : verifyKYC → fail
    credit --> credit : getCreditScore (score ≥ 600)
    credit --> done : getCreditScore (score < 600)
    credit --> loan_selection : calculateFOIR ≤ 50%
    credit --> done : calculateFOIR > 50%
    loan_selection --> done : generateLoanPDF called
    done --> [*] : Conversation ended
```

**Stage Transition Table:**

| Tool Result | Old Stage | New Stage |
|---|---|---|
| `updateProfile` called | `sales` | `kyc` |
| `verifyKYC` → pass | `kyc` | `credit` |
| `verifyKYC` → fail | `kyc` | `done` |
| `getCreditScore` → score < 600 | `credit` | `done` |
| `calculateFOIR` → eligible (≤ 50%) | `credit` | `loan_selection` |
| `calculateFOIR` → ineligible (> 50%) | `credit` | `done` |
| `generateLoanPDF` called | `loan_selection` | `done` |
| `getAvailableLoans` called | `loan_selection` | `loan_selection` (no change) |

---

### `resolveReply(result)`

Extracts the final user-facing text from the Mastra agent result object, handling multiple response formats:

```mermaid
flowchart TD
    Result["Mastra agent.generate() result"]
    HasText{"Has result.text?"}
    IsToolResult{"Has toolResults?"}
    ExtractExplanation["Use last tool's\nresult.explanation\nor result.message"]
    UseText["Use result.text"]
    Fallback["Return fallback:\n'I've processed your request.'"]

    Result --> HasText
    HasText -->|Yes| UseText
    HasText -->|No| IsToolResult
    IsToolResult -->|Yes| ExtractExplanation
    IsToolResult -->|No| Fallback
```

---

## `embeddings/` Sub-Folder

See [lib.md embeddings section](#embeddings-sub-folder) and the dedicated [mastra.md → RAG section](./mastra.md) for vector store details.

### `embeddings.ts` — Google Text Embedding Wrapper

```typescript
generateEmbedding(text: string): Promise<number[]>
```

- Uses the Google `text-embedding-004` model (768 dimensions)
- Wraps the Google AI SDK for consistent error handling
- Used both during **indexing** (when PDF is uploaded) and **querying** (when user asks a policy question)

### `policyVectorStore.ts` — Store & Search

**Store function** (`storePolicyDocument`):

```mermaid
flowchart LR
    PDF["PDF full text"]
    Delete["Delete old chunks\nfor filename"]
    Split["Split into chunks\n500 chars, 100 overlap"]
    Embed["generateEmbedding()\nfor each chunk"]
    Save["PolicyDocument.create()\n{ filename, chunkIndex, text, embedding }"]

    PDF --> Delete --> Split --> Embed --> Save
```

**Search function** (`searchPolicyContext`):

```mermaid
flowchart LR
    Query["User query string\ne.g. 'interest rate?'"]
    Embed["generateEmbedding(query)\n→ 768-dim vector"]
    Vector["$vectorSearch\nagainst vector_index_1"]
    TopK["Top 4 chunks\nby cosine similarity"]
    Agent["Agent composes\n1-2 line answer"]

    Query --> Embed --> Vector --> TopK --> Agent
```

**Fallback behavior:** If the Atlas vector index is unavailable (e.g., not yet built), `searchPolicyContext` falls back to returning the most recently uploaded chunks ordered by `uploadedAt` descending.
