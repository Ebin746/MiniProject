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

// Tool for the Sales Agent to fetch available loan options
export const getAvailableLoans = createTool({
    id: 'getAvailableLoans',
    description: 'Fetch available personal loan options from the database.',
    inputSchema: z.object({}), // No input needed
    execute: async () => {
        // In a real app, this would be a DB call
        const loans = await import('../data/loans.json');
        return {
            loans: loans.default,
        };
    }
});
