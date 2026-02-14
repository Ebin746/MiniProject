import { createTool } from '@mastra/core';
import { z } from 'zod';

export const updateProfile = createTool({
    id: 'updateProfile',
    description: 'Update the user profile with provided data. Only pass fields that have actual values.',
    inputSchema: z.object({
        name: z.string().nullable().optional().describe('Full name. Pass ONLY if provided.'),
        income: z.union([z.number(), z.string()]).nullable().optional().describe('Monthly income. Pass ONLY if provided.'),
        employment: z.string().nullable().optional().describe('Employment type. Pass ONLY if provided.'),
    }),
    execute: async ({ context }) => {
        // Filter out null and undefined values
        const filteredContext = Object.fromEntries(
            Object.entries(context).filter(([_, value]) => value !== null && value !== undefined)
        );

        return {
            ...filteredContext,
            message: 'Profile updated successfully'
        };
    }
});