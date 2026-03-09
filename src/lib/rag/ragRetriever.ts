import { searchSimilarContext } from "../embeddings/vectorStore";

export async function retrieveRelevantContext(query: string) {
  const results = await searchSimilarContext(query, 4);

  const contexts = results.map((r: Record<string, unknown>) => {
    return `
User: ${r.userMessage}
Assistant: ${r.assistantMessage}
`;
  });

  return contexts.join("\n");
}