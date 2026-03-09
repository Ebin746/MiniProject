import ConversationHistory from "@/models/ConversationHistory";
import { generateEmbedding } from "./embeddings";
import dbConnect from "@/lib/mongodb";

/**
 * Store conversation with embeddings in MongoDB
 */
export async function storeConversation(
  sessionId: string,
  userMessage: string,
  assistantMessage: string
) {
  try {
    await dbConnect();
    const text = `${userMessage} ${assistantMessage}`;

    const embedding = await generateEmbedding(text);

    await ConversationHistory.create({
      sessionId,
      userMessage,
      assistantMessage,
      embedding,
      createdAt: new Date(),
    });

    console.log("✓ Conversation stored with embedding");
    return true;
  } catch (error: unknown) {
    console.error("Error storing conversation:", error);

    // Don't break chat if storage fails
    return false;
  }
}

/**
 * Search similar conversations using MongoDB Vector Search
 */
export async function searchSimilarContext(query: string, limit = 5) {
  try {
    await dbConnect();
    const embedding = await generateEmbedding(query);

    const results = await ConversationHistory.aggregate([
      {
        $vectorSearch: {
          index: "vector_index", // must match Atlas index name
          path: "embedding",
          queryVector: embedding,
          numCandidates: 100,
          limit: limit,
        },
      },
      {
        $project: {
          sessionId: 1,
          userMessage: 1,
          assistantMessage: 1,
          score: { $meta: "vectorSearchScore" },
          createdAt: 1,
        },
      },
    ]);

    console.log(`✓ Found ${results.length} similar contexts`);
    return results;
  } catch (error: unknown) {
    console.error("Error searching similar context:", error);

    /**
     * FALLBACK MECHANISM
     * If vector search fails (index missing, cluster issue etc)
     * return recent conversations instead
     */
    try {
      const fallbackResults = await ConversationHistory.find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .select("sessionId userMessage assistantMessage createdAt");

      console.log(
        `⚠ Using fallback search, found ${fallbackResults.length} recent conversations`
      );

      return fallbackResults;
    } catch (fallbackError) {
      console.error("Fallback search also failed:", fallbackError);
      return [];
    }
  }
}