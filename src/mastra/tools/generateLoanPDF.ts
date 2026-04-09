import { createTool } from '@mastra/core';
import { z } from 'zod';
import PDFDocument from 'pdfkit/js/pdfkit.standalone';
import dbConnect from '../../lib/mongodb';
import LoanPdf from '../../models/LoanPdf';


export const generateLoanPDF = createTool({
    id: 'generateLoanPDF',
    description: 'Generate a PDF document for loan confirmation with user and loan details.',
    inputSchema: z.object({
        name: z.string().describe('User name'),
        income: z.string().describe('Monthly income (number or numeric string, e.g. 50000 or 50k)'),
        existing_emi: z.string().describe('Existing EMI (number or numeric string, e.g. 12000)'),
        loanName: z.string().describe('Name of the loan'),
        loanAmount: z.string().describe('Loan amount (number or numeric string, e.g. 8L, 800000)'),
        loanTenure: z.string().describe('Loan tenure in months (numeric string)'),
        interestRate: z.string().describe('Interest rate percentage (numeric string, e.g. 11.5)'),
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
        const loanName = context.loanName;

        const income = parseValue(context.income);
        const existing_emi = parseValue(context.existing_emi);
        const loanAmount = parseValue(context.loanAmount);
        const loanTenure = parseValue(context.loanTenure);
        const interestRate = parseValue(context.interestRate);

        try {
            // Generate unique filename
            const timestamp = Date.now();
            const filename = `loan_confirmation_${name.replace(/\s+/g, '_')}_${timestamp}.pdf`;

            // Create PDF in memory (Vercel-safe; no runtime filesystem writes)
            const doc = new PDFDocument({ margin: 50 });
            const chunks: Buffer[] = [];

            doc.on('data', (chunk: Uint8Array) => {
                chunks.push(Buffer.from(chunk));
            });

            const pdfDone = new Promise<void>((resolve, reject) => {
                doc.on('end', () => resolve());
                doc.on('error', reject);
            });

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
                .text(`Monthly Income: Rs.${income.toLocaleString('en-IN')}`)
                .text(`Existing EMI: Rs.${existing_emi.toLocaleString('en-IN')}`)
                .moveDown(2);

            // Loan Details Section
            doc.fontSize(16)
                .fillColor('#2c3e50')
                .text('Loan Details', { underline: true })
                .moveDown(0.5);

            doc.fontSize(12)
                .fillColor('#34495e')
                .text(`Loan Type: ${loanName}`)
                .text(`Loan Amount: Rs.${loanAmount.toLocaleString('en-IN')}`)
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
                .text(`Monthly EMI: Rs.${Math.round(emi).toLocaleString('en-IN')}`)
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

            await pdfDone;

            const pdfBuffer = Buffer.concat(chunks);

            await dbConnect();
            const storedPdf = await LoanPdf.create({
                filename,
                mimeType: 'application/pdf',
                content: pdfBuffer,
            });

            // Generate full URL based on environment
            const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '';
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || vercelUrl || 'http://localhost:3000';
            const fullPdfUrl = `${baseUrl}/api/pdfs/${String(storedPdf._id)}`;

            return {
                success: true,
                pdfPath: fullPdfUrl,
                fullUrl: fullPdfUrl,
                downloadUrl: fullPdfUrl,
                filename: filename,
                message: `PDF generated successfully! [Download Loan Confirmation PDF](${fullPdfUrl})`
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