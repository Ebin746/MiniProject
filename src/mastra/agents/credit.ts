import { Agent } from '@mastra/core';
import { CREDIT_AGENT_PROMPT } from '../prompts/credit';
import { calculateFOIR } from '../tools';

export const creditAgent = new Agent({
  name: 'Credit Agent',
  instructions: CREDIT_AGENT_PROMPT,
  model: 'groq/llama-3.3-70b-versatile',
  tools: {
    calculateFOIR
  }, defaultGenerateOptions: {
    maxSteps: 4
  }
});
