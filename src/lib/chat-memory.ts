import { SessionData, ChatTurn, FactualMemory } from './session-manager';

const MAX_SHORT_TERM_PAIRS = 4;          // 4 user+assistant pairs = 8 messages
const SHORT_TERM_LIMIT = MAX_SHORT_TERM_PAIRS * 2;

// ── Short-term history ─────────────────────────────────────────────────────

/**
 * Appends one turn to short-term history, capped at last 4 pairs (8 entries).
 */
export function appendShortTerm(
  session: SessionData,
  role: 'user' | 'assistant',
  content: string
): void {
  session.shortTermHistory.push({ role, content });
  if (session.shortTermHistory.length > SHORT_TERM_LIMIT) {
    session.shortTermHistory = session.shortTermHistory.slice(-SHORT_TERM_LIMIT);
  }
}

// ── Factual memory ─────────────────────────────────────────────────────────

/**
 * Rebuilds factualMemory from the current session snapshot.
 * Called after every tool-result pass so facts are always fresh.
 */
export function updateFactualMemory(session: SessionData): void {
  const mem = session.factualMemory;
  mem.stage = session.stage;

  if (session.kycResult)         mem.kycVerified   = session.kycResult.verified;
  if (session.creditResult) {
    mem.creditFOIR     = session.creditResult.foir;
    mem.creditRisk     = session.creditResult.risk;
    mem.creditEligible = session.creditResult.eligible;
  }
  if (session.selectedLoan)      mem.loanName      = session.selectedLoan.name;
  if (session.pdfPath)           mem.pdfPath       = session.pdfPath;
}

// ── System prompt ──────────────────────────────────────────────────────────

const STAGE_TASK: Record<string, string> = {
  sales:          'Collect name,income,employment → call updateProfile.',
  kyc:            'Collect Aadhaar+DOB → call verifyKYC. DO_NOT_ASK:name,income,employment.',
  credit:         'Ask PAN → getCreditScore → calculateFOIR. DO_NOT_ASK:Aadhaar,DOB,name,income.',
  loan_selection: 'Show loans via getAvailableLoans → confirm selection. DO_NOT_ASK:any personal info.',
  docs:           'Call generateLoanPDF → share download link.',
  done:           'Conversation complete. Provide closing message only.',
};

/**
 * Builds a compact system message from factual memory only (~150-220 chars).
 */
export function buildSystemPrompt(session: SessionData): string {
  const mem = session.factualMemory;
  const task = STAGE_TASK[mem.stage] ?? '';

  // Build a compact FACTS line from only the fields that exist
  const facts: string[] = [];
  if (mem.name)                       facts.push(`name=${mem.name}`);
  if (mem.income !== undefined)        facts.push(`income=${mem.income}`);
  if (mem.employment)                  facts.push(`employment=${mem.employment}`);
  if (mem.existing_emi !== undefined)  facts.push(`emi=${mem.existing_emi}`);
  if (mem.aadhaar)                     facts.push(`aadhaar=✓`);
  if (mem.dob)                         facts.push(`dob=${mem.dob}`);
  if (mem.pan)                         facts.push(`pan=✓`);
  if (mem.kycVerified !== undefined)   facts.push(`kyc=${mem.kycVerified ? 'verified' : 'failed'}`);
  if (mem.creditFOIR !== undefined)    facts.push(`foir=${mem.creditFOIR}`);
  if (mem.creditRisk)                  facts.push(`risk=${mem.creditRisk}`);
  if (mem.creditEligible !== undefined) facts.push(`eligible=${mem.creditEligible}`);
  if (mem.loanName)                    facts.push(`loan=${mem.loanName}`);
  if (mem.pdfPath)                     facts.push(`pdf=${mem.pdfPath}`);

  const factsLine = facts.length > 0 ? `FACTS:${facts.join(',')}` : 'FACTS:none';
  const systemPrompt = `STAGE:${mem.stage}\n${factsLine}\nTASK:${task}`;
  console.log(`System Context Build - Length: ${systemPrompt.length} chars`);
  return systemPrompt;
}

// ── Message assembly ───────────────────────────────────────────────────────

/**
 * Assembles the full message array for masterAgent.generate():
 *   [system] + [last 4 user/assistant pairs] + [current user message]
 */
export function buildMessages(
  userMessage: string,
  session: SessionData
): { role: string; content: string }[] {
  return [
    { role: 'system', content: buildSystemPrompt(session) },
    ...session.shortTermHistory,
    { role: 'user', content: userMessage },
  ];
}

// ── Tool result processor ──────────────────────────────────────────────────

/**
 * Iterates over all tool results and updates session state.
 * After this runs, call updateFactualMemory() to sync facts.
 */
export function processToolResults(session: SessionData, toolResults: any[]): void {
  toolResults.forEach((tr: any, i) => {
    const payload   = tr.payload || tr;
    const tName     = payload.toolName || tr.toolName || tr.name || 'unknown';
    const toolRes   = payload.result ?? tr.result;
    const toolArgs  = payload.args   ?? tr.args;

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

      if (Object.keys(extracted).length > 0) {
        session.factualMemory = { ...session.factualMemory, ...extracted };
        console.log('Factual Memory updated via updateProfile:', session.factualMemory);
      }

      if (session.stage === 'sales') {
        session.stage = 'kyc';
      }
    }

    if (tName === 'verifyKYC' && toolRes) {
      const verified = toolRes.kycFailed === false;
      session.kycResult = { verified, message: toolRes.message || '' };
      session.stage = verified ? 'credit' : 'done';
    }

    if (tName === 'getCreditScore' && toolRes) {
      if (toolRes.creditScoreLow) session.stage = 'done';
    }

    if (tName === 'calculateFOIR' && toolRes) {
      session.factualMemory.creditFOIR     = toolRes.foir        ?? 0;
      session.factualMemory.creditRisk     = toolRes.risk        ?? 'MEDIUM';
      session.factualMemory.creditEligible = toolRes.eligible;
      
      if (session.stage === 'credit' && toolRes.eligible) {
        session.stage = 'loan_selection';
      }
    }

    if (tName === 'getAvailableLoans') {
      session.stage = 'loan_selection';
    }

    if (tName === 'generateLoanPDF' && toolRes?.pdfPath) {
      session.pdfPath = toolRes.pdfPath;
      session.stage   = 'done';
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
    const res  = last.payload?.result || last.result;
    return typeof res === 'string'
      ? res
      : (res?.explanation || res?.message || 'Processed.');
  }

  return "I've processed your request.";
}
