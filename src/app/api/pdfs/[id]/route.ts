import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import LoanPdf from '@/models/LoanPdf';

function toNodeBuffer(value: unknown): Buffer | null {
  if (!value) return null;
  if (Buffer.isBuffer(value)) return value;

  if (value instanceof Uint8Array) {
    return Buffer.from(value);
  }

  if (value instanceof ArrayBuffer) {
    return Buffer.from(value);
  }

  if (typeof value === 'object') {
    const obj = value as { buffer?: unknown; data?: unknown };

    if (Buffer.isBuffer(obj.buffer)) {
      return obj.buffer;
    }

    if (obj.buffer instanceof Uint8Array) {
      return Buffer.from(obj.buffer);
    }

    if (Array.isArray(obj.data)) {
      return Buffer.from(obj.data);
    }
  }

  return null;
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  try {
    const resolvedParams = await Promise.resolve(context.params);
    const id = resolvedParams?.id;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid PDF id' }, { status: 400 });
    }

    await dbConnect();
    const pdfDoc = await LoanPdf.findById(id).select('filename mimeType content');

    if (!pdfDoc?.content) {
      return NextResponse.json({ error: 'PDF not found' }, { status: 404 });
    }

    const filename = typeof pdfDoc.filename === 'string' ? pdfDoc.filename : 'loan_confirmation.pdf';
    const mimeType = typeof pdfDoc.mimeType === 'string' ? pdfDoc.mimeType : 'application/pdf';
    const contentBuffer = toNodeBuffer(pdfDoc.content);

    if (!contentBuffer || contentBuffer.length === 0) {
      return NextResponse.json({ error: 'Stored PDF is empty or invalid' }, { status: 500 });
    }

    const body = new Uint8Array([...contentBuffer]);

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(contentBuffer.length),
        'Cache-Control': 'private, no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('[API/PDFs] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch PDF' }, { status: 500 });
  }
}
