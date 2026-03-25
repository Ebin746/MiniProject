# `src/app/` — Next.js Pages & Routes

This is the top-level **Next.js App Router** directory. It contains all UI pages and the `api/` sub-directory for backend route handlers. Next.js uses the file system to determine routes — every folder with a `page.tsx` or `route.ts` becomes a URL path.

---

## Directory Structure

```
src/app/
├── layout.tsx          # Root layout (HTML shell, global font, metadata)
├── globals.css         # Global Tailwind / base CSS
├── page.tsx            # "/" — Landing page (Finance Bot marketing page)
├── favicon.ico
│
├── login/              # "/login" — Login page
├── signup/             # "/signup" — Signup / registration page
├── chat/               # "/chat" — Main chat UI (the loan assistant interface)
├── upload/             # "/upload" — Admin panel to upload loan policy PDFs
│
└── api/                # All backend API routes (see api/docs/README.md)
```

---

## Pages

### `/` — Landing Page (`page.tsx`)
The public marketing page for "Finance Bot". Contains:
- Navigation bar with Log In / Get Started links
- Hero section (headline + chat UI mockup)
- "How It Works" section (3 steps)
- Features section (Fast, AI-Driven, Secure)
- User reviews section
- Footer

### `/login` and `/signup`
Authentication pages. They POST credentials to `/api/auth/login` and `/api/auth/signup` respectively. On success, the server sets an HTTP-only JWT cookie and redirects to `/chat`.

### `/chat`
The core application. A WhatsApp-style chat interface where the user interacts with "Aria" (the Master Agent). Messages are sent as POST requests to `/api/chat`. Document uploads (Aadhaar, salary slip) are processed via `/api/ocr` and injected into the next chat message.

### `/upload`
An admin/internal page that allows uploading a loan policy PDF. On upload, it calls `/api/policy` which stores the extracted text as vector-searchable chunks in MongoDB.

---

## Global Files

| File           | Purpose                                                        |
|----------------|----------------------------------------------------------------|
| `layout.tsx`   | Wraps all pages; sets `<html>`, `<body>`, font (`Inter`), and OG metadata |
| `globals.css`  | Imports Tailwind base layers and sets CSS root variables       |
