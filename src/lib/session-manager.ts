import fs from 'fs';
import path from 'path';

export interface UserProfile {
  name?: string;
  income?: number;
  employment?: string;
  existing_emi?: number;
}

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

export interface SessionData {
  sessionId: string;
  stage: 'sales' | 'credit' | 'loan_selection' | 'docs' | 'done';
  profile: UserProfile;
  creditResult?: CreditResult;
  selectedLoan?: SelectedLoan;
  pdfPath?: string;
  logs: string[];
}

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
        profile: {},
        logs: [],
      };
      this.sessions.set(sessionId, newSession);
    }
    return this.sessions.get(sessionId)!;
  }

  saveSession(session: SessionData): void {
    this.sessions.set(session.sessionId, session);
  }

  updateSession(sessionId: string, data: Partial<SessionData>): void {
    const session = this.getSession(sessionId);
    const updatedSession = { ...session, ...data };
    this.sessions.set(sessionId, updatedSession);

    if (updatedSession.stage === 'done') {
      this.persistSession(updatedSession);
    }
  }

  private persistSession(session: SessionData): void {
    const filePath = path.join(this.sessionsDir, `${session.sessionId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(session, null, 2));
  }
}

export const sessionManager = new SessionManager();