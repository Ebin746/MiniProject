import { retrieveRelevantContext } from "./ragRetriever";

export async function buildAugmentedPrompt(
  userMessage: string,
  systemContext: string
) {
  const retrievedContext = await retrieveRelevantContext(userMessage);

  const prompt = `
SYSTEM STATE
${systemContext}

RELEVANT PAST CONVERSATION
${retrievedContext}

USER MESSAGE
${userMessage}
`;

  return prompt;
}