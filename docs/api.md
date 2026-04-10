# 🔌 `src/app/api/` — Backend API Routes

All backend logic is fulfilled by **Next.js Route Handlers** (the App Router equivalent of `pages/api/`). Each sub-folder maps to a URL path under `/api/`. These are server-side functions that run in Node.js and connect to MongoDB, Mastra, and external services.

---

## Routes Overview

| Route | Method | Auth Required | Purpose |
|---|---|---|---|
| `/api/auth/signup` | POST | No | Create a new user account |
| `/api/auth/login` | POST | No | Authenticate and issue JWT |
| `/api/auth/logout` | POST | No | Clear the auth cookie |
| `/api/chat` | POST | ✅ Yes | Send a message to the Mastra agent |
| `/api/ocr` | POST | ✅ Yes | Extract text from uploaded documents |
| `/api/policy` | POST | ✅ Yes | Upload policy PDF and vectorize it |
| `/api/test` | GET/POST | No | Internal testing endpoint |

---

## API Architecture Overview

```mermaid
graph TD
    Client["🌐 Client Browser"]
    Auth["/api/auth/\n(signup · login · logout)"]
    Chat["/api/chat\n(agent invocation)"]
    OCR["/api/ocr\n(document extraction)"]
    Policy["/api/policy\n(PDF vectorization)"]
    Test["/api/test\n(internal)"]

    Mastra["🤖 Mastra Agent\n(masterAgent)"]
    MongoDB["🗄️ MongoDB Atlas"]
    VectorDB["📊 Vector Store\n(PolicyDocuments)"]
    Tesseract["🔍 Tesseract.js\n(OCR)"]

    Client --> Auth --> MongoDB
    Client --> Chat --> Mastra --> MongoDB
    Client --> OCR --> Tesseract
    Client --> Policy --> VectorDB
    Client --> Test --> MongoDB

    style Chat fill:#6366f1,color:#fff
    style Mastra fill:#8b5cf6,color:#fff
```

---

## `/api/auth/` — Authentication

Handles all authentication operations. Uses `bcryptjs` for password hashing and `jsonwebtoken` for JWT management.

### Signup Flow

```mermaid
sequenceDiagram
    participant Client
    participant Signup as /api/auth/signup
    participant DB as MongoDB (User)

    Client->>Signup: POST { name, email, password }
    Signup->>DB: User.findOne({ email })
    DB-->>Signup: null (user doesn't exist)
    Signup->>Signup: bcrypt.hash(password, 10)
    Signup->>DB: User.create({ name, email, hashedPassword })
    DB-->>Signup: User document
    Signup->>Signup: signToken({ userId, email })
    Signup-->>Client: Set-Cookie: auth_token=JWT (HTTP-only)\n200 OK { message: "Registered" }
```

### Login Flow

```mermaid
sequenceDiagram
    participant Client
    participant Login as /api/auth/login
    participant DB as MongoDB (User)

    Client->>Login: POST { email, password }
    Login->>DB: User.findOne({ email })
    DB-->>Login: User document (with hashedPassword)
    Login->>Login: user.comparePassword(password)
    alt Password valid
        Login->>Login: signToken({ userId, email })
        Login-->>Client: Set-Cookie: auth_token=JWT (HTTP-only)\n200 OK
    else Password invalid
        Login-->>Client: 401 Unauthorized
    end
```

**Cookie Configuration:**
- `httpOnly: true` — Not accessible from JavaScript (XSS protection)
- `secure: true` — HTTPS only in production
- `sameSite: 'strict'` — CSRF protection

---

## `/api/chat` — Core Chat Handler

The most critical route. Handles a single conversational turn, invoking the Mastra agent.

```mermaid
sequenceDiagram
    participant Client as Client (/chat)
    participant ChatRoute as /api/chat
    participant SessionMgr as session-manager.ts
    participant Agent as masterAgent(stage)
    participant Memory as Mastra LibSQL Memory
    participant DB as MongoDB

    Client->>ChatRoute: POST { message } + JWT cookie
    ChatRoute->>ChatRoute: verifyToken(cookie)
    alt Invalid JWT
        ChatRoute-->>Client: 401 Unauthorized
    end
    ChatRoute->>SessionMgr: getOrCreateSession(userId)
    SessionMgr-->>ChatRoute: { stage, threadId }
    ChatRoute->>Agent: masterAgent(stage)
    Agent->>Memory: Load thread history (threadId)
    Memory-->>Agent: Previous messages + working memory
    Agent->>DB: (Tool calls as needed: getCreditScore, etc.)
    DB-->>Agent: Tool results
    Agent-->>ChatRoute: { text, toolResults }
    ChatRoute->>ChatRoute: processToolResults(session, toolResults)
    Note over ChatRoute: Stage may advance (e.g. sales→kyc)
    ChatRoute->>ChatRoute: resolveReply(result)
    ChatRoute-->>Client: { reply: "...", stage: "kyc" }
```

**Detailed Internal Logic:**

| Step | Code | Description |
|---|---|---|
| 1 | `verifyToken(cookie)` | Reject unauthenticated requests |
| 2 | `getOrCreateSession(userId)` | Get/create in-memory session with `stage` and `threadId` |
| 3 | `masterAgent(stage)` | Instantiate agent with stage-specific system prompt |
| 4 | `agent.generate(message, { threadId, resourceId })` | Mastra handles memory & multi-step tool calling |
| 5 | `processToolResults()` | Inspect tool results to advance stage |
| 6 | `resolveReply()` | Extract user-facing text from Mastra result object |
| 7 | Return `{ reply, stage }` | JSON response to frontend |

---

## `/api/ocr` — Document Text Extraction

Accepts multipart form-data uploads and extracts text from images or PDFs.

```mermaid
flowchart LR
    Upload["📁 File Upload\n(image / PDF)"]
    OCR["Tesseract.js\nOCR Engine"]
    Text["📄 Extracted Text\n(raw string)"]
    Frontend["Frontend\n(/chat page)"]
    NextMsg["Next Chat Message\nEXTRACTED_DOC_DATA: ..."]

    Upload --> OCR --> Text --> Frontend --> NextMsg
```

**Supported formats:** JPEG, PNG, PDF (first page)

**Response:**
```json
{
  "extractedText": "Name: Rahul Kumar\nAadhaar: XXXX XXXX 1234\n..."
}
```

The frontend prepends `EXTRACTED_DOC_DATA: {extractedText}` to the user's next message, so the agent can read it without any extra UI prompts.

---

## `/api/policy` — PDF Vectorization Pipeline

Accepts PDF uploads from admin and processes them into the RAG vector store.

```mermaid
flowchart TD
    A["📥 POST /api/policy\n(multipart, PDF file)"]
    B["Extract full text\nfrom PDF"]
    C["Delete existing chunks\nfor this filename"]
    D["Split text into chunks\n500 chars, 100 overlap"]
    E["For each chunk:\ngenerateEmbedding()"]
    F["PolicyDocument.create\nleft({ filename, chunkIndex, text, embedding })"]
    G["✅ Stored in MongoDB\n(vector_index_1 ready)"]

    A --> B --> C --> D --> E --> F --> G
```

**Chunking Strategy:**

| Parameter | Value | Rationale |
|---|---|---|
| `CHUNK_SIZE` | 500 chars | Semantically focused per chunk |
| `CHUNK_OVERLAP` | 100 chars | Preserves context at boundaries |

---

## `/api/test` — Internal Testing Endpoint

An internal endpoint used to trigger individual test scenarios without going through the full UI.

**Purpose:**
- Inject fake KYC data
- Simulate credit score responses
- Trigger and observe full pipeline runs
- Useful during development and CI

**Usage:**
```bash
# Trigger a passing loan scenario
curl -X POST http://localhost:3000/api/test \
  -H "Content-Type: application/json" \
  -d '{ "scenario": "loanPassing" }'
```

---

## Error Handling Pattern

All routes follow a consistent error structure:

```mermaid
flowchart LR
    Request["Incoming Request"]
    TryCatch["try / catch block"]
    Success["200/201 OK\n{ data }"]
    ClientErr["400/401/422\n{ error: 'message' }"]
    ServerErr["500 Internal Server Error\n{ error: 'Unexpected error' }"]

    Request --> TryCatch
    TryCatch -->|"Logic succeeds"| Success
    TryCatch -->|"Validation fails"| ClientErr
    TryCatch -->|"Unhandled exception"| ServerErr
```
