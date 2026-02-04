import { createTool } from '@mastra/core';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

export const verifyKYC = createTool({
    id: 'verifyKYC',
    description: 'Verify user identity using Aadhar number and Date of Birth.',
    inputSchema: z.object({
        aadhar_no: z.string().describe('12-digit Aadhar number'),
        dob: z.string().describe('Date of birth in YYYY-MM-DD format'),
    }),
    execute: async ({ context }) => {
        const { aadhar_no, dob } = context;

        try {
            const kycDataPath = path.join(process.cwd(), 'src', 'mastra', 'data', 'kyc.json');
            const kycData = JSON.parse(fs.readFileSync(kycDataPath, 'utf8'));

            const record = kycData.find(
                (entry: any) => entry.aadhar_no === aadhar_no && entry.dob === dob
            );

            if (record) {
                return {
                    success: true,
                    message: 'KYC verified successfully.',
                    full_name: record.full_name
                };
            } else {
                return {
                    success: false,
                    message: 'KYC verification failed. Information does not match our records.'
                };
            }
        } catch (error) {
            console.error('KYC Verification Error:', error);
            return {
                success: false,
                message: 'Error accessing KYC database.'
            };
        }
    }
});
