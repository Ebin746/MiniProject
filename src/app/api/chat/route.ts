import { NextResponse } from 'next/server';
import { mastra } from '@/mastra';
import { sessionManager, SessionData, UserProfile, CreditResult } from '@/lib/session-manager';

export async function POST(req: Request) {
    try {
        const { sessionId, message } = await req.json();

        if (!sessionId) {
            return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
        }

        const session = sessionManager.getSession(sessionId);
        session.logs.push(`User: ${message}`);

        let agentResponse = '';
        const { salesAgent, creditAgent, masterAgent } = mastra.getAgents();

        if (session.stage === 'sales') {
            const context = session.logs.join('\n');
            const result = await salesAgent.generate(`${context}\nUser: ${message}`);
            agentResponse = result.text;

            // Check if response contains JSON profile
            try {
                const jsonMatch = agentResponse.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const profileData: UserProfile = JSON.parse(jsonMatch[0]);
                    // Basic validation to ensure it's not just a partial JSON
                    if (profileData.name && profileData.income && profileData.employment) {
                        sessionManager.updateSession(sessionId, {
                            profile: profileData,
                            stage: 'credit',
                            logs: [...session.logs, `Sales Agent: Profile extracted: ${JSON.stringify(profileData)}`]
                        });

                        // Immediately transition to credit assessment
                        const creditResult = await creditAgent.generate(JSON.stringify(profileData));
                        const creditJsonMatch = creditResult.text.match(/\{[\s\S]*\}/);

                        if (creditJsonMatch) {
                            const assessment: CreditResult = JSON.parse(creditJsonMatch[0]);
                            sessionManager.updateSession(sessionId, {
                                creditResult: assessment,
                                stage: 'done',
                                logs: [...session.logs, `Credit Agent: Assessment complete.`]
                            });

                            // Final summary from Master Agent
                            const finalSummary = await masterAgent.generate(
                                `The user ${profileData.name} has been assessed. 
                 Profile: ${JSON.stringify(profileData)}. 
                 Result: ${JSON.stringify(assessment)}. 
                 Please present this to the user.`
                            );
                            agentResponse = finalSummary.text;
                        }
                    }
                }
            } catch (e) {
                console.error('Error parsing agent output:', e);
            }
        } else if (session.stage === 'done') {
            agentResponse = "Your application is complete. Thank you!";
        }

        session.logs.push(`Assistant: ${agentResponse}`);
        return NextResponse.json({ response: agentResponse, session });

    } catch (error: any) {
        console.error('Chat API Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
