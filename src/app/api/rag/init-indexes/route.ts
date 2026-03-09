import { NextResponse } from 'next/server';
import { initVectorIndexes } from '@/lib/mongodb/initVectorIndexes';

/**
 * POST /api/rag/init-indexes
 * Initializes MongoDB vector indexes for RAG
 * Should be called once during app setup
 */
export async function POST() {
  try {
    const result = await initVectorIndexes();
    
    return NextResponse.json({
      success: result.success,
      message: result.message || result.error,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Vector index initialization failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to initialize vector indexes',
      },
      { status: 500 }
    );
  }
}
