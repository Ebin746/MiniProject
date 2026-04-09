import { createTool } from '@mastra/core';
import { z } from 'zod';

export const updateProfile = createTool({
    id: 'updateProfile',
    description: 'Update any confirmed user profile details. Supports partial updates (name-only, income-only, or both).',
    inputSchema: z.object({
        name: z.string().describe('Full name.'),
        income: z.string().describe('Monthly income (number or numeric string).'),
    }).partial().refine((data) => Object.keys(data).length > 0, {
        message: 'At least one profile field is required.',
    }),
    execute: async ({ context }) => {
        const filtered = Object.fromEntries(
            Object.entries(context).filter(([, v]) => v !== null && v !== undefined && v !== '')
        );
        return { ...filtered, message: 'Profile updated successfully' };
    }
});