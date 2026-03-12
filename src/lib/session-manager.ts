import fs from 'fs';
import path from 'path';

// ── Tool-result snapshots ──────────────────────────────────────────────────
export interface CreditResult {
  foir: number;
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  eligible: boolean;
  explanation: string;
}

export interface SelectedLoan {
  name: string;
  amount: number;
  tenure: number;
  interestRate: number;
}

export interface KycResult {
  verified: boolean;
  message: string;
}

// ── Factual Memory — single source of truth for confirmed facts ────────────
export interface FactualMemory {
  stage: string;
  // collected profile fields (only confirmed values)
  name?: string;
  income?: number;
  employment?: string;
  existing_emi?: number;
  aadhaar?: string;
  dob?: string;
  pan?: string;
  kycVerified?: boolean;
  creditFOIR?: number;
  creditRisk?: string;
  creditEligible?: boolean;
  loanName?: string;
  pdfPath?: string;
}

// ── Short-term chat turn ───────────────────────────────────────────────────
export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

// ── Session ────────────────────────────────────────────────────────────────
export interface SessionData {
  sessionId: string;
  stage: 'sales' | 'kyc' | 'credit' | 'loan_selection' | 'docs' | 'done';
  kycResult?: KycResult;
  creditResult?: CreditResult;
  selectedLoan?: SelectedLoan;
  pdfPath?: string;
  /** Confirmed facts — rebuilt after every tool call. Replaces old log blobs. */
  factualMemory: FactualMemory;
  /** Last 4 user/assistant pairs (8 entries max). Proper chat turns. */
  shortTermHistory: ChatTurn[];
}

// ── Manager ────────────────────────────────────────────────────────────────
class SessionManager {
  private sessions: Map<string, SessionData> = new Map();
  private sessionsDir = path.join(process.cwd(), 'sessions');

  constructor() {
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir);
    }
  }

  getSession(sessionId: string): SessionData {
    if (!this.sessions.has(sessionId)) {
      const newSession: SessionData = {
        sessionId,
        stage: 'sales',
        factualMemory: { stage: 'sales' },
        shortTermHistory: [],
      };
      this.sessions.set(sessionId, newSession);
    }
    return this.sessions.get(sessionId)!;
  }

  saveSession(session: SessionData): void {
    this.sessions.set(session.sessionId, session);
  }


}

export const sessionManager = new SessionManager();