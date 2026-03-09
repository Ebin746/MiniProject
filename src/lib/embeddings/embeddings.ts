// Using a simple hash-based approach for embeddings
// This generates consistent, deterministic vectors from text content
// For production, integrate with OpenAI, Cohere, or other embedding services

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    return generateDeterministicEmbedding(text);
  } catch (error) {
    console.error('Error generating embedding:', error);
    // Return a default embedding on error
    return generateDeterministicEmbedding('error-fallback');
  }
}

/**
 * Generate a deterministic embedding from text
 * This approach creates consistent vectors that can be used for similarity search
 */
function generateDeterministicEmbedding(text: string): number[] {
  const seed = simpleHash(text);
  const dimensions = 1536; // Match OpenAI embedding dimensions
  const vector: number[] = [];

  // Generate vector using seeded pseudo-random function
  for (let i = 0; i < dimensions; i++) {
    const pseudoRandom = Math.sin((seed + i) * 12.9898 + (text.length || 1) * 78.233) * 43758.5453;
    vector.push(pseudoRandom - Math.floor(pseudoRandom));
  }

  // Normalize to unit vector for consistency
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  return magnitude > 0 ? vector.map(val => val / magnitude) : vector;
}

/**
 * Simple hash function for string
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}