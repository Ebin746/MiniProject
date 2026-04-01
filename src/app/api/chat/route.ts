import { NextResponse } from "next/server";
import { masterAgent } from "@/mastra/agents/master";
import { memory } from "@/mastra/memory";
import { sessionManager } from "@/lib/session-manager";
import { processToolResults, resolveReply } from "@/lib/chat-memory";
import { getSession as getAuthSession } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import mongoose from "mongoose";

type LooseToolResult = {
  payload?: Record<string, unknown>;
  toolName?: string;
  name?: string;
  result?: unknown;
  args?: unknown;
  input?: unknown;
  context?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : ({} as Record<string, unknown>);
}

function parseNumeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase().trim();
  if (!normalized) return null;
  if (normalized.endsWith("k")) {
    const n = parseFloat(normalized.slice(0, -1));
    return Number.isFinite(n) ? n * 1000 : null;
  }
  if (normalized.endsWith("m")) {
    const n = parseFloat(normalized.slice(0, -1));
    return Number.isFinite(n) ? n * 1000000 : null;
  }
  const n = parseFloat(normalized.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function getToolName(tr: unknown): string {
  const row = asRecord(tr) as LooseToolResult;
  const payload = asRecord(row.payload);
  return String(payload.toolName || row.toolName || row.name || "unknown");
}

function getToolResult(tr: unknown): unknown {
  const row = asRecord(tr) as LooseToolResult;
  const payload = asRecord(row.payload);
  return payload.result ?? row.result;
}

function getToolInput(tr: unknown): Record<string, unknown> {
  const row = asRecord(tr) as LooseToolResult;
  const payload = asRecord(row.payload);
  const input = payload.args ?? payload.input ?? payload.context ?? row.args ?? row.input ?? row.context;
  return asRecord(input);
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
    await dbConnect();

    let resolvedUserId = extractUserId(authPayload);

    if (!resolvedUserId && typeof authPayload.email === "string") {
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
    const userDoc = await User.findById(session.userId).lean();
    const returningEligible = Boolean(
      userDoc?.verification?.eligibleApproved &&
      userDoc?.verification?.hasVerifiedKyc &&
      userDoc?.verification?.hasVerifiedPan
    );
    session.returningEligible = returningEligible;

    const stage = session.stage || 'sales';

    console.log(`[API/Chat] Session: ${sessionId} | Stage: ${stage}`);

    const enrichedMessage = [
      `SESSION_CONTEXT: returning_verified_user=${returningEligible ? "true" : "false"}`,
      `SESSION_CONTEXT: current_stage=${stage}`,
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

      const updates: Record<string, unknown> = {};

      for (const tr of result.toolResults) {
        const toolName = getToolName(tr);
        const toolResult: Record<string, unknown> = asRecord(getToolResult(tr));
        const toolInput = getToolInput(tr);

        if (toolName === 'updateProfile') {
          const income = parseNumeric(toolInput.income);
          if (income !== null) {
            updates['profile.monthlyIncome'] = income;
          }
        }

        if (toolName === 'verifyKYC' && toolResult['kycFailed'] === false) {
          updates['verification.hasVerifiedKyc'] = true;
          if (typeof toolInput.aadhar_no === 'string') {
            updates['documents.aadhaarNo'] = toolInput.aadhar_no.replace(/\s/g, '');
          }
          if (typeof toolInput.dob === 'string') {
            updates['documents.dob'] = toolInput.dob.trim();
          }
        }

        if (toolName === 'getCreditScore' && toolResult['success']) {
          updates['verification.hasVerifiedPan'] = true;
          if (typeof toolInput.pan === 'string') {
            updates['documents.pan'] = toolInput.pan.trim().toUpperCase();
          }
          if (typeof toolResult['score'] === 'number') {
            updates['verification.lastCreditScore'] = toolResult['score'];
          }
        }

        if (toolName === 'calculateFOIR' && toolResult) {
          if (typeof toolResult['foir'] === 'number') {
            updates['verification.lastFoir'] = toolResult['foir'];
          }
          if (toolResult['eligible'] === true) {
            updates['verification.eligibleApproved'] = true;
            updates['verification.lastEligibleAt'] = new Date();
          }
        }
      }

      if (Object.keys(updates).length > 0) {
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