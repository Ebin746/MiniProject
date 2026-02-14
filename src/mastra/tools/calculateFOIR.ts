import { createTool } from '@mastra/core';
import { z } from 'zod';

export const calculateFOIR = createTool({
    id: 'calculateFOIR',
    description: 'Calculate the Fixed Obligation to Income Ratio (FOIR).',
    inputSchema: z.object({
        income: z.union([z.number(), z.string()]).describe('Monthly income'),
        existing_emi: z.union([z.number(), z.string()]).optional().describe('Total monthly EMIs (defaults to 0)'),
        creditScore: z.union([z.number(), z.string()]).optional().describe('User credit score (from PAN)'),
    }),
    execute: async ({ context }) => {
        const parseValue = (val: number | string | undefined): number => {
            if (val === undefined) return 0;
            if (typeof val === 'number') return val;
            const normalized = val.toLowerCase().trim();
            if (normalized.endsWith('k')) return parseFloat(normalized.slice(0, -1)) * 1000;
            if (normalized.endsWith('m')) return parseFloat(normalized.slice(0, -1)) * 1000000;
            return parseFloat(normalized.replace(/[^0-9.]/g, ''));
        };

        const income = parseValue(context.income);
        const existing_emi = parseValue(context.existing_emi);
        const creditScore = context.creditScore !== undefined ? parseValue(context.creditScore) : 700;

        if (isNaN(income) || income === 0) return { foir: 0, error: "Invalid or zero income" };
        if (isNaN(existing_emi)) return { foir: 0, error: "Invalid EMI value" };
        if (isNaN(creditScore)) return { foir: 0, error: "Invalid credit score" };

        const foir = (existing_emi / income) * 100;
        const eligible = foir <= 50 && creditScore >= 600;
        const risk = foir > 40 || creditScore < 650 ? 'HIGH' : foir > 20 || creditScore < 700 ? 'MEDIUM' : 'LOW';

        let explanation = eligible
            ? `Your FOIR is ${foir.toFixed(2)}% and credit score is ${creditScore}. You are eligible!`
            : `Unfortunately, you are not eligible. `;

        if (foir > 50) explanation += `Your FOIR of ${foir.toFixed(2)}% exceeds the 50% limit. `;
        if (creditScore < 600) explanation += `Your credit score of ${creditScore} is below the required 600. `;

        return {
            foir: parseFloat(foir.toFixed(2)),
            creditScore,
            risk,
            eligible,
            explanation
        };
    }
});
