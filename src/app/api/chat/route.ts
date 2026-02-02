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

    // Keep only last 4 message pairs (8 messages: 4 user + 4 assistant)
    // This ensures we maintain the most recent conversation context
    if (session.logs.length > 8) {
      session.logs = session.logs.slice(-10);
    }

    // Prepare context with structured memory
    const systemContext = `
Current User Profile:
${JSON.stringify(session.profile, null, 2)}

${session.creditResult ? `Credit Assessment Result:
${JSON.stringify(session.creditResult, null, 2)}
` : ''}

${session.selectedLoan ? `Selected Loan:
${JSON.stringify(session.selectedLoan, null, 2)}
` : ''}

${session.pdfPath ? `PDF Document: ${session.pdfPath}` : ''}

Conversation History (Last 4 message pairs):
${session.logs.join("\n")}
`;

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
    if (result.toolResults) {
      console.log('Tool results found:', result.toolResults.length);
      result.toolResults.forEach((tr: any, i) => {
        console.log(`Tool Result ${i}:`, {
          toolName: tr.toolName,
          resultType: typeof tr.result,
          resultPreview: typeof tr.result === 'string' ? tr.result.substring(0, 200) : 'object'
        });
      });
    }

    let reply = result.text || "";

    // Clean up function call syntax that shouldn't be shown to users
    reply = reply.replace(/<function=[^>]*>[\s\S]*?<\/function>/g, '').trim();
    reply = reply.replace(/<function=[^>]*\{[^}]*\}>/g, '').trim();

    // Fallback if agent returns empty response
    if (!reply || reply.length === 0) {
      console.warn('Agent returned empty response text');
      // If there are tool results (sub-agent responses), use the last one as the reply if it's text
      if (result.toolResults && result.toolResults.length > 0) {
        const lastResult = result.toolResults[result.toolResults.length - 1] as any;
        if (typeof lastResult.result === 'string' && !lastResult.result.startsWith('{')) {
          reply = lastResult.result;
          console.log('Using last tool result as reply fallback:', reply.substring(0, 50) + '...');
        } else {
          reply = "I've processed your request. What would you like to do next?";
        }
      } else {
        reply = "I'm sorry, I'm having trouble processing that. Could you please rephrase your request?";
      }
    }

    // Process tool results for specific actions (like PDF generation)
    if (result.toolResults && result.toolResults.length > 0) {
      for (const toolResult of result.toolResults) {
        const tr = toolResult as any;
        if (tr.toolName === 'generateLoanPDF' && tr.result) {
          try {
            const pdfData = typeof tr.result === 'string' ? JSON.parse(tr.result) : tr.result;
            if (pdfData.pdfPath) {
              session.pdfPath = pdfData.pdfPath;
              session.stage = 'done';
            }
          } catch (e) { console.warn('PDF parse error:', e); }
        }
      }
    }

    // Save assistant reply
    session.logs.push(`Assistant: ${reply}`);

    // Update session logs limit
    if (session.logs.length > 10) {
      session.logs = session.logs.slice(-8);
    }

    // --- RESONANT STATE EXTRACTION ---
    // Extract JSON from BOTH the reply text and ALL tool results
    const sourcesToScan = [
      reply,
      ...(result.toolResults?.map((tr: any) => typeof tr.result === 'string' ? tr.result : JSON.stringify(tr.result)) || [])
    ];

    for (const source of sourcesToScan) {
      if (!source) continue;
      const jsonMatches = Array.from(source.matchAll(/\{[\s\S]*?\}/g));

      for (const match of jsonMatches as any[]) {
        try {
          const data = JSON.parse(match[0]);

          // Profile updates
          if (data.name || data.income || data.employment || data.existing_emi || data.job) {
            session.profile = {
              ...session.profile,
              ...data,
              employment: data.employment || data.job || session.profile.employment
            };
            console.log('Updated profile from source:', session.profile);
          }

          // Credit updates
          if (data.eligible !== undefined && (data.foir !== undefined || data.risk)) {
            session.creditResult = {
              foir: data.foir ?? 0,
              risk: data.risk ?? 'MEDIUM',
              eligible: data.eligible,
              explanation: data.explanation || ''
            };
            console.log('Updated credit result from source:', session.creditResult);
          }

          // Loan selection updates
          if (data.loanName || data.selectedLoan || (data.amount && data.tenure)) {
            const loanData = data.selectedLoan || data;
            session.selectedLoan = {
              name: loanData.loanName || loanData.name || 'Personal Loan',
              amount: loanData.loanAmount || loanData.amount,
              tenure: loanData.loanTenure || loanData.tenure,
              interestRate: loanData.interestRate || loanData.interest_rate || loanData.rate
            };
            console.log('Updated selected loan from source:', session.selectedLoan);
          }

          // PDF path updates
          if (data.pdfPath && !session.pdfPath) {
            session.pdfPath = data.pdfPath;
            session.stage = 'done';
            console.log('Updated PDF path from source:', session.pdfPath);
          }
        } catch (err) { /* ignore non-JSON matches */ }
      }
    }

    // Save updated session
    sessionManager.saveSession(session);

    console.log('--- SESSION END ---');
    console.log('Updated Profile:', JSON.stringify(session.profile, null, 2));
    console.log('Updated Loan:', JSON.stringify(session.selectedLoan, null, 2));
    console.log('-------------------');

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