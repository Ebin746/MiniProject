# `src/mastra/prompts/` — Agent System Prompts

This folder contains the **system prompt** that defines the personality, rules, and stage-specific instructions for the Master Agent (Aria).

---

## `master.ts`

Exports three things:

### 1. `BASE_PROMPT` (string)
The global, always-present personality and rule set for Aria. Key rules:

- **Personality**: Warm, friendly, concise — like texting a helpful friend, not a bank form.
- **Format**: Max 3 lines per message, no bullet points, no markdown, no bold text.
- **Strict rules**:
  - Never repeat the same sentence twice.
  - Locked to the current stage — never ask questions from other stages.
  - Never narrate tool calls (e.g., do not say "let me check your credit score…").
  - Rejection is final — KYC fail or credit score < 600 → stop immediately.
  - Policy questions at any stage → call `searchLoanPolicy`, give a 1–2 line answer, then resume.

---

### 2. `STAGE_INSTRUCTIONS` (Record<string, string>)
A dictionary of stage-specific instructions. Each entry tells the agent its **single, narrow job** for that stage.

| Stage            | Job                                                          |
|------------------|--------------------------------------------------------------|
| `sales`          | Collect name + monthly income, call `updateProfile`          |
| `kyc`            | Collect Aadhaar + DOB, call `verifyKYC`, handle pass/fail    |
| `credit`         | Confirm PAN, call `getCreditScore` → `calculateFOIR`         |
| `loan_selection` | Show loan options, wait for pick, generate PDF immediately    |
| `docs`           | Graceful warm close (loan was sent in loan_selection)        |
| `done`           | Warm closing message; only `searchLoanPolicy` allowed         |

---

### 3. `MasterAgentPrompt(stage)` (function)
The final prompt builder. Combines `BASE_PROMPT` and the relevant `STAGE_INSTRUCTIONS` entry:

```ts
export const MasterAgentPrompt = (stage: string) =>
  `${BASE_PROMPT}\n\n## YOU ARE IN THE ${stage.toUpperCase()} STAGE\n${STAGE_INSTRUCTIONS[stage] ?? STAGE_INSTRUCTIONS['done']}`;
```

This is called every time `/api/chat` creates a new agent instance, ensuring the agent always gets the right instructions for the current stage.

---

## Design Note

The prompt design enforces **strict stage isolation** — the agent is forbidden from volunteering information about future steps or asking questions outside its current stage. This prevents the conversation from becoming confusing or overwhelming for the user.
