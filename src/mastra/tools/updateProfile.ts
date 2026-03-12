import { createTool } from '@mastra/core';
import { z } from 'zod';

export const updateProfile = createTool({
    id: 'updateProfile',
    description: 'Update the user profile with any confirmed user details. Only pass fields that have actual values.',
    inputSchema: z.object({
        name:         z.string().nullable().optional().describe('Full name.'),
        income:       z.union([z.number(), z.string()]).nullable().optional().describe('Monthly income.'),
        employment:   z.string().nullable().optional().describe('Employment type (salaried/self-employed/business).'),
        existing_emi: z.number().nullable().optional().describe('Existing monthly EMI obligations.'),
        aadhaar:      z.string().nullable().optional().describe('12-digit Aadhaar number.'),
        dob:          z.string().nullable().optional().describe('Date of birth (DD/MM/YYYY).'),
        pan:          z.string().nullable().optional().describe('10-character PAN number.'),
    }),
    execute: async ({ context }) => {
        const filtered = Object.fromEntries(
            Object.entries(context).filter(([_, v]) => v !== null && v !== undefined && v !== '')
        );
        return { ...filtered, message: 'Profile updated successfully' };
    }
});