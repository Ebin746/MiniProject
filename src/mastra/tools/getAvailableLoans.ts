import { createTool } from '@mastra/core';
import { z } from 'zod';

export const getAvailableLoans = createTool({
    id: 'getAvailableLoans',
    description: 'Fetch available personal loan options from the database.',
    inputSchema: z.object({}), // No input needed
    execute: async () => {
        const loans = await import('../data/loans.json');
        return {
            loans: loans.default,
        };
    }
});
