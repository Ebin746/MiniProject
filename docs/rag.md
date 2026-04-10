# 🔍 RAG (Retrieval-Augmented Generation) — Loan Policy Search

[![MongoDB Atlas](https://img.shields.io/badge/MongoDB_Atlas-Vector_Search-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/atlas/search)
[![Google AI](https://img.shields.io/badge/Google_AI-Embeddings-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)

> **What is RAG?** Retrieval-Augmented Generation is a technique where an LLM's response is _grounded_ in real documents retrieved at query time, instead of relying solely on its training data. This ensures factual, up-to-date answers.

In the loanCopilot, RAG powers the **`searchLoanPolicy`** tool — allowing the AI agent **Aria** to answer any user question about loan policies, interest rates, eligibility criteria, EMI calculations, FOIR thresholds, or required documents by searching **actual uploaded bank policy PDFs**.

---

## 📋 Table of Contents

- [High-Level Architecture](#-high-level-architecture)
- [End-to-End Workflow](#-end-to-end-workflow)
  - [Phase 1 — Ingestion Pipeline](#phase-1--ingestion-pipeline-admin-uploads-policy-pdf)
  - [Phase 2 — Query Pipeline](#phase-2--query-pipeline-user-asks-a-policy-question)
- [Detailed Component Breakdown](#-detailed-component-breakdown)
  - [1. PDF Upload & Text Extraction](#1-pdf-upload--text-extraction)
  - [2. Text Chunking](#2-text-chunking)
  - [3. Embedding Generation](#3-embedding-generation)
  - [4. Vector Storage (MongoDB Atlas)](#4-vector-storage-mongodb-atlas)
  - [5. Semantic Search](#5-semantic-search--vectorsearch)
  - [6. Agent Integration](#6-agent-integration--searchloanpolicy-tool)
- [Data Flow Diagrams](#-data-flow-diagrams)
- [MongoDB Vector Index Configuration](#-mongodb-vector-index-configuration)
- [Fallback Strategy](#-fallback-strategy)
- [Key Design Decisions](#-key-design-decisions)
- [File Reference Map](#-file-reference-map)

---

## 🏛️ High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          RAG PIPELINE OVERVIEW                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────┐     ┌──────────────┐     ┌─────────────┐                  │
│   │  Admin       │     │  /api/policy │     │  Text       │                  │
│   │  Upload Page │────►│  Route       │────►│  Extraction │                  │
│   │  (/upload)   │     │  Handler     │     │  (pdf-parse)│                  │
│   └─────────────┘     └──────────────┘     └──────┬──────┘                  │
│                                                    │                         │
│                         INGESTION                  ▼                         │
│                        ─────────         ┌─────────────────┐                │
│                                          │   Chunking       │                │
│                                          │   (500 chars,    │                │
│                                          │    100 overlap)  │                │
│                                          └────────┬────────┘                │
│                                                   │                         │
│                                                   ▼                         │
│                                          ┌─────────────────┐                │
│                                          │  Google AI       │                │
│                                          │  Embedding Model │                │
│                                          │  (768-dim)       │                │
│                                          └────────┬────────┘                │
│                                                   │                         │
│                                                   ▼                         │
│                                          ┌─────────────────┐                │
│                                          │  MongoDB Atlas   │                │
│                                          │  PolicyDocuments │                │
│                                          │  Collection      │                │
│                                          │  + Vector Index  │                │
│                                          └────────┬────────┘                │
│                                                   │                         │
│                          RETRIEVAL                 │                         │
│                         ──────────                 │                         │
│                                                   ▼                         │
│   ┌─────────────┐     ┌──────────────┐   ┌─────────────────┐               │
│   │  User asks  │     │  Aria Agent  │   │  $vectorSearch   │               │
│   │  "What is   │────►│  calls       │──►│  Aggregation     │               │
│   │  the rate?" │     │  searchLoan  │   │  (cosine sim.)   │               │
│   └─────────────┘     │  Policy tool │   └────────┬────────┘               │
│                       └──────┬───────┘            │                         │
│                              │                    │                         │
│                              │◄───────────────────┘                         │
│                              ▼           Top-4 chunks                       │
│                       ┌──────────────┐                                      │
│                       │  LLM grounds │                                      │
│                       │  answer in   │                                      │
│                       │  retrieved   │                                      │
│                       │  context     │                                      │
│                       └──────┬───────┘                                      │
│                              │                                              │
│                              ▼                                              │
│                       ┌──────────────┐                                      │
│                       │  User gets   │                                      │
│                       │  factual,    │                                      │
│                       │  grounded    │                                      │
│                       │  answer      │                                      │
│                       └──────────────┘                                      │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 End-to-End Workflow

### Phase 1 — Ingestion Pipeline (Admin Uploads Policy PDF)

```
 ADMIN                  SERVER                          MONGODB
  │                       │                               │
  │  1. Upload PDF        │                               │
  │  ──────────────────►  │                               │
  │  (multipart/form)     │                               │
  │                       │  2. Extract text              │
  │                       │  (pdf-parse library)          │
  │                       │                               │
  │                       │  3. Chunk text                │
  │                       │  (500-char windows,           │
  │                       │   100-char overlap)           │
  │                       │                               │
  │                       │  4. Delete old chunks         │
  │                       │  ──────────────────────────►  │
  │                       │                               │
  │                       │  5. For EACH chunk:           │
  │                       │     a) Call Google AI          │
  │                       │        embedContent()         │
  │                       │        → 768-dim vector       │
  │                       │                               │
  │                       │     b) Store chunk doc        │
  │                       │  ──────────────────────────►  │
  │                       │     { filename, chunkIndex,   │
  │                       │       text, embedding[768] }  │
  │                       │                               │
  │  6. Success response  │                               │
  │  ◄──────────────────  │                               │
  │  { chunksStored: N }  │                               │
```

**Step-by-step breakdown:**

1. **Admin navigates to `/upload`** — A protected page with a file input that accepts `.pdf` files.
2. **PDF is sent to `/api/policy`** — The API route receives the file as `multipart/form-data`.
3. **Text is extracted** using the `pdf-parse` library, converting the binary PDF into a raw text string.
4. **`storePolicyDocument()` is called** — this is the core ingestion function located in `src/lib/embeddings/policyVectorStore.ts`.
5. **Old chunks are purged** — Any existing chunks for the same filename are deleted (`PolicyDocument.deleteMany({ filename })`), ensuring idempotent re-uploads.
6. **Text is chunked** — The raw text is split into overlapping windows of 500 characters each, with a 100-character overlap between consecutive chunks.
7. **Each chunk is embedded** — `generateEmbedding()` calls Google AI's `gemini-embedding-001` model, producing a 768-dimensional float vector for each chunk.
8. **Chunks are stored** — Each chunk is saved as a MongoDB document in the `policydocuments` collection with fields: `filename`, `chunkIndex`, `text`, and `embedding`.

---

### Phase 2 — Query Pipeline (User Asks a Policy Question)

```
 USER                ARIA AGENT            VECTOR STORE              MONGODB
  │                     │                      │                       │
  │  "What is the       │                      │                       │
  │   interest rate?"   │                      │                       │
  │  ────────────────►  │                      │                       │
  │                     │                      │                       │
  │                     │  1. Recognizes        │                       │
  │                     │  policy question      │                       │
  │                     │                      │                       │
  │                     │  2. Calls tool:       │                       │
  │                     │  searchLoanPolicy     │                       │
  │                     │  { query: "interest   │                       │
  │                     │    rate" }            │                       │
  │                     │  ──────────────────►  │                       │
  │                     │                      │                       │
  │                     │                      │  3. Embed query       │
  │                     │                      │  → 768-dim vector     │
  │                     │                      │                       │
  │                     │                      │  4. $vectorSearch     │
  │                     │                      │  ─────────────────►   │
  │                     │                      │  index: vector_index_1│
  │                     │                      │  numCandidates: 100   │
  │                     │                      │  limit: 4             │
  │                     │                      │                       │
  │                     │                      │  5. Top-4 chunks      │
  │                     │                      │  ◄─────────────────   │
  │                     │                      │  (with cosine scores) │
  │                     │                      │                       │
  │                     │  6. Return matched   │                       │
  │                     │  chunks + scores     │                       │
  │                     │  ◄──────────────────  │                       │
  │                     │                      │                       │
  │                     │  7. LLM synthesizes  │                       │
  │                     │  1-2 line answer     │                       │
  │                     │  from chunk content  │                       │
  │                     │                      │                       │
  │  8. Grounded reply  │                      │                       │
  │  ◄────────────────  │                      │                       │
  │  "The interest rate │                      │                       │
  │   is 10.5% p.a."   │                      │                       │
```

**Step-by-step breakdown:**

1. **User sends a policy question** — e.g., "What is the interest rate for a personal loan?"
2. **Aria recognizes it as a policy question** — The system prompt instructs: _"If user asks about rates, EMI, eligibility, documents → call `searchLoanPolicy`"_
3. **`searchLoanPolicy` tool is invoked** — The tool receives the user's query string.
4. **Query is embedded** — The same `generateEmbedding()` function converts the question into a 768-dimensional vector.
5. **MongoDB `$vectorSearch` is executed** — An aggregation pipeline runs against the `vector_index_1` index, finding the 4 most semantically similar chunks using cosine similarity, scanning 100 candidates.
6. **Top-4 matching chunks are returned** — Each result includes the `text`, `filename`, and `vectorSearchScore`.
7. **Chunks are returned to the agent** — The tool returns `{ found: true, results: [{ source, content, score }] }`.
8. **Aria synthesizes a grounded answer** — The LLM reads the retrieved chunk content and formulates a concise 1-2 line answer, citing actual policy text.

---

## 📦 Detailed Component Breakdown

### 1. PDF Upload & Text Extraction

**File:** `src/app/api/policy/route.ts`

The admin uploads a loan policy PDF through the `/upload` page. The API route:
- Receives the file as `multipart/form-data`
- Uses `pdf-parse` to extract the full text content from the PDF
- Passes the filename and extracted text to `storePolicyDocument()`

```
PDF Binary ──► pdf-parse ──► Raw Text String
                              "Loan Policy Document...
                               Interest rates vary...
                               Eligibility criteria..."
```

---

### 2. Text Chunking

**File:** `src/lib/embeddings/policyVectorStore.ts` → `chunkText()`

**Parameters:**
| Parameter | Value | Purpose |
|---|---|---|
| `CHUNK_SIZE` | 500 characters | Maximum length of each text chunk |
| `CHUNK_OVERLAP` | 100 characters | Overlap between consecutive chunks to preserve context |

**How Sliding Window Chunking Works:**

```
Original Text (1200 characters):
┌──────────────────────────────────────────────────────────────────────┐
│ The personal loan interest rate is 10.5% per annum. Eligibility    │
│ requires a minimum credit score of 600. The maximum loan amount    │
│ is ₹5,00,000 with tenor options of 12, 24, or 36 months. The      │
│ Fixed Obligation to Income Ratio (FOIR) must not exceed 50%.       │
│ Documents required include Aadhaar card, PAN card, salary slips    │
│ for last 3 months, and bank statements. Processing fee is 2% of   │
│ the loan amount. Prepayment is allowed after 6 EMIs with a 3%     │
│ foreclosure charge. Late payment penalty is ₹500 per instance...  │
└──────────────────────────────────────────────────────────────────────┘

Chunk 1 (chars 0–499):       ████████████████████░░░░░░░░░░░░░░░░░░░░
Chunk 2 (chars 400–899):     ░░░░░░░░░░░░░░░░████████████████████░░░░
Chunk 3 (chars 800–1199):    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░████████
                                              ▲
                                     100-char overlap zones
                                   (prevents context loss at
                                    chunk boundaries)
```

**Why overlapping windows?** Without overlap, a sentence split across two chunks would lose meaning in both. The 100-character overlap ensures sentences that span chunk boundaries appear in at least one chunk in their entirety.

---

### 3. Embedding Generation

**File:** `src/lib/embeddings/embeddings.ts`

```
Text Chunk ──► Google AI API ──► 768-dimensional Float Vector
               (gemini-embedding-001)

"Interest rate       ──►  [0.0234, -0.0891, 0.1456, ..., 0.0672]
 is 10.5% p.a."           ◄──── 768 floating-point numbers ────►
```

| Property | Value |
|---|---|
| **Model** | `gemini-embedding-001` (Google Generative AI) |
| **Dimensions** | 768 |
| **Input** | Raw text string (chunk or query) |
| **Output** | `number[]` — 768-dimensional embedding vector |

The same function `generateEmbedding()` is used for **both** the ingestion pipeline (embedding chunks) and the query pipeline (embedding the user's question). This ensures vectors live in the same semantic space and cosine similarity comparisons are meaningful.

---

### 4. Vector Storage (MongoDB Atlas)

**File:** `src/models/PolicyDocument.ts`

Each chunk is stored as a document in the `policydocuments` collection:

```json
{
  "_id": "ObjectId(...)",
  "filename": "loan_policy_document.pdf",
  "chunkIndex": 0,
  "text": "The personal loan interest rate is 10.5% per annum...",
  "embedding": [0.0234, -0.0891, 0.1456, ..., 0.0672],   // 768 floats
  "uploadedAt": "2026-04-10T07:00:00Z"
}
```

**MongoDB Atlas Vector Search Index** (`vector_index_1`):

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 768,
      "similarity": "cosine"
    }
  ]
}
```

---

### 5. Semantic Search (`$vectorSearch`)

**File:** `src/lib/embeddings/policyVectorStore.ts` → `searchPolicyContext()`

The search uses MongoDB Atlas's native `$vectorSearch` aggregation stage:

```
┌────────────────────────────────────────────────────────────────┐
│  MongoDB $vectorSearch Aggregation Pipeline                     │
│                                                                 │
│  Stage 1: $vectorSearch                                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  index:         "vector_index_1"                         │  │
│  │  path:          "embedding"                              │  │
│  │  queryVector:   [0.0312, -0.0721, ...]  (768-dim)       │  │
│  │  numCandidates: 100   ← scan 100 candidates             │  │
│  │  limit:         4     ← return top 4 results            │  │
│  │  similarity:    cosine                                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│  Stage 2: $project                                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  filename: 1                                             │  │
│  │  text: 1                                                 │  │
│  │  score: { $meta: "vectorSearchScore" }                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│  Output: [                                                      │
│    { filename: "policy.pdf", text: "...", score: 0.9234 },     │
│    { filename: "policy.pdf", text: "...", score: 0.8891 },     │
│    { filename: "policy.pdf", text: "...", score: 0.8456 },     │
│    { filename: "policy.pdf", text: "...", score: 0.8123 }      │
│  ]                                                              │
└────────────────────────────────────────────────────────────────┘
```

| Parameter | Value | Purpose |
|---|---|---|
| `numCandidates` | 100 | Number of vectors to consider during ANN (Approximate Nearest Neighbor) search |
| `limit` | 4 | Final number of top-matching chunks returned |
| `similarity` | cosine | Distance metric — measures the angle between vectors (1.0 = identical direction) |

---

### 6. Agent Integration — `searchLoanPolicy` Tool

**File:** `src/mastra/tools/searchLoanPolicy.ts`

This is the Mastra tool that bridges the AI agent and the RAG pipeline:

```
┌───────────────────────────────────────────────────────────────┐
│                    searchLoanPolicy Tool                       │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  Input Schema (Zod):                                          │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  query: z.string()                                      │ │
│  │  "The user question about loan policy, eligibility,     │ │
│  │   documents, interest rates, or process"                │ │
│  └─────────────────────────────────────────────────────────┘ │
│                          │                                    │
│                          ▼                                    │
│  Execute:                                                     │
│  1. Call searchPolicyContext(query, 4)                        │
│  2. If no matches → { found: false, message: "..." }        │
│  3. If matches   → { found: true, results: [...] }          │
│                                                               │
│  Output:                                                      │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  {                                                      │ │
│  │    found: true,                                         │ │
│  │    results: [                                           │ │
│  │      { source: "policy.pdf", content: "...", score: N } │ │
│  │    ]                                                    │ │
│  │  }                                                      │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  The LLM reads `content` from each result and synthesizes    │
│  a grounded 1-2 line answer for the user.                    │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

**When does the agent call this tool?**

The system prompt (`src/mastra/prompts/master.ts`) instructs:

> _"POLICY QUESTIONS: If user asks about rates, EMI, score, eligibility, documents at any stage → call `searchLoanPolicy`, give a 1-2 line answer, then continue the current stage."_

This means RAG is available **at every stage** of the loan application — `sales`, `kyc`, `credit`, `loan_selection`, and `done`. The user can ask policy questions anytime without disrupting the main workflow.

---

## 📊 Data Flow Diagrams

### Complete RAG Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                    ╔═══════════════════════╗                            │
│                    ║   INGESTION FLOW      ║                            │
│                    ╚═══════════════════════╝                            │
│                                                                         │
│   loan_policy.pdf                                                       │
│        │                                                                │
│        ▼                                                                │
│   ┌─────────┐     ┌──────────┐     ┌────────────┐     ┌────────────┐  │
│   │ pdf-    │────►│ chunkText│────►│ generate   │────►│ PolicyDoc  │  │
│   │ parse   │     │ (500/100)│     │ Embedding  │     │ .create()  │  │
│   │         │     │          │     │ (768-dim)  │     │            │  │
│   └─────────┘     └──────────┘     └────────────┘     └────────────┘  │
│   Raw text         N chunks         N vectors          N documents     │
│                                                                         │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│                                                                         │
│                    ╔═══════════════════════╗                            │
│                    ║   RETRIEVAL FLOW      ║                            │
│                    ╚═══════════════════════╝                            │
│                                                                         │
│   "What is FOIR?"                                                       │
│        │                                                                │
│        ▼                                                                │
│   ┌─────────────┐     ┌────────────┐     ┌──────────────┐              │
│   │ generate    │────►│ $vector    │────►│ Top-4 chunks │              │
│   │ Embedding   │     │ Search     │     │ + scores     │              │
│   │ (768-dim)   │     │ (cosine)   │     │              │              │
│   └─────────────┘     └────────────┘     └──────┬───────┘              │
│   Query vector                                   │                      │
│                                                   ▼                      │
│                                          ┌───────────────┐              │
│                                          │ LLM generates │              │
│                                          │ grounded reply│              │
│                                          │ from chunks   │              │
│                                          └───────────────┘              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### RAG Within the Multi-Stage Loan Pipeline

```
  ┌────────┐   ┌────────┐   ┌────────┐   ┌────────────────┐   ┌────────┐
  │ SALES  │──►│  KYC   │──►│ CREDIT │──►│ LOAN SELECTION │──►│  DONE  │
  └───┬────┘   └───┬────┘   └───┬────┘   └───────┬────────┘   └───┬────┘
      │            │            │                 │                 │
      │    At ANY stage, user can ask:            │                 │
      │    "What documents do I need?"            │                 │
      │    "What is the interest rate?"           │                 │
      │    "How is FOIR calculated?"              │                 │
      │            │            │                 │                 │
      └────────────┴────────────┴─────────────────┴─────────────────┘
                                    │
                                    ▼
                          ┌──────────────────┐
                          │ searchLoanPolicy │
                          │   (RAG Tool)     │
                          │                  │
                          │  query → embed   │
                          │  → $vectorSearch │
                          │  → top-4 chunks  │
                          │  → LLM answer    │
                          └──────────────────┘
```

---

## 🔧 MongoDB Vector Index Configuration

To enable vector search, you must create an **Atlas Vector Search Index** on the `policydocuments` collection.

**Index Name:** `vector_index_1`

**Index Definition:**

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 768,
      "similarity": "cosine"
    }
  ]
}
```

**How to create it:**

1. Navigate to your MongoDB Atlas cluster → **Atlas Search** tab
2. Click **Create Search Index** → choose **JSON Editor**
3. Select the `policydocuments` collection
4. Set the index name to `vector_index_1`
5. Paste the JSON definition above
6. Click **Create Search Index**

> ⚠️ **Important:** The vector search index must be created _before_ running the first query. During ingestion, documents will be stored even without the index, but `$vectorSearch` queries will fail until the index is built.

---

## 🛡️ Fallback Strategy

If the `$vectorSearch` aggregation fails (e.g., index not yet created, Atlas plan limitation, or transient error), the system gracefully falls back:

```
$vectorSearch Failed?
        │
        ▼
┌───────────────────────────────────────┐
│  FALLBACK: Recent Chunks Strategy     │
│                                       │
│  PolicyDocument.find()                │
│    .sort({ uploadedAt: -1 })          │
│    .limit(4)                          │
│    .select("filename text")           │
│                                       │
│  Returns the 4 most recently          │
│  uploaded chunks (score = 0)          │
│                                       │
│  Still provides some context for      │
│  the LLM, though not semantically     │
│  targeted to the user's question.     │
└───────────────────────────────────────┘
```

This ensures the agent always returns _some_ policy context, even if vector search is unavailable.

---

## 💡 Key Design Decisions

| Decision | Rationale |
|---|---|
| **500-char chunks with 100-char overlap** | Balances granularity (small enough for precise retrieval) with context preservation (overlap prevents sentence splitting) |
| **768-dimensional embeddings** | Native output size of Google's `gemini-embedding-001` model — no truncation or padding needed |
| **Top-4 results** | Enough context for comprehensive answers without overwhelming the LLM's context window or increasing latency |
| **100 numCandidates** | Scans a broad candidate pool for accurate ANN results, while keeping query time under ~50ms |
| **Cosine similarity** | Standard for text embeddings — measures semantic direction regardless of vector magnitude |
| **Same embedding function for ingestion & query** | Ensures both document chunks and user queries exist in the same vector space, making similarity scores meaningful |
| **Idempotent re-upload** | `deleteMany({ filename })` before re-ingesting ensures admins can update policies without duplicates |
| **Fallback to recent chunks** | Graceful degradation — if vector search fails, the LLM still gets _some_ policy context |
| **Tool available at all stages** | Users can ask policy questions anytime without disrupting the loan application flow |

---

## 📁 File Reference Map

| File | Role in RAG Pipeline |
|---|---|
| [`src/app/upload/page.tsx`](../src/app/upload/page.tsx) | Admin UI — file picker + upload button |
| [`src/app/api/policy/route.ts`](../src/app/api/policy/route.ts) | API route — receives PDF, extracts text, triggers ingestion |
| [`src/lib/embeddings/policyVectorStore.ts`](../src/lib/embeddings/policyVectorStore.ts) | **Core RAG engine** — `storePolicyDocument()` (ingestion) + `searchPolicyContext()` (retrieval) |
| [`src/lib/embeddings/embeddings.ts`](../src/lib/embeddings/embeddings.ts) | Google AI embedding wrapper — `generateEmbedding()` |
| [`src/models/PolicyDocument.ts`](../src/models/PolicyDocument.ts) | Mongoose schema for chunk documents (text + embedding + metadata) |
| [`src/mastra/tools/searchLoanPolicy.ts`](../src/mastra/tools/searchLoanPolicy.ts) | Mastra tool — bridges the AI agent to `searchPolicyContext()` |
| [`src/mastra/prompts/master.ts`](../src/mastra/prompts/master.ts) | System prompt — instructs agent when to call `searchLoanPolicy` |
| [`test/loan_policy_document.pdf`](../test/loan_policy_document.pdf) | Sample policy PDF for testing the RAG pipeline |

---

> 📖 **Related Documentation:** [tools.md](./tools.md) · [mastra.md](./mastra.md) · [models.md](./models.md) · [api.md](./api.md)
