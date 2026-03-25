# `src/mastra/tools/` — Agent Tools

Tools are the actions the Mastra agent can perform. Each tool is a TypeScript function decorated with a Mastra `createTool()` wrapper that provides a name, description, and Zod input/output schema. The agent decides which tools to call based on the current stage instructions and user input.

---

## Tool Index

| File                   | Tool Name           | What It Does                                                 |
|------------------------|---------------------|--------------------------------------------------------------|
| `updateProfile.ts`     | `updateProfile`     | Saves user name and monthly income to MongoDB session        |
| `verifyKYC.ts`         | `verifyKYC`         | Validates Aadhaar + DOB against the KYC collection          |
| `getCreditScore.ts`    | `getCreditScore`    | Simulates/fetches a credit score using the user's PAN       |
| `calculateFOIR.ts`     | `calculateFOIR`     | Calculates Fixed Obligation to Income Ratio (EMI / income)  |
| `getAvailableLoans.ts` | `getAvailableLoans` | Queries the `Loan` collection and returns available products |
| `generateLoanPDF.ts`   | `generateLoanPDF`   | Generates a PDF loan confirmation document and stores the link |
| `searchLoanPolicy.ts`  | `searchLoanPolicy`  | Runs a RAG vector search on uploaded policy docs to answer Q&A |

---

## Tool Flow in the Pipeline

```
Stage: sales
  └─ updateProfile(name, income)

Stage: kyc
  └─ verifyKYC(aadhaar, dob)
       ├─ PASS → stage advances to "credit"
       └─ FAIL → stage jumps to "done"

Stage: credit
  └─ getCreditScore(pan)
       ├─ score < 600 → stage = "done" (rejected)
       └─ score >= 600 → calculateFOIR(emi, income)
            ├─ FOIR > 50% → stage = "done"
            └─ FOIR <= 50% → stage = "loan_selection"

Stage: loan_selection
  ├─ getAvailableLoans()
  └─ generateLoanPDF(name, income, loanName, amount, tenure, rate)
       └─ stage = "done"

Any stage:
  └─ searchLoanPolicy(query) → returns 1–2 line answer from policy PDF
```

---

## Key Detail: `searchLoanPolicy`

This tool uses **RAG (Retrieval-Augmented Generation)**. Instead of the agent answering from training data, it:
1. Generates an embedding for the user's question.
2. Runs a `$vectorSearch` on MongoDB Atlas to find the most relevant policy document chunks.
3. Returns the top-k chunks as context which the agent uses to compose the answer.

This ensures answers about interest rates, eligibility, EMI, etc. are always grounded in the bank's actual uploaded policy document.

---

## `index.ts`

A barrel export that re-exports all tools for clean importing in `master.ts`:

```ts
export * from './calculateFOIR';
export * from './generateLoanPDF';
// ...etc
```
