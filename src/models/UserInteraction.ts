import mongoose from "mongoose";

const UserInteractionSchema = new mongoose.Schema({
  sessionId: String,

  type: {
    type: String,
    enum: ["KYC", "CREDIT_CHECK", "LOAN_SELECTION"],
  },

  data: mongoose.Schema.Types.Mixed,

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.models.UserInteraction ||
  mongoose.model("UserInteraction", UserInteractionSchema);