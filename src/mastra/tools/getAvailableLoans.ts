import { createTool } from '@mastra/core';
import { z } from 'zod';
import dbConnect from '../../lib/mongodb';
import Loan from '../../models/Loan';

export const getAvailableLoans = createTool({
    id: 'getAvailableLoans',
    description: 'Fetch available personal loan options from the database.',
    inputSchema: z.object({}), // No input needed
    execute: async () => {
        await dbConnect();
        const loans = await Loan.find({}).lean();
        return {
            loans,
        };
    }
});
