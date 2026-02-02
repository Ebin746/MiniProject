import { Agent } from '@mastra/core';
import { SALES_AGENT_PROMPT } from '../prompts/sales';
import { getAvailableLoans } from '../tools';

export const salesAgent = new Agent({
  name: 'Sales Agent',
  instructions: SALES_AGENT_PROMPT,
  model: 'groq/qwen/qwen3-32b',
  tools: {
    getAvailableLoans
  },
  defaultGenerateOptions: {
    maxSteps: 4
  }
});
