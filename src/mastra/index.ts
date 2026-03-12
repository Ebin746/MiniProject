import { Mastra } from '@mastra/core';
import { masterAgent } from './agents/master';

export const mastra = new Mastra({
  agents: {
    masterAgent,
  },
});