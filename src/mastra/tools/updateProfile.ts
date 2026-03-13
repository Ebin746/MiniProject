import { createTool } from '@mastra/core';
import { z } from 'zod';

export const updateProfile = createTool({
    id: 'updateProfile',
    description: 'Update the user profile with any confirmed user details. Only pass fields that have actual values.',
    inputSchema: z.object({
        name:         z.string().optional().describe('Full name.'),
        income:       z.union([z.number(), z.string()]).optional().describe('Monthly income.'),
        employment:   z.string().optional().describe('Employment type (salaried/self-employed/business).'),
        existing_emi: z.number().optional().describe('Existing monthly EMI obligations.'),
        aadhaar:      z.string().optional().describe('12-digit Aadhaar number.'),
        dob:          z.string().optional().describe('Date of birth (DD/MM/YYYY).'),
        pan:          z.string().optional().describe('10-character PAN number.'),
    }),
    execute: async ({ context }) => {
        const filtered = Object.fromEntries(
            Object.entries(context).filter(([_, v]) => v !== null && v !== undefined && v !== '')
        );
        return { ...filtered, message: 'Profile updated successfully' };
    }
});