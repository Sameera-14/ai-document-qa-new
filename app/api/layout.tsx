
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DocuMind AI | Document Q&A",
  description:
    "An AI-powered document question-answering application using Gemini AI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
