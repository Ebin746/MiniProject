import { NextResponse } from "next/server";
import { masterAgent } from "@/mastra/agents/master";
import { sessionManager } from "@/lib/session-manager";

export async function POST(req: Request) {
  try {
    const { sessionId, message } = await req.json();

    if (!sessionId || !message) {
      return NextResponse.json(
        { error: "sessionId and message are required" },
        { status: 400 }
      );
    }

    console.log('Received message:', message, 'for session:', sessionId);

    // Get or create session
    const session = sessionManager.getSession(sessionId);

    console.log('--- SESSION START ---');
    console.log('Session ID:', sessionId);
    console.log('Profile:', JSON.stringify(session.profile, null, 2));
    console.log('Credit:', JSON.stringify(session.creditResult, null, 2));
    console.log('Loan:', JSON.stringify(session.selectedLoan, null, 2));
    console.log('---------------------');

    // Initialize profile if missing (important)
    if (!session.profile) {
      session.profile = {};
    }

    // Save user message
    session.logs.push(`User: ${message}`);

    // Keep only last 2 message pairs (4 messages) to stay within rate limits
    if (session.logs.length > 4) {
      session.logs = session.logs.slice(-4);
    }

    // Aggressive compression for tight Groq limits
    const p = JSON.stringify(session.profile);
    const c = session.creditResult ? `|CREDIT:${JSON.stringify(session.creditResult)}` : '';
    const l = session.selectedLoan ? `|LOAN:${JSON.stringify(session.selectedLoan)}` : '';
    const h = session.logs.join("|");
    const systemContext = `PROFILE:${p}${c}${l}\nHISTORY:${h}`;

    console.log('System Context sent to agent:', systemContext.substring(0, 200) + '...');

    // Call master agent
    const result = await masterAgent.generate([
      {
        role: "system",
        content: systemContext
      },
      {
        role: "user",
        content: message
      }
    ]);

    console.log('Agent text result:', result.text);

    // Better tool result logging
    if (result.toolResults && result.toolResults.length > 0) {
      console.log('Tool results found:', result.toolResults.length);

      result.toolResults.forEach((tr: any, i) => {
        const tName = tr.toolName || tr.name || 'unknown';
        const payload = tr.payload || tr;
        const toolRes = payload.result || tr.result;
        const toolArgs = payload.args || tr.args;

        console.log(`Processing tool: ${tName}`);

        // Extract profile data from BOTH args and result (very important for persistence)
        const profileSource = { ...toolArgs, ...(typeof toolRes === 'object' ? toolRes : {}) };
        const potentialFields = ['name', 'income', 'employment', 'existing_emi'];
        const extractedData: any = {};

        potentialFields.forEach(field => {
          if (profileSource[field] !== undefined && profileSource[field] !== null && profileSource[field] !== "") {
            extractedData[field] = profileSource[field];
          }
        });

        if (Object.keys(extractedData).length > 0) {
          session.profile = { ...session.profile, ...extractedData };
          console.log('Updated profile from tool data:', session.profile);
        }

        // Specific handling for credit results
        if (tName === 'calculateFOIR' && toolRes) {
          session.creditResult = {
            foir: toolRes.foir ?? 0,
            risk: toolRes.risk ?? 'MEDIUM',
            eligible: toolRes.eligible,
            explanation: toolRes.explanation || ''
          };
          console.log('Updated credit result:', session.creditResult);
        }

        if (tName === 'generateLoanPDF' && toolRes && toolRes.pdfPath) {
          session.pdfPath = toolRes.pdfPath;
        }

        console.log(`Tool Result ${i} raw:`, JSON.stringify(tr, null, 2));
      });
    }

    let reply = result.text || "";

    // Fallback if agent returns empty response but has tool results
    if (!reply && result.toolResults && result.toolResults.length > 0) {
      const last = result.toolResults[result.toolResults.length - 1] as any;
      const res = last.payload?.result || last.result;
      reply = typeof res === 'string' ? res : (res?.explanation || res?.message || "Processed.");
    }

    if (!reply) reply = "I've processed your request.";

    // Save assistant reply
    session.logs.push(`Assistant: ${reply}`);

    if (session.logs.length > 4) {
      session.logs = session.logs.slice(-4);
    }

    // Save updated session
    sessionManager.saveSession(session);

    console.log('--- SESSION END ---');
    console.log('Updated Profile:', JSON.stringify(session.profile, null, 2));

    return NextResponse.json({
      response: reply,
      session: session,
      profile: session.profile,
      creditResult: session.creditResult,
      selectedLoan: session.selectedLoan,
      pdfPath: session.pdfPath
    });

  } catch (error) {
    console.error("Route Error:", error);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}