import { createTool } from '@mastra/core';
import { z } from 'zod';
import dbConnect from '../../lib/mongodb';
import Credit from '../../models/Credit';

export const getCreditScore = createTool({
    id: 'getCreditScore',
    description: 'Fetch credit score by PAN and verify PAN-Aadhaar linkage.',
    inputSchema: z.object({
        pan: z.string().describe('Permanent Account Number (PAN)'),
        aadhar_no: z.string().describe('Aadhaar number for PAN-Aadhaar linkage check.'),
    }),
    execute: async ({ context }) => {
        const pan = context.pan.trim();
        const aadharNo = context.aadhar_no.replace(/\s/g, '');

        try {
            await dbConnect();
            const record = await Credit.findOne({
                pan: new RegExp(`^${pan}$`, 'i')
            });

            if (record) {
                const linkedAadhar = typeof record.aadhar_no === 'string' ? record.aadhar_no.replace(/\s/g, '') : '';
                if (!linkedAadhar) {
                    return {
                        success: false,
                        creditScoreLow: true,
                        linkageMismatch: true,
                        scoreCategory: 'UNKNOWN',
                        message: 'PAN record is missing Aadhaar linkage in credit system. Please contact support.',
                    };
                }

                if (linkedAadhar !== aadharNo) {
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
                return {
                    success: true,
                    creditScoreLow,
                    scoreCategory,
                    score: record.score,
                    emi: record.emi || 0,
                    message: creditScoreLow
                        ? `Credit score for PAN ${pan.toUpperCase()} is ${record.score}, which is very low.`
                        : `Credit score for PAN ${pan.toUpperCase()} is ${record.score}.`
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
