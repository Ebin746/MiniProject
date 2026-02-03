import { createTool } from '@mastra/core';
import { z } from 'zod';

export const updateProfile = createTool({
    id: 'updateProfile',
    description: 'Update the user profile with extracted data (name, income, employment, existing_emi).',
    inputSchema: z.object({
        name: z.string().optional().describe('Full name'),
        income: z.union([z.number(), z.string()]).optional().describe('Monthly income'),
        employment: z.string().optional().describe('Employment type (salaried, self-employed, etc.)'),
        existing_emi: z.union([z.number(), z.string()]).optional().describe('Total monthly EMIs'),
    }),
    execute: async ({ context }) => {
        return {
            ...context,
            message: 'Profile updated successfully'
        };
    }
});
