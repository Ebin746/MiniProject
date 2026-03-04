import { SessionData } from './session-manager';

const MAX_LOG_ENTRIES = 4;

/**
 * Appends a message to the session log and trims it to the last MAX_LOG_ENTRIES entries.
 */
export function appendLog(session: SessionData, message: string): void {
    session.logs.push(message);
    if (session.logs.length > MAX_LOG_ENTRIES) {
        session.logs = session.logs.slice(-MAX_LOG_ENTRIES);
    }
}

/**
 * Builds the compressed system context string that is injected as a system
 * message into every LLM call, giving the model awareness of the current
 * session state and recent conversation history.
 */
export function buildSystemContext(session: SessionData): string {
    const p = JSON.stringify(session.profile);
    const c = session.creditResult ? `|CREDIT:${JSON.stringify(session.creditResult)}` : '';
    const l = session.selectedLoan ? `|LOAN:${JSON.stringify(session.selectedLoan)}` : '';
    const pdf = session.pdfPath ? `|PDF:${session.pdfPath}` : '';
    const h = session.logs.join('|');
    return `PROFILE:${p}${c}${l}${pdf}\nHISTORY:${h}`;
}

/**
 * Iterates over all tool results returned by the agent and updates the
 * session accordingly.  Each tool result updates a specific slice of
 * session state so downstream calls always have the latest data.
 */
export function processToolResults(session: SessionData, toolResults: any[]): void {
    toolResults.forEach((tr: any, i) => {
        const tName = tr.toolName || tr.name || 'unknown';
        const payload = tr.payload || tr;
        const toolRes = payload.result || tr.result;
        const toolArgs = payload.args || tr.args;

        console.log(`Processing tool [${i}]: ${tName}`);

        // --- Profile fields (extracted from both args and result) ---
        const profileSource = { ...toolArgs, ...(typeof toolRes === 'object' ? toolRes : {}) };
        const profileFields = ['name', 'income', 'employment', 'existing_emi'];
        const extracted: Record<string, any> = {};

        profileFields.forEach(field => {
            if (profileSource[field] !== undefined &&
                profileSource[field] !== null &&
                profileSource[field] !== '') {
                extracted[field] = profileSource[field];
            }
        });

        if (Object.keys(extracted).length > 0) {
            session.profile = { ...session.profile, ...extracted };
            console.log('Updated profile:', session.profile);
        }

        // --- FOIR / credit result ---
        if (tName === 'calculateFOIR' && toolRes) {
            session.creditResult = {
                foir: toolRes.foir ?? 0,
                risk: toolRes.risk ?? 'MEDIUM',
                eligible: toolRes.eligible,
                explanation: toolRes.explanation || '',
            };
            session.stage = 'credit';
            console.log('Updated creditResult:', session.creditResult);
        }

        // --- Loan selection ---
        if (tName === 'getAvailableLoans') {
            session.stage = 'loan_selection';
        }

        // --- PDF generated ---
        if (tName === 'generateLoanPDF' && toolRes?.pdfPath) {
            session.pdfPath = toolRes.pdfPath;
            session.stage = 'done';
        }

        console.log(`Tool Result [${i}] raw:`, JSON.stringify(tr, null, 2));
    });
}

/**
 * Derives the final reply text from the agent result.
 * Falls back to the last tool result's message if the agent returned no text.
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
