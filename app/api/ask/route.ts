
import { NextRequest, NextResponse } from "next/server";
import { ai } from "@/lib/gemini";

export const maxDuration = 120;

async function generateWithRetry(prompt: string) {
  const models = [
    "gemini-3.8-flash",
    "gemini-3.5-flash-lite",
  ];

  const delays = [1000, 2000];

  for (const model of models) {
    for (let attempt = 0; attempt <= delays.length; attempt++) {
      try {
        console.log(`Trying Gemini model: ${model}`);

        const stream = await ai.models.generateContentStream({
          model,
          contents: prompt,
          config: {
            abortSignal: AbortSignal.timeout(45000),
            maxOutputTokens: 1024,
          },
        });

        const iterator = stream[Symbol.asyncIterator]();
        const firstChunk = await iterator.next();

        console.log(`Gemini model succeeded: ${model}`);

        return { iterator, firstChunk };

      } catch (error: any) {
        const status = Number(error?.status ?? error?.code);

        console.error(
          `Gemini ${model} failed:`,
          status,
          error
        );

        const retryable = [
          429, 500, 502, 503, 504
        ].includes(status);

        if (!retryable) {
          throw error;
        }

        if (attempt < delays.length) {
          console.log(
            `Retrying ${model} in ${delays[attempt]}ms`
          );

          await new Promise(resolve =>
            setTimeout(resolve, delays[attempt])
          );
        }
      }
    }

    console.log(`Switching to fallback model.`);
  }

  throw new Error(
    "All Gemini models are temporarily unavailable."
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question, documentText } = body;

    if (
      typeof question !== "string" ||
      !question.trim() ||
      question.length > 1000
    ) {
      return NextResponse.json(
        {
          error: "Please enter a valid question under 1000 characters."
        },
        { status: 400 }
      );
    }

    if (
      typeof documentText !== "string" ||
      !documentText.trim()
    ) {
      return NextResponse.json(
        { error: "Please upload a document first." },
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
              controller.enqueue(
                encoder.encode(firstText)
              );
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
          console.error("Streaming failed:", error);
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

  } catch (error: any) {
    console.error("AI generation error:", error);

    return NextResponse.json(
      {
        error: "AI service is temporarily unavailable. Please try again.",
      },
      { status: 503 }
    );
  }
}
