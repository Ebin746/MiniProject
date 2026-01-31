import { Agent } from '@mastra/core';
import { groq } from '@ai-sdk/groq';

import { calculateFOIR } from '../tools';

export const creditAgent = new Agent({
  name: 'Credit Agent',
  instructions: `
    You are a Credit Assessment Agent.
    Input: A JSON object containing user profile (name, income, employment, existing_emi).

    Tasks:
    1. USE the 'calculateFOIR' tool to get the precise ratio. DO NOT calculate it mentally.
    2. Assign Risk based on FOIR:
       - LOW: FOIR < 30%
       - MEDIUM: 30% <= FOIR < 50%
       - HIGH: FOIR >= 50%
    3. Determine Eligibility:
       - Eligible if risk is included in LOW or MEDIUM.
    4. Provide a clear explanation.

    Output STRICT JSON:
    {
      "foir": number,
      "risk": "LOW" | "MEDIUM" | "HIGH",
      "eligible": boolean,
      "explanation": string
    }
  `,
  model: 'groq/llama-3.3-70b-versatile',
  tools: {
    calculateFOIR
  }
});
