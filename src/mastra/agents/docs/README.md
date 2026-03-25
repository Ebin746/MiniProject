# `src/mastra/agents/` — Agent Definitions

This folder contains the Mastra **Agent** definitions. Currently the application uses a single omnipotent agent — the **Master Agent**.

---

## `master.ts` — Master Agent

The `masterAgent` is a factory function that returns a configured Mastra `Agent` instance. It accepts the current **stage** as a parameter so the system prompt changes dynamically per conversation turn.

```
masterAgent(stage: string) → Agent
```

### Configuration

| Property               | Value / Source                          |
|------------------------|-----------------------------------------|
| `name`                 | `"Master Agent"`                        |
| `instructions`         | `MasterAgentPrompt(stage)` — dynamic    |
| `model`                | `PRIMARY_MODEL` (Google Gemini, from `llms.ts`) |
| `memory`               | Mastra `LibSQLMemory` (persistent threads) |
| `maxSteps`             | `7` — max tool calls per turn          |
| `maxTokens`            | `600`                                   |
| `temperature`          | `0.5`                                   |

### Tools wired in

All 7 tools from `src/mastra/tools/` are attached:

| Tool               | Trigger Condition                        |
|--------------------|------------------------------------------|
| `updateProfile`    | Stage `sales` — after collecting name + income |
| `verifyKYC`        | Stage `kyc` — after collecting Aadhaar + DOB |
| `getCreditScore`   | Stage `credit` — after user confirms PAN check |
| `calculateFOIR`    | Stage `credit` — after credit score passes  |
| `getAvailableLoans`| Stage `loan_selection`                   |
| `generateLoanPDF`  | Stage `loan_selection` — after user picks a loan |
| `searchLoanPolicy` | Any stage — triggered by policy/rate questions |

### Why a single agent?

One agent is easier to maintain and ensures consistent personality across all stages. The stage-specific behaviour is encoded purely in the system prompt via `STAGE_INSTRUCTIONS`, not in separate agent classes.
