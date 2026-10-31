import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard, Table2, Upload, ShieldCheck, ArrowRight } from "lucide-react";
import BankStatementEmbed from "@/components/BankStatementEmbed";

/**
 * Landing page for credit card statements.
 *
 * The cheapest page on the site to justify: the product already does this.
 * BANK_SYSTEM_PROMPT in lib/bankStatement.ts reads "bank, credit card or
 * account statement", and the per-bank pages list Credit Card among their
 * account types. The capability shipped long ago; nothing said so anywhere a
 * search could find it.
 *
 * Competitors validated the demand — bankstatementconverters.ai runs both
 * /converters/credit-card-statement-pdf-to-excel and -to-csv — and our own
 * query data shows the intersection that matters here: "download hdfc credit
 * card statement" is a credit-card query from the market converting at 4.83%.
 *
 * Deliberately a thin page by this site's standards. A credit card statement
 * is the same transaction table as a bank statement with a different header,
 * so this says what differs and then gets out of the way rather than padding
 * to a word count.
 */

const SITE = "https://www.invoicetodata.com";

export const metadata: Metadata = {
  alternates: { canonical: "/tools/credit-card-statement-to-excel" },
  title: "Credit Card Statement to Excel — Free PDF Converter",
  description:
    "Convert a PDF credit card statement to Excel or CSV. Transactions, dates, amounts and running balance, ready for Xero or QuickBooks. First conversion free.",
  keywords: [
    "credit card statement to excel",
    "convert credit card statement pdf to excel",
    "credit card statement pdf to csv",
    "credit card statement converter",
    "download credit card statement excel",
  ],
  openGraph: {
    title: "Credit Card Statement to Excel — Free PDF Converter",
    description:
      "Convert a PDF credit card statement to Excel or CSV in seconds. Any issuer, any layout.",
    url: `${SITE}/tools/credit-card-statement-to-excel`,
    type: "website",
    siteName: "InvoiceToData",
  },
};

/**
 * HowTo and BreadcrumbList only. No FAQPage — Google removed FAQ rich results
 * in May 2026, so that markup would be weight without effect.
 */
const howToSchema = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "Convert a credit card statement to Excel",
  description: "Turn a PDF credit card statement into a spreadsheet of transactions.",
  step: [
    {
      "@type": "HowToStep",
      position: 1,
      name: "Upload the statement",
      text: "Drop in the PDF as the issuer sent it. Protected files are handled — the password is entered in the converter.",
    },
    {
      "@type": "HowToStep",
      position: 2,
      name: "The AI reads the transaction table",
      text: "Dates, merchant descriptions, amounts and the running balance, read from the page layout with no template to set up.",
    },
    {
      "@type": "HowToStep",
      position: 3,
      name: "Download",
      text: "Excel or CSV, or QIF, OFX, IIF and Tally for direct import into accounting software.",
    },
  ],
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE },
    { "@type": "ListItem", position: 2, name: "Tools", item: `${SITE}/tools` },
    {
      "@type": "ListItem",
      position: 3,
      name: "Credit card statement to Excel",
      item: `${SITE}/tools/credit-card-statement-to-excel`,
    },
  ],
};

export default function CreditCardStatementPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <header className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
            <CreditCard className="h-4 w-4" aria-hidden />
            Any issuer, any layout
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Credit Card Statement to Excel
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
            Upload the PDF your card issuer sent. Get back every transaction as a
            spreadsheet — dates, merchants, amounts, running balance.
          </p>
        </header>

        <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {/*
            bankName feeds "Drop your {bankName} statement here" and the batch
            upsell line, both of which want a bank's name. There is no issuer
            name on a generic page, so dropLabel carries the wording instead
            and bankName is left off.
          */}
          <BankStatementEmbed
            tool="credit-card-statement-to-excel"
            noun="statement"
            dropLabel="Drop your credit card statement here"
          />
        </div>

        <section className="mt-16" aria-labelledby="diff-heading">
          <h2 id="diff-heading" className="text-2xl font-bold tracking-tight text-slate-900">
            What differs from a bank statement
          </h2>
          <p className="mt-4 text-slate-600">
            Less than you would expect — a card statement is the same transaction table with
            different column names, which is why the same extractor handles both. Three things
            are particular to cards:
          </p>
          <ul className="mt-5 space-y-4 text-slate-600">
            <li>
              <strong className="text-slate-900">Purchases and payments point opposite ways.</strong>{" "}
              A purchase increases what you owe; a payment to the card reduces it. The output
              keeps them in separate debit and credit columns so the direction survives the
              conversion rather than becoming a column of unsigned numbers.
            </li>
            <li>
              <strong className="text-slate-900">Merchant names are messy.</strong> Card
              statements carry the acquirer&apos;s descriptor, not the shop&apos;s trading name —
              reference codes, city names and processor prefixes packed into one field. It is
              preserved exactly as printed rather than cleaned up, because a guess at what the
              merchant &quot;really&quot; is would be a guess inside your accounting records.
            </li>
            <li>
              <strong className="text-slate-900">Foreign currency rows appear twice.</strong> Many
              issuers print the original amount and the converted one. Both are kept, so the
              exchange difference is visible instead of silently collapsed.
            </li>
          </ul>
        </section>

        <section className="mt-16" aria-labelledby="check-heading">
          <h2 id="check-heading" className="text-2xl font-bold tracking-tight text-slate-900">
            How to check nothing was dropped
          </h2>
          <p className="mt-4 text-slate-600">
            The output carries the <strong>running balance</strong> where the statement has one.
            Compare the closing figure against your statement: if it matches, every row made it
            across. A converter that returns a bare list of transactions gives you no way to
            notice a missing one, and on a card statement a dropped row is a purchase that never
            reaches your books.
          </p>
        </section>

        <section className="mt-16" aria-labelledby="formats-heading">
          <h2 id="formats-heading" className="text-2xl font-bold tracking-tight text-slate-900">
            What you can download
          </h2>
          <p className="mt-4 text-slate-600">
            Excel and CSV for a spreadsheet, or the file your accounting software imports
            directly — QIF for Quicken, OFX for QuickBooks Online and Xero, IIF for QuickBooks
            Desktop, XML for Tally. No column mapping in an import wizard.
          </p>
          <p className="mt-4 text-sm text-slate-500">
            <Link href="/blog/bank-statement-to-qif-ofx-iif-tally" className="text-blue-600 hover:underline">
              More on which format to pick
            </Link>
          </p>
        </section>

        <section className="mt-16 rounded-2xl border border-slate-200 bg-slate-50/60 px-6 py-8">
          <h2 className="text-lg font-semibold text-slate-900">Statement locked?</h2>
          <p className="mt-2 text-slate-600">
            Card issuers protect statement PDFs as often as banks do. Upload it as it arrived and
            enter the password when the converter asks — the file is unlocked in your own browser
            and the password never reaches a server.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/tools/password-protected-bank-statement-to-excel"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-blue-400 hover:text-blue-600"
            >
              How password-protected statements work
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
            <Link
              href="/tools/bank-statement-to-excel"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-blue-400 hover:text-blue-600"
            >
              Bank statement converter
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
          <p className="mt-5 text-sm text-slate-500">
            <ShieldCheck className="mr-1 inline h-4 w-4 align-text-bottom" aria-hidden />
            Files are processed and discarded — we do not keep your statements.
          </p>
        </section>

        <section className="mt-16 grid gap-6 sm:grid-cols-3">
          {[
            { icon: Upload, t: "No template setup", d: "Any issuer's layout, read from the page rather than a per-card map." },
            { icon: Table2, t: "Scans and photos too", d: "A photographed statement converts the same as a downloaded one." },
            { icon: CreditCard, t: "Free first conversion", d: "Up to ten pages, no account and no card." },
          ].map((f) => (
            <div key={f.t} className="rounded-xl border border-slate-200 p-5">
              <f.icon className="h-5 w-5 text-blue-600" aria-hidden />
              <h3 className="mt-3 font-semibold text-slate-900">{f.t}</h3>
              <p className="mt-1 text-sm text-slate-600">{f.d}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
