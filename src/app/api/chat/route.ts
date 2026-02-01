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

    // Get or create session
    const session = sessionManager.getSession(sessionId);

    // Initialize profile if missing (important)
    if (!session.profile) {
      session.profile = {};
    }

    // Save user message
    session.logs.push(`User: ${message}`);

    // Keep only last 4 message pairs (8 messages: 4 user + 4 assistant)
    // This ensures we maintain the most recent conversation context
    if (session.logs.length > 8) {
      session.logs = session.logs.slice(-8);
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

    const reply = result.text;

    // Save assistant reply
    session.logs.push(`Assistant: ${reply}`);

    // Keep only last 4 message pairs (8 messages) after adding assistant reply
    if (session.logs.length > 8) {
      session.logs = session.logs.slice(-8);
    }

    // Try to extract JSON and update structured memory
    try {
      const jsonMatch = reply.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);

        // Update profile if user data is present
        if (data.name || data.income || data.employment || data.existing_emi) {
          session.profile = {
            ...session.profile,
            ...data
          };
        }

        // Update credit result if present
        if (data.foir !== undefined && data.risk && data.eligible !== undefined) {
          session.creditResult = {
            foir: data.foir,
            risk: data.risk,
            eligible: data.eligible,
            explanation: data.explanation || ''
          };
        }

        // Update selected loan if present
        if (data.loanName || data.selectedLoan) {
          const loanData = data.selectedLoan || data;
          session.selectedLoan = {
            name: loanData.loanName || loanData.name,
            amount: loanData.loanAmount || loanData.amount,
            tenure: loanData.loanTenure || loanData.tenure,
            interestRate: loanData.interestRate || loanData.interest_rate
          };
        }

        // Update PDF path if present
        if (data.pdfPath) {
          session.pdfPath = data.pdfPath;
          session.stage = 'done';
        }
      }
    } catch (err) {
      console.warn("No valid JSON found for memory update");
    }

    // Save updated session
    sessionManager.saveSession(session);

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