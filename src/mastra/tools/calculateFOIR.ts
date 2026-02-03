import { createTool } from '@mastra/core';
import { z } from 'zod';

export const calculateFOIR = createTool({
    id: 'calculateFOIR',
    description: 'Calculate the Fixed Obligation to Income Ratio (FOIR).',
    inputSchema: z.object({
        income: z.union([z.number(), z.string()]).describe('Monthly income'),
        existing_emi: z.union([z.number(), z.string()]).describe('Total monthly EMIs'),
    }),
    execute: async ({ context }) => {
        const parseValue = (val: number | string): number => {
            if (typeof val === 'number') return val;
            const normalized = val.toLowerCase().trim();
            if (normalized.endsWith('k')) return parseFloat(normalized.slice(0, -1)) * 1000;
            if (normalized.endsWith('m')) return parseFloat(normalized.slice(0, -1)) * 1000000;
            return parseFloat(normalized.replace(/[^0-9.]/g, ''));
        };

        const income = parseValue(context.income);
        const existing_emi = parseValue(context.existing_emi);

        if (isNaN(income) || income === 0) return { foir: 0, error: "Invalid or zero income" };
        if (isNaN(existing_emi)) return { foir: 0, error: "Invalid EMI value" };

        const foir = (existing_emi / income) * 100;
        const eligible = foir <= 50;
        const risk = foir > 40 ? 'HIGH' : foir > 20 ? 'MEDIUM' : 'LOW';

        return {
            foir: parseFloat(foir.toFixed(2)),
            risk,
            eligible,
            explanation: eligible
                ? `Your FOIR is ${foir.toFixed(2)}%, which is within our limit of 50%. You are eligible!`
                : `Your FOIR is ${foir.toFixed(2)}%, which exceeds our limit of 50%. Unfortunately, you are not eligible.`
        };
    }
});
