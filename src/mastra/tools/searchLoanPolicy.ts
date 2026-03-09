import { createTool } from '@mastra/core';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

interface Policy {
  id: string;
  category: string;
  question: string;
  answer: string;
}

// ── TF-IDF RAG Index ─────────────────────────────────────────────────────────

// Cached index: built once on first call, reused for all subsequent queries
let policyIndex: { policy: Policy; tfidfVector: Map<string, number> }[] | null = null;
let idfScores: Map<string, number> | null = null;

const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall',
  'should', 'may', 'might', 'can', 'could', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'and', 'or',
  'but', 'if', 'i', 'my', 'me', 'it', 'its', 'this', 'that', 'what',
  'how', 'why', 'when', 'who', 'which',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOPWORDS.has(t));
}

function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) ?? 0) + 1);
  }
  // Normalize by document length
  for (const [term, count] of tf) {
    tf.set(term, count / tokens.length);
  }
  return tf;
}

function buildIndex(policies: Policy[]) {
  // ── Step 1: compute TF for each policy document ──────────────────────────
  const allTfs = policies.map(policy => {
    const text = `${policy.question} ${policy.answer}`;
    const tokens = tokenize(text);
    return { policy, tf: termFrequency(tokens), tokens };
  });

  // ── Step 2: compute IDF across all documents ──────────────────────────────
  const docCount = policies.length;
  const df = new Map<string, number>(); // document frequency per term
  for (const { tf } of allTfs) {
    for (const term of tf.keys()) {
      df.set(term, (df.get(term) ?? 0) + 1);
    }
  }
  const idf = new Map<string, number>();
  for (const [term, count] of df) {
    idf.set(term, Math.log(docCount / count) + 1); // +1 smoothing
  }

  // ── Step 3: compute TF-IDF vector per document ───────────────────────────
  const index = allTfs.map(({ policy, tf }) => {
    const tfidfVector = new Map<string, number>();
    for (const [term, tfScore] of tf) {
      const idfScore = idf.get(term) ?? 0;
      tfidfVector.set(term, tfScore * idfScore);
    }
    return { policy, tfidfVector };
  });

  return { index, idf };
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (const [term, scoreA] of a) {
    magA += scoreA * scoreA;
    const scoreB = b.get(term) ?? 0;
    dot += scoreA * scoreB;
  }
  for (const scoreB of b.values()) {
    magB += scoreB * scoreB;
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

function getIndex() {
  if (!policyIndex || !idfScores) {
    const policiesPath = path.join(process.cwd(), 'src', 'mastra', 'data', 'policies.json');
    const policies: Policy[] = JSON.parse(fs.readFileSync(policiesPath, 'utf8'));
    const { index, idf } = buildIndex(policies);
    policyIndex = index;
    idfScores = idf;
  }
  return { index: policyIndex, idf: idfScores };
}

/**
 * RAG retrieval: embed query as TF-IDF vector, rank policies by cosine similarity
 */
function retrievePolicies(query: string, topK = 3): Policy[] {
  const { index, idf } = getIndex();

  // Build query TF-IDF vector using the same IDF learned from the corpus
  const queryTokens = tokenize(query);
  const queryTf = termFrequency(queryTokens);
  const queryVector = new Map<string, number>();
  for (const [term, tfScore] of queryTf) {
    const idfScore = idf.get(term) ?? Math.log(index.length) + 1; // unseen terms get high IDF
    queryVector.set(term, tfScore * idfScore);
  }

  // Rank all policies by cosine similarity to the query vector
  const ranked = index
    .map(({ policy, tfidfVector }) => ({
      policy,
      score: cosineSimilarity(queryVector, tfidfVector),
    }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return ranked.map(r => r.policy);
}

// ── Tool Definition ───────────────────────────────────────────────────────────

export const searchLoanPolicy = createTool({
  id: 'searchLoanPolicy',
  description: `Search loan policy documents to answer user questions about eligibility, interest rates, documents required, KYC process, FOIR, repayment, EMI calculation, or any other loan-related policy. Call this whenever the user asks a "how", "what", "why", or "can I" question about the loan process.`,
  inputSchema: z.object({
    query: z.string().describe('The user question about loan policy, eligibility, documents, interest rates, or process'),
  }),
  execute: async ({ context }) => {
    const { query } = context;

    try {
      const matches = retrievePolicies(query, 3);

      if (matches.length === 0) {
        return {
          found: false,
          message: 'No specific policy found for that question. Please visit our nearest branch or contact support for detailed assistance.',
          results: [],
        };
      }

      return {
        found: true,
        results: matches.map(p => ({
          category: p.category,
          question: p.question,
          answer: p.answer,
        })),
      };
    } catch (error) {
      console.error('searchLoanPolicy error:', error);
      return {
        found: false,
        message: 'Unable to retrieve policy information at the moment. Please try again.',
        results: [],
      };
    }
  },
});
