import { NextResponse } from "next/server";
import { masterAgent } from "@/mastra/agents/master";

export async function POST(req: Request) {
  const { sessionId, message } = await req.json();

  if (!sessionId || !message) {
    return NextResponse.json(
      { error: "sessionId and message are required" },
      { status: 400 }
    );
  }

  const result = await masterAgent.generate(message, {
    threadId: sessionId,
    resourceId: sessionId,
  });

  return NextResponse.json({ response: result.text });
}