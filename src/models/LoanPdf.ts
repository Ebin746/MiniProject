import mongoose from 'mongoose';

const LoanPdfSchema = new mongoose.Schema(
  {
    filename: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: {
      type: String,
      required: true,
      default: 'application/pdf',
    },
    content: {
      type: Buffer,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 60 * 60 * 24 * 1, // auto-delete after 1 day
    },
  },
  { versionKey: false },
);

export default mongoose.models.LoanPdf || mongoose.model('LoanPdf', LoanPdfSchema);
