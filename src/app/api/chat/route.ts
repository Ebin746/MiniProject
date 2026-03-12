import { NextResponse } from "next/server";
import { masterAgent } from "@/mastra/agents/master";
import { sessionManager } from "@/lib/session-manager";
import {
  appendShortTerm,
  buildMessages,
  processToolResults,
  resolveReply,
  updateFactualMemory,
} from "@/lib/chat-memory";

export async function POST(req: Request) {
  try {
    const { sessionId, message } = await req.json();

    if (!sessionId || !message) {
      return NextResponse.json(
        { error: "sessionId and message are required" },
        { status: 400 }
      );
    }

    // ── 1. Load session ───────────────────────────────────────────────────
    const session = sessionManager.getSession(sessionId);
    if (!session.profile) session.profile = {};

    console.log(`[${sessionId}] stage=${session.stage} profile=${JSON.stringify(session.profile)}`);

    // ── 2. Build message array: [system + last 4 pairs + current user] ────
    const messages = buildMessages(message, session);
    console.log('System Prompt:', messages[0].content);
    console.log('Short-term history length:', session.shortTermHistory.length);

    // ── 3. Call agent ─────────────────────────────────────────────────────
    const result = await masterAgent.generate(messages as any);
    console.log('Agent reply:', result.text);

    // ── 4. Process tool results → update session state ────────────────────
    if (result.toolResults?.length > 0) {
      processToolResults(session, result.toolResults);
    }

    // ── 5. Sync factual memory from updated session ───────────────────────
    updateFactualMemory(session);
    console.log('Factual Memory:', JSON.stringify(session.factualMemory));

    // ── 6. Resolve reply and record both turns in short-term history ──────
    const reply = resolveReply(result);
    appendShortTerm(session, 'user', message);
    appendShortTerm(session, 'assistant', reply);

    // ── 7. Persist ────────────────────────────────────────────────────────
    sessionManager.saveSession(session);

    return NextResponse.json({
      response: reply,
      session: session,
      profile: session.profile,
      creditResult: session.creditResult,
      selectedLoan: session.selectedLoan,
      pdfPath: session.pdfPath,
    });

  } catch (error) {
    console.error("Route Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}