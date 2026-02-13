import { createTool } from '@mastra/core';
import { z } from 'zod';

export const updateProfile = createTool({
    id: 'updateProfile',
    description: 'Update the user profile with provided data. Use ONLY for non-empty values.',
    inputSchema: z.object({
        name: z.string().describe('Full name. Pass ONLY if provided.'),
        income: z.union([z.number(), z.string()]).describe('Monthly income. Pass ONLY if provided.'),
        employment: z.string().describe('Employment type. Pass ONLY if provided.'),
    }).partial(), // Keep as partial so agent can pass only what it has
    execute: async ({ context }) => {
        return {
            ...context,
            message: 'Profile updated successfully'
        };
    }
});
