import { createTool } from '@mastra/core';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

export const getCreditScore = createTool({
    id: 'getCreditScore',
    description: 'Fetch the credit score of a user using their PAN card number.',
    inputSchema: z.object({
        pan: z.string().describe('Permanent Account Number (PAN)'),
    }),
    execute: async ({ context }) => {
        const { pan } = context;

        try {
            const creditDataPath = path.join(process.cwd(), 'src', 'mastra', 'data', 'credit.json');
            const creditData = JSON.parse(fs.readFileSync(creditDataPath, 'utf8'));

            const record = creditData.find(
                (entry: any) => entry.pan.toUpperCase() === pan.toUpperCase()
            );

            if (record) {
                return {
                    success: true,
                    score: record.score,
                    message: `Credit score for PAN ${pan.toUpperCase()} is ${record.score}.`
                };
            } else {
                return {
                    success: false,
                    message: `No credit record found for PAN ${pan.toUpperCase()}. Assuming a default score of 300.`
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
