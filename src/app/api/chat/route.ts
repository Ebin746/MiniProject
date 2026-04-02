import { NextResponse } from "next/server";
import { masterAgent } from "@/mastra/agents/master";
import { memory } from "@/mastra/memory";
import { sessionManager } from "@/lib/session-manager";
import { buildUserPersistenceUpdates, extractPdfPath, processToolResults, resolveReply } from "../../../lib/chat-memory";
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

function isWorkingMemoryToolParseError(error: unknown): boolean {
  const serialized = (() => {
    if (error instanceof Error) {
      const details = JSON.stringify(error, Object.getOwnPropertyNames(error));
      return `${error.message || ""}\n${details}`;
    }
    return String(error ?? "");
  })();

  const lower = serialized.toLowerCase();
  const hasParseFailure = lower.includes("failed to parse tool call arguments as json");
  const hasWorkingMemoryContext =
    lower.includes("updateworkingmemory") ||
    lower.includes("# working memory") ||
    lower.includes("tool_use_failed");

  return hasParseFailure && hasWorkingMemoryContext;
}

function getWorkingMemoryField(workingMemory: string | null, label: string): string {
  if (!workingMemory) return "";
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`-\\s*${escapedLabel}\\s*:\\s*(.*)`, "i");
  const match = workingMemory.match(regex);
  return match?.[1]?.trim() || "";
}

function parseStage(value: string): "sales" | "kyc" | "credit" | "loan_selection" | "docs" | "done" | null {
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "sales" ||
    normalized === "kyc" ||
    normalized === "credit" ||
    normalized === "loan_selection" ||
    normalized === "docs" ||
    normalized === "done"
  ) {
    return normalized;
  }
  return null;
}

function patchBrokenPdfLinks(reply: string, generatedPdfPath: string | null): string {
  if (!generatedPdfPath) return reply;

  const patched = reply
    .replace(/\((?:https?:\/\/[^)\s]+)?\/pdfs\/loan_done[^)]*\)/gi, `(${generatedPdfPath})`)
    .replace(/\b(?:https?:\/\/[^\s]+)?\/pdfs\/loan_done\S*/gi, generatedPdfPath);

  // If the model renders a broken markdown link like (http://) or empty target,
  // force the known generated PDF URL for the download anchor text.
  return patched.replace(/\[\s*Download\s+your\s+PDF\s*\]\([^)]*\)/gi, `[Download your PDF](${generatedPdfPath})`);
}

function setWorkingMemoryField(workingMemory: string, label: string, value: string): string {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const fieldRegex = new RegExp(`(-\\s*${escapedLabel}\\s*:\\s*).*$`, "im");
  if (fieldRegex.test(workingMemory)) {
    return workingMemory.replace(fieldRegex, `$1${value}`);
  }
  return workingMemory;
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
      const rememberedWorkingMemory = await memory.getWorkingMemory({
        threadId: sessionId,
        resourceId: session.userId,
      });

      const rememberedStage = parseStage(getWorkingMemoryField(rememberedWorkingMemory, "Current Stage"));
      if (rememberedStage) {
        session.stage = rememberedStage;
      }

      const rememberedName = getWorkingMemoryField(rememberedWorkingMemory, "Name");
      if (rememberedName) {
        session.savedName = rememberedName;
      }

      const rememberedPan = getWorkingMemoryField(rememberedWorkingMemory, "PAN Card").toUpperCase();
      const rememberedKycStatus = getWorkingMemoryField(rememberedWorkingMemory, "KYC Status").toLowerCase();
      const hasRememberedVerification = Boolean(rememberedPan) && rememberedKycStatus === "verified";

      if (hasRememberedVerification) {
        session.returningEligible = true;
        session.savedPan = rememberedPan;
        session.userHydrated = true;
      } else {
        await dbConnect();
        const userDoc = await User.findById(session.userId)
          .select("name verification documents.pan")
          .lean();

        if (typeof userDoc?.name === "string" && userDoc.name.trim()) {
          session.savedName = userDoc.name.trim();
        }

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
    }

    const returningEligible = Boolean(session.returningEligible);
    const savedName = session.savedName || "";
    const savedPan = session.savedPan || "";

    const stage = session.stage || 'sales';

    console.log(`[API/Chat] Session: ${sessionId} | Stage: ${stage}`);

    const enrichedMessage = [
      `SESSION_CONTEXT: returning_verified_user=${returningEligible ? "true" : "false"}`,
      `SESSION_CONTEXT: saved_name=${savedName}`,
      `SESSION_CONTEXT: current_stage=${stage}`,
      `SESSION_CONTEXT: saved_pan=${savedPan || ""}`,
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