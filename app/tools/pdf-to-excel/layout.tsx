import type { Metadata } from "next";

/**
 * On naming: this says the tool *runs on* Claude, it never uses "Claude" as
 * part of the product or feature name.
 *
 * Anthropic's guidance permits accurately stating in plain text that your
 * product runs Claude, and prohibits using the Claude or Anthropic names as
 * part of your own product, feature, or company name — or in any way implying
 * Anthropic built, endorses, or partnered on it.
 *
 * An earlier revision here read "Claude PDF to Excel: …", chosen purely to
 * match the query "claude pdf to excel" for click-through. That phrasing reads
 * as a feature name, which is the prohibited use — it was a worse position on
 * this axis than the "Powered by" wording it replaced. "Powered by" keeps the
 * term in the title for query matching while staying inside the plain-text
 * statement the guidance allows.
 *
 * This is a summary of guidance, not legal advice, and it is drawn from the
 * Claude Code legal page rather than Anthropic's full Trademark Guidelines —
 * read those directly before leaning on this wording commercially.
 */
/**
 * Term coverage is deliberately close to the title that actually earned the
 * ranking: "Extract Data from PDF Invoice to Excel | Powered by Claude AI".
 * That version holds the top organic slot for "claude convert pdf to excel",
 * so it — not a rewrite — is the known-good baseline.
 *
 * Keeps PDF / Invoice / Excel / Claude, adds "Free" and "Converter" (which
 * also covers the "convert" in the query). A first pass at this fix dropped
 * "Invoice", which the ranking title carried; put back.
 */
export const metadata: Metadata = {
  title: "Free PDF Invoice to Excel Converter — Powered by Claude AI",
  description:
    "Convert PDF invoices to Excel free, powered by Claude AI. Extract tables, line items, and totals in seconds — no signup for your first file. Try it today.",
  openGraph: {
    title: "Free PDF Invoice to Excel Converter — Powered by Claude AI",
    description:
      "Convert PDF invoices to Excel free, powered by Claude AI. Extract tables, line items, and totals in seconds — no signup for your first file.",
  },
};

export default function PdfToExcelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
