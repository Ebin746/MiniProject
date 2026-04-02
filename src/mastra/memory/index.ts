import { Memory } from '@mastra/memory';
import { MongoDBStore } from '@mastra/mongodb';
import { z } from 'zod';

// ── Read env vars FIRST ───────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB_NAME;

if (!MONGODB_URI) throw new Error('MONGODB_URI missing from .env');
if (!MONGODB_DB) throw new Error('MONGODB_DB_NAME missing from .env');

// ── Storage ───────────────────────────────────────────────────────
const storage = new MongoDBStore({
  url: MONGODB_URI,
  dbName: MONGODB_DB,
});

// ── Memory ────────────────────────────────────────────────────────
export const memory = new Memory({
  storage,
  options: {
    workingMemory: {
      enabled: true,
      scope: 'resource',
      schema: z.object({
        userProfile: z.object({
          name: z.string().optional(),
          monthlyIncome: z.union([z.number(), z.string()]).optional(),
          aadhaarNo: z.string().optional(),
          dateOfBirth: z.string().optional(),
          panCard: z.string().optional(),
        }),
        applicationStatus: z.object({
          currentStage: z.string().optional(),
          kycStatus: z.string().optional(),
          creditScore: z.union([z.number(), z.string()]).optional(),
          emi: z.union([z.number(), z.string()]).optional(),
          foir: z.union([z.number(), z.string()]).optional(),
          selectedLoan: z.string().optional(),
          confirmationPdf: z.string().optional(),
        }),
      }),
    },
    lastMessages: 8,
  },
});
