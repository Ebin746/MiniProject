import { NextResponse } from "next/server";
import { masterAgent } from "@/mastra/agents/master";
import { sessionManager } from "@/lib/session-manager";
import { STAGE_INSTRUCTIONS } from "@/mastra/prompts/master";
import { processToolResults, resolveReply } from "@/lib/chat-memory";

export async function POST(req: Request) {
  try {
    const { sessionId, message } = await req.json();

    if (!sessionId || !message) {
      return NextResponse.json(
        { error: "sessionId and message are required" },
        { status: 400 }
      );
    }

    const session = sessionManager.getSession(sessionId);
    const stage = session.stage || 'sales';
    const stagePrompt = STAGE_INSTRUCTIONS[stage] || '';

    console.log(`[API/Chat] Session: ${sessionId} | Stage: ${stage}`);

    const result = await masterAgent.generate(message, {
      threadId: sessionId,
      resourceId: sessionId,
      instructions: stagePrompt, // Overrides or appends to base instructions
    });

    // 1. Process tool calls to update session stage/facts
    if (result.toolResults) {
      processToolResults(session, result.toolResults);
    }

    // 2. Persist session
    sessionManager.saveSession(session);

    // 3. Resolve clean text reply
    const cleanReply = resolveReply(result);

    return NextResponse.json({
      response: cleanReply,
      stage: session.stage,
      session: {
        stage: session.stage
      }
    });
  } catch (error: any) {
    console.error("[API/Chat] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}