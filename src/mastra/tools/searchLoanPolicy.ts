import { createTool } from "@mastra/core";
import { z } from "zod";
import { searchPolicyContext } from "@/lib/embeddings/policyVectorStore";

export const searchLoanPolicy = createTool({
  id: "searchLoanPolicy",
  description: `Search loan policy documents to answer user questions about eligibility, interest rates, documents required, KYC process, FOIR, repayment, EMI calculation, or any other loan-related policy. Call this whenever the user asks a "how", "what", "why", or "can I" question about the loan process.`,
  inputSchema: z.object({
    query: z
      .string()
      .describe(
        "The user question about loan policy, eligibility, documents, interest rates, or process"
      ),
  }),
  execute: async ({ context }) => {
    const { query } = context;

    try {
      const matches = await searchPolicyContext(query, 4);

      if (!matches || matches.length === 0) {
        return {
          found: false,
          message:
            "No specific policy found for that question. Please visit your nearest branch or contact support.",
          results: [],
        };
      }

      return {
        found: true,
        results: matches.map((m) => ({
          source: m.filename,
          content: m.text,
          score: m.score,
        })),
      };
    } catch (error) {
      console.error("searchLoanPolicy error:", error);
      return {
        found: false,
        message: "Unable to retrieve policy information at the moment.",
        results: [],
      };
    }
  },
});