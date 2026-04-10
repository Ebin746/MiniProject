# 🏦 Loan Assistant — AI-Powered Financial Orchestrator

[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![Mastra](https://img.shields.io/badge/Mastra-AI-indigo?style=for-the-badge)](https://mastra.ai/)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

**Loan Assistant** is a production-grade, multi-stage AI application that guides users through the complete loan application process — from identity verification to PDF document generation — via a conversational AI agent named **Aria**.

## 📚 Full Documentation

All documentation lives in the **[`docs/`](./docs/)** folder:

| Document | Description |
|---|---|
| **[docs/README.md](./docs/README.md)** | Master README — complete project overview, architecture, quick start |
| [docs/app.md](./docs/app.md) | Next.js pages, routing, and UI structure |
| [docs/api.md](./docs/api.md) | All backend API route handlers |
| [docs/lib.md](./docs/lib.md) | Server utilities: auth, DB, session, chat-memory |
| [docs/mastra.md](./docs/mastra.md) | AI agent layer overview |
| [docs/agents.md](./docs/agents.md) | Master agent configuration |
| [docs/memory.md](./docs/memory.md) | Agent persistent memory |
| [docs/prompts.md](./docs/prompts.md) | Stage-aware system prompt design |
| [docs/tools.md](./docs/tools.md) | All 7 agent-callable tools |
| [docs/models.md](./docs/models.md) | MongoDB Mongoose schemas |
| [docs/test.md](./docs/test.md) | Test scenarios and fixtures |

## 🚀 Quick Start

```bash
git clone <repository-url> && cd MiniProject
npm install
# Create .env with MONGODB_URI, GOOGLE_GENERATIVE_AI_API_KEY, JWT_SECRET
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — see [docs/README.md](./docs/README.md) for full setup details.

## 📜 License

MIT License.
