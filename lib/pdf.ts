import pdf from "pdf-parse/lib/pdf-parse.js";

export async function extractPDF(buffer: Buffer): Promise<string> {
  try {
    const result = await pdf(buffer);

    const extractedText = result.text || "";

    if (!extractedText.trim()) {
      throw new Error("No readable text found in PDF.");
    }

    return extractedText;
  } catch (error) {
    console.error("PDF extraction failed:", error);
    throw new Error("Unable to extract text from PDF.");
  }
}