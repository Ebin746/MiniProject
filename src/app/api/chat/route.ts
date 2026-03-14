import { NextResponse } from "next/server";
import { masterAgent } from "@/mastra/agents/master";
import { memory } from "@/mastra/memory";
import { sessionManager } from "@/lib/session-manager";
import { processToolResults, resolveReply } from "@/lib/chat-memory";

export async function POST(req: Request) {
  try {
    const { sessionId, message } = await req.json();

    if (!sessionId || !message) {
      return NextResponse.json(
        { error: "sessionId and message are required" },
        { status: 400 }
      );
    }

    const session = sessionManager.getSession(sessionId);
    const stage = session.stage || 'sales';

    console.log(`[API/Chat] Session: ${sessionId} | Stage: ${stage}`);

    const result = await masterAgent(stage).generate(message, {
      threadId: sessionId,
      resourceId: sessionId,
    });
    
    console.log('[API/Chat] Raw LLM text response:', JSON.stringify(result.text));

    // Get working memory (facts the agent remembers)
    const workingMemory = await memory.getWorkingMemory({
      threadId: sessionId,
      resourceId: sessionId,
    });
    console.log('💾 Working Memory:', workingMemory);

    // 1. Process tool calls to update session stage/facts
    if (result.toolResults) {
      processToolResults(session, result.toolResults);
    }

    // 2. Persist session
    sessionManager.saveSession(session);

    // 3. Resolve clean text reply
    let cleanReply = resolveReply(result);

    // Fallback deduplication for LLM glitches (e.g. Llama 3 repeating itself)
    if (typeof cleanReply === 'string') {
      const lines = cleanReply.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length === 2 && lines[0] === lines[1]) {
        cleanReply = lines[0];
      }
    }

    return NextResponse.json({
      response: cleanReply,
      stage: session.stage,
      session: {
        stage: session.stage
      }
    });
  } catch (error: any) {
    console.error("[API/Chat] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}