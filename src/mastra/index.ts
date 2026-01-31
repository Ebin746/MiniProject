import { Mastra } from '@mastra/core';
import { salesAgent } from './agents/sales';
import { creditAgent } from './agents/credit';
import { masterAgent } from './agents/master';

export const mastra = new Mastra({
    agents: {
        salesAgent,
        creditAgent,
        masterAgent,
    },
});
