import { createTool } from '@mastra/core';
import { z } from 'zod';
import dbConnect from '../../lib/mongodb';
import Credit from '../../models/Credit';

export const getCreditScore = createTool({
    id: 'getCreditScore',
    description: 'Fetch the credit score of a user using their PAN card number.',
    inputSchema: z.object({
        pan: z.string().describe('Permanent Account Number (PAN)'),
    }),
    execute: async ({ context }) => {
        const { pan } = context;

        try {
            await dbConnect();
            const record = await Credit.findOne({
                pan: new RegExp(`^${pan}$`, 'i')
            });

            if (record) {
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
