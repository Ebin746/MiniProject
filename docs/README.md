# 🏦 Loan Assistant — Complete Project Documentation

[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![Mastra](https://img.shields.io/badge/Mastra-AI-indigo?style=for-the-badge)](https://mastra.ai/)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

**Loan Assistant** (internally called **Finance Bot**) is a production-grade, multi-stage AI web application that streamlines the end-to-end loan eligibility and application process. Powered by an intelligent AI agent named **Aria**, it guides users through a fully automated conversational pipeline — from identity verification to PDF loan document generation.

---

## 📋 Table of Contents

- [Project Overview](#-project-overview)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [System Architecture](#-system-architecture)
- [Loan Application Pipeline](#-loan-application-pipeline)
- [Folder Structure](#-folder-structure)
- [Quick Start](#-quick-start)
- [Environment Variables](#-environment-variables)
- [Documentation Index](#-documentation-index)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🌟 Project Overview

Finance Bot is an AI-powered loan assistant built with **Next.js (App Router)** and the **Mastra AI agent framework**. Users sign up, chat with the intelligent agent "Aria", and are guided through a fully automated loan application flow — from identity verification to loan PDF generation.

The system uses a **stage machine** pattern: the conversation automatically advances through defined stages (`sales → kyc → credit → loan_selection → done`) based on the results of tool calls made by the AI agent. Each stage has a narrowly scoped system prompt, preventing the agent from skipping ahead or going off-topic.

---

## ✨ Key Features

| Feature | Description |
|---|---|
| 🤖 **Intelligent Multi-Agent System** | Powered by Mastra and Google Gemini, the agent dynamically manages the full loan lifecycle |
| 📄 **OCR Data Extraction** | Built-in document processing (Tesseract.js) to extract financial info from IDs and salary slips |
| 🔄 **Multi-Stage Workflow** | A state-aware session manager handles Sales, KYC, Credit Assessment, and Loan Selection |
| 📊 **Real-time Financial Analysis** | Instant FOIR (Fixed Obligation to Income Ratio) calculations and credit score assessment |
| 🖨️ **Automated PDF Generation** | Professional loan application PDFs generated on-the-fly via PDFKit |
| 🔐 **Secure Authentication** | JWT-based session management and secure MongoDB persistence |
| 🔍 **RAG Policy Search** | Policy documents are chunked and vector-embedded; the agent answers at any stage |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 15 (App Router), React 19, Tailwind CSS 4, Lucide React |
| **Backend** | Next.js API Routes (Edge-compatible) |
| **AI Agent** | Mastra (`@mastra/core`), Google Gemini LLM |
| **Database** | MongoDB Atlas (Mongoose ODM) |
| **Vector Search** | MongoDB Atlas Vector Search + Google text-embedding model |
| **Auth** | JWT stored in HTTP-only cookies |
| **OCR** | Tesseract.js |
| **PDF** | PDFKit |
| **Runtime** | Node.js 18+, TypeScript, `tsx` |

---

## 🏛️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER BROWSER                                 │
│              Landing Page → Login/Signup → Chat UI                  │
└────────────────────────────┬────────────────────────────────────────┘
                             │  HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    NEXT.JS APP ROUTER (Frontend)                     │
│  /           Landing page (marketing)                               │
│  /login      JWT authentication                                     │
│  /signup     User registration                                      │
│  /chat       Main chat UI (WhatsApp-style)                          │
│  /upload     Admin: upload loan policy PDF                          │
└────────────────────────────┬────────────────────────────────────────┘
                             │  Internal API calls
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    NEXT.JS API ROUTES (Backend)                      │
│  /api/auth     Signup, login, logout (JWT + bcrypt)                 │
│  /api/chat     Core chat handler — invokes Mastra agent             │
│  /api/ocr      OCR document extraction (Tesseract.js)               │
│  /api/policy   PDF upload → chunk → embed → store                   │
│  /api/test     Internal testing endpoint                            │
└──────────┬─────────────────────────────────────────┬───────────────┘
           │ agent.generate()                         │ dbConnect()
           ▼                                          ▼
┌──────────────────────────┐             ┌────────────────────────────┐
│   MASTRA MASTER AGENT    │             │       MONGODB ATLAS         │
│  ┌────────────────────┐  │             │  ┌──────────────────────┐  │
│  │  Stage-Aware Prompt│  │             │  │ Users, Loans, KYC    │  │
│  │  (Aria persona)    │  │             │  │ Credits, PolicyDocs  │  │
│  └────────────────────┘  │             │  └──────────────────────┘  │
│  ┌────────────────────┐  │             │  ┌──────────────────────┐  │
│  │  7 Tools wired in  │  │◄──read/write│  │ Vector Search Index  │  │
│  └────────────────────┘  │             │  │ (vector_index_1)     │  │
│  ┌────────────────────┐  │             │  └──────────────────────┘  │
│  │  LibSQL Memory     │  │             └────────────────────────────┘
│  │  (thread history)  │  │
│  └────────────────────┘  │
└──────────────────────────┘
```

---

## 🔄 Loan Application Pipeline

The agent automatically advances the user through six stages based on tool results:

```
sales ──► kyc ──► credit ──► loan_selection ──► done
           │         │
        (FAIL)    (FAIL)
           └────────►── done (rejected)
```

| Stage | What Happens | Key Tool(s) |
|---|---|---|
| `sales` | Collect name + monthly income | `updateProfile` |
| `kyc` | Collect Aadhaar + DOB; identity check | `verifyKYC` |
| `credit` | PAN-based credit score + FOIR calculation | `getCreditScore`, `calculateFOIR` |
| `loan_selection` | Show available loans; user picks; generate PDF | `getAvailableLoans`, `generateLoanPDF` |
| `docs` | Graceful confirmation | — |
| `done` | Warm close; only policy Q&A allowed | `searchLoanPolicy` |

> **At any stage**: The user can ask policy questions (e.g., "What is the interest rate?"). The agent calls `searchLoanPolicy` which runs a RAG vector search on the uploaded policy PDF and returns a grounded 1–2 line answer.

---

## 📁 Folder Structure

```
MiniProject/
├── README.md                    ← Root README (points here)
├── docs/                        ← 📖 ALL DOCUMENTATION (you are here)
│   ├── README.md                ← This file (master README)
│   ├── app.md                   ← Next.js pages & routes
│   ├── api.md                   ← API route handlers
│   ├── lib.md                   ← Server-side utilities
│   ├── mastra.md                ← AI agent layer overview
│   ├── agents.md                ← Mastra agent definition
│   ├── memory.md                ← Agent memory configuration
│   ├── prompts.md               ← System prompt design
│   ├── tools.md                 ← All 7 agent tools
│   ├── models.md                ← MongoDB Mongoose schemas
│   └── test.md                  ← Test scenarios & fixtures
│
├── src/
│   ├── app/                     ← Next.js App Router pages + API
│   │   ├── api/                 ← Backend route handlers
│   │   ├── chat/                ← Chat page
│   │   ├── login/               ← Login page
│   │   ├── signup/              ← Signup page
│   │   ├── upload/              ← Admin PDF upload page
│   │   ├── layout.tsx           ← Root layout
│   │   ├── page.tsx             ← Landing page
│   │   └── globals.css
│   │
│   ├── lib/                     ← Server utilities
│   │   ├── auth.ts              ← JWT sign/verify
│   │   ├── mongodb.ts           ← DB connection singleton
│   │   ├── session-manager.ts   ← Per-user stage + threadId
│   │   ├── chat-memory.ts       ← Stage transition logic
│   │   └── embeddings/          ← RAG vector store
│   │       ├── embeddings.ts
│   │       └── policyVectorStore.ts
│   │
│   ├── mastra/                  ← AI agent configuration
│   │   ├── llms.ts              ← LLM model setup
│   │   ├── agents/master.ts     ← Master agent factory
│   │   ├── prompts/master.ts    ← Stage-aware prompt builder
│   │   ├── memory/index.ts      ← LibSQL memory config
│   │   └── tools/               ← 7 agent-callable tools
│   │
│   └── models/                  ← Mongoose schemas
│       ├── User.ts
│       ├── Loan.ts
│       ├── KYC.ts
│       ├── Credit.ts
│       ├── LoanPdf.ts
│       └── PolicyDocument.ts
│
├── test/                        ← Test scenarios & fixtures
│   ├── loan_policy_document.pdf
│   ├── loanPassing/
│   ├── fakeKYC/
│   └── creaditFail/
│
├── public/                      ← Static assets
├── package.json
├── tsconfig.json
├── next.config.ts
└── eslint.config.mjs
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js v18+
- MongoDB Atlas account (or local MongoDB)
- Google AI API Key (for Gemini LLM + text-embedding)

### Installation

```bash
# 1. Clone the repository
git clone <repository-url>
cd MiniProject

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
# Edit .env with your credentials (see below)

# 4. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔑 Environment Variables

Create a `.env` file in the project root:

```env
# MongoDB Atlas connection string
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<dbname>

# Google AI API Key (for Gemini LLM + text-embedding model)
GOOGLE_GENERATIVE_AI_API_KEY=your_google_ai_api_key

# JWT secret (use a long, random string in production)
JWT_SECRET=your_super_secret_jwt_key_min_32_chars
```

> **MongoDB Atlas Setup**: After connecting, create a **Vector Search index** named `vector_index_1` on the `policydocuments` collection with `numDimensions: 768` and `similarity: cosine`. See [models.md](./models.md) for details.

---

## 📖 Documentation Index

| Document | Description |
|---|---|
| [app.md](./app.md) | Next.js pages, routing, layout, and UI structure |
| [api.md](./api.md) | All backend API route handlers with request/response flows |
| [lib.md](./lib.md) | Server utilities: auth, DB, session, chat-memory, embeddings |
| [mastra.md](./mastra.md) | AI agent layer overview and orchestration |
| [agents.md](./agents.md) | Master agent configuration and tool wiring |
| [memory.md](./memory.md) | Agent persistent memory using LibSQL threads |
| [prompts.md](./prompts.md) | Stage-aware system prompt design and persona |
| [tools.md](./tools.md) | All 7 agent-callable tools with input/output schemas |
| [models.md](./models.md) | MongoDB Mongoose schemas (User, Loan, KYC, Credit, PolicyDocument) |
| [test.md](./test.md) | Test scenarios, fixtures, and how to run them |

---

## 🔑 Key Design Decisions

1. **Stage machine in memory, not DB** — The active stage lives in the server-side session (`session-manager.ts`) and is promoted by `processToolResults()` after each agent turn, keeping latency low.

2. **Single agent, many tools** — One `masterAgent` is reused across all stages; the active stage changes only the system prompt, avoiding multiple agent classes or complex routing.

3. **RAG for policy QA** — Policy PDF documents are chunked and stored as embeddings in MongoDB Atlas. `searchLoanPolicy` runs a `$vectorSearch` aggregation to answer user questions at any stage, grounding answers in actual bank policy.

4. **OCR injection pattern** — Extracted OCR text is returned to the frontend and injected as a `EXTRACTED_DOC_DATA: ...` block into the user's next chat message, so the agent can silently process documents without UI complexity.

5. **JWT in HTTP-only cookies** — Prevents XSS token theft. The cookie is set server-side on login and cleared on logout.

---

## 🤝 Contributing

We welcome contributions! Please follow the standard workflow:

1. Fork the repo.
2. Create your feature branch: `git checkout -b feature/AmazingFeature`
3. Commit your changes: `git commit -m 'Add some AmazingFeature'`
4. Push to the branch: `git push origin feature/AmazingFeature`
5. Open a Pull Request.

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.
