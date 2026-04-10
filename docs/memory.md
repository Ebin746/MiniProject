# 💾 `src/mastra/memory/` — Agent Memory Configuration

This folder configures the **persistent working memory** that the Mastra agent uses to remember conversation history and user data across multiple chat turns within the same session. Without this, the agent would forget everything the user said the moment the HTTP request ends.

---

## `index.ts`

Exports the `memory` object that is passed directly to the `Agent` constructor in `agents/master.ts`.

```typescript
import { memory } from '@/mastra/memory';
// Passed to masterAgent as: new Agent({ ..., memory })
```

---

## Memory Technology: LibSQL

Mastra's memory uses **LibSQL** (a SQLite-compatible library) to persist:

| Storage Layer | What It Stores |
|---|---|
| **Thread history** | Full chronological message log (user + assistant turns) tied to a `threadId` |
| **Working memory** | Structured key-value data the agent reads/writes within a thread (e.g., `name`, `income`, `pan`, `creditScore`, `selectedLoan`) |

---

## Memory Architecture

```mermaid
graph TD
    subgraph "Server-Side Session (session-manager.ts)"
        Stage["stage: 'kyc'\n(application logic)"]
        ThreadID["threadId: 'abc-123'\n(memory thread link)"]
    end

    subgraph "Mastra LibSQL Memory (threadId = 'abc-123')"
        History["Message History\n[user: 'Hello', assistant: 'Hi!', ...]"]
        WorkingMem["Working Memory\n{ name: 'Rahul', income: 50000,\n  pan: 'ABCDE1234F', creditScore: 720 }"]
    end

    subgraph "Agent Turn"
        Agent["masterAgent.generate()"]
    end

    ThreadID --> History
    ThreadID --> WorkingMem
    Agent --> History
    Agent --> WorkingMem
    Stage -.->|"Prompt selection"| Agent
```

**Key distinction:** The **session** manages the stage state (application/business logic), while **Mastra memory** manages the conversational state (what the AI remembers and can reference). These are deliberately separate concerns.

---

## How Memory Is Used Per Turn

```mermaid
sequenceDiagram
    participant ChatRoute as /api/chat
    participant Agent as masterAgent
    participant LibSQL as LibSQL Storage

    ChatRoute->>Agent: agent.generate("My name is Rahul", { threadId: "abc-123" })
    Agent->>LibSQL: Load thread "abc-123"
    LibSQL-->>Agent: { history: [...prev messages], workingMemory: { income: 50000 } }
    Note over Agent: Agent now knows previous context
    Agent->>LibSQL: Append new user message to thread
    Agent->>Agent: Process with full context
    Agent->>LibSQL: Append assistant reply to thread
    Agent->>LibSQL: Update working memory: { name: "Rahul" }
    Agent-->>ChatRoute: { text: "Nice to meet you, Rahul!" }
```

---

## Why Persistent Thread Memory?

Consider the loan application pipeline:

```mermaid
timeline
    title Conversation Memory Across Stages
    sales: User: "My name is Rahul, income 50000"
         : Agent stores: {name, income}
    kyc: User: "Aadhaar 1234 5678 9012, DOB 1990-01-15"
       : Agent stores: {aadhaar, dob}
    credit: User: "My PAN is ABCDE1234F"
          : Agent stores: {pan}
          : getCreditScore → stores: {creditScore: 720}
    loan_selection: User: "I'll take the Standard Loan"
                  : generateLoanPDF uses ALL stored data
                  : name, income, pan, creditScore, loanChoice
```

Without persistent memory, the agent would have to re-ask for the user's name at every stage. With LibSQL threads, it recalls everything from turn 1 when generating the PDF at turn 20+.

---

## Session ↔ Memory Relationship

```mermaid
flowchart TD
    JWTCookie["JWT Cookie\n(userId)"]
    SessionLookup["session-manager.getOrCreateSession(userId)"]
    Session["{ stage: 'credit',\n  threadId: 'uuid-abc' }"]
    AgentCall["agent.generate(msg, { threadId: 'uuid-abc' })"]
    LibSQLLoad["Load LibSQL thread 'uuid-abc'"]
    FullContext["Full conversation context\n+ working memory"]

    JWTCookie --> SessionLookup --> Session --> AgentCall --> LibSQLLoad --> FullContext
```

- Each user gets **one session object** (in-memory on the server)
- The session contains one **`threadId`** (UUID string)
- The `threadId` maps to one **LibSQL thread** with all history and working memory
- A new session (server restart) creates a new `threadId` → fresh memory (intentional prototype behaviour)

---

## Working Memory Schema (Informal)

The agent writes and reads these keys in working memory throughout the pipeline:

| Key | Populated At Stage | Description |
|---|---|---|
| `name` | `sales` | User's full name |
| `income` | `sales` | Monthly income (₹) |
| `aadhaar` | `kyc` | 12-digit Aadhaar number |
| `dob` | `kyc` | Date of birth |
| `pan` | `credit` | PAN card number |
| `creditScore` | `credit` | Fetched credit score (0–900) |
| `foir` | `credit` | Calculated FOIR percentage |
| `selectedLoan` | `loan_selection` | Name of the chosen loan product |
| `pdfLink` | `done` | URL of the generated loan PDF |
