import PolicyDocument from "@/models/PolicyDocument";
import { generateEmbedding } from "./embeddings";
import dbConnect from "@/lib/mongodb";

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 100;

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = start + CHUNK_SIZE;
    chunks.push(text.slice(start, end));
    start = end - CHUNK_OVERLAP;
  }

  console.log(`📄 chunkText: total text length = ${text.length} chars`);
  console.log(`📄 chunkText: produced ${chunks.length} chunks`);
  console.log(`📄 chunkText: first chunk preview = "${chunks[0]?.slice(0, 80)}..."`);
  console.log(`📄 chunkText: last chunk preview  = "${chunks[chunks.length - 1]?.slice(0, 80)}..."`);

  return chunks;
}

export async function storePolicyDocument(
  filename: string,
  fullText: string
): Promise<{ success: boolean; chunksStored: number }> {
  console.log("\n==============================");
  console.log("📥 storePolicyDocument CALLED");
  console.log(`   filename  : ${filename}`);
  console.log(`   text length: ${fullText.length} chars`);
  console.log(`   text preview: "${fullText.slice(0, 150)}..."`);
  console.log("==============================\n");

  await dbConnect();

  // Delete old chunks for same file
  const deleted = await PolicyDocument.deleteMany({ filename });
  console.log(`🗑️  Deleted ${deleted.deletedCount} old chunks for "${filename}"`);

  const chunks = chunkText(fullText);

  let stored = 0;
  for (let i = 0; i < chunks.length; i++) {
    console.log(`\n🔢 Processing chunk ${i + 1}/${chunks.length}`);
    console.log(`   chunk text (first 80 chars): "${chunks[i].slice(0, 80)}..."`);

    const embedding = await generateEmbedding(chunks[i]);

    console.log(`   embedding type    : ${typeof embedding}`);
    console.log(`   embedding length  : ${embedding.length} dimensions`);
    console.log(`   embedding preview : [${embedding.slice(0, 5).map(n => n.toFixed(4)).join(", ")} ...]`);

    await PolicyDocument.create({
      filename,
      chunkIndex: i,
      text: chunks[i],
      embedding,
    });

    console.log(`   ✅ Chunk ${i + 1} saved to MongoDB`);
    stored++;
  }

  console.log(`\n✓ storePolicyDocument DONE — stored ${stored} chunks for "${filename}"\n`);
  return { success: true, chunksStored: stored };
}

export async function searchPolicyContext(
  query: string,
  limit = 4
): Promise<{ text: string; filename: string; score: number }[]> {
  console.log("\n==============================");
  console.log("🔍 searchPolicyContext CALLED");
  console.log(`   query : "${query}"`);
  console.log(`   limit : ${limit}`);
  console.log("==============================\n");

  await dbConnect();

  const embedding = await generateEmbedding(query);
  console.log(`🔢 Query embedding length  : ${embedding.length} dimensions`);
  console.log(`🔢 Query embedding preview : [${embedding.slice(0, 5).map(n => n.toFixed(4)).join(", ")} ...]`);

  try {
    const results = await PolicyDocument.aggregate([
      {
        $vectorSearch: {
          index: "vector_index_1",
          path: "embedding",
          queryVector: embedding,
          numCandidates: 100,
          limit,
        },
      },
      {
        $project: {
          filename: 1,
          text: 1,
          score: { $meta: "vectorSearchScore" },
        },
      },
    ]);

    console.log(`\n📊 Vector search returned ${results.length} results:`);
    results.forEach((r, i) => {
      console.log(`   [${i + 1}] score: ${r.score?.toFixed(4)} | file: ${r.filename}`);
      console.log(`        text preview: "${r.text?.slice(0, 100)}..."`);
    });

    return results;

  } catch (err) {
    console.error("❌ Vector search failed:", err);
    console.log("⚠️  Falling back to most recent chunks...");

    const fallback = await PolicyDocument.find()
      .sort({ uploadedAt: -1 })
      .limit(limit)
      .select("filename text");

    console.log(`⚠️  Fallback returned ${fallback.length} chunks`);
    fallback.forEach((r, i) => {
      console.log(`   [${i + 1}] file: ${r.filename}`);
      console.log(`        text preview: "${r.text?.slice(0, 100)}..."`);
    });

    return fallback.map((r) => ({ text: r.text, filename: r.filename, score: 0 }));
  }
}