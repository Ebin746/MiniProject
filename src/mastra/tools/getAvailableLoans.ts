import { createTool } from '@mastra/core';
import { z } from 'zod';
import dbConnect from '../../lib/mongodb';
import Loan from '../../models/Loan';
// getAvailableLoans.ts
export const getAvailableLoans = createTool({
    id: 'getAvailableLoans',
    description: 'Fetch available personal loan options from the database.',
    inputSchema: z.object({
        dummy: z.string().optional().describe('Not required. Pass empty string.')
    }),
    execute: async () => {
        await dbConnect();
        const loans = await Loan.find({}).lean();
        return { loans };
    }
});