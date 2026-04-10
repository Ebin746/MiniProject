# 🧪 `test/` — Test Data & Scenarios

This folder contains test scenarios, fixtures, and a sample loan policy PDF used to manually test and verify the loan application pipeline — without needing to go through the live UI for each test run. It is essential for development-time debugging and regression testing.

---

## Directory Structure

```
test/
├── loan_policy_document.pdf    # Reference policy PDF for RAG seeding
│
├── loanPassing/                # ✅ Happy path: full approval flow
├── fakeKYC/                    # ❌ Failure path: KYC rejection
└── creaditFail/                # ❌ Failure path: Credit score rejection
                                # (note: "creadit" spelling preserved as-is)
```

---

## Test Coverage Map

```mermaid
graph TD
    Entry["Loan Application\nEntry Point"]

    Sales["Stage: sales\n(name + income collected)"]
    KYC_Pass["verifyKYC → PASS"]
    KYC_Fail["verifyKYC → FAIL"]
    Credit_Pass["getCreditScore ≥ 600\n+ FOIR ≤ 50%"]
    Credit_Fail["getCreditScore < 600"]
    FOIR_Fail["calculateFOIR > 50%"]
    LoanApproved["✅ Loan PDF Generated\n(loanPassing/)"]
    RejectedKYC["❌ KYC Rejected\n(fakeKYC/)"]
    RejectedCredit["❌ Credit Rejected\n(creaditFail/)"]
    RejectedFOIR["❌ FOIR Too High\n(future scenario)"]

    Entry --> Sales
    Sales --> KYC_Pass
    Sales --> KYC_Fail
    KYC_Pass --> Credit_Pass
    KYC_Pass --> Credit_Fail
    KYC_Pass --> FOIR_Fail
    Credit_Pass --> LoanApproved
    KYC_Fail --> RejectedKYC
    Credit_Fail --> RejectedCredit
    FOIR_Fail --> RejectedFOIR

    style LoanApproved fill:#10b981,color:#fff
    style RejectedKYC fill:#ef4444,color:#fff
    style RejectedCredit fill:#ef4444,color:#fff
    style RejectedFOIR fill:#f59e0b,color:#fff
```

---

## Scenario: `loanPassing/` — Happy Path ✅

A complete end-to-end success scenario where the user passes all verification gates and receives a loan PDF.

**Test Setup Requirements:**
- A `KYC` record exists in MongoDB matching the test Aadhaar + DOB
- A `Credit` record exists with PAN → credit score ≥ 600
- At least one `Loan` product exists in the `Loan` collection
- The test user has a monthly income resulting in FOIR ≤ 50%

**Expected Pipeline:**
```mermaid
sequenceDiagram
    participant Test as Test Client
    participant API as /api/chat
    participant Agent as Aria (Master Agent)

    Test->>API: "My name is Rahul, income 60000"
    API->>Agent: Stage: sales
    Agent-->>API: calls updateProfile(name, income)
    API-->>Test: "Thanks Rahul! Now I need to verify your identity..."

    Test->>API: "Aadhaar: 1234 5678 9012, DOB: 1990-01-15"
    API->>Agent: Stage: kyc
    Agent-->>API: calls verifyKYC → PASS
    API-->>Test: "Identity verified! Let me check your credit..."

    Test->>API: "My PAN is ABCDE1234F"
    API->>Agent: Stage: credit
    Agent-->>API: calls getCreditScore(720) → calculateFOIR(PASS)
    API-->>Test: "Great! You're eligible. Here are available loans..."

    Test->>API: "I'll take the Standard Loan for ₹5 lakhs"
    API->>Agent: Stage: loan_selection
    Agent-->>API: calls generateLoanPDF → pdfUrl
    API-->>Test: "Your loan application is complete! Download PDF: [link]"
```

**What to Verify:**
- [ ] All 6 stages complete in sequence
- [ ] Tools called in order: `updateProfile` → `verifyKYC` → `getCreditScore` → `calculateFOIR` → `getAvailableLoans` → `generateLoanPDF`
- [ ] Agent provides a PDF download link in the final message
- [ ] Stage in session is `done` after completion

---

## Scenario: `fakeKYC/` — KYC Failure ❌

A test case where the user provides an Aadhaar/DOB combination that does **not** exist in the `KYC` collection, causing identity verification to fail.

**Test Setup:**
- The test Aadhaar number is **not** seeded in the `KYC` MongoDB collection
- OR the DOB doesn't match the Aadhaar record

**Expected Flow:**
```mermaid
flowchart TD
    A["User provides Aadhaar + DOB"]
    B["verifyKYC tool called"]
    C{"KYC.findOne(aadhaar, dob)"}
    D["Record not found\n→ kycFailed: true"]
    E["Agent sends rejection message\n'Unfortunately, we couldn't verify your identity...'"]
    F["Stage → done"]
    G["No further questions asked"]

    A --> B --> C --> D --> E --> F --> G
```

**What to Verify:**
- [ ] Agent immediately sends a warm rejection message
- [ ] Stage advances to `done`
- [ ] No credit score questions are asked
- [ ] Subsequent messages only allow `searchLoanPolicy`

---

## Scenario: `creaditFail/` — Credit Score Failure ❌

> **Note**: The folder name `creaditFail` (with the typo) is preserved as-is from the codebase.

A test case where the user's PAN maps to a credit score **below 600** in the `Credit` collection.

**Test Setup:**
- A `KYC` record exists (so KYC passes)
- A `Credit` record exists with PAN → credit score < 600 (e.g., `540`)

**Expected Flow:**
```mermaid
flowchart TD
    A["KYC passes successfully"]
    B["User provides PAN: FAILP1234F"]
    C["getCreditScore(pan)"]
    D["Credit.findOne({ pan })\n→ score: 540"]
    E{"score < 600?"}
    F["creditScoreLow: true"]
    G["Agent: 'Your credit score is 540.\nUnfortunately, you do not qualify...'"]
    H["Stage → done"]

    A --> B --> C --> D --> E -->|Yes| F --> G --> H
```

**What to Verify:**
- [ ] Agent quotes the **actual credit score** in the rejection message
- [ ] Stage advances to `done` immediately
- [ ] No loan options are presented
- [ ] The message is warm and not harsh

---

## `loan_policy_document.pdf` — Policy PDF for RAG Testing

A reference PDF file containing simulated bank loan policies: interest rates, eligibility rules, FOIR limits, tenure options, prepayment penalties, etc.

**How to use in testing:**

```mermaid
flowchart LR
    A["Start dev server\nnpm run dev"]
    B["Navigate to\n/upload page"]
    C["Upload\nloan_policy_document.pdf"]
    D["/api/policy route\nchunks + embeds PDF"]
    E["PolicyDocument\ncollection populated"]
    F["searchLoanPolicy tool\nworks correctly"]

    A --> B --> C --> D --> E --> F
```

1. Start the dev server: `npm run dev`
2. Navigate to `http://localhost:3000/upload`
3. Upload the PDF file from this folder
4. The `/api/policy` route processes, chunks, and embeds it
5. Now `searchLoanPolicy` can answer policy questions during chat

---

## Running Tests via `/api/test`

The `/api/test` endpoint can trigger individual scenarios programmatically without UI interaction:

```bash
# Trigger a scenario from the command line (dev server must be running)
curl -X POST http://localhost:3000/api/test \
  -H "Content-Type: application/json" \
  -d '{ "scenario": "loanPassing" }'

# Or for KYC failure:
curl -X POST http://localhost:3000/api/test \
  -d '{ "scenario": "fakeKYC" }'
```

---

## Test Checklist

| Scenario | Stages Tested | Expected Outcome |
|---|---|---|
| `loanPassing` | All 6 stages | ✅ PDF generated, link returned |
| `fakeKYC` | sales, kyc | ❌ Rejected at KYC, stage = done |
| `creaditFail` | sales, kyc, credit | ❌ Rejected at credit, stage = done |
| Policy Q&A | Any stage | ✅ `searchLoanPolicy` returns grounded answer |
| FOIR > 50% | sales, kyc, credit | ❌ Rejected at FOIR check, stage = done |
