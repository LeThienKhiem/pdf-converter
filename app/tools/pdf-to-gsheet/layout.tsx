import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PDF to Google Sheets Free: AI Extraction in 1 Click",
  description:
    "Convert PDFs and invoices to Google Sheets free with AI. Paste your Sheet URL and sync in one click — no downloads, no reformatting, ready in seconds.",
  openGraph: {
    title: "PDF to Google Sheets Free: AI Extraction in 1 Click",
    description:
      "Convert PDFs and invoices to Google Sheets free with AI. Paste your Sheet URL and sync in one click — no downloads, no reformatting.",
  },
};

export default function PdfToGsheetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
