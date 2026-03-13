
// ── Session ────────────────────────────────────────────────────────────────
export interface SessionData {
  sessionId: string;
  stage: 'sales' | 'kyc' | 'credit' | 'loan_selection' | 'docs' | 'done';
}

// ── Manager ────────────────────────────────────────────────────────────────
class SessionManager {
  private sessions: Map<string, SessionData> = new Map();


  getSession(sessionId: string): SessionData {
    if (!this.sessions.has(sessionId)) {
      const newSession: SessionData = {
        sessionId,
        stage: 'sales',
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