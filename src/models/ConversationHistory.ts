import mongoose from "mongoose";

const ConversationHistorySchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    index: true,
  },

  userMessage: String,

  assistantMessage: String,

  embedding: {
    type: [Number],
    required: true,
  },

  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

// Create vector search index - run by initVectorIndexes.ts
ConversationHistorySchema.index({ embedding: "2dsphere" });

export default mongoose.models.ConversationHistory ||
  mongoose.model("ConversationHistory", ConversationHistorySchema);