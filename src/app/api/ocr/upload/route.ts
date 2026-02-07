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

        console.log('--- Groq Vision OCR Start ---');

        const { text: extractedText } = await generateText({
            model: groq('meta-llama/llama-4-scout-17b-16e-instruct'),
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: 'Extract the Full Name, 12-digit Aadhaar Number, and Date of Birth (in YYYY-MM-DD format) from this identity document. If it is a PAN card, extract the PAN number instead. Respond with ONLY the extracted data points clearly labeled.'
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
