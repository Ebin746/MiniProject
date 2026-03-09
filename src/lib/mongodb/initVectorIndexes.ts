import dbConnect from '../mongodb';
import ConversationHistory from '@/models/ConversationHistory';

/**
 * Initialize vector search indexes in MongoDB
 * Run this once during app startup or manually via API endpoint
 */
export async function initVectorIndexes() {
  try {
    await dbConnect();
    
    console.log('Initializing vector indexes...');

    // Get the MongoDB collection
    const collection = ConversationHistory.collection;

    // Drop existing indexes (optional - uncomment if needed)
    // await collection.dropIndexes();

    // Create compound index for efficient queries
    await collection.createIndex({ sessionId: 1, createdAt: -1 });
    console.log('✓ Created sessionId + timestamp index');

    // Create embedding index for vector search
    await collection.createIndex({ embedding: '2dsphere' });
    console.log('✓ Created embedding vector index');

    console.log('Vector indexes initialized successfully!');
    return { success: true, message: 'Vector indexes created' };
  } catch (error: unknown) {
    console.error('Error initializing vector indexes:', error);
    // Don't throw - let app continue even if index creation fails
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
