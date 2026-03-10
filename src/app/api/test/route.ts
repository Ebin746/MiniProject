import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import PolicyDocument from "@/models/PolicyDocument";

export async function GET() {
  await dbConnect();

  // Check total chunks stored
  const count = await PolicyDocument.countDocuments();
  
  // Get one sample document
  const sample = await PolicyDocument.findOne().select("filename chunkIndex text embedding");

  return NextResponse.json({
    totalChunks: count,
    sample: sample ? {
      filename: sample.filename,
      chunkIndex: sample.chunkIndex,
      textPreview: sample.text?.slice(0, 100),
      embeddingLength: sample.embedding?.length,
      embeddingPreview: sample.embedding?.slice(0, 3),
    } : null,
  });
}