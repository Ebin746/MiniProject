# `test/` — Test Data & Scenarios

This folder contains test scenarios and fixtures used to manually test and verify the loan application pipeline without going through the live UI. It also contains a sample loan policy PDF used to seed the vector store.

---

## Directory Structure

```
test/
├── loan_policy_document.pdf    # Sample policy PDF for RAG testing
│
├── loanPassing/                # Scenario: User passes all checks → loan approved
├── fakeKYC/                    # Scenario: KYC fails → application rejected
└── creaditFail/                # Scenario: Credit score < 600 → application rejected
```

---

## Scenarios

### `loanPassing/`
A happy-path test case where the user provides correct identity details, has a credit score ≥ 600, FOIR ≤ 50%, and selects a loan product resulting in a PDF being generated.

Use this scenario to verify:
- All 6 stages complete successfully.
- `updateProfile`, `verifyKYC`, `getCreditScore`, `calculateFOIR`, `getAvailableLoans`, `generateLoanPDF` tools are all invoked in order.
- The agent produces a download link for the PDF.

---

### `fakeKYC/`
A test case where the user provides an Aadhaar/DOB combination that does not exist in the `KYC` collection, causing `verifyKYC` to return `kycFailed: true`.

Use this scenario to verify:
- The agent immediately sends the rejection message.
- The stage advances to `done`.
- No further questions are asked.

---

### `creaditFail/` *(note: spelling is as-is in the codebase)*
A test case where the user's PAN maps to a credit score below 600 in the `Credit` collection, causing `getCreditScore` to return `creditScoreLow: true`.

Use this scenario to verify:
- The agent quotes the actual score in the rejection message.
- The stage advances to `done`.
- No loan options are shown.

---

## `loan_policy_document.pdf`
A reference PDF file containing simulated bank loan policies (interest rates, eligibility rules, FOIR limits, etc.).

To use in testing:
1. Start the dev server.
2. Go to `/upload`.
3. Upload this file.

This triggers the `/api/policy` route to chunk and embed the document into MongoDB, enabling `searchLoanPolicy` to answer policy questions correctly during chat.

---

## How to Run Tests via `/api/test`

The `/api/test` route can be used to trigger individual scenarios programmatically. Send a POST request with the scenario name to observe the agent's response without UI interaction.
