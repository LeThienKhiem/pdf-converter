import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Extract Data from PDF Invoice to Excel | Powered by Gemini AI",
  description:
    "Free AI tool to automatically extract data from PDF invoices to Excel and Google Sheets. Powered by Gemini AI for 100% accurate table and line-item extraction.",
  openGraph: {
    title: "Extract Data from PDF Invoice to Excel | Powered by Gemini AI",
    description:
      "Free AI tool to automatically extract data from PDF invoices to Excel and Google Sheets. Powered by Gemini AI for 100% accurate table and line-item extraction.",
  },
};

export default function PdfToExcelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
