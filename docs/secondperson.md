# 🔁 Second-Time (Returning) User — Login & Fast-Path Logic

[![JWT Auth](https://img.shields.io/badge/Auth-JWT_HTTP--Only_Cookies-orange?style=for-the-badge)](https://jwt.io/)
[![Mastra Memory](https://img.shields.io/badge/Memory-LibSQL_Working_Memory-indigo?style=for-the-badge)](https://mastra.ai/)
[![MongoDB](https://img.shields.io/badge/Persistence-MongoDB_Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)

> **The Problem:** A user who has already completed KYC (Aadhaar verification) and PAN verification in a previous session should not be forced to re-verify. The system must recognize them and offer a streamlined "fast path" to loan eligibility.

This document details the complete workflow for how the loanCopilot detects, authenticates, and fast-tracks a returning user through the loan application process.

---

## 📋 Table of Contents

- [High-Level Architecture](#-high-level-architecture)
- [First-Time vs Returning User — Comparison](#-first-time-vs-returning-user--comparison)
- [End-to-End Workflow](#-end-to-end-workflow)
  - [Phase 1 — Authentication (Login)](#phase-1--authentication-login)
  - [Phase 2 — Session Hydration](#phase-2--session-hydration-detecting-a-returning-user)
  - [Phase 3 — Returning User Chat Flow](#phase-3--returning-user-chat-flow-fast-path)
- [Detailed Component Breakdown](#-detailed-component-breakdown)
  - [1. Login & JWT](#1-login--jwt-authentication)
  - [2. Session Manager](#2-session-manager)
  - [3. Working Memory Hydration](#3-working-memory-hydration)
  - [4. Returning User Detection](#4-returning-user-detection-logic)
  - [5. Stage Machine Skip](#5-stage-machine--kyc-skip-logic)
  - [6. Prompt Switching](#6-prompt-switching--returning-user-prompts)
  - [7. Data Persistence](#7-data-persistence--user-verification-state)
- [Architecture Diagrams](#-architecture-diagrams)
- [Data Persistence Model](#-data-persistence-model)
- [Key Design Decisions](#-key-design-decisions)
- [File Reference Map](#-file-reference-map)

---

## 🏛️ High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                RETURNING USER — SYSTEM ARCHITECTURE                          │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────┐                                                            │
│   │  User opens  │                                                           │
│   │  /login page │                                                           │
│   └──────┬──────┘                                                            │
│          │ email + password                                                  │
│          ▼                                                                   │
│   ┌─────────────────────────────────────────────────────────┐               │
│   │                  AUTHENTICATION LAYER                    │               │
│   │                                                          │               │
│   │  /api/auth/login                                         │               │
│   │  ┌─────────┐  ┌──────────┐  ┌────────────┐             │               │
│   │  │ MongoDB  │─►│ bcrypt   │─►│  Sign JWT  │             │               │
│   │  │ findOne  │  │ compare  │  │  (HS256)   │             │               │
│   │  │ (email)  │  │ password │  │  24h expiry│             │               │
│   │  └─────────┘  └──────────┘  └─────┬──────┘             │               │
│   │                                    │                     │               │
│   │                          Set HTTP-only cookie            │               │
│   │                          { token: "eyJ..." }             │               │
│   └────────────────────────────┬────────────────────────────┘               │
│                                │                                             │
│          Redirect to /chat     │                                             │
│                                ▼                                             │
│   ┌─────────────────────────────────────────────────────────┐               │
│   │                 SESSION HYDRATION LAYER                   │               │
│   │                                                          │               │
│   │  /api/chat (first message)                               │               │
│   │  ┌──────────┐  ┌──────────────────┐  ┌───────────────┐ │               │
│   │  │ Verify   │─►│ Read Working     │─►│ Detect        │ │               │
│   │  │ JWT from │  │ Memory (LibSQL)  │  │ Returning     │ │               │
│   │  │ cookie   │  │ Name, PAN, KYC   │  │ User Status   │ │               │
│   │  └──────────┘  └──────────────────┘  └──────┬────────┘ │               │
│   │                                              │          │               │
│   │          returningEligible = true ◄──────────┘          │               │
│   │          savedName = "Rahul"                            │               │
│   │          savedPan = "ABCDE1234F"                        │               │
│   │                                                          │               │
│   └────────────────────────────┬────────────────────────────┘               │
│                                │                                             │
│                                ▼                                             │
│   ┌─────────────────────────────────────────────────────────┐               │
│   │                FAST-PATH AGENT LAYER                     │               │
│   │                                                          │               │
│   │  masterAgent(stage, { isReturningUser: true })           │               │
│   │  ┌────────────────────────────────────────────────────┐ │               │
│   │  │  RETURNING_USER_PROMPT loaded                      │ │               │
│   │  │  STAGE_INSTRUCTIONS_RETURNING[stage] loaded        │ │               │
│   │  │                                                    │ │               │
│   │  │  sales ──► credit ──► loan_selection ──► done      │ │               │
│   │  │        (KYC SKIPPED!)                              │ │               │
│   │  └────────────────────────────────────────────────────┘ │               │
│   │                                                          │               │
│   └─────────────────────────────────────────────────────────┘               │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## ⚖️ First-Time vs Returning User — Comparison

```
┌──────────────────────────────────────────────────────────────────────┐
│                FIRST-TIME USER JOURNEY (6 stages)                    │
│                                                                      │
│  sales ───────► kyc ───────► credit ───────► loan_selection ─► done │
│  │               │             │                │                    │
│  Collect         Aadhaar +     PAN + Credit     Show loans +         │
│  name +          DOB verify    Score + FOIR     Generate PDF         │
│  income                                                              │
│                                                                      │
│  ⏱️ ~8-12 messages                                                   │
├──────────────────────────────────────────────────────────────────────┤
│                RETURNING USER JOURNEY (4 stages — KYC skipped)       │
│                                                                      │
│  sales ──────────────────► credit ───────► loan_selection ──► done  │
│  │                           │                │                      │
│  Collect current             Use saved PAN    Show loans +           │
│  income ONLY                 from memory      Generate PDF           │
│  (name already               for credit                              │
│   known)                     check                                   │
│                                                                      │
│  ⏱️ ~4-6 messages (2x faster!)                                       │
└──────────────────────────────────────────────────────────────────────┘
```

| Aspect | First-Time User | Returning User |
|---|---|---|
| **Greeting** | "Hi! I'm Aria, your loanCopilot 😊" | "Welcome back Rahul! I already have your KYC and PAN..." |
| **Name collection** | Asked explicitly | Retrieved from working memory |
| **KYC stage** | Full Aadhaar + DOB verification | **Skipped entirely** |
| **PAN** | Asked during credit stage | Loaded from `savedPan` in session |
| **Income** | Asked during sales | Still asked (may have changed) |
| **Prompt template** | `FIRST_TIME_USER_PROMPT` | `RETURNING_USER_PROMPT` |
| **Stage instructions** | `STAGE_INSTRUCTIONS_FIRST_TIME` | `STAGE_INSTRUCTIONS_RETURNING` |
| **Stage flow** | sales → kyc → credit → loan_selection → done | sales → credit → loan_selection → done |
| **Avg. messages** | 8-12 | 4-6 |

---

## 🔄 End-to-End Workflow

### Phase 1 — Authentication (Login)

```
 USER                          SERVER                         MONGODB
  │                              │                              │
  │  1. Navigate to /login       │                              │
  │                              │                              │
  │  2. Submit email + password  │                              │
  │  ────────────────────────►   │                              │
  │  POST /api/auth/login        │                              │
  │  { email, password }         │                              │
  │                              │                              │
  │                              │  3. Normalize email          │
  │                              │  (lowercase + trim)          │
  │                              │                              │
  │                              │  4. Find user by email       │
  │                              │  ────────────────────────►   │
  │                              │  User.findOne({ email })     │
  │                              │  .select('+password')        │
  │                              │                              │
  │                              │  5. User document returned   │
  │                              │  ◄────────────────────────   │
  │                              │  { _id, name, email,         │
  │                              │    password: "$2b$10$..." }  │
  │                              │                              │
  │                              │  6. bcrypt.compare()         │
  │                              │  password vs hashed          │
  │                              │  → true ✅                   │
  │                              │                              │
  │                              │  7. Sign JWT                 │
  │                              │  { userId, name, email }     │
  │                              │  Algorithm: HS256            │
  │                              │  Expiry: 24 hours            │
  │                              │                              │
  │  8. Response + Cookie        │                              │
  │  ◄────────────────────────   │                              │
  │  Set-Cookie: token=eyJ...    │                              │
  │  { httpOnly, secure,         │                              │
  │    sameSite: lax,            │                              │
  │    maxAge: 86400 }           │                              │
  │                              │                              │
  │  9. Redirect to /chat        │                              │
  │  ────────────────────────►   │                              │
```

**Security Features:**
- Password is **never stored in plaintext** — bcrypt hashing with salt rounds = 10
- JWT is stored in an **HTTP-only cookie** — cannot be accessed by JavaScript (prevents XSS theft)
- Cookie uses `sameSite: lax` — prevents CSRF attacks
- Cookie uses `secure: true` in production — sent only over HTTPS
- JWT expires in **24 hours** — limits the damage window if a token is compromised
- In-memory JWT verification cache (**30-second TTL**) — reduces crypto verification overhead on repeated requests

---

### Phase 2 — Session Hydration (Detecting a Returning User)

This is the **core logic** that determines whether a user is returning. It happens when the user sends their **first chat message** after logging in.

```
 CHAT UI                    /api/chat ROUTE                   MASTRA MEMORY
  │                              │                              │
  │  1. Send first message       │                              │
  │  POST /api/chat              │                              │
  │  { sessionId, message }      │                              │
  │  ────────────────────────►   │                              │
  │                              │                              │
  │                              │  2. Verify JWT from          │
  │                              │  HTTP-only cookie            │
  │                              │  → { userId, name, email }   │
  │                              │                              │
  │                              │  3. Get/create session       │
  │                              │  sessionManager.getSession() │
  │                              │  → { stage: 'sales' }       │
  │                              │                              │
  │                              │  4. Check: session.          │
  │                              │  userHydrated === false?     │
  │                              │  YES → Hydrate now!         │
  │                              │                              │
  │                              │  5. Read working memory      │
  │                              │  ────────────────────────►   │
  │                              │  memory.getWorkingMemory({   │
  │                              │    threadId: sessionId,      │
  │                              │    resourceId: userId        │
  │                              │  })                          │
  │                              │                              │
  │                              │  6. Working memory returned  │
  │                              │  ◄────────────────────────   │
  │                              │  "- Name: Rahul Sharma       │
  │                              │   - Monthly Income: 55000    │
  │                              │   - PAN Card: ABCDE1234F    │
  │                              │   - KYC Status: Verified     │
  │                              │   - Current Stage: done"     │
  │                              │                              │
  │                              │  7. Extract fields:          │
  │                              │  ┌──────────────────────┐   │
  │                              │  │ Name → "Rahul"       │   │
  │                              │  │ PAN  → "ABCDE1234F"  │   │
  │                              │  │ KYC  → "Verified"    │   │
  │                              │  │ Stage → "done"       │   │
  │                              │  └──────────────────────┘   │
  │                              │                              │
  │                              │  8. Detection logic:         │
  │                              │  PAN exists? ✅              │
  │                              │  KYC === "verified"? ✅      │
  │                              │  ────────────────────────    │
  │                              │  returningEligible = TRUE   │
  │                              │                              │
  │                              │  9. Stage override:          │
  │                              │  Previous stage was "done"   │
  │                              │  → Reset to "sales" (fresh   │
  │                              │    application, but with     │
  │                              │    fast-path flag)           │
  │                              │                              │
  │                              │  10. Save to session:        │
  │                              │  ┌──────────────────────┐   │
  │                              │  │ savedName = "Rahul"  │   │
  │                              │  │ savedPan = "ABCDE.." │   │
  │                              │  │ returningEligible    │   │
  │                              │  │   = true             │   │
  │                              │  │ userHydrated = true  │   │
  │                              │  └──────────────────────┘   │
  │                              │                              │
  │                              │  11. Continue to agent       │
  │                              │  invocation with returning   │
  │                              │  user flags...               │
```

**The hydration check happens exactly once** per session (`userHydrated` flag). After the first message, all subsequent messages in the same session skip this step.

---

### Phase 3 — Returning User Chat Flow (Fast Path)

```
 USER                      ARIA (Returning Mode)              SYSTEM
  │                              │                              │
  │  "Hi"                        │                              │
  │  ────────────────────────►   │                              │
  │                              │                              │
  │                              │  SESSION_CONTEXT injected:   │
  │                              │  returning_verified_user=true│
  │                              │  saved_name=Rahul            │
  │                              │  saved_pan=ABCDE1234F        │
  │                              │                              │
  │  "Welcome back Rahul! 😊     │                              │
  │   I already have your KYC    │                              │
  │   and PAN. What's your      │                              │
  │   current monthly income?"  │                              │
  │  ◄────────────────────────   │                              │
  │                              │                              │
  │  "My income is 65000"        │                              │
  │  ────────────────────────►   │                              │
  │                              │  Calls updateProfile         │
  │                              │  { income: 65000 }           │
  │                              │                              │
  │                              │  processToolResults():       │
  │                              │  stage changes: sales →      │
  │                              │  CREDIT (KYC SKIPPED! 🚀)   │
  │                              │                              │
  │  "Got it! I have your KYC    │                              │
  │   and PAN, shall I run a     │                              │
  │   quick eligibility check?"  │                              │
  │  ◄────────────────────────   │                              │
  │                              │                              │
  │  "Yes please"                │                              │
  │  ────────────────────────►   │                              │
  │                              │  Calls getCreditScore        │
  │                              │  (using saved PAN)           │
  │                              │  Calls calculateFOIR         │
  │                              │                              │
  │  "Your score is 742 and      │                              │
  │   FOIR is 35% — you're      │                              │
  │   eligible! 🎉"              │                              │
  │  ◄────────────────────────   │                              │
  │                              │                              │
  │                              │  Stage → loan_selection      │
  │                              │                              │
  │  ... loan selection and PDF generation continues ...        │
```

---

## 📦 Detailed Component Breakdown

### 1. Login & JWT Authentication

**Files:** `src/app/api/auth/login/route.ts`, `src/lib/auth.ts`

```
┌──────────────────────────────────────────────────────────┐
│                     LOGIN FLOW                            │
│                                                           │
│  Input: { email, password }                               │
│                                                           │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐           │
│  │ Normalize│───►│ DB Lookup│───►│ bcrypt   │           │
│  │ email    │    │ findOne  │    │ compare  │           │
│  └──────────┘    └──────────┘    └────┬─────┘           │
│                                       │                  │
│                                  Match? ──No──► 400      │
│                                       │                  │
│                                      Yes                 │
│                                       │                  │
│                                       ▼                  │
│                                 ┌──────────┐             │
│                                 │ Sign JWT │             │
│                                 │ HS256    │             │
│                                 │ 24h exp  │             │
│                                 └────┬─────┘             │
│                                      │                   │
│                                      ▼                   │
│                             ┌──────────────┐             │
│                             │ HTTP-only    │             │
│                             │ Cookie set   │             │
│                             │ (sameSite:lax│             │
│                             │  secure:prod)│             │
│                             └──────────────┘             │
│                                                           │
│  JWT Payload:                                             │
│  { userId: "507f1f...",                                   │
│    name: "Rahul Sharma",                                  │
│    email: "rahul@example.com" }                           │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

**JWT Verification Cache** (in `auth.ts`):

```
  Request arrives with cookie
        │
        ▼
  ┌─────────────────────────┐
  │ Is token in jwtCache    │
  │ AND expiresAt > now?    │
  │                         │
  │  YES → Return cached    │  ← Saves ~2ms per request
  │         payload         │
  │                         │
  │  NO  → Run jwtVerify()  │
  │        Cache result for │
  │        30 seconds       │
  │        Clean up expired │
  │        entries          │
  └─────────────────────────┘
```

---

### 2. Session Manager

**File:** `src/lib/session-manager.ts`

The session manager maintains an in-memory `Map<string, SessionData>` for active chat sessions:

```typescript
interface SessionData {
  sessionId: string;
  stage: 'sales' | 'kyc' | 'credit' | 'loan_selection' | 'docs' | 'done';
  userId?: string;
  returningEligible?: boolean;    // ← Key flag for returning users
  savedName?: string;             // ← Remembered from previous session
  savedPan?: string;              // ← Remembered from previous session
  userHydrated?: boolean;         // ← True after first hydration check
  persistedVerification?: {       // ← Accumulated verification state
    hasVerifiedKyc: boolean;
    hasVerifiedPan: boolean;
    eligibleApproved: boolean;
    lastCreditScore: number | null;
    lastFoir: number | null;
  };
}
```

**Fields relevant to returning users:**

| Field | Type | Purpose |
|---|---|---|
| `returningEligible` | `boolean` | `true` if user has verified KYC + PAN from a previous session |
| `savedName` | `string` | User's name from working memory — used in greeting |
| `savedPan` | `string` | User's PAN from working memory — used for credit check without re-asking |
| `userHydrated` | `boolean` | `true` after the first hydration check — prevents redundant memory reads |

---

### 3. Working Memory Hydration

**File:** `src/app/api/chat/route.ts` (lines 56-82)

When a user sends their first message, the chat route reads Mastra's **working memory** — a structured markdown blob persisted per thread by LibSQL:

```
Working Memory Format (LibSQL):
─────────────────────────────────
- Name: Rahul Sharma
- Monthly Income: 55000
- Existing EMI: 5000
- Aadhaar NO: 1234 5678 9012
- PAN Card: ABCDE1234F
- KYC Status: Verified
- Credit Score: 742
- FOIR: 35.0
- Current Stage: done
- Loan Selected: Standard Personal Loan
─────────────────────────────────
```

**The hydration algorithm:**

```
┌───────────────────────────────────────────────────────────────────┐
│                    HYDRATION ALGORITHM                             │
│                                                                   │
│  1. Read working memory from LibSQL                              │
│     memory.getWorkingMemory({ threadId, resourceId })            │
│                                                                   │
│  2. Extract fields using getWorkingMemoryField():                │
│     ┌─────────────────────────────────────────────────────┐     │
│     │  regex: /- Current Stage\s*:\s*(.*)/i               │     │
│     │  regex: /- Name\s*:\s*(.*)/i                        │     │
│     │  regex: /- PAN Card\s*:\s*(.*)/i                    │     │
│     │  regex: /- KYC Status\s*:\s*(.*)/i                  │     │
│     └─────────────────────────────────────────────────────┘     │
│                                                                   │
│  3. Determine returning status:                                  │
│     ┌─────────────────────────────────────────────────────┐     │
│     │  hasRememberedVerification =                        │     │
│     │    Boolean(rememberedPan)          // PAN exists?   │     │
│     │    && rememberedKycStatus === "verified"  // KYC ✅ │     │
│     └─────────────────────────────────────────────────────┘     │
│                                                                   │
│  4. If returning, override stage:                                │
│     ┌─────────────────────────────────────────────────────┐     │
│     │  if (stage === "loan_selection" ||                   │     │
│     │      stage === "docs" ||                             │     │
│     │      stage === "done")                               │     │
│     │    → stage = "sales"  // Reset for new application  │     │
│     │  else                                                │     │
│     │    → keep remembered stage                           │     │
│     └─────────────────────────────────────────────────────┘     │
│                                                                   │
│  5. Set session flags:                                           │
│     session.returningEligible = true                             │
│     session.savedName = rememberedName                           │
│     session.savedPan = rememberedPan                             │
│     session.userHydrated = true                                  │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

### 4. Returning User Detection Logic

**File:** `src/app/api/chat/route.ts` (lines 75-81)

The detection is a **two-condition check**:

```
                    ┌─────────────────┐
                    │ Read Working    │
                    │ Memory from     │
                    │ LibSQL          │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ Extract PAN     │
                    │ from memory     │
                    └────────┬────────┘
                             │
                ┌────────────▼────────────┐
                │    Is PAN non-empty?     │
                └──────┬──────────┬───────┘
                       │          │
                      YES         NO
                       │          │
              ┌────────▼────────┐ │
              │ Is KYC Status   │ │
              │ === "verified"? │ │
              └──┬──────────┬──┘ │
                 │          │    │
                YES         NO   │
                 │          │    │
                 ▼          ▼    ▼
         ┌──────────┐  ┌──────────┐
         │RETURNING │  │FIRST-TIME│
         │ELIGIBLE  │  │USER      │
         │= true    │  │= false   │
         └──────────┘  └──────────┘
```

**Both conditions must be true:**
1. ✅ PAN Card exists in working memory (non-empty string)
2. ✅ KYC Status is exactly `"verified"` (case-insensitive)

If either condition fails, the user is treated as a first-time applicant.

---

### 5. Stage Machine — KYC Skip Logic

**File:** `src/lib/chat-memory.ts` → `processToolResults()` (line 58)

The magic happens in one critical line of the stage transition logic:

```typescript
if (tName === 'updateProfile') {
  if (session.stage === 'sales') {
    session.stage = session.returningEligible ? 'credit' : 'kyc';
    //              ▲▲▲ THIS IS THE KYC SKIP ▲▲▲
  }
}
```

**Visual representation:**

```
                    ┌─────────────┐
                    │   SALES     │
                    │   STAGE     │
                    └──────┬──────┘
                           │
                    updateProfile
                    tool called
                           │
               ┌───────────▼──────────┐
               │ returningEligible?    │
               └───┬──────────────┬───┘
                   │              │
                  TRUE          FALSE
                   │              │
                   ▼              ▼
            ┌──────────┐   ┌──────────┐
            │ CREDIT   │   │  KYC     │
            │ (skip!)  │   │ (normal) │
            └──────────┘   └──────────┘
            
  Returning user           First-time user
  jumps directly           must verify
  to credit check          Aadhaar + DOB
```

---

### 6. Prompt Switching — Returning User Prompts

**File:** `src/mastra/prompts/master.ts`

The `MasterAgentPrompt()` function switches between two complete prompt sets based on the `isReturningUser` flag:

```
┌─────────────────────────────────────────────────────────────────┐
│               PROMPT SELECTION LOGIC                             │
│                                                                  │
│  MasterAgentPrompt(stage, { isReturningUser })                  │
│                                                                  │
│                    ┌────────────────────┐                        │
│                    │ isReturningUser?   │                        │
│                    └──────┬─────┬───────┘                        │
│                           │     │                                │
│                         TRUE  FALSE                              │
│                           │     │                                │
│              ┌────────────▼┐   ┌▼────────────┐                  │
│              │ RETURNING   │   │ FIRST_TIME   │                  │
│              │ _USER_      │   │ _USER_       │                  │
│              │ PROMPT      │   │ PROMPT       │                  │
│              ├─────────────┤   ├──────────────┤                  │
│              │ "USER MODE: │   │ "USER MODE:  │                  │
│              │  RETURNING  │   │  FIRST-TIME  │                  │
│              │  VERIFIED   │   │  APPLICANT"  │                  │
│              │  APPLICANT" │   │              │                  │
│              │             │   │ Treat as     │                  │
│              │ Greet by    │   │ fresh        │                  │
│              │ name, skip  │   │ journey.     │                  │
│              │ verified    │   │ Collect      │                  │
│              │ details.    │   │ everything." │                  │
│              └──────┬──────┘   └──────┬───────┘                  │
│                     │                 │                           │
│         ┌───────────▼──┐    ┌────────▼─────────┐                │
│         │ STAGE_INSTR_ │    │ STAGE_INSTR_     │                │
│         │ RETURNING    │    │ FIRST_TIME       │                │
│         │ [stage]      │    │ [stage]          │                │
│         └──────────────┘    └──────────────────┘                │
│                                                                  │
│  Final prompt = BASE_PROMPT + modePrompt + stageInstructions    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Key differences in returning user's `sales` stage instructions:**

| Aspect | First-Time | Returning |
|---|---|---|
| First message | "Greet warmly and ask for name and income" | "Welcome back {saved_name}! I already have your KYC and PAN. Please share your current monthly income." |
| Data collected | Name + Monthly Income | Monthly Income only |
| After update | "Let's move on to verifying your identity" | "I already have your KYC and PAN, so I can directly check your eligibility now. Should I continue?" |
| Next stage | → KYC | → Credit (KYC skipped) |

---

### 7. Data Persistence — User Verification State

**File:** `src/lib/chat-memory.ts` → `buildUserPersistenceUpdates()`

As the user progresses through stages, their verification state is persisted to MongoDB via `User.updateOne()`:

```
Tool Result                          MongoDB Update
─────────────                        ──────────────

verifyKYC → success         ──►     verification.hasVerifiedKyc = true
                                     documents.aadhaarNo = "1234..."
                                     documents.dob = "1990-01-15"

getCreditScore → success    ──►     verification.hasVerifiedPan = true
                                     documents.pan = "ABCDE1234F"
                                     verification.lastCreditScore = 742

calculateFOIR → eligible    ──►     verification.lastFoir = 35.0
                                     verification.eligibleApproved = true
                                     verification.lastEligibleAt = Date
```

This persisted data **supplements** the working memory — even if working memory is lost, the MongoDB document retains the user's verification history.

---

## 📊 Architecture Diagrams

### Complete Returning User Flow — Sequence Diagram

```
 USER          FRONTEND        /api/auth/login    /api/chat         SESSION MGR      MASTRA MEMORY
  │               │                 │                │                  │                 │
  │  Open /login  │                 │                │                  │                 │
  │  ──────────►  │                 │                │                  │                 │
  │               │                 │                │                  │                 │
  │  Submit creds │                 │                │                  │                 │
  │  ──────────►  │  POST           │                │                  │                 │
  │               │  ─────────────► │                │                  │                 │
  │               │                 │ DB lookup      │                  │                 │
  │               │                 │ bcrypt compare │                  │                 │
  │               │                 │ sign JWT       │                  │                 │
  │               │  Cookie set     │                │                  │                 │
  │               │  ◄───────────── │                │                  │                 │
  │               │                 │                │                  │                 │
  │  Redirect     │                 │                │                  │                 │
  │  to /chat     │                 │                │                  │                 │
  │               │                 │                │                  │                 │
  │  Send "Hi"    │                 │                │                  │                 │
  │  ──────────►  │                 │  POST          │                  │                 │
  │               │                 │  ────────────► │                  │                 │
  │               │                 │                │  getSession()    │                 │
  │               │                 │                │  ───────────►    │                 │
  │               │                 │                │  { stage:sales } │                 │
  │               │                 │                │  ◄───────────    │                 │
  │               │                 │                │                  │                 │
  │               │                 │                │  userHydrated?   │                 │
  │               │                 │                │  = false         │                 │
  │               │                 │                │                  │ getWorkingMemory│
  │               │                 │                │                  │ ───────────────►│
  │               │                 │                │                  │ Name: Rahul     │
  │               │                 │                │                  │ PAN: ABCDE...   │
  │               │                 │                │                  │ KYC: Verified   │
  │               │                 │                │                  │ ◄───────────────│
  │               │                 │                │                  │                 │
  │               │                 │                │  returningEligible = true          │
  │               │                 │                │  savedName = "Rahul"               │
  │               │                 │                │  savedPan = "ABCDE..."             │
  │               │                 │                │                  │                 │
  │               │                 │                │  masterAgent(    │                 │
  │               │                 │                │   "sales",       │                 │
  │               │                 │                │   {isReturning   │                 │
  │               │                 │                │    User: true})  │                 │
  │               │                 │                │                  │                 │
  │  "Welcome     │                 │                │                  │                 │
  │   back Rahul!"│                 │                │                  │                 │
  │  ◄──────────  │                 │                │                  │                 │
```

### Session Context Injection

Every chat message to the agent is **enriched** with session context:

```
┌──────────────────────────────────────────────────────────┐
│               ENRICHED MESSAGE FORMAT                     │
│                                                           │
│  Before reaching the LLM, the user's message is          │
│  prefixed with SESSION_CONTEXT lines:                    │
│                                                           │
│  ┌───────────────────────────────────────────────────┐   │
│  │ SESSION_CONTEXT: returning_verified_user=true     │   │
│  │ SESSION_CONTEXT: saved_name=Rahul Sharma          │   │
│  │ SESSION_CONTEXT: current_stage=sales              │   │
│  │ SESSION_CONTEXT: saved_pan=ABCDE1234F             │   │
│  │                                                    │   │
│  │ Hi, I want to apply for a loan                    │   │
│  └───────────────────────────────────────────────────┘   │
│                                                           │
│  The LLM reads these context lines and uses them to:     │
│  - Address user by name                                   │
│  - Acknowledge saved verification status                 │
│  - Use saved PAN for credit checks                       │
│  - Skip questions about already-known data               │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

---

## 💾 Data Persistence Model

### Where Returning User Data Lives

```
┌──────────────────────────────────────────────────────────────────┐
│                    DATA STORAGE LAYERS                            │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  LAYER 1: IN-MEMORY SESSION (session-manager.ts)            │ │
│  │  Lifetime: Single server process                            │ │
│  │                                                              │ │
│  │  ┌─────────────────────────────────────────────────────┐   │ │
│  │  │  sessionId → {                                      │   │ │
│  │  │    stage: "sales",                                  │   │ │
│  │  │    returningEligible: true,                         │   │ │
│  │  │    savedName: "Rahul",                              │   │ │
│  │  │    savedPan: "ABCDE1234F",                          │   │ │
│  │  │    userHydrated: true                               │   │ │
│  │  │  }                                                  │   │ │
│  │  └─────────────────────────────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                              │                                    │
│                              │ Hydrated from ↓                   │
│                              │                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  LAYER 2: MASTRA WORKING MEMORY (LibSQL)                    │ │
│  │  Lifetime: Persistent across sessions                       │ │
│  │                                                              │ │
│  │  ┌─────────────────────────────────────────────────────┐   │ │
│  │  │  - Name: Rahul Sharma                               │   │ │
│  │  │  - Monthly Income: 55000                             │   │ │
│  │  │  - PAN Card: ABCDE1234F                              │   │ │
│  │  │  - Aadhaar NO: 1234 5678 9012                        │   │ │
│  │  │  - KYC Status: Verified                              │   │ │
│  │  │  - Credit Score: 742                                 │   │ │
│  │  │  - Current Stage: done                               │   │ │
│  │  └─────────────────────────────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                              │                                    │
│                              │ Persisted verification also in ↓  │
│                              │                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  LAYER 3: MONGODB USER DOCUMENT                             │ │
│  │  Lifetime: Permanent                                        │ │
│  │                                                              │ │
│  │  ┌─────────────────────────────────────────────────────┐   │ │
│  │  │  {                                                  │   │ │
│  │  │    _id: "507f1f...",                                │   │ │
│  │  │    name: "Rahul Sharma",                            │   │ │
│  │  │    email: "rahul@example.com",                      │   │ │
│  │  │    verification: {                                  │   │ │
│  │  │      hasVerifiedKyc: true,                          │   │ │
│  │  │      hasVerifiedPan: true,                          │   │ │
│  │  │      eligibleApproved: true,                        │   │ │
│  │  │      lastCreditScore: 742,                          │   │ │
│  │  │      lastFoir: 35.0,                                │   │ │
│  │  │      lastEligibleAt: "2026-04-09T..."               │   │ │
│  │  │    },                                               │   │ │
│  │  │    documents: {                                     │   │ │
│  │  │      aadhaarNo: "123456789012",                     │   │ │
│  │  │      pan: "ABCDE1234F",                             │   │ │
│  │  │      dob: "1990-01-15"                              │   │ │
│  │  │    }                                                │   │ │
│  │  │  }                                                  │   │ │
│  │  └─────────────────────────────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 💡 Key Design Decisions

| Decision | Rationale |
|---|---|
| **Working memory as source of truth for returning detection** | LibSQL working memory is updated by the agent after every tool call, making it the most reliable and up-to-date source of user state. |
| **Two-condition check (PAN + KYC)** | Ensures we only fast-track users who have _fully_ verified their identity. Having just a name isn't enough — both document verifications must be complete. |
| **Stage reset to `sales` for terminal stages** | A returning user whose previous session reached `done`, `docs`, or `loan_selection` starts a fresh application from `sales` — but with the fast-path flag. This prevents "resuming" a completed/late-stage application that may have stale data. |
| **`userHydrated` flag** | Prevents redundant working memory reads on every message. The hydration check is expensive (LibSQL read + regex parsing) and only needed once per session. |
| **SESSION_CONTEXT prefix in messages** | Injects session state into the LLM's context window without modifying the system prompt. The agent reads `returning_verified_user=true` and `saved_name=Rahul` to personalize its responses. |
| **Separate prompt templates per mode** | `STAGE_INSTRUCTIONS_RETURNING` gives the agent completely different behavioral instructions from `STAGE_INSTRUCTIONS_FIRST_TIME`, ensuring the agent never accidentally asks for already-verified data. |
| **Ternary stage jump in `processToolResults()`** | `session.returningEligible ? 'credit' : 'kyc'` — A single line controls the entire KYC skip logic, keeping the state machine simple and predictable. |
| **Income always re-collected** | Even for returning users, monthly income is re-asked because it can change between sessions. Credit eligibility depends on current income, not historical. |
| **JWT in HTTP-only cookie** | Prevents XSS token theft. The token is invisible to client-side JavaScript, and is automatically sent with every request to the same domain. |
| **Verification persisted to MongoDB (Layer 3)** | Even if LibSQL working memory is cleared or the server restarts, the user's verification history survives in MongoDB. Future enhancements can use this as a fallback hydration source. |

---

## 📁 File Reference Map

| File | Role in Returning User Flow |
|---|---|
| [`src/app/api/auth/login/route.ts`](../src/app/api/auth/login/route.ts) | Authenticates user, issues JWT cookie |
| [`src/app/api/auth/signup/route.ts`](../src/app/api/auth/signup/route.ts) | Creates new user, issues JWT cookie |
| [`src/lib/auth.ts`](../src/lib/auth.ts) | JWT sign/verify utilities, in-memory verification cache |
| [`src/lib/session-manager.ts`](../src/lib/session-manager.ts) | In-memory session store — holds `returningEligible`, `savedName`, `savedPan` |
| [`src/app/api/chat/route.ts`](../src/app/api/chat/route.ts) | **Core hydration logic** — reads working memory, detects returning user, injects SESSION_CONTEXT |
| [`src/lib/chat-route-utils.ts`](../src/lib/chat-route-utils.ts) | Utility functions — `getWorkingMemoryField()`, `parseStage()`, `extractUserId()` |
| [`src/lib/chat-memory.ts`](../src/lib/chat-memory.ts) | **Stage transition logic** — `processToolResults()` contains the KYC skip ternary; `buildUserPersistenceUpdates()` persists verification to MongoDB |
| [`src/mastra/prompts/master.ts`](../src/mastra/prompts/master.ts) | **Prompt switching** — `RETURNING_USER_PROMPT`, `STAGE_INSTRUCTIONS_RETURNING` |
| [`src/mastra/agents/master.ts`](../src/mastra/agents/master.ts) | Agent factory — passes `isReturningUser` flag to prompt builder |
| [`src/models/User.ts`](../src/models/User.ts) | Mongoose schema — stores user credentials + verification history |

---

> 📖 **Related Documentation:** [app.md](./app.md) · [api.md](./api.md) · [lib.md](./lib.md) · [memory.md](./memory.md) · [prompts.md](./prompts.md)
