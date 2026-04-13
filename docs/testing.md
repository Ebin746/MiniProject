# 🧪 Testing Strategy (Unit & Integration)

This document outlines the testing philosophy and implementation guidelines for the **loanCopilot** project.

---

## 📋 Table of Contents
- [Overview](#-overview)
- [Unit Testing](#-unit-testing)
- [Integration Testing](#-integration-testing)
- [Manual & Scenario Testing](#-manual--scenario-testing)
- [Recommended Tooling (Vitest)](#-recommended-tooling-vitest)
- [Test-Driven Development (TDD) Tips](#-test-driven-development-tdd-tips)

---

## 🌟 Overview

We follow a balanced testing pyramid:
1. **Unit Tests (Base)**: Fast tests for individual functions and utilities.
2. **Integration Tests (Middle)**: Verifying the AI agent flow and database interactions.
3. **Manual Scenarios (Top)**: Validating end-to-end "happy paths" and failure cases using the UI.

---

## 🧩 Unit Testing

Unit tests focus on isolated business logic without external dependencies (like MongoDB or LLMs).

### What to Unit Test?
- **Security Utils**: `src/lib/security/pii-crypto.ts` (Encryption/Decryption parity).
- **Calculation Logic**: `src/mastra/tools/calculateFOIR.ts` (FOIR calculation, income parsing).
- **Session Utilities**: `src/lib/utils/chat-context-utils.ts` (Working memory manipulation).

### Example Test (Vitest/Jest)
```typescript
// src/lib/security/pii-crypto.test.ts
import { encryptPII, decryptPII } from './pii-crypto';

describe('PII Crypto Utility', () => {
  it('should encrypt and then decrypt to the same value', () => {
    const original = "ABCDE1234F";
    const encrypted = encryptPII(original);
    const decrypted = decryptPII(encrypted);
    
    expect(decrypted).toBe(original);
    expect(encrypted).not.toBe(original);
  });
});
```

---

## 🔄 Integration Testing

Integration tests verify that different parts of the system work together correctly, particularly the multi-stage AI agent flow.

### Key Focus Areas:
1. **Agent State Transitions**: Ensuring `sales → kyc → credit` happens as expected.
2. **Database Persistence**: Verifying that tools like `verifyKYC` correctly update the `User` document in MongoDB.
3. **Session Hydration**: Testing that `chat-flow-service.ts` correctly restores user state from both MongoDB and working memory.

### Mocking Strategies:
- **Database**: Use `mongodb-memory-server` for a clean, temporary DB during tests.
- **LLM Agent**: Mock the `masterAgent` generate call to return deterministic tool calls and text responses.

---

## 📂 Manual & Scenario Testing

The project includes a suite of manual test scenarios located in the `test/` directory.

### Existing Scenarios:
- `test/loanPassing/`: Happy path documentation.
- `test/fakeKYC/`: Identity verification failure flow.
- `test/creaditFail/`: Low credit score rejection flow.

### Verification Tools:
- **`http://localhost:3000/api/test`**: Returns a snapshot of the current Policy RAG data (chunks, embeddings). 
- **Tail Logs**: Monitor server logs for `[API/Chat]` or `[Mastra]` prefixes to see real-time tool execution.

---

## 🛠️ Recommended Tooling (Vitest)

We recommend using **Vitest** for its exceptional speed and native support for TypeScript and Next.js.

### 1. Installation
```bash
npm install -D vitest @vitejs/plugin-react jsdom
```

### 2. Configuration (`vitest.config.ts`)
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
```

### 3. Running Tests
Add these scripts to your `package.json`:
```json
"scripts": {
  "test": "vitest",
  "test:ui": "vitest --ui",
  "test:run": "vitest run"
}
```

---

## 💡 Test-Driven Development (TDD) Tips

1. **Extract Logic**: If a tool (like `calculateFOIR`) has a complex private function (like `parseValue`), extract it to a shared utility file so it can be unit-tested efficiently.
2. **Seed Before Test**: For integration tests, always seed your test MongoDB with the required `KYC` and `Credit` records before running the agent flow.
3. **Environment Isolation**: Ensure your `.env.test` file points to a local or memory-based MongoDB to avoid polluting your development database.
