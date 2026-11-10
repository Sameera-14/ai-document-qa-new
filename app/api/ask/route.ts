

import { NextRequest, NextResponse } from "next/server";
import { ai } from "@/lib/gemini";

async function generateWithRetry(prompt: string) {
  const delays = [1000, 2000, 4000];

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const stream = await ai.models.generateContentStream({
        model: "gemini-3.8-flash",
        contents: prompt,
      });

      // Read the first chunk here so initial streaming errors
      // are also caught by the retry mechanism.
      const iterator = stream[Symbol.asyncIterator]();
      const firstChunk = await iterator.next();

      return { iterator, firstChunk };
    } catch (error: any) {
      const status = Number(
        error?.status ??
        error?.code ??
        error?.error?.code
      );

      if (
        ![429, 500, 502, 503, 504].includes(status) ||
        attempt === delays.length
      ) {
        throw error;
      }

      console.log(
        `Gemini error ${status}. Retry attempt ${attempt + 1}`
      );

      await new Promise((resolve) =>
        setTimeout(resolve, delays[attempt])
      );
    }
  }

  throw new Error("AI service is temporarily unavailable.");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question, documentText } = body;

    if (!question || typeof question !== "string" || !question.trim()) {
      return NextResponse.json(
        { error: "Please enter a valid question." },
        { status: 400 }
      );
    }

    if (
      !documentText ||
      typeof documentText !== "string" ||
      !documentText.trim()
    ) {
      return NextResponse.json(
        { error: "Please upload a document first." },
        { status: 400 }
      );
    }

    if (question.length > 1000) {
      return NextResponse.json(
        { error: "Question must be under 1000 characters." },
        { status: 400 }
      );
    }

    if (documentText.length > 100000) {
      return NextResponse.json(
        { error: "Document exceeds the allowed size." },
        { status: 413 }
      );
    }

    const prompt = `
You are an AI document question-answering assistant.

Answer using ONLY the information in the document.

Rules:
1. Do not invent information.
2. Do not use outside knowledge.
3. Give clear and accurate answers.
4. If the answer is unavailable, say:
"Information not found in the provided document."
5. Keep answers relevant.

DOCUMENT:
${documentText}

QUESTION:
${question}

ANSWER:
`;

    const { iterator, firstChunk } =
      await generateWithRetry(prompt);

    const encoder = new TextEncoder();

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          if (!firstChunk.done) {
            const firstText = firstChunk.value.text || "";

            if (firstText) {
              controller.enqueue(encoder.encode(firstText));
            }
          }

          while (true) {
            const { done, value } = await iterator.next();

            if (done) break;

            const text = value.text || "";

            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }

          controller.close();
        } catch (error) {
          console.error("Gemini streaming error:", error);
          controller.error(error);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });

  } catch (error) {
    console.error("AI generation error:", error);

    return NextResponse.json(
      {
        error: "AI service is temporarily unavailable. Please try again.",
      },
      { status: 503 }
    );
  }
}
