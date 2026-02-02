import { Agent } from '@mastra/core';
import { CREDIT_AGENT_PROMPT } from '../prompts/credit';
import { calculateFOIR } from '../tools';

export const creditAgent = new Agent({
  name: 'Credit Agent',
  instructions: CREDIT_AGENT_PROMPT,
  model: 'groq/qwen/qwen3-32b',
  tools: {
    calculateFOIR
  }, defaultGenerateOptions: {
    maxSteps: 4
  }
});
