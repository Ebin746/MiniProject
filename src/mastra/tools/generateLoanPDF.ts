import { createTool } from '@mastra/core';
import { z } from 'zod';
import PDFDocument from 'pdfkit/js/pdfkit.standalone';
import fs from 'fs';
import path from 'path';

export const generateLoanPDF = createTool({
    id: 'generateLoanPDF',
    description: 'Generate a PDF document for loan confirmation with user and loan details.',
    inputSchema: z.object({
        name: z.string().describe('User name'),
        income: z.union([z.number(), z.string()]).describe('Monthly income'),
        employment: z.string().describe('Employment type'),
        existing_emi: z.union([z.number(), z.string()]).describe('Existing EMI'),
        loanName: z.string().describe('Name of the loan'),
        loanAmount: z.union([z.number(), z.string()]).describe('Loan amount'),
        loanTenure: z.union([z.number(), z.string()]).describe('Loan tenure in months'),
        interestRate: z.union([z.number(), z.string()]).describe('Interest rate percentage'),
    }),
    execute: async ({ context }) => {
        const parseValue = (val: number | string): number => {
            if (typeof val === 'number') return val;
            const normalized = val.toLowerCase().trim();
            if (normalized.endsWith('k')) return parseFloat(normalized.slice(0, -1)) * 1000;
            if (normalized.endsWith('m')) return parseFloat(normalized.slice(0, -1)) * 1000000;
            return parseFloat(normalized.replace(/[^0-9.]/g, ''));
        };

        const name = context.name;
        const employment = context.employment;
        const loanName = context.loanName;

        const income = parseValue(context.income);
        const existing_emi = parseValue(context.existing_emi);
        const loanAmount = parseValue(context.loanAmount);
        const loanTenure = parseValue(context.loanTenure);
        const interestRate = parseValue(context.interestRate);

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
                .text(`Name: ${name}`)
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
                pdfPath: `public/pdfs/${filename}`,
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
