import { NextResponse } from "next/server";
import { storePolicyDocument } from "@/lib/embeddings/policyVectorStore";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file || file.type !== "application/pdf") {
      return NextResponse.json({ error: "A PDF file is required" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // pdf2json works purely in Node.js, no worker needed
    const PDFParser = (await import("pdf2json")).default;

    const fullText = await new Promise<string>((resolve, reject) => {
      const parser = new PDFParser();

      parser.on("pdfParser_dataError", (err: any) => reject(new Error(err.parserError)));

      parser.on("pdfParser_dataReady", (data: any) => {
        const safeDecode = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };
        const text = data.Pages
          .flatMap((page: any) => page.Texts)
          .map((t: any) => safeDecode(t.R.map((r: any) => r.T).join("")))
          .join(" ")
          .trim();
        resolve(text);
      });

      parser.parseBuffer(buffer);
    });

    if (!fullText) {
      return NextResponse.json({ error: "Could not extract text from PDF" }, { status: 422 });
    }

    const result = await storePolicyDocument(file.name, fullText);

    return NextResponse.json({
      success: true,
      filename: file.name,
      chunksStored: result.chunksStored,
      message: `"${file.name}" uploaded and indexed with ${result.chunksStored} chunks.`,
    });

  } catch (error: any) {
    console.error("Policy upload error:", error);
    return NextResponse.json({ error: error.message || "Upload failed" }, { status: 500 });
  }
}