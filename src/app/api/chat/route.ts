import { NextResponse } from "next/server";
import { masterAgent } from "@/mastra/agents/master";
import { sessionManager } from "@/lib/session-manager";
import { appendLog, buildSystemContext, processToolResults, resolveReply } from "@/lib/chat-memory";

export async function POST(req: Request) {
  try {
    const { sessionId, message } = await req.json();

    if (!sessionId || !message) {
      return NextResponse.json(
        { error: "sessionId and message are required" },
        { status: 400 }
      );
    }

    // ── 1. Load session ──────────────────────────────────────────────────────
    const session = sessionManager.getSession(sessionId);
    if (!session.profile) session.profile = {};

    console.log('--- SESSION START ---');
    console.log('Session ID:', sessionId);
    console.log('Profile:', JSON.stringify(session.profile));
    console.log('Stage:', session.stage);
    console.log('---------------------');

    // ── 2. Record user message ───────────────────────────────────────────────
    appendLog(session, `User: ${message}`);

    // ── 3. Build context and call agent ─────────────────────────────────────
    const systemContext = buildSystemContext(session);
    console.log('System Context:', systemContext.substring(0, 200) + '...');

    const result = await masterAgent.generate([
      { role: "system", content: systemContext },
      { role: "user", content: message },
    ]);

    console.log('Agent reply:', result.text);

    // ── 4. Process tool results → update session ─────────────────────────────
    if (result.toolResults?.length > 0) {
      processToolResults(session, result.toolResults);
    }

    // ── 5. Resolve reply text ────────────────────────────────────────────────
    const reply = resolveReply(result);

    // ── 6. Record assistant reply and persist ────────────────────────────────
    appendLog(session, `Assistant: ${reply}`);
    sessionManager.saveSession(session);

    console.log('--- SESSION END ---');
    console.log('Updated Profile:', JSON.stringify(session.profile));

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