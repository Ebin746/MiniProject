// master.ts

import { Agent } from '@mastra/core';
import { memory } from '../memory';
import { MasterAgentPrompt } from '../prompts/master';
import { PRIMARY_MODEL } from '../llms';
import {
  getAvailableLoans, generateLoanPDF, updateProfile,
  calculateFOIR, verifyKYC, getCreditScore, searchLoanPolicy
} from '../tools';

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