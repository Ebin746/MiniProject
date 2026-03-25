# `src/lib/embeddings/` — RAG Vector Store

This folder implements the **Retrieval-Augmented Generation (RAG)** pipeline that powers the `searchLoanPolicy` tool. It allows the agent to answer user questions about interest rates, eligibility criteria, EMI rules, and other policy details based on the actual bank policy PDF — not from LLM training data.

---

## Files

### `embeddings.ts` — Embedding Model Wrapper
A thin wrapper around a Google text-embedding model. Exports:

```ts
generateEmbedding(text: string): Promise<number[]>
```

Takes a string and returns a high-dimensional vector (e.g., 768 dimensions). Used both when **indexing** policy chunks and when **querying** them at runtime.

---

### `policyVectorStore.ts` — Store & Search

#### `storePolicyDocument(filename, fullText)`
Called by `/api/policy` when an admin uploads a PDF.

**Steps:**
1. Deletes all existing MongoDB documents for this `filename` (prevents duplicates on re-upload).
2. Splits `fullText` into overlapping chunks of **500 characters** with **100-character overlap** to preserve context at boundaries.
3. For each chunk: generates an embedding → saves a `PolicyDocument` record with `{ filename, chunkIndex, text, embedding }`.

```
PDF Text → split → [chunk_0, chunk_1, ..., chunk_N]
                          ↓ (for each)
              generateEmbedding()
                          ↓
              PolicyDocument.create({ embedding, text, ... })
```

#### `searchPolicyContext(query, limit = 4)`
Called by the `searchLoanPolicy` tool at runtime when a user asks a policy question.

**Steps:**
1. Generates an embedding for the user's `query` string.
2. Runs a MongoDB Atlas **`$vectorSearch`** aggregation against the `vector_index_1` index on the `embedding` field.
3. Returns the top `limit` most semantically similar chunks with their `text`, `filename`, and `score`.
4. **Fallback**: If vector search fails (e.g., index not ready), falls back to returning the most recently uploaded chunks.

---

## MongoDB Atlas Setup Required

For vector search to work, you must create a **Vector Search index** on the `policydocuments` collection in Atlas:

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

The index name must be `"vector_index_1"` (as referenced in `policyVectorStore.ts`).

---

## Chunking Parameters

| Parameter       | Value | Rationale                                        |
|-----------------|-------|--------------------------------------------------|
| `CHUNK_SIZE`    | 500   | Small enough to be semantically focused          |
| `CHUNK_OVERLAP` | 100   | Preserves context across chunk boundaries        |

---

## Data Flow Summary

```
Admin uploads PDF
    → /api/policy
    → storePolicyDocument()
    → [chunk] → [embedding] → MongoDB PolicyDocument

User asks "what is the interest rate?"
    → searchLoanPolicy tool
    → searchPolicyContext("what is the interest rate?")
    → generateEmbedding(query)
    → $vectorSearch → top 4 matching chunks
    → Agent composes 1–2 line answer from chunks
```
