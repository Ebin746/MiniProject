// master.ts

import { Agent } from '@mastra/core';
import { memory } from '../memory';
import { MasterAgentPrompt } from '../prompts/master';
import { PRIMARY_MODEL } from '../llms';
import {
  getAvailableLoans, generateLoanPDF, updateProfile,
  calculateFOIR, verifyKYC, getCreditScore, getVerifiedUserData, searchLoanPolicy
} from '../tools';

type MasterAgentOptions = {
  disableMemory?: boolean;
  isReturningUser?: boolean;
};

// ── Agent ─────────────────────────────────────────────────────────
export const masterAgent = (stage: string, options: MasterAgentOptions = {}) => {
  return new Agent({
    name: 'Master Agent',
    instructions: MasterAgentPrompt(stage, { isReturningUser: options.isReturningUser }),
    model: PRIMARY_MODEL,
    ...(options.disableMemory ? {} : { memory }),
    tools: {
      getAvailableLoans,
      generateLoanPDF,
      updateProfile,
      calculateFOIR,
      verifyKYC,
      getVerifiedUserData,
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