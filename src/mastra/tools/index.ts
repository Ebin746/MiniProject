import { createTool } from '@mastra/core';
import { z } from 'zod';

// Tool for the Credit Agent to use (Sub-agent tool)
export const calculateFOIR = createTool({
    id: 'calculateFOIR',
    description: 'Calculate the Fixed Obligation to Income Ratio (FOIR).',
    inputSchema: z.object({
        income: z.number().describe('Monthly income'),
        existing_emi: z.number().describe('Total monthly EMIs'),
    }),
    execute: async ({ context }) => {
        const { income, existing_emi } = context;
        if (income === 0) return { foir: 0, error: "Income cannot be zero" };

        const foir = (existing_emi / income) * 100;
        return {
            foir: parseFloat(foir.toFixed(2)),
        };
    }
});
