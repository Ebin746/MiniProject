import { NextResponse } from 'next/server';
import { groq } from '@ai-sdk/groq';
import { generateText } from 'ai';

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        console.log('--- Groq Vision OCR Start (Unified) ---');

        const prompt = `Identify the type of document and extract information as follows:
- IF SALARY SLIP: Extract Full Name, Designation/Job Title, and Monthly Net/Gross Salary.
- IF AADHAR CARD: Extract Full Name, 12-digit Aadhaar Number, and Date of Birth (YYYY-MM-DD).
- IF PAN CARD: Extract Full Name and PAN Number.
Respond with ONLY the extracted data points clearly labeled. If a field is not found, omit it.`;

        const { text: extractedText } = await generateText({
            model: groq('meta-llama/llama-4-scout-17b-16e-instruct'),
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: prompt
                        },
                        {
                            type: 'image',
                            image: buffer
                        },
                    ],
                },
            ],
        });

        console.log('Extracted Text:', extractedText);
        console.log('--- Groq Vision OCR End ---');

        return NextResponse.json({ text: extractedText });
    } catch (error: any) {
        console.error('OCR Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
