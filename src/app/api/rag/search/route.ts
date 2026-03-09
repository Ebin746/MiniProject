import { NextResponse } from 'next/server';
import { searchSimilarContext } from '@/lib/embeddings/vectorStore';

/**
 * POST /api/rag/search
 * Search similar conversations using RAG
 * Body: { query: string, limit?: number }
 */
export async function POST(req: Request) {
  try {
    const { query, limit = 5 } = await req.json();

    if (!query) {
      return NextResponse.json(
        { error: 'query parameter is required' },
        { status: 400 }
      );
    }

    console.log(`Searching similar contexts for: "${query}"`);
    const results = await searchSimilarContext(query, Math.min(limit, 10));

    return NextResponse.json({
      success: true,
      query,
      resultCount: results.length,
      results: results.map((r: Record<string, unknown>) => ({
        sessionId: r.sessionId,
        userMessage: r.userMessage,
        assistantMessage: r.assistantMessage,
        distance: r.distance,
        createdAt: r.createdAt,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error('RAG search failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to search contexts';
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
