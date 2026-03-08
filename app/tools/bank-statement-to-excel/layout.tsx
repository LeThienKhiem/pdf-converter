import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Convert PDF Bank Statements to Excel & CSV Free | AI Extractor",
  description:
    "Securely extract transactions from PDF bank statements to Excel or CSV in seconds using AI. Perfect for Xero, QuickBooks, and bank reconciliation.",
  openGraph: {
    title: "Convert PDF Bank Statements to Excel & CSV Free | AI Extractor",
    description:
      "Securely extract transactions from PDF bank statements to Excel or CSV in seconds using AI. Perfect for Xero, QuickBooks, and bank reconciliation.",
  },
};

export default function BankStatementToExcelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
