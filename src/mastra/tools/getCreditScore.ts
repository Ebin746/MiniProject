import { createTool } from '@mastra/core';
import { z } from 'zod';
import dbConnect from '../../lib/mongodb';
import Credit from '../../models/Credit';
import User from '../../models/User';
import { encryptPII } from '../../lib/security/pii-crypto';
import { getVerifiedUserIdentity, resolveToolUserId } from './secureUserIdentity';

export const getCreditScore = createTool({
    id: 'getCreditScore',
    description: 'Fetch credit score using secure identity data. Reads PAN/Aadhaar from encrypted profile when available.',
    inputSchema: z.object({
        pan: z.string().optional().describe('Permanent Account Number (PAN). Optional for returning verified users.'),
        aadhar_no: z.string().optional().describe('Aadhaar number for PAN-Aadhaar linkage check. Optional if already verified.'),
    }),
    execute: async (input) => {
        const context = input.context;
        const runtimeContext = (input as { runtimeContext?: unknown; resourceId?: unknown; userId?: unknown }).runtimeContext
            ?? { resourceId: (input as { resourceId?: unknown }).resourceId, userId: (input as { userId?: unknown }).userId };
        const userId = resolveToolUserId(runtimeContext);
        const secureIdentity = await getVerifiedUserIdentity(userId);

        const requestedPan = typeof context.pan === 'string' ? context.pan.trim().toUpperCase() : '';
        const requestedAadhaar = typeof context.aadhar_no === 'string' ? context.aadhar_no.replace(/\s/g, '') : '';

        const pan = requestedPan || secureIdentity.pan;
        const aadharNo = requestedAadhaar || secureIdentity.aadhaar;

        if (!pan) {
            return {
                success: false,
                creditScoreLow: true,
                scoreCategory: 'UNKNOWN',
                message: 'PAN is required for eligibility check. Please share PAN once to continue securely.',
            };
        }

        try {
            await dbConnect();
            const record = await Credit.findOne({
                pan: new RegExp(`^${pan}$`, 'i')
            });

            if (record) {
                if (requestedPan) {
                    await User.findByIdAndUpdate(
                        userId,
                        {
                            $set: {
                                encryptedPan: encryptPII(pan),
                                hasVerifiedPan: true,
                            },
                        },
                        { new: false }
                    );
                }

                const linkedAadhar = typeof record.aadhar_no === 'string' ? record.aadhar_no.replace(/\s/g, '') : '';
                if (!linkedAadhar && aadharNo) {
                    return {
                        success: false,
                        creditScoreLow: true,
                        linkageMismatch: true,
                        scoreCategory: 'UNKNOWN',
                        message: 'PAN record is missing Aadhaar linkage in credit system. Please contact support.',
                    };
                }

                if (aadharNo && linkedAadhar && linkedAadhar !== aadharNo) {
                    return {
                        success: false,
                        creditScoreLow: true,
                        linkageMismatch: true,
                        scoreCategory: 'UNKNOWN',
                        message: 'PAN and Aadhaar linkage validation failed. Please provide matching identity documents.',
                    };
                }

                const creditScoreLow = record.score < 600;
                const scoreCategory =
                    record.score >= 750 ? 'EXCELLENT' :
                        record.score >= 700 ? 'GOOD' :
                            record.score >= 650 ? 'FAIR' :
                                record.score >= 600 ? 'POOR' : 'VERY LOW';

                await User.findByIdAndUpdate(
                    userId,
                    {
                        $set: {
                            lastCreditScore: record.score,
                        },
                    },
                    { new: false }
                );

                return {
                    success: true,
                    creditScoreLow,
                    scoreCategory,
                    score: record.score,
                    emi: record.emi || 0,
                    message: creditScoreLow
                        ? `Credit score is ${record.score}, which is below the required threshold.`
                        : `Credit score is ${record.score}.`
                };
            } else {
                return {
                    success: false,
                    creditScoreLow: true,
                    scoreCategory: 'UNKNOWN',
                    message: `No credit record found for PAN ${pan.toUpperCase()}. Cannot proceed without a valid credit record.`
                };
            }
        } catch (error) {
            console.error('Credit Score Fetch Error:', error);
            return {
                success: false,
                message: 'Error accessing credit database.'
            };
        }
    }
});

export const getVerifiedUserData = createTool({
    id: 'getVerifiedUserData',
    description: 'Get secure returning-user verification flags from encrypted profile data without exposing raw PAN/Aadhaar.',
    inputSchema: z.object({}).optional(),
    execute: async (input) => {
        const runtimeContext = (input as { runtimeContext?: unknown; resourceId?: unknown; userId?: unknown }).runtimeContext
            ?? { resourceId: (input as { resourceId?: unknown }).resourceId, userId: (input as { userId?: unknown }).userId };
        const userId = resolveToolUserId(runtimeContext);
        const secureIdentity = await getVerifiedUserIdentity(userId);

        return {
            hasVerifiedKyc: secureIdentity.hasVerifiedKyc,
            hasVerifiedPan: secureIdentity.hasVerifiedPan,
            hasSensitiveIdentity: Boolean(secureIdentity.pan),
            lastCreditScore: secureIdentity.lastCreditScore,
            lastFoir: secureIdentity.lastFoir,
            message: secureIdentity.pan
                ? 'Verified identity found in secure profile store.'
                : 'No stored PAN found in secure profile store.',
        };
    },
});
