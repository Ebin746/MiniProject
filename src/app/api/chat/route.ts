import { NextResponse } from 'next/server';
import { mastra } from '@/mastra';
import { sessionManager } from '@/lib/session-manager';

export async function POST(req: Request) {
    try {
        const { sessionId, message } = await req.json();

        if (!sessionId) {
            return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
        }

        const session = sessionManager.getSession(sessionId);
        session.logs.push(`User: ${message}`);

        const { masterAgent } = mastra.getAgents();

        // DELEGATE EVERYTHING TO THE MASTER AGENT
        const context = session.logs.join('\n');

        console.log('[DEBUG] Calling Master Agent with message:', message);
        const result = await masterAgent.generate(`${context}\nUser: ${message}`);

        console.log('[DEBUG] Master Agent Result text:', result.text);
        console.log('[DEBUG] Master Agent Step Count:', result.steps?.length);

        const agentResponse = result.text;

        session.logs.push(`Assistant: ${agentResponse}`);
        return NextResponse.json({ response: agentResponse, session });

    } catch (error: any) {
        console.error('Chat API Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}