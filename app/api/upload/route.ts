
import { NextRequest, NextResponse } from "next/server";
import { extractPDF } from "@/lib/pdf";



export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Please upload a PDF file." },
        { status: 400 }
      );
    }

    if (
      file.type !== "application/pdf" ||
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      return NextResponse.json(
        { error: "Only PDF files are supported." },
        { status: 400 }
      );
    }

    if (file.size === 0 || file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "PDF size must be between 1 byte and 5 MB." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const extractedText = await extractPDF(buffer);

    if (extractedText.length > 100000) {
      return NextResponse.json(
        { error: "Document exceeds 100,000 characters." },
        { status: 413 }
      );
    }

    return NextResponse.json({
      success: true,
      filename: file.name,
      text: extractedText,
      characters: extractedText.length
    });

  } catch (error) {
    console.error("PDF upload error:", error);

    return NextResponse.json(
      { error: "Unable to process PDF. Please try another file." },
      { status: 500 }
    );
  }
}
