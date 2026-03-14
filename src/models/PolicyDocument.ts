import mongoose, { Schema, Document } from "mongoose";

export interface IPolicyDocument extends Document {
  filename: string;
  chunkIndex: number;
  text: string;
  embedding: string;
  uploadedAt: Date;
}

const PolicyDocumentSchema = new Schema<IPolicyDocument>({
  filename: { type: String, required: true },
  chunkIndex: { type: Number, required: true },
  text: { type: String, required: true },
  embedding: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
});

export default mongoose.models.PolicyDocument ||
  mongoose.model<IPolicyDocument>("PolicyDocument", PolicyDocumentSchema);