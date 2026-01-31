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

        console.log(`[DEBUG] Session ID: ${sessionId}`);
        console.log(`[DEBUG] Incoming Message: ${message}`);

        const { masterAgent } = mastra.getAgents();

        // DELEGATE EVERYTHING TO THE MASTER AGENT
        const context = session.logs.join('\n');

        console.log('[DEBUG] Calling Master Agent.generate()...');

        const result = await masterAgent.generate(`${context}\nUser: ${message}`, {
            onStepFinish: (step: any) => {
                console.log(`[DEBUG] STEP FINISHED:`);
                console.log(`- Step Type: ${step.type}`);
                if (step.text) console.log(`- Step Text Snippet: "${step.text.substring(0, 50)}..."`);
                if (step.toolCalls) console.log(`- Step Tool Calls: ${step.toolCalls.length}`);
            }
        });

        console.log('[DEBUG] Generation complete.');
        console.log(`[DEBUG] Total steps: ${result.steps?.length || 0}`);

        let agentResponse = result.text || '';

        // Emergency fallback: If text is empty but we have steps, try to get the text from the previous steps
        if (!agentResponse && result.steps?.length) {
            console.log('[DEBUG] result.text is empty. Searching steps for text...');
            for (let i = result.steps.length - 1; i >= 0; i--) {
                const step = result.steps[i];
                if (step.text) {
                    agentResponse = step.text;
                    console.log(`[DEBUG] Found text in step ${i}`);
                    break;
                }
            }
        }

        if (!agentResponse) {
            console.warn('[DEBUG] WARNING: NO RESPONSE TEXT FOUND.');
            agentResponse = "I have processed your request. Is there anything specific you would like to know next?";
        }

        session.logs.push(`Assistant: ${agentResponse}`);
        console.log(`[DEBUG] Final Response: "${agentResponse.substring(0, 50)}..."`);

        return NextResponse.json({ response: agentResponse, session });

    } catch (error: any) {
        console.error('Chat API Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}