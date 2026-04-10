# 🔧 `src/mastra/tools/` — Agent Tools

Tools are the actions the Mastra agent can perform. Each tool is a TypeScript function decorated with a Mastra `createTool()` wrapper that provides a name, description, and Zod input/output schema. The agent decides which tools to call based on the current stage instructions and user input.

---

## Tool Index

| File | Tool Name | Stage | What It Does |
|---|---|---|---|
| `updateProfile.ts` | `updateProfile` | `sales` | Saves user name and monthly income to MongoDB user session |
| `verifyKYC.ts` | `verifyKYC` | `kyc` | Validates Aadhaar + DOB against the KYC collection |
| `getCreditScore.ts` | `getCreditScore` | `credit` | Fetches/simulates a credit score using the user's PAN |
| `calculateFOIR.ts` | `calculateFOIR` | `credit` | Calculates Fixed Obligation to Income Ratio (EMI / income) |
| `getAvailableLoans.ts` | `getAvailableLoans` | `loan_selection` | Queries the Loan collection and returns available products |
| `generateLoanPDF.ts` | `generateLoanPDF` | `loan_selection` | Generates a PDF loan document and stores the download link |
| `searchLoanPolicy.ts` | `searchLoanPolicy` | **Any** | RAG vector search on policy docs to answer Q&A |
| `index.ts` | — | — | Barrel export of all tools |

---

## Tool Architecture Overview

```mermaid
graph TD
    Agent["masterAgent\n(Mastra Agent)"]

    subgraph "Tools (src/mastra/tools/)"
        UP["updateProfile"]
        VK["verifyKYC"]
        CS["getCreditScore"]
        CF["calculateFOIR"]
        GA["getAvailableLoans"]
        GP["generateLoanPDF"]
        SP["searchLoanPolicy"]
    end

    subgraph "Data Layer"
        UserModel["User Model\n(MongoDB)"]
        KYCModel["KYC Model\n(MongoDB)"]
        CreditModel["Credit Model\n(MongoDB)"]
        LoanModel["Loan Model\n(MongoDB)"]
        LoanPdfModel["LoanPdf Model\n(MongoDB)"]
        VectorStore["PolicyDocument\n(Vector Store)"]
    end

    Agent --> UP --> UserModel
    Agent --> VK --> KYCModel
    Agent --> CS --> CreditModel
    Agent --> CF
    Agent --> GA --> LoanModel
    Agent --> GP --> LoanPdfModel
    Agent --> SP --> VectorStore

    style SP fill:#10b981,color:#fff
```

---

## Tool Flow Through the Pipeline

```mermaid
flowchart TD
    Sales["Stage: sales"]
    KYC["Stage: kyc"]
    Credit["Stage: credit"]
    Loan["Stage: loan_selection"]
    Done["Stage: done"]

    UP["updateProfile\n(name, income)"]
    VK["verifyKYC\n(aadhaar, dob)"]
    CS["getCreditScore\n(pan)"]
    CF["calculateFOIR\n(emi, income)"]
    GA["getAvailableLoans\n()"]
    GP["generateLoanPDF\n(name, income, loan details)"]
    SP["searchLoanPolicy\n(query)"]

    Sales --> UP --> KYC
    KYC --> VK
    VK -->|"pass"| Credit
    VK -->|"fail"| Done

    Credit --> CS
    CS -->|"score < 600"| Done
    CS -->|"score ≥ 600"| CF
    CF -->|"FOIR > 50%"| Done
    CF -->|"FOIR ≤ 50%"| Loan

    Loan --> GA
    GA --> GP --> Done

    SP -.->|"callable at any stage"| Sales
    SP -.-> KYC
    SP -.-> Credit
    SP -.-> Loan

    style SP fill:#10b981,color:#fff
    style Done fill:#6b7280,color:#fff
```

---

## Tool Descriptions

### `updateProfile` — Sales Stage

Persists the user's basic profile data collected during the sales stage.

**Input Schema:**
| Field | Type | Description |
|---|---|---|
| `name` | `string` | User's full name |
| `income` | `number` | Monthly income in ₹ |

**Output:**
```json
{ "success": true, "message": "Profile saved." }
```

**Example trigger:** User says "My name is Rahul and I earn ₹50,000 per month."

---

### `verifyKYC` — KYC Stage

Looks up the Aadhaar + DOB combination in the `KYC` MongoDB collection to verify identity.

**Input Schema:**
| Field | Type | Description |
|---|---|---|
| `aadhaar` | `string` | 12-digit Aadhaar number |
| `dob` | `string` | Date of birth (YYYY-MM-DD) |

**Output:**
```json
// Pass
{ "kycPassed": true, "message": "Identity verified successfully." }
// Fail
{ "kycFailed": true, "message": "We couldn't verify your identity." }
```

**Decision flow:**
```mermaid
flowchart LR
    Input["aadhaar + dob"]
    DB["KYC.findOne({ aadhaar, dob })"]
    Found{"Record\nfound?"}
    Pass["{ kycPassed: true }"]
    Fail["{ kycFailed: true }"]

    Input --> DB --> Found
    Found -->|Yes| Pass
    Found -->|No| Fail
```

---

### `getCreditScore` — Credit Stage

Simulates fetching a credit score from a bureau (CIBIL/Experian equivalent) by looking up the PAN in the `Credit` MongoDB collection.

**Input Schema:**
| Field | Type | Description |
|---|---|---|
| `pan` | `string` | PAN card number (e.g., ABCDE1234F) |

**Decision:**
- Score ≥ 600 → eligible, proceed to `calculateFOIR`
- Score < 600 → `creditScoreLow: true`; agent sends rejection, stage → `done`

---

### `calculateFOIR` — Credit Stage

**FOIR (Fixed Obligation to Income Ratio)** = (Total existing EMIs) ÷ (Monthly income) × 100

A FOIR below 50% indicates the user can afford a new loan EMI.

**Input Schema:**
| Field | Type | Description |
|---|---|---|
| `existingEMI` | `number` | Total current monthly obligations (₹) |
| `income` | `number` | Monthly income (₹) |

**Decision:**
```mermaid
flowchart LR
    Calc["FOIR = (EMI / income) × 100"]
    Check{"FOIR ≤ 50%?"}
    Eligible["eligible: true\n→ stage: loan_selection"]
    Rejected["eligible: false\n→ stage: done"]

    Calc --> Check
    Check -->|Yes| Eligible
    Check -->|No| Rejected
```

---

### `getAvailableLoans` — Loan Selection Stage

Queries the `Loan` MongoDB collection and returns all available loan products.

**Output (array of):**
| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique product ID |
| `name` | `string` | e.g., "Standard Personal Loan" |
| `interestRate` | `number` | Annual rate (%) |
| `maxAmount` | `number` | Max disbursable (₹) |
| `tenureMonths` | `number` | Repayment period (months) |
| `description` | `string` | Short description |

---

### `generateLoanPDF` — Loan Selection Stage

Generates a professional PDF loan application document and saves it to disk or cloud storage.

**Input Schema:**
| Field | Type | Description |
|---|---|---|
| `name` | `string` | Applicant name |
| `income` | `number` | Monthly income |
| `loanName` | `string` | Selected loan product name |
| `amount` | `number` | Requested loan amount |
| `tenure` | `number` | Repayment tenure (months) |
| `rate` | `number` | Interest rate |

**Output:** `{ pdfUrl: "https://..." }` — The agent returns this URL in the reply message.

---

### `searchLoanPolicy` — Any Stage ⭐

The RAG tool. Runs a semantic vector search on uploaded policy documents to answer user questions grounded in actual bank policy.

```mermaid
sequenceDiagram
    participant User
    participant Agent
    participant Tool as searchLoanPolicy
    participant Embeddings as generateEmbedding()
    participant MongoDB as $vectorSearch

    User->>Agent: "What is the interest rate for personal loans?"
    Agent->>Tool: searchLoanPolicy({ query: "interest rate personal loan" })
    Tool->>Embeddings: generateEmbedding("interest rate personal loan")
    Embeddings-->>Tool: [0.21, -0.08, ..., 0.54] (768-dim vector)
    Tool->>MongoDB: $vectorSearch { vector, index: "vector_index_1", limit: 4 }
    MongoDB-->>Tool: Top 4 matching policy chunks (text + score)
    Tool-->>Agent: { chunks: ["Personal loans carry...", ...] }
    Agent->>Agent: Compose 1-2 line answer from chunks
    Agent-->>User: "Personal loans carry an annual rate of 10.5%..."
```

---

## `index.ts` — Barrel Export

A clean barrel export that re-exports all tools for importing in `master.ts`:

```typescript
export * from './calculateFOIR';
export * from './generateLoanPDF';
export * from './getAvailableLoans';
export * from './getCreditScore';
export * from './searchLoanPolicy';
export * from './updateProfile';
export * from './verifyKYC';
```

---

## Tool Design Principles

1. **Zod-validated inputs** — Every tool input is validated by a Zod schema. The LLM cannot pass malformed data.
2. **Explicit output schemas** — The agent knows exactly what shape to expect from each tool.
3. **Idempotent where possible** — `updateProfile` can be called multiple times; latest data wins.
4. **Graceful failure** — Each tool returns structured error objects (e.g., `{ kycFailed: true }`) rather than throwing, so the agent can compose a user-friendly message.
