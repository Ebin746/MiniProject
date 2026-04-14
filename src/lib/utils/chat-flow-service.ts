// Purpose: Central orchestration helpers for the chat API pipeline.
// Use this file to resolve authorized users, hydrate session state from working memory,
// generate agent responses with retry behavior, and normalize final reply output.
import { masterAgent } from '@/mastra/agents/master';
import { memory } from '@/mastra/memory';
import { SessionData } from '@/lib/session-manager';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { decryptPII } from '@/lib/security/pii-crypto';
import {
  asRecord,
  extractUserId,
  getWorkingMemoryField,
  isWorkingMemoryToolParseError,
  parseStage,
  patchBrokenPdfLinks,
  setWorkingMemoryField,
} from './chat-context-utils';
import { resolveReply } from './chat-stage-response';

type AgentResult = {
  text?: string;
  toolResults?: unknown[];
};

type GenerateResult = {
  result: AgentResult;
  usedNoMemoryRetry: boolean;
};

export async function resolveAuthorizedUserId(authPayload: Record<string, unknown>): Promise<string | null> {
  let resolvedUserId = extractUserId(authPayload);

  if (!resolvedUserId && typeof authPayload.email === 'string') {
    await dbConnect();
    const existingUser = await User.findOne({ email: authPayload.email.toLowerCase().trim() })
      .select('_id')
      .lean();
    if (existingUser?._id) {
      resolvedUserId = String(existingUser._id);
    }
  }

  return resolvedUserId;
}

export async function hydrateSessionFromWorkingMemory(params: {
  session: SessionData;
  sessionId: string;
}): Promise<void> {
  const { session, sessionId } = params;
  if (!session.userId || session.userHydrated) return;

  const rememberedWorkingMemory = await memory.getWorkingMemory({
    threadId: sessionId,
    resourceId: session.userId,
  });

  const rememberedStage = parseStage(getWorkingMemoryField(rememberedWorkingMemory, 'Current Stage'));
  if (rememberedStage) {
    session.stage =
      rememberedStage === 'loan_selection' || rememberedStage === 'docs' || rememberedStage === 'done'
        ? 'sales'
        : rememberedStage;
  }

  const rememberedName = getWorkingMemoryField(rememberedWorkingMemory, 'Name');
  if (rememberedName) {
    session.savedName = rememberedName;
  }

  await dbConnect();
  const userProfile = await User.findById(session.userId)
    .select('encryptedPan hasVerifiedPan hasVerifiedKyc')
    .lean();

  const encryptedPan = typeof userProfile?.encryptedPan === 'string' ? userProfile.encryptedPan : '';
  let decryptedPan = '';
  if (encryptedPan) {
    try {
      decryptedPan = decryptPII(encryptedPan).toUpperCase();
    } catch {
      decryptedPan = '';
    }
  }
  const hasRememberedVerification = Boolean(decryptedPan) && Boolean(userProfile?.hasVerifiedKyc);

  session.returningEligible = hasRememberedVerification;
  session.savedPan = hasRememberedVerification ? decryptedPan : '';
  if (hasRememberedVerification) {
    // Returning verified applicants must refresh income each new chat session.
    // Always start from sales, then transition to credit after updateProfile.
    session.stage = 'sales';
  }
  session.userHydrated = true;
}

export function buildEnrichedMessage(params: {
  message: string;
  stage: SessionData['stage'];
  returningEligible: boolean;
  savedName: string;
}): string {
  const { message, stage, returningEligible, savedName } = params;
  return [
    `SESSION_CONTEXT: returning_verified_user=${returningEligible ? 'true' : 'false'}`,
    `SESSION_CONTEXT: saved_name=${savedName}`,
    `SESSION_CONTEXT: current_stage=${stage}`,
    message,
  ].join('\n');
}

export async function generateAgentResponse(params: {
  sessionId: string;
  userId: string;
  stage: SessionData['stage'];
  returningEligible: boolean;
  enrichedMessage: string;
}): Promise<GenerateResult> {
  const { sessionId, userId, stage, returningEligible, enrichedMessage } = params;
  let result: AgentResult;
  let usedNoMemoryRetry = false;

  try {
    result = await masterAgent(stage, { isReturningUser: returningEligible }).generate(enrichedMessage, {
      threadId: sessionId,
      resourceId: userId,
      runtimeContext: {
        userId,
      } as any,
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
      resourceId: userId,
      runtimeContext: {
        userId,
      } as any,
    });
    usedNoMemoryRetry = true;
  }

  return { result, usedNoMemoryRetry };
}

export async function getWorkingMemorySnapshot(sessionId: string, userId: string): Promise<string | null> {
  return memory.getWorkingMemory({
    threadId: sessionId,
    resourceId: userId,
  });
}

export async function scrubSensitiveWorkingMemoryIfNeeded(params: {
  sessionId: string;
  userId: string;
  workingMemory: string | null;
}): Promise<string | null> {
  const { sessionId, userId, workingMemory } = params;
  if (typeof workingMemory !== 'string') {
    return workingMemory;
  }

  let next = workingMemory;
  next = setWorkingMemoryField(next, 'PAN Card', '');
  next = setWorkingMemoryField(next, 'Aadhaar NO', '');

  if (next === workingMemory) {
    return workingMemory;
  }

  await memory.updateWorkingMemory({
    threadId: sessionId,
    resourceId: userId,
    workingMemory: next,
  });

  return next;
}

export async function syncStageToWorkingMemoryIfNeeded(params: {
  usedNoMemoryRetry: boolean;
  workingMemory: string | null;
  sessionId: string;
  userId: string;
  stage: SessionData['stage'];
}): Promise<string | null> {
  const { usedNoMemoryRetry, workingMemory, sessionId, userId, stage } = params;
  if (!usedNoMemoryRetry || typeof workingMemory !== 'string') {
    return workingMemory;
  }

  const memoryStage = getWorkingMemoryField(workingMemory, 'Current Stage').toLowerCase();
  const sessionStage = stage.toLowerCase();

  if (memoryStage === sessionStage) {
    return workingMemory;
  }

  const nextWorkingMemory = setWorkingMemoryField(workingMemory, 'Current Stage', stage);
  await memory.updateWorkingMemory({
    threadId: sessionId,
    resourceId: userId,
    workingMemory: nextWorkingMemory,
  });

  return nextWorkingMemory;
}

export function hasPdfToolFailure(toolResults: unknown[] | undefined): boolean {
  if (!Array.isArray(toolResults)) return false;

  return [...toolResults].reverse().some((toolResult) => {
    const row = asRecord(toolResult);
    const payload = asRecord(row.payload);
    const toolName = String(payload.toolName || row.toolName || row.name || '');
    if (toolName !== 'generateLoanPDF') return false;
    const toolRes = asRecord(payload.result ?? row.result);
    return toolRes.success === false;
  });
}

export function buildCleanReply(params: {
  result: AgentResult;
  generatedPdfPath: string | null;
}): string {
  const { result, generatedPdfPath } = params;
  let cleanReply = resolveReply(result);

  if (hasPdfToolFailure(result.toolResults)) {
    cleanReply = "I'm sorry, I encountered a small technical issue while generating your document. Could you please select the loan option once more so I can retry right away?";
  }

  cleanReply = patchBrokenPdfLinks(cleanReply, generatedPdfPath);

  const lines = cleanReply.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 2 && lines[0] === lines[1]) {
    cleanReply = lines[0];
  }

  return cleanReply;
}
