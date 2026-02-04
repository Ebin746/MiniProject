import { Agent } from '@mastra/core';
import { MASTER_AGENT_PROMPT } from '../prompts/master';
import { getAvailableLoans, generateLoanPDF, updateProfile, calculateFOIR, verifyKYC } from '../tools';
import { PRIMARY_MODEL } from '../llms';

export const masterAgent = new Agent({
  name: 'Master Agent',
  instructions: MASTER_AGENT_PROMPT,
  model: PRIMARY_MODEL,
  tools: {
    getAvailableLoans,
    generateLoanPDF,
    updateProfile,
    calculateFOIR,
    verifyKYC
  },
  defaultGenerateOptions: {
    maxSteps: 10,
  }
});