import { createTool } from '@mastra/core';
import { z } from 'zod';
import dbConnect from '../../lib/mongodb';
import KYC from '../../models/KYC';

export const verifyKYC = createTool({
    id: 'verifyKYC',
    description: 'Verify user identity using Aadhar number and Date of Birth.',
    inputSchema: z.object({
        aadhar_no: z.string().describe('12-digit Aadhar number'),
        dob: z.string().describe('Date of birth in YYYY-MM-DD format'),
    }),
    execute: async ({ context }) => {
        const aadhar_no = context.aadhar_no.replace(/\s/g, '');
        const dob = context.dob.trim();

        try {
            await dbConnect();
            const record = await KYC.findOne({
                aadhar_no: aadhar_no,
                dob: dob
            });

            if (record) {
                return {
                    success: true,
                    kycFailed: false,
                    message: 'KYC verified successfully.',
                    full_name: record.full_name
                };
            } else {
                return {
                    success: false,
                    kycFailed: true,
                    message: 'KYC verification failed. The Aadhaar details provided do not match our records.'
                };
            }
        } catch (error) {
            console.error('KYC Verification Error:', error);
            return {
                success: false,
                kycFailed: true,
                message: 'Error accessing KYC database.'
            };
        }
    }
});
