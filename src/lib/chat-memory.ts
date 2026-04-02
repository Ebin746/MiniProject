import { SessionData } from './session-manager';
import { encryptField } from './field-encryption';

type LooseToolResult = {
  payload?: Record<string, unknown>;
  toolName?: string;
  name?: string;
  result?: unknown;
  args?: unknown;
  input?: unknown;
  context?: unknown;
};

type AgentResult = {
  text?: string;
  toolResults?: unknown[];
};

export type UserPersistenceState = {
  hasVerifiedKyc: boolean;
  hasVerifiedPan: boolean;
  eligibleApproved: boolean;
  lastCreditScore: number | null;
  lastFoir: number | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function getToolName(tr: unknown): string {
  const row = asRecord(tr) as LooseToolResult;
  const payload = asRecord(row.payload);
  return String(payload.toolName || row.toolName || row.name || 'unknown');
}

function getToolResult(tr: unknown): Record<string, unknown> {
  const row = asRecord(tr) as LooseToolResult;
  const payload = asRecord(row.payload);
  return asRecord(payload.result ?? row.result);
}

function getToolInput(tr: unknown): Record<string, unknown> {
  const row = asRecord(tr) as LooseToolResult;
  const payload = asRecord(row.payload);
  const input = payload.args ?? payload.input ?? payload.context ?? row.args ?? row.input ?? row.context;
  return asRecord(input);
}

export function processToolResults(session: SessionData, toolResults: unknown[]): void {
  toolResults.forEach((tr: unknown, i) => {
    const row = asRecord(tr);
    const payload = asRecord(row.payload ?? row);
    const tName = payload.toolName || row.toolName || row.name || 'unknown';
    const toolRes = asRecord(payload.result ?? row.result);

    console.log(`Processing tool [${i}]: ${String(tName)}`);

    if (tName === 'updateProfile') {
      if (session.stage === 'sales') {
        session.stage = session.returningEligible ? 'credit' : 'kyc';
      }
    }

    if (tName === 'verifyKYC' && Object.keys(toolRes).length > 0) {
      const verified = toolRes.kycFailed === false;
      session.stage = verified ? 'credit' : 'done';
    }

    if (tName === 'getCreditScore' && Object.keys(toolRes).length > 0) {
      if (toolRes.creditScoreLow) session.stage = 'done';
    }

    if (tName === 'calculateFOIR' && Object.keys(toolRes).length > 0) {
      if (session.stage === 'credit' && toolRes.eligible) {
        session.stage = 'loan_selection';
      }
    }

    if (tName === 'getAvailableLoans') {
      session.stage = 'loan_selection';
    }

    if (tName === 'generateLoanPDF' && typeof toolRes.pdfPath === 'string' && toolRes.pdfPath) {
      session.stage = 'done';
    }
  });
}

export function buildUserPersistenceUpdates(
  toolResults: unknown[],
  currentState: UserPersistenceState,
): { updates: Record<string, unknown>; nextState: UserPersistenceState } {
  const updates: Record<string, unknown> = {};
  const nextState: UserPersistenceState = { ...currentState };

  for (const tr of toolResults) {
    const toolName = getToolName(tr);
    const toolResult = getToolResult(tr);
    const toolInput = getToolInput(tr);

    // Working memory already tracks profile fields. Skip monthlyIncome writes.

    if (toolName === 'verifyKYC' && toolResult.kycFailed === false && !nextState.hasVerifiedKyc) {
      nextState.hasVerifiedKyc = true;
      updates['verification.hasVerifiedKyc'] = true;

      if (typeof toolInput.aadhar_no === 'string') {
        updates['documents.aadhaarNo'] = encryptField(toolInput.aadhar_no.replace(/\s/g, ''));
      }
      if (typeof toolInput.dob === 'string') {
        updates['documents.dob'] = toolInput.dob.trim();
      }
    }

    if (toolName === 'getCreditScore' && toolResult.success) {
      if (!nextState.hasVerifiedPan) {
        nextState.hasVerifiedPan = true;
        updates['verification.hasVerifiedPan'] = true;
        if (typeof toolInput.pan === 'string') {
          updates['documents.pan'] = encryptField(toolInput.pan.trim().toUpperCase());
        }
      }

      if (typeof toolResult.score === 'number' && toolResult.score !== nextState.lastCreditScore) {
        nextState.lastCreditScore = toolResult.score;
        updates['verification.lastCreditScore'] = toolResult.score;
      }
    }

    if (toolName === 'calculateFOIR') {
      if (typeof toolResult.foir === 'number' && toolResult.foir !== nextState.lastFoir) {
        nextState.lastFoir = toolResult.foir;
        updates['verification.lastFoir'] = toolResult.foir;
      }

      if (toolResult.eligible === true && !nextState.eligibleApproved) {
        nextState.eligibleApproved = true;
        updates['verification.eligibleApproved'] = true;
        updates['verification.lastEligibleAt'] = new Date();
      }
    }
  }

  return { updates, nextState };
}

/**
 * Extracts the final reply text from the agent result.
 */
export function resolveReply(result: AgentResult): string {
  if (result.text) return result.text;

  const toolResults = result.toolResults || [];
  if (toolResults.length > 0) {
    const last = asRecord(toolResults[toolResults.length - 1]);
    const payload = asRecord(last.payload);
    const res = payload.result ?? last.result;
    const resRecord = asRecord(res);
    if (typeof res === 'string') {
      return res;
    }
    if (typeof resRecord.explanation === 'string') {
      return resRecord.explanation;
    }
    if (typeof resRecord.message === 'string') {
      return resRecord.message;
    }
    return 'Processed.';
  }

  return "I've processed your request.";
}
