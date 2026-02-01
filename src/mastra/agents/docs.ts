import { Agent } from '@mastra/core';
import { generateLoanPDF } from '../tools';

export const docsAgent = new Agent({
    name: 'Docs Agent',
    instructions: `
    You are a Documentation Agent for a loan application.
    Your job is to generate a PDF confirmation for the user's selected loan.
    
    1. Collect or use the provided user and loan details:
       - User Name
       - Monthly Income
       - Employment Type
       - Existing EMI
       - Selected Loan Name
       - Loan Amount
       - Loan Tenure
       - Interest Rate
    2. CALL the 'generateLoanPDF' tool with these details.
    3. Confirm to the user that the PDF has been generated and provide the path if available.
  `,
    model: 'groq/llama-3.3-70b-versatile',
    tools: {
        generateLoanPDF
    }
});
