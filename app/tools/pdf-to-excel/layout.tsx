import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Best PDF to Data Converter | Extract PDF to Excel & JSON - InvoiceToData",
  description:
    "Convert PDF and images to Excel with layout preserved. Free online tool using Powerful AI Model. Supports invoices, Form 8862, and tables.",
  openGraph: {
    title: "PBest PDF to Data Converter | Extract PDF to Excel & JSON - InvoiceToData",
    description:
      "Convert PDF and images to Excel with layout preserved. Free online tool using Powerful AI Model.",
  },
};

export default function PdfToExcelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
