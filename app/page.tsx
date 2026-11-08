
"use client";

import { useState, useRef } from "react";
import type { ChangeEvent } from "react";

interface Message {
  question: string;
  answer: string;
}

export default function Home() {
  const [documentText, setDocumentText] = useState("");
  const [filename, setFilename] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const fileInput = useRef<HTMLInputElement>(null);

  async function handleUpload(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    setError("");
    setAnswer("");

    if (
      file.type !== "application/pdf" ||
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      setError("Please select a valid PDF file.");
      event.target.value = "";
      return;
    }

    if (file.size === 0 || file.size > 5 * 1024 * 1024) {
      setError("PDF must be between 1 byte and 5 MB.");
      event.target.value = "";
      return;
    }

    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Upload failed.");
      }

      setDocumentText(data.text);
      setFilename(data.filename);
      setMessages([]);
      setAnswer("");

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to upload document."
      );
    } finally {
      setUploading(false);

      if (fileInput.current) {
        fileInput.current.value = "";
      }
    }
  }

  async function handleAsk() {
    if (!question.trim()) {
      setError("Please enter a question.");
      return;
    }

    if (!documentText) {
      setError("Please upload a PDF first.");
      return;
    }

    if (question.length > 1000) {
      setError("Question must be under 1000 characters.");
      return;
    }

    setError("");
    setAnswer("");
    setLoading(true);

    const currentQuestion = question.trim();
    setQuestion("");

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: currentQuestion,
          documentText,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "AI request failed.");
      }

      if (!response.body) {
        throw new Error("Streaming is unavailable.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let generatedAnswer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        generatedAnswer += decoder.decode(value, {
          stream: true,
        });

        setAnswer(generatedAnswer);
      }

      generatedAnswer += decoder.decode();

      setAnswer(generatedAnswer);

      setMessages((previous) => [
        ...previous,
        {
          question: currentQuestion,
          answer: generatedAnswer,
        },
      ]);

      if (!generatedAnswer.trim()) {
        setError("The AI returned an empty response.");
      }

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to generate answer."
      );

    } finally {
      setLoading(false);
    }
  }

  function clearDocument() {
    if (loading || uploading) return;

    setDocumentText("");
    setFilename("");
    setQuestion("");
    setAnswer("");
    setMessages([]);
    setError("");
  }

  return (
    <main className="main-container">

      <header className="header">
        <div className="logo">
          <span className="logo-icon">✦</span>
          <h2>DocuMind AI</h2>
        </div>

        <span className="status">
          AI POWERED
        </span>
      </header>

      <section className="hero">
        <span className="eyebrow">
          YOUR DOCUMENT INTELLIGENCE ASSISTANT
        </span>

        <h1>
          Understand your documents
          <span> with AI.</span>
        </h1>

        <p>
          Upload your PDF, ask questions, and get
          intelligent answers grounded in your document.
        </p>
      </section>

      <section className="workspace">

        <div className="upload-card">

          <div className="section-heading">
            <div>
              <h3>01. Upload Document</h3>
              <p>Choose a PDF to get started.</p>
            </div>

            <span className="step">PDF</span>
          </div>

          {!documentText ? (

            <div
              className="upload-area"
              onClick={() => {
                if (!uploading) {
                  fileInput.current?.click();
                }
              }}
            >
              <div className="upload-icon">↑</div>

              <h3>
                {uploading
                  ? "Processing document..."
                  : "Drop your PDF here"}
              </h3>

              <p>
                Click to browse your files
              </p>

              <span className="file-limit">
                PDF only · Maximum 5 MB
              </span>

              <input
                ref={fileInput}
                type="file"
                accept=".pdf,application/pdf"
                hidden
                onChange={handleUpload}
                disabled={uploading}
              />
            </div>

          ) : (

            <div className="document-info">

              <div className="file-icon">PDF</div>

              <div className="file-details">
                <strong>{filename}</strong>

                <span>
                  {documentText.length.toLocaleString()}
                  {" "}characters extracted
                </span>

                <span className="success-text">
                  ✓ Document ready
                </span>
              </div>

              <button
                className="remove-button"
                onClick={clearDocument}
                disabled={loading || uploading}
              >
                Remove
              </button>

            </div>
          )}

        </div>

        <div className="question-card">

          <div className="section-heading">
            <div>
              <h3>02. Ask Your Question</h3>
              <p>
                Ask anything about your uploaded document.
              </p>
            </div>

            <span className="step">AI</span>
          </div>

          <textarea
            placeholder={
              documentText
                ? "What would you like to know about this document?"
                : "Upload a PDF to start asking questions..."
            }
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={!documentText || loading}
            maxLength={1000}
          />

          <div className="question-footer">

            <span>
              {question.length}/1000 characters
            </span>

            <button
              className="ask-button"
              onClick={handleAsk}
              disabled={
                !documentText ||
                loading ||
                uploading ||
                !question.trim()
              }
            >
              {loading
                ? "Generating..."
                : "Generate Answer →"}
            </button>

          </div>

        </div>

        {error && (
          <div className="error-message" role="alert">
            ⚠ {error}
          </div>
        )}

        {uploading && (
          <div className="loading-message">
            <div className="spinner" />
            Extracting document content...
          </div>
        )}

        {loading && (
          <div className="loading-message">
            <div className="spinner" />
            AI is generating your answer...
          </div>
        )}

        {answer && (
          <div className="answer-card">

            <div className="answer-heading">
              <div>
                <span className="answer-label">
                  AI RESPONSE
                </span>

                <h3>Generated Answer</h3>
              </div>

              <span className="live-badge">
                ● LIVE
              </span>
            </div>

            <div className="answer-content">
              {answer}
            </div>

            {loading && (
              <span className="stream-cursor">▋</span>
            )}

            {!loading && (
              <div className="answer-source">
                <span>Source document:</span>
                <strong>{filename}</strong>
              </div>
            )}

          </div>
        )}

        {messages.length > 0 && (
          <div className="history-card">
            <h3>Previous Questions</h3>

            {messages.slice(0, -1).reverse().map(
              (item, index) => (
                <div className="history-item" key={index}>
                  <strong>Q: {item.question}</strong>
                  <p>{item.answer}</p>
                </div>
              )
            )}
          </div>
        )}

      </section>

      <footer>
        <p>
          DocuMind AI · Built with Next.js and Gemini AI
        </p>
      </footer>

    </main>
  );
}
