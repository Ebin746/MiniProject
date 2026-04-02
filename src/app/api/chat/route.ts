import { NextResponse } from "next/server";
import { masterAgent } from "@/mastra/agents/master";
import { memory } from "@/mastra/memory";
import { sessionManager } from "@/lib/session-manager";
import { buildUserPersistenceUpdates, processToolResults, resolveReply } from "../../../lib/chat-memory";
import { getSession as getAuthSession } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import mongoose from "mongoose";
import { decryptField } from "@/lib/field-encryption";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : ({} as Record<string, unknown>);
}

function extractUserId(authSession: Record<string, unknown>): string | null {
  const raw = authSession.userId;

  if (typeof raw === "string" && mongoose.Types.ObjectId.isValid(raw)) {
    return raw;
  }

  if (raw && typeof raw === "object") {
    const rec = raw as Record<string, unknown>;
    const oid = rec.$oid;
    if (typeof oid === "string" && mongoose.Types.ObjectId.isValid(oid)) {
      return oid;
    }
    const maybeToString = (raw as { toString?: () => string }).toString;
    if (typeof maybeToString === "function") {
      const value = maybeToString.call(raw);
      if (typeof value === "string" && mongoose.Types.ObjectId.isValid(value)) {
        return value;
      }
    }
  }

  return null;
}

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
      await dbConnect();
      const userDoc = await User.findById(session.userId)
        .select("verification documents.pan")
        .lean();

      let returningEligible = Boolean(
        userDoc?.verification?.eligibleApproved &&
        userDoc?.verification?.hasVerifiedKyc &&
        userDoc?.verification?.hasVerifiedPan
      );

      let savedPan = "";
      const encryptedPan = userDoc?.documents?.pan;
      if (returningEligible && typeof encryptedPan === "string" && encryptedPan.trim()) {
        try {
          savedPan = decryptField(encryptedPan).trim().toUpperCase();
        } catch (decryptError) {
          console.error("[API/Chat] Failed to decrypt saved PAN for returning user:", decryptError);
        }
      }

      if (returningEligible && !savedPan) {
        returningEligible = false;
      }

      session.returningEligible = returningEligible;
      session.savedPan = savedPan;
      session.userHydrated = true;
      session.persistedVerification = {
        hasVerifiedKyc: Boolean(userDoc?.verification?.hasVerifiedKyc),
        hasVerifiedPan: Boolean(userDoc?.verification?.hasVerifiedPan),
        eligibleApproved: Boolean(userDoc?.verification?.eligibleApproved),
        lastCreditScore: typeof userDoc?.verification?.lastCreditScore === "number"
          ? userDoc.verification.lastCreditScore
          : null,
        lastFoir: typeof userDoc?.verification?.lastFoir === "number"
          ? userDoc.verification.lastFoir
          : null,
      };
    }

    const returningEligible = Boolean(session.returningEligible);
    const savedPan = session.savedPan || "";

    const stage = session.stage || 'sales';

    console.log(`[API/Chat] Session: ${sessionId} | Stage: ${stage}`);

    const enrichedMessage = [
      `SESSION_CONTEXT: returning_verified_user=${returningEligible ? "true" : "false"}`,
      `SESSION_CONTEXT: current_stage=${stage}`,
      `SESSION_CONTEXT: saved_pan=${savedPan || ""}`,
      message,
    ].join("\n");

    const result = await masterAgent(stage).generate(enrichedMessage, {
      threadId: sessionId,
      resourceId: sessionId,
    });
    
    console.log('[API/Chat] Raw LLM text response:', JSON.stringify(result.text));

    // Get working memory (facts the agent remembers)
    const workingMemory = await memory.getWorkingMemory({
      threadId: sessionId,
      resourceId: sessionId,
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

    // 3. Resolve clean text reply
    let cleanReply = resolveReply(result);

    // Fallback deduplication for LLM glitches (e.g. Llama 3 repeating itself)
    if (typeof cleanReply === 'string') {
      const lines = cleanReply.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length === 2 && lines[0] === lines[1]) {
        cleanReply = lines[0];
      }
    }

    return NextResponse.json({
      response: cleanReply,
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