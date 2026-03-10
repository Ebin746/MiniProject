import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import PolicyDocument from "@/models/PolicyDocument";

export async function POST() {
  try {
    await dbConnect();
    const collection = PolicyDocument.collection;

    // Regular index for fast filtering
    await collection.createIndex({ filename: 1, chunkIndex: 1 });
    console.log("✓ Created filename + chunkIndex index");

    // NOTE: The Atlas Vector Search index "policy_vector_index" must be
    // created manually in MongoDB Atlas UI or via Atlas CLI:
    //
    // Collection: <db>.policydocuments
    // Index name: policy_vector_index
    // Field: embedding (dimensions: 1536, similarity: cosine)

    return NextResponse.json({
      success: true,
      message:
        'Regular indexes created. Remember to create "policy_vector_index" in Atlas UI for vector search.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}