# Finance Bot

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)

## Project Overview

Finance Bot is an AI-powered conversational assistant designed to streamline the loan application process. It guides users through eligibility checks, offers loan options, and facilitates document generation through an intuitive chat interface.

This project aims to simplify financial services by automating key stages of loan application, from identity verification and credit assessment to personalized loan recommendations and instant document generation. By leveraging AI orchestration and a multi-agent system, Finance Bot delivers a fast, secure, and user-friendly experience, removing the complexities of traditional lending processes.

## ✨ Features

*   **Intelligent Conversational Interface**: An AI agent guides users through the loan application with natural, multi-stage dialogue.
*   **Automated KYC Verification**: Validates user identity using provided Aadhaar and date of birth information.
*   **Credit Score Assessment**: Retrieves and evaluates user credit scores to determine eligibility.
*   **FOIR Calculation**: Automatically computes the Fixed Obligation to Income Ratio for precise financial assessment.
*   **Dynamic Loan Options**: Presents tailored loan products based on user eligibility and preferences.
*   **On-the-fly Loan Document Generation**: Creates formal loan application PDFs once a loan is selected.
*   **RAG-Enhanced Contextual Chat**: Incorporates Retrieval Augmented Generation (RAG) to provide relevant, context-aware responses based on past interactions.
*   **User Profile Management**: Persists and updates user data securely throughout the application journey.
*   **Document Upload with OCR**: Supports uploading identity documents for data extraction and verification.

## 🛠️ Tech Stack

This project leverages a modern web and AI tech stack for a robust and scalable application.

| Category               | Technology                                             | Description                                                                     |
| :--------------------- | :----------------------------------------------------- | :------------------------------------------------------------------------------ |
| **Frontend**           | Next.js, React                                         | Server-side rendering, client-side interactivity for the user interface.        |
| **Styling**            | Tailwind CSS                                           | Utility-first CSS framework for rapid and consistent UI development.            |
| **Backend Runtime**    | Node.js                                                | JavaScript runtime for server-side logic and API handling.                      |
| **Language**           | TypeScript                                             | Strongly typed superset of JavaScript for enhanced code quality and maintainability. |
| **AI Orchestration**   | Mastra AI                                              | Framework for building and managing AI agents and their tools.                  |
| **Large Language Model** | Cerebras/Qwen-3-235b-a22b-instruct-2507 (or similar) | Powers the AI agent's conversational abilities and decision-making.             |
| **Database**           | MongoDB                                                | NoSQL database for flexible and scalable data storage.                          |
| **ORM**                | Mongoose                                               | Object Data Modeling (ODM) library for MongoDB.                                 |
| **Document Processing**| PDFKit, Tesseract.js                                   | For generating PDF documents and Optical Character Recognition (OCR).           |

## 🚀 Quick Start

Follow these steps to get the Finance Bot running on your local machine.

### Prerequisites

*   Node.js (LTS recommended)
*   npm or Yarn
*   MongoDB instance (local or cloud)

### Installation

1.  Clone the repository:
    bash
    git clone https://github.com/your-username/MiniProject.git
    cd MiniProject
    
2.  Install dependencies:
    bash
    npm install
    # or
    yarn install
    
3.  Create a `.env` file in the root directory based on a `.env.example` (if present) or provided instructions. This file will contain your MongoDB connection string and other environment-specific configurations.

### Initialize RAG Vector Indexes (One-Time Step)

Before running the application, you need to initialize the vector indexes for the RAG system in your MongoDB database.

bash
curl -X POST http://localhost:3000/api/rag/init-indexes


You should receive a success message upon completion.

### Run the Development Server

After installation and RAG index initialization, start the application:

bash
npm run dev
# or
yarn dev


The application will be accessible at `http://localhost:3000`.

## 💻 Development

### Project Structure

The project follows a modular structure, separating concerns into distinct directories:

text
MiniProject/
├── docs/               # Technical documentation (Architecture, Data Flow)
├── public/             # Static assets (images, fonts, generated PDFs)
├── src/
│   ├── app/            # Next.js App Router (Pages, API routes like /chat, /login)
│   ├── components/     # Reusable React components
│   ├── lib/            # Utilities, MongoDB connection, Session management, RAG components
│   ├── mastra/         # AI Orchestration (LLMs, Agents, Prompts, Custom Tools)
│   └── models/         # Mongoose Database Models (User, Loan, KYC, Credit)
└── test/               # Test scripts and mock data


### Key Directories and Files

*   **`src/app/`**: Contains the main Next.js application pages (`page.tsx` for landing, `chat/page.tsx` for the main chat interface, `login/page.tsx`, `signup/page.tsx`, `upload/page.tsx`). Also hosts API routes like `api/chat`, `api/rag/init-indexes`, and `api/rag/search`.
*   **`src/mastra/`**: Core of the AI orchestration.
    *   `llms.ts`: Configures the Large Language Models used by the agents.
    *   `agents/master.ts`: Defines the central AI agent that manages the user journey.
    *   `tools/`: Contains custom tools (`calculateFOIR`, `verifyKYC`, `getCreditScore`, `generateLoanPDF`, etc.) that the AI agent can invoke.
    *   `prompts/master.ts`: Stores the conversational prompts and stage-specific instructions for the AI agent.
*   **`src/models/`**: Defines the Mongoose schemas for MongoDB, including `User.ts`, `Loan.ts`, `KYC.ts`, and `Credit.ts`.
*   **`src/lib/`**: Houses utility functions and services.
    *   `embeddings/`: Logic for generating and managing embeddings for RAG.
    *   `rag/`: Components for Retrieval Augmented Generation, including `ragRetriever.ts` and `contextBuilder.ts`.
    *   `mongodb.ts`: Establishes the database connection.

## 📡 API Reference

The project exposes several API endpoints to interact with the frontend and AI backend.

### Chat API

Interact with the AI assistant for loan applications.

`POST /api/chat`

**Request Body:**

json
{
  "sessionId": "string",
  "message": "string"
}


**Example Request:**

bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "user456",
    "message": "I want to apply for a personal loan."
  }'


### RAG Index Initialization

Initializes or re-initializes the MongoDB vector indexes for RAG. This is a one-time setup.

`POST /api/rag/init-indexes`

**Example Request:**

bash
curl -X POST http://localhost:3000/api/rag/init-indexes


**Example Response:**

json
{
  "success": true,
  "message": "Vector indexes created",
  "timestamp": "2026-03-09T10:30:00Z"
}


### RAG Search (for Debugging/Verification)

Allows manual searching of the RAG vector store.

`POST /api/rag/search`

**Request Body:**

json
{
  "query": "string",
  "limit": "number"
}


**Example Request:**

bash
curl -X POST http://localhost:3000/api/rag/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "how much income is needed",
    "limit": 3
  }'


**Example Response:**

json
{
  "success": true,
  "query": "how much income is needed",
  "resultCount": 1,
  "results": [
    {
      "sessionId": "user456",
      "userMessage": "My monthly income is ₹75,000",
      "assistantMessage": "That's a good income!",
      "distance": 0.08,
      "createdAt": "2026-03-09T..."
    }
  ],
  "timestamp": "2026-03-09T..."
}
