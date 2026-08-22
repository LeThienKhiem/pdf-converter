import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Claude PDF to Excel: Free AI Invoice OCR in Seconds",
  description:
    "Convert PDF invoices to Excel with Claude AI, free. Extract tables, line items, and totals in seconds. Discover the fastest AI OCR — try free today.",
  openGraph: {
    title: "Claude PDF to Excel: Free AI Invoice OCR in Seconds",
    description:
      "Convert PDF invoices to Excel with Claude AI, free. Extract tables, line items, and totals in seconds. Discover the fastest AI OCR — try free today.",
  },
};

export default function PdfToExcelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
