import { NextResponse } from "next/server";
import { sessionManager } from "@/lib/session-manager";
import { extractPdfPath, processToolResults } from "@/lib/utils/chat-stage-response";
import { getSession as getAuthSession } from "@/lib/auth";
import { asRecord } from "@/lib/utils/chat-context-utils";
import {
  buildCleanReply,
  buildEnrichedMessage,
  generateAgentResponse,
  getWorkingMemorySnapshot,
  hydrateSessionFromWorkingMemory,
  resolveAuthorizedUserId,
  syncStageToWorkingMemoryIfNeeded,
} from "@/lib/utils/chat-flow-service";

export async function POST(req: Request) {
  try {
    const { sessionId, message } = await req.json();

    if (!sessionId || !message) {
      return NextResponse.json(
        { error: "sessionId and message are required" },
        { status: 400 }
      );
    }

    const authSession = await getAuthSession();
    const authPayload = asRecord(authSession);

    if (!authPayload.userId && !authPayload.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = sessionManager.getSession(sessionId);

    const resolvedUserId = await resolveAuthorizedUserId(authPayload);

    if (!resolvedUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    session.userId = resolvedUserId;
    await hydrateSessionFromWorkingMemory({ session, sessionId });

    const returningEligible = Boolean(session.returningEligible);
    const savedName = session.savedName || "";
    const savedPan = session.savedPan || "";

    const stage = session.stage;

    console.log(`[API/Chat] Session: ${sessionId} | Stage: ${stage}`);

    const enrichedMessage = buildEnrichedMessage({
      message,
      stage,
      returningEligible,
      savedName,
      savedPan,
    });

    const { result, usedNoMemoryRetry } = await generateAgentResponse({
      sessionId,
      userId: session.userId,
      stage,
      returningEligible,
      enrichedMessage,
    });
    
    console.log('[API/Chat] Raw LLM text response:', JSON.stringify(result.text));

    let workingMemory = await getWorkingMemorySnapshot(sessionId, session.userId);
    console.log('💾 Working Memory:', workingMemory);

    // 1. Process tool calls to update session stage/facts
    if (result.toolResults) {
      processToolResults(session, result.toolResults);
    }

    sessionManager.saveSession(session);

    workingMemory = await syncStageToWorkingMemoryIfNeeded({
      usedNoMemoryRetry,
      workingMemory,
      sessionId,
      userId: session.userId,
      stage: session.stage,
    });

    const generatedPdfPath = result.toolResults ? extractPdfPath(result.toolResults) : null;
    const cleanReply = buildCleanReply({ result, generatedPdfPath });

    return NextResponse.json({
      response: cleanReply,
      pdfPath: generatedPdfPath,
      stage: session.stage,
      session: {
        stage: session.stage
      }
    });
  } catch (error: unknown) {
    console.error("[API/Chat] Error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}