import { Agent } from '@mastra/core';
import { MASTER_AGENT_PROMPT } from '../prompts/master';
import { salesAgent } from './sales';
import { creditAgent } from './credit';
import { getAvailableLoans, generateLoanPDF } from '../tools';

export const masterAgent = new Agent({
  name: 'Master Agent',
  instructions: MASTER_AGENT_PROMPT,
  model: 'groq/llama-3.3-70b-versatile',
  agents: {
    salesAgent,
    creditAgent,
  },
  tools: {
    getAvailableLoans,
    generateLoanPDF
  },
  defaultGenerateOptions: {
    maxSteps: 6,
  }
});