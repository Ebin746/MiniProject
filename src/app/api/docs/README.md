# `src/app/api/` — Backend API Routes

All backend logic is fulfilled by **Next.js Route Handlers** (the App Router equivalent of `pages/api/`). Each sub-folder maps to a URL path under `/api/`.

---

## Routes Overview

| Route               | Method | Purpose                                       |
|---------------------|--------|-----------------------------------------------|
| `/api/auth/...`     | POST   | User signup, login, logout                    |
| `/api/chat`         | POST   | Send a message to the Mastra agent            |
| `/api/ocr`          | POST   | Extract text from uploaded documents (images/PDF) |
| `/api/policy`       | POST   | Upload a loan policy PDF and store as vectors |
| `/api/test`         | GET/POST | Internal testing endpoint                  |

---

## `/api/auth/`
Handles authentication. Reads the request body (email, password), interacts with the `User` Mongoose model, and sets/clears an HTTP-only cookie containing a JWT.

- `signup/route.ts` — Creates a new user (hashes password via `bcryptjs`).
- `login/route.ts` — Validates credentials, issues a signed JWT.
- *(implied)* logout — Clears the auth cookie.

Authentication utility logic lives in `src/lib/auth.ts`.

---

## `/api/chat/`
The most critical route. Handles a single conversational turn.

**Flow:**
1. Verify JWT cookie → reject if not authenticated.
2. Look up or create the in-memory session (includes current `stage`, `threadId`).
3. Instantiate `masterAgent(stage)` with the correct stage-aware system prompt.
4. Call `agent.generate(message, { threadId, resourceId })` — Mastra handles memory & multi-step tool calling.
5. Call `processToolResults()` to advance the session stage based on which tools fired.
6. Call `resolveReply()` to extract the text response.
7. Return `{ reply, stage }` as JSON.

---

## `/api/ocr/`
Accepts a multipart form-data upload (image or PDF). Uses an OCR library or Google Vision to extract plain text from the document.

The extracted text is returned to the frontend and then injected as a special system context block (`EXTRACTED_DOC_DATA: ...`) into the user's next chat message so the agent can silently process the document.

---

## `/api/policy/`
Accepts a PDF file upload (multipart). Extracts the full text and calls `storePolicyDocument(filename, text)` from `src/lib/embeddings/policyVectorStore.ts`, which:
1. Deletes old chunks for that filename.
2. Splits the text into 500-char overlapping chunks.
3. Generates an embedding for each chunk (Google text-embedding model).
4. Saves each chunk to the `PolicyDocument` MongoDB collection.

---

## `/api/test/`
Internal endpoint used to trigger and observe test scenarios (fake KYC, fake credit scores, etc.) without going through the full UI. Useful during development and CI.
