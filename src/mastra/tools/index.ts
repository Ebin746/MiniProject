import { createTool } from '@mastra/core';
import { z } from 'zod';
import PDFDocument from 'pdfkit/js/pdfkit.standalone';
import fs from 'fs';
import path from 'path';

// Tool for the Credit Agent to use (Sub-agent tool)
export const calculateFOIR = createTool({
    id: 'calculateFOIR',
    description: 'Calculate the Fixed Obligation to Income Ratio (FOIR).',
    inputSchema: z.object({
        income: z.number().describe('Monthly income'),
        existing_emi: z.number().describe('Total monthly EMIs'),
    }),
    execute: async ({ context }) => {
        const { income, existing_emi } = context;
        if (income === 0) return { foir: 0, error: "Income cannot be zero" };

        const foir = (existing_emi / income) * 100;
        return {
            foir: parseFloat(foir.toFixed(2)),
        };
    }
});

// Tool for the Sales Agent to fetch available loan options
export const getAvailableLoans = createTool({
    id: 'getAvailableLoans',
    description: 'Fetch available personal loan options from the database.',
    inputSchema: z.object({}), // No input needed
    execute: async () => {
        // In a real app, this would be a DB call
        const loans = await import('../data/loans.json');
        return {
            loans: loans.default,
        };
    }
});

// Tool for the Docs Agent to generate PDF
export const generateLoanPDF = createTool({
    id: 'generateLoanPDF',
    description: 'Generate a PDF document for loan confirmation with user and loan details.',
    inputSchema: z.object({
        name: z.string().describe('User name'),
        income: z.number().describe('Monthly income'),
        employment: z.string().describe('Employment type'),
        existing_emi: z.number().describe('Existing EMI'),
        loanName: z.string().describe('Name of the loan'),
        loanAmount: z.number().describe('Loan amount'),
        loanTenure: z.number().describe('Loan tenure in months'),
        interestRate: z.number().describe('Interest rate percentage'),
    }),
    execute: async ({ context }) => {
        const { name, income, employment, existing_emi, loanName, loanAmount, loanTenure, interestRate } = context;

        try {
            // Create PDF directory if it doesn't exist
            const pdfDir = path.join(process.cwd(), 'public', 'pdfs');
            if (!fs.existsSync(pdfDir)) {
                fs.mkdirSync(pdfDir, { recursive: true });
            }

            // Generate unique filename
            const timestamp = Date.now();
            const filename = `loan_confirmation_${name.replace(/\s+/g, '_')}_${timestamp}.pdf`;
            const filepath = path.join(pdfDir, filename);

            // Create PDF
            const doc = new PDFDocument({ margin: 50 });
            const stream = fs.createWriteStream(filepath);
            doc.pipe(stream);

            // Header
            doc.fontSize(24)
                .fillColor('#2c3e50')
                .text('LOAN CONFIRMATION', { align: 'center' })
                .moveDown(0.5);

            doc.fontSize(12)
                .fillColor('#7f8c8d')
                .text('Congratulations on your loan approval!', { align: 'center' })
                .moveDown(2);

            // Personal Details Section
            doc.fontSize(16)
                .fillColor('#2c3e50')
                .text('Personal Details', { underline: true })
                .moveDown(0.5);

            doc.fontSize(12)
                .fillColor('#34495e')
                .text(`Name: ${name}`, { continued: false })
                .text(`Employment: ${employment}`)
                .text(`Monthly Income: ₹${income.toLocaleString('en-IN')}`)
                .text(`Existing EMI: ₹${existing_emi.toLocaleString('en-IN')}`)
                .moveDown(2);

            // Loan Details Section
            doc.fontSize(16)
                .fillColor('#2c3e50')
                .text('Loan Details', { underline: true })
                .moveDown(0.5);

            doc.fontSize(12)
                .fillColor('#34495e')
                .text(`Loan Type: ${loanName}`)
                .text(`Loan Amount: ₹${loanAmount.toLocaleString('en-IN')}`)
                .text(`Tenure: ${loanTenure} months`)
                .text(`Interest Rate: ${interestRate}% per annum`)
                .moveDown(2);

            // Calculate EMI
            const monthlyRate = interestRate / 12 / 100;
            const emi = (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, loanTenure)) /
                (Math.pow(1 + monthlyRate, loanTenure) - 1);

            doc.fontSize(14)
                .fillColor('#27ae60')
                .font('Helvetica-Bold')
                .text(`Monthly EMI: ₹${Math.round(emi).toLocaleString('en-IN')}`)
                .font('Helvetica')
                .moveDown(2);

            // Footer
            doc.fontSize(10)
                .fillColor('#95a5a6')
                .text('This is a computer-generated document and does not require a signature.', { align: 'center' })
                .moveDown(0.5)
                .text(`Generated on: ${new Date().toLocaleString('en-IN')}`, { align: 'center' });

            // Finalize PDF
            doc.end();

            // Wait for the PDF to be written
            await new Promise((resolve, reject) => {
                stream.on('finish', () => resolve(true));
                stream.on('error', reject);
            });

            return {
                success: true,
                pdfPath: `/pdfs/${filename}`,
                filename: filename,
                message: 'PDF generated successfully'
            };

        } catch (error) {
            console.error('PDF Generation Error:', error);
            return {
                success: false,
                error: 'Failed to generate PDF',
                message: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
});