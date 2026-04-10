# 🧠 `src/mastra/agents/` — Agent Definitions

This folder contains the **Mastra Agent** definition for the application. Currently, the entire loan pipeline is handled by a single agent — the **Master Agent** — which dynamically adapts its behaviour based on the current stage of the user's session.

---

## `master.ts` — Master Agent Factory

The `masterAgent` is a **factory function** that returns a configured Mastra `Agent` instance. It accepts the current **stage** as a parameter so the system prompt changes dynamically per conversation turn.

```typescript
masterAgent(stage: string): Agent
```

---

## Agent Configuration

| Property | Value / Source | Notes |
|---|---|---|
| `name` | `"Master Agent"` | Internal identifier |
| `instructions` | `MasterAgentPrompt(stage)` | Dynamic — changes per stage |
| `model` | `PRIMARY_MODEL` (Google Gemini) | From `llms.ts` |
| `memory` | Mastra `LibSQLMemory` | Persistent thread-based memory |
| `maxSteps` | `7` | Max tool calls per single turn |
| `maxTokens` | `600` | Keeps replies concise |
| `temperature` | `0.5` | Balanced creativity & consistency |

---

## Tools Wired Into the Agent

All 7 tools from `src/mastra/tools/` are registered on the agent at instantiation. The LLM decides which to call based on context and stage instructions.

```mermaid
graph TD
    Agent["masterAgent(stage)\nMastra Agent"]

    T1["updateProfile\n→ Save name + income"]
    T2["verifyKYC\n→ Validate Aadhaar + DOB"]
    T3["getCreditScore\n→ PAN credit check"]
    T4["calculateFOIR\n→ EMI/income eligibility"]
    T5["getAvailableLoans\n→ Fetch loan products"]
    T6["generateLoanPDF\n→ Create PDF document"]
    T7["searchLoanPolicy\n→ RAG policy Q&A"]

    Agent --> T1
    Agent --> T2
    Agent --> T3
    Agent --> T4
    Agent --> T5
    Agent --> T6
    Agent --> T7

    style Agent fill:#6366f1,color:#fff
    style T7 fill:#10b981,color:#fff
```

---

## Tool Trigger Map by Stage

```mermaid
flowchart TD
    SalesStage["Stage: sales"]
    KYCStage["Stage: kyc"]
    CreditStage["Stage: credit"]
    LoanStage["Stage: loan_selection"]
    AnyStage["Any Stage"]

    UP["updateProfile"]
    VK["verifyKYC"]
    CS["getCreditScore"]
    CF["calculateFOIR"]
    GA["getAvailableLoans"]
    GP["generateLoanPDF"]
    SP["searchLoanPolicy"]

    SalesStage --> UP
    KYCStage --> VK
    CreditStage --> CS
    CreditStage --> CF
    LoanStage --> GA
    LoanStage --> GP
    AnyStage --> SP

    style SP fill:#10b981,color:#fff
```

| Tool | Primary Stage | Trigger Condition |
|---|---|---|
| `updateProfile` | `sales` | After collecting name + monthly income |
| `verifyKYC` | `kyc` | After collecting Aadhaar number + DOB |
| `getCreditScore` | `credit` | After user confirms PAN check |
| `calculateFOIR` | `credit` | After credit score passes (≥ 600) |
| `getAvailableLoans` | `loan_selection` | At start of loan selection stage |
| `generateLoanPDF` | `loan_selection` | After user picks a specific loan |
| `searchLoanPolicy` | **Any** | When user asks about rates, eligibility, EMI rules |

---

## Agent Execution Model

```mermaid
sequenceDiagram
    participant ChatRoute as /api/chat
    participant Agent as masterAgent
    participant LLM as Google Gemini
    participant Tools as Registered Tools

    ChatRoute->>Agent: agent.generate(userMessage, options)
    loop Up to maxSteps=7 times
        Agent->>LLM: Current context + tool schemas
        LLM-->>Agent: "Call tool X with args Y"
        Agent->>Tools: Execute tool (validated by Zod)
        Tools-->>Agent: Tool result
        Agent->>LLM: Tool result → continue reasoning
    end
    LLM-->>Agent: Final text reply
    Agent-->>ChatRoute: { text, toolResults, usage }
```

---

## Why a Single Agent?

Rather than creating separate agents for each stage (e.g., `SalesAgent`, `KYCAgent`), the architecture uses one `masterAgent` factory:

**Benefits:**
- ✅ **Consistent personality** — Aria's tone is uniform throughout the conversation
- ✅ **Simpler codebase** — one agent class to maintain and test
- ✅ **Cross-stage tool access** — `searchLoanPolicy` can answer policy questions at any stage without routing
- ✅ **Prompt-driven isolation** — stage restrictions are enforced at the prompt level via `STAGE_INSTRUCTIONS`

**Trade-offs:**
- The LLM technically has access to all tools at all stages (but the prompt forbids using wrong-stage tools)
- If the LLM ignores prompt stage restrictions, it could theoretically call `generateLoanPDF` during `sales` — this is mitigated by `processToolResults()` ignoring unexpected tool calls

---

## Agent Instantiation Flow

```mermaid
flowchart LR
    ChatRoute["/api/chat"]
    GetSession["getOrCreateSession(userId)\n{ stage, threadId }"]
    InstantiateAgent["masterAgent(stage)"]
    Generate["agent.generate(message,\n{ threadId, resourceId })"]
    ProcessTools["processToolResults()\n(advance stage)"]

    ChatRoute --> GetSession --> InstantiateAgent --> Generate --> ProcessTools
```
