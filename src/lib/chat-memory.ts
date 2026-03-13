import { SessionData } from './session-manager';


export function processToolResults(session: SessionData, toolResults: any[]): void {
  toolResults.forEach((tr: any, i) => {
    const payload = tr.payload || tr;
    const tName = payload.toolName || tr.toolName || tr.name || 'unknown';
    const toolRes = payload.result ?? tr.result;
    const toolArgs = payload.args ?? tr.args;

    console.log(`Processing tool [${i}]: ${tName}`);

    // --- updateProfile: The single source of truth for profile mutations ---
    if (tName === 'updateProfile') {
      const src = { ...toolArgs, ...(typeof toolRes === 'object' ? toolRes : {}) };
      const profileFields = ['name', 'income', 'employment', 'existing_emi', 'aadhaar', 'dob', 'pan'] as const;
      const extracted: Record<string, any> = {};

      profileFields.forEach(field => {
        if (src[field] !== undefined && src[field] !== null && src[field] !== '') {
          extracted[field] = src[field];
        }
      });



      if (session.stage === 'sales') {
        session.stage = 'kyc';
      }
    }

    if (tName === 'verifyKYC' && toolRes) {
      const verified = toolRes.kycFailed === false;
      session.stage = verified ? 'credit' : 'done';
    }

    if (tName === 'getCreditScore' && toolRes) {
      if (toolRes.creditScoreLow) session.stage = 'done';
    }

    if (tName === 'calculateFOIR' && toolRes) {
      if (session.stage === 'credit' && toolRes.eligible) {
        session.stage = 'loan_selection';
      }
    }

    if (tName === 'getAvailableLoans') {
      session.stage = 'loan_selection';
    }

    if (tName === 'generateLoanPDF' && toolRes?.pdfPath) {
      session.stage = 'done';
    }
  });
}

// ── Reply resolver ─────────────────────────────────────────────────────────

/**
 * Extracts the final reply text from the agent result.
 */
export function resolveReply(result: any): string {
  if (result.text) return result.text;

  if (result.toolResults?.length > 0) {
    const last = result.toolResults[result.toolResults.length - 1] as any;
    const res = last.payload?.result || last.result;
    return typeof res === 'string'
      ? res
      : (res?.explanation || res?.message || 'Processed.');
  }

  return "I've processed your request.";
}
