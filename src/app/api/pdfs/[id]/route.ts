import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import LoanPdf from '@/models/LoanPdf';

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
    const pdfDoc = await LoanPdf.findById(id).select('filename mimeType content').lean();

    if (!pdfDoc?.content) {
      return NextResponse.json({ error: 'PDF not found' }, { status: 404 });
    }

    const filename = typeof pdfDoc.filename === 'string' ? pdfDoc.filename : 'loan_confirmation.pdf';
    const mimeType = typeof pdfDoc.mimeType === 'string' ? pdfDoc.mimeType : 'application/pdf';
    const contentBuffer = Buffer.isBuffer(pdfDoc.content)
      ? pdfDoc.content
      : Buffer.from(pdfDoc.content as ArrayBufferLike);

    return new NextResponse(contentBuffer, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('[API/PDFs] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch PDF' }, { status: 500 });
  }
}
