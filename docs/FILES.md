# Project Structure & File Guide

This document provides a comprehensive overview of the Loan Assistant project's directory structure and the purpose of key files.

## Directory Overview

```text
MiniProject/
├── docs/               # Technical documentation (Architecture, Data Flow, etc.)
├── public/             # Static assets (PDFs, icons, etc.)
├── src/
│   ├── app/            # Next.js App Router (Pages, API routes)
│   ├── components/     # Reusable React components
│   ├── lib/            # Utilities, Database connection, Session management
│   ├── mastra/         # AI Orchestration (Agents, Tools, Prompts)
│   └── models/         # Mongoose Database Models
├── test/               # Test scripts and mock data
└── .env                # Environment variables (Configuration)
```

---

## Detailed File Descriptions

### Core Application (`src/app/`)

- [page.tsx](file:///c:/Users/ebin/Desktop/codes/MiniProject/src/app/page.tsx): The main chat interface. Handles user interactions, message history, and file uploads.
- [layout.tsx](file:///c:/Users/ebin/Desktop/codes/MiniProject/src/app/layout.tsx): Root layout with global styles and basic structure.
- **api/**:
  - `auth/`: Authentication endpoints (me, logout).
  - `chat/`: Main AI interaction endpoint. Connects the frontend to the Mastra agent.
  - `ocr/`: Handles document upload and text extraction using Tesseract.js.

### AI Orchestration (`src/mastra/`)

- [llms.ts](file:///c:/Users/ebin/Desktop/codes/MiniProject/src/mastra/llms.ts): Configuration for LLM models (e.g., Groq).
- **agents/master.ts**: Defines the main "Master Agent" responsible for guiding the user through the loan process.
- **tools/**: Custom tools that the agent can execute:
  - `verifyKYC.ts`: Validates identity documents.
  - `getCreditScore.ts`: Calculates or retrieves the user's credit score.
  - `calculateFOIR.ts`: Computes Fixed Obligation to Income Ratio.
  - `getAvailableLoans.ts`: Fetches matching loan products.
  - `generateLoanPDF.ts`: Creates a formal loan application document.
  - `updateProfile.ts`: Persists user data to the database.

### Database Models (`src/models/`)

- [User.ts](file:///c:/Users/ebin/Desktop/codes/MiniProject/src/models/User.ts): User authentication and profile data.
- [Loan.ts](file:///c:/Users/ebin/Desktop/codes/MiniProject/src/models/Loan.ts): Loan product definitions.
- [KYC.ts](file:///c:/Users/ebin/Desktop/codes/MiniProject/src/models/KYC.ts): Verification status and document metadata.
- [Credit.ts](file:///c:/Users/ebin/Desktop/codes/MiniProject/src/models/Credit.ts): Credit history and scoring data.

### Utilities (`src/lib/`)

- [mongodb.ts](file:///c:/Users/ebin/Desktop/codes/MiniProject/src/lib/mongodb.ts): Connection logic for MongoDB using Mongoose.
- [auth.ts](file:///c:/Users/ebin/Desktop/codes/MiniProject/src/lib/auth.ts): JWT-based authentication utilities.
- [session-manager.ts](file:///c:/Users/ebin/Desktop/codes/MiniProject/src/lib/session-manager.ts): Manages state across different stages of the application process.
- [chat-memory.ts](file:///c:/Users/ebin/Desktop/codes/MiniProject/src/lib/chat-memory.ts): Stores conversation context for the AI agent.

---

## Developer Guide

### Adding a New Tool
1. Create a new `.ts` file in `src/mastra/tools/`.
2. Define the tool's input schema and logic.
3. Export it and register it in `src/mastra/tools/index.ts`.
4. Add the tool to the agent's tool list in `src/mastra/agents/master.ts`.

### Modifying the Database
1. Update the relevant model in `src/models/`.
2. Ensure any impacted tools or API routes are updated to handle new fields.
