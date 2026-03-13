// master.ts

import { Agent } from '@mastra/core';
import { Memory } from '@mastra/memory';
import { MongoDBStore } from '@mastra/mongodb';
import { MasterAgentPrompt } from '../prompts/master';
import { PRIMARY_MODEL } from '../llms';
import {
  getAvailableLoans, generateLoanPDF, updateProfile,
  calculateFOIR, verifyKYC, getCreditScore, searchLoanPolicy
} from '../tools';

// ── Read env vars FIRST, outside everything ──────────────────────
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB_NAME;

if (!MONGODB_URI) throw new Error('MONGODB_URI missing from .env');
if (!MONGODB_DB) throw new Error('MONGODB_DB_NAME missing from .env');

// ── Storage ───────────────────────────────────────────────────────
const storage = new MongoDBStore({
  url: MONGODB_URI,
  dbName: MONGODB_DB,
})


// ── Memory ────────────────────────────────────────────────────────
const memory = new Memory({
  storage,
  options: {
    workingMemory: { enabled: true },
    lastMessages: 8,
  },
});
// ── Agent ─────────────────────────────────────────────────────────
export const masterAgent = (stage: string) => {
  return new Agent({
    name: 'Master Agent',
    instructions: MasterAgentPrompt(stage),
    model: PRIMARY_MODEL,
    memory,
    tools: {
      getAvailableLoans,
      generateLoanPDF,
      updateProfile,
      calculateFOIR,
      verifyKYC,
      getCreditScore,
      searchLoanPolicy,
    },
    defaultGenerateOptions: {
      maxSteps: 7,
      maxTokens: 600,
      temperature: 0.5,
    },
  });
}