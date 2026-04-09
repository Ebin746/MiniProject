import { NextResponse } from "next/server";
import { masterAgent } from "@/mastra/agents/master";
import { memory } from "@/mastra/memory";
import { sessionManager } from "@/lib/session-manager";
import { buildUserPersistenceUpdates, extractPdfPath, processToolResults, resolveReply } from "../../../lib/chat-memory";
import { getSession as getAuthSession } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import {
  asRecord,
  extractUserId,
  getWorkingMemoryField,
  isWorkingMemoryToolParseError,
  parseStage,
  patchBrokenPdfLinks,
  setWorkingMemoryField,
} from "@/lib/chat-route-utils";
import User from "@/models/User";

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

    let resolvedUserId = extractUserId(authPayload);

    if (!resolvedUserId && typeof authPayload.email === "string") {
      await dbConnect();
      const existingUser = await User.findOne({ email: authPayload.email.toLowerCase().trim() })
        .select("_id")
        .lean();
      if (existingUser?._id) {
        resolvedUserId = String(existingUser._id);
      }
    }

    if (!resolvedUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    session.userId = resolvedUserId;
    if (!session.userHydrated) {
      const rememberedWorkingMemory = await memory.getWorkingMemory({
        threadId: sessionId,
        resourceId: session.userId,
      });

      const rememberedStage = parseStage(getWorkingMemoryField(rememberedWorkingMemory, "Current Stage"));
      if (rememberedStage) {
        // New sessions should not resume from terminal/late stages for returning users.
        session.stage = (rememberedStage === "loan_selection" || rememberedStage === "docs" || rememberedStage === "done")
          ? "sales"
          : rememberedStage;
      }

      const rememberedName = getWorkingMemoryField(rememberedWorkingMemory, "Name");
      if (rememberedName) {
        session.savedName = rememberedName;
      }

      const rememberedPan = getWorkingMemoryField(rememberedWorkingMemory, "PAN Card").toUpperCase();
      const rememberedKycStatus = getWorkingMemoryField(rememberedWorkingMemory, "KYC Status").toLowerCase();
      const hasRememberedVerification = Boolean(rememberedPan) && rememberedKycStatus === "verified";

      session.returningEligible = hasRememberedVerification;
      session.savedPan = hasRememberedVerification ? rememberedPan : "";
      session.userHydrated = true;
    }

    const returningEligible = Boolean(session.returningEligible);
    const savedName = session.savedName || "";
    const savedPan = session.savedPan || "";

    const stage = session.stage;

    console.log(`[API/Chat] Session: ${sessionId} | Stage: ${stage}`);

    const enrichedMessage = [
      `SESSION_CONTEXT: returning_verified_user=${returningEligible ? "true" : "false"}`,
      `SESSION_CONTEXT: saved_name=${savedName}`,
      `SESSION_CONTEXT: current_stage=${stage}`,
      `SESSION_CONTEXT: saved_pan=${savedPan}`,
      message,
    ].join("\n");

    let result;
    let usedNoMemoryRetry = false;
    try {
      result = await masterAgent(stage, { isReturningUser: returningEligible }).generate(enrichedMessage, {
        threadId: sessionId,
        resourceId: session.userId,
      });
    } catch (generateError) {
      if (!isWorkingMemoryToolParseError(generateError)) {
        throw generateError;
      }

      console.warn('[API/Chat] Retrying without memory after malformed updateWorkingMemory tool arguments.');
      result = await masterAgent(stage, {
        disableMemory: true,
        isReturningUser: returningEligible,
      }).generate(enrichedMessage, {
        threadId: sessionId,
        resourceId: session.userId,
      });
      usedNoMemoryRetry = true;
    }
    
    console.log('[API/Chat] Raw LLM text response:', JSON.stringify(result.text));

    // Get working memory (facts the agent remembers)
    let workingMemory = await memory.getWorkingMemory({
      threadId: sessionId,
      resourceId: session.userId,
    });
    console.log('💾 Working Memory:', workingMemory);

    // 1. Process tool calls to update session stage/facts
    if (result.toolResults) {
      processToolResults(session, result.toolResults);

      const { updates, nextState } = buildUserPersistenceUpdates(
        result.toolResults,
        session.persistedVerification || {
          hasVerifiedKyc: false,
          hasVerifiedPan: false,
          eligibleApproved: false,
          lastCreditScore: null,
          lastFoir: null,
        }
      );

      session.persistedVerification = nextState;

      if (Object.keys(updates).length > 0) {
        await dbConnect();
        await User.updateOne({ _id: session.userId }, { $set: updates });
      }
    }

    // 2. Persist session
    sessionManager.saveSession(session);

    // Keep stage consistent in memory when generation had to retry without memory tools.
    if (usedNoMemoryRetry && typeof workingMemory === 'string') {
      const memoryStage = getWorkingMemoryField(workingMemory, 'Current Stage').toLowerCase();
      const sessionStage = session.stage.toLowerCase();

      if (memoryStage !== sessionStage) {
        const nextWorkingMemory = setWorkingMemoryField(workingMemory, 'Current Stage', session.stage);
        await memory.updateWorkingMemory({
          threadId: sessionId,
          resourceId: session.userId,
          workingMemory: nextWorkingMemory,
        });
        workingMemory = nextWorkingMemory;
      }
    }

    // 3. Resolve clean text reply
    let cleanReply = resolveReply(result);
    const generatedPdfPath = result.toolResults ? extractPdfPath(result.toolResults) : null;

    const latestPdfToolFailure = Array.isArray(result.toolResults)
      ? [...result.toolResults].reverse().find((toolResult) => {
          const row = asRecord(toolResult);
          const payload = asRecord(row.payload);
          const toolName = String(payload.toolName || row.toolName || row.name || '');
          if (toolName !== 'generateLoanPDF') return false;
          const toolRes = asRecord(payload.result ?? row.result);
          return toolRes.success === false;
        })
      : null;

    if (latestPdfToolFailure) {
      cleanReply = "I'm sorry, I encountered a small technical issue while generating your document. Could you please select the loan option once more so I can retry right away?";
    }

    if (typeof cleanReply === 'string') {
      cleanReply = patchBrokenPdfLinks(cleanReply, generatedPdfPath);
    }

    // Fallback deduplication for LLM glitches (e.g. Llama 3 repeating itself)
    if (typeof cleanReply === 'string') {
      const lines = cleanReply.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length === 2 && lines[0] === lines[1]) {
        cleanReply = lines[0];
      }
    }

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