import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Convert PDF to Google Sheets with AI - Free Online Tool",
  description:
    "Automatically extract data from PDFs, invoices, and forms directly into Google Sheets using AI. Paste your Sheet URL and sync in one click.",
  openGraph: {
    title: "Convert PDF to Google Sheets with AI - Free Online Tool",
    description:
      "Automatically extract data from PDFs, invoices, and forms directly into Google Sheets using AI.",
  },
};

export default function PdfToGsheetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
