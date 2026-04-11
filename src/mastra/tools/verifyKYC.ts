import { createTool } from '@mastra/core';
import { z } from 'zod';
import dbConnect from '../../lib/mongodb';
import KYC from '../../models/KYC';
import User from '../../models/User';
import { encryptPII } from '../../lib/security/pii-crypto';
import { resolveToolUserId } from './secureUserIdentity';

export const verifyKYC = createTool({
    id: 'verifyKYC',
    description: 'Verify user identity using Aadhar number and Date of Birth, and optionally cross-check with expected user name from salary/profile.',
    inputSchema: z.object({
        aadhar_no: z.string().describe('12-digit Aadhar number'),
        dob: z.string().describe('Date of birth in YYYY-MM-DD format'),
        expected_name: z.string().describe('Expected applicant full name from salary slip or profile.'),
    }),
    execute: async (input) => {
        const context = input.context;
        const runtimeContext = (input as { runtimeContext?: unknown; resourceId?: unknown; userId?: unknown }).runtimeContext
            ?? { resourceId: (input as { resourceId?: unknown }).resourceId, userId: (input as { userId?: unknown }).userId };
        const aadhar_no = context.aadhar_no.replace(/\s/g, '');
        const dob = context.dob.trim();
        const expectedName = context.expected_name.trim();
        const userId = resolveToolUserId(runtimeContext);

        const normalizeName = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

        try {
            if (!expectedName) {
                return {
                    success: false,
                    kycFailed: true,
                    nameMismatch: true,
                    message: 'KYC verification failed because applicant name is missing for cross-check.',
                };
            }

            await dbConnect();
            const record = await KYC.findOne({
                aadhar_no: aadhar_no,
                dob: dob
            });

            if (record) {
                const kycName = String(record.full_name || '').trim();
                const hasExpectedName = expectedName.length > 0;
                const nameMatched = !hasExpectedName || normalizeName(expectedName) === normalizeName(kycName);

                if (!nameMatched) {
                    return {
                        success: false,
                        kycFailed: true,
                        nameMismatch: true,
                        message: 'KYC name mismatch. Salary/Profile name does not match Aadhaar record.',
                        full_name: kycName,
                    };
                }

                await User.findByIdAndUpdate(
                    userId,
                    {
                        $set: {
                            encryptedAadhaar: encryptPII(aadhar_no),
                            hasVerifiedKyc: true,
                        },
                    },
                    { new: false }
                );

                return {
                    success: true,
                    kycFailed: false,
                    message: 'KYC verified successfully.',
                    full_name: kycName
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
