import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "/tools/bank-statement-to-excel" },
  title: "Bank Statement to Excel Free: AI PDF Converter",
  description:
    "Convert PDF bank statements to Excel or CSV free — any bank, any layout. AI extracts transactions in seconds for Xero, QuickBooks, and reconciliation.",
  openGraph: {
    title: "Bank Statement to Excel Free: AI PDF Converter",
    description:
      "Convert PDF bank statements to Excel or CSV free — any bank, any layout. AI extracts transactions in seconds for Xero, QuickBooks, and reconciliation.",
  },
};

export default function BankStatementToExcelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
