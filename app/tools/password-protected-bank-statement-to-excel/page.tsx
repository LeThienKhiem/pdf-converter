import type { Metadata } from "next";
import Link from "next/link";
import { Lock, ShieldCheck, Upload, Table2, ArrowRight } from "lucide-react";
import BankStatementEmbed from "@/components/BankStatementEmbed";

/**
 * Landing page for locked and password-protected bank statements.
 *
 * Built because the query data showed an opening rather than a hunch. Across
 * 90 days to 2026-09-29 not one query containing "password", "locked" or
 * "encrypted" reached the site — while the bank+AI cluster around it pulled
 * 1,145 impressions. The absence was ours: the capability shipped 2026-09-13
 * and no page targeted the words for it, so there was nothing for Google to
 * rank.
 *
 * It is also the one place in this market where the product is genuinely
 * ahead. The head term, "bank statement converter ai", sits behind two
 * exact-match domains and is an authority problem measured in months. This
 * phrasing has no incumbent and a real differentiator behind it: the file is
 * decrypted in the reader's own browser, so the password never reaches a
 * server. Competitors either refuse encrypted files or decrypt them
 * server-side; neither can make that claim.
 *
 * The converter itself is on the page. A page that ranks for "convert locked
 * bank statement" and then sends the reader elsewhere to actually do it is a
 * doorway, and deserves to be treated as one.
 */

const SITE = "https://www.invoicetodata.com";

export const metadata: Metadata = {
  alternates: { canonical: "/tools/password-protected-bank-statement-to-excel" },
  title: "Password-Protected Bank Statement to Excel — Converter",
  description:
    "Convert locked and password-protected PDF bank statements to Excel or CSV. Enter the password in the converter — it never leaves your browser. Any bank, first conversion free.",
  keywords: [
    "password protected bank statement to excel",
    "locked pdf bank statement converter",
    "convert encrypted bank statement",
    "how to convert password protected bank statement to excel",
    "open password protected bank statement",
    "locked bank statement to csv",
  ],
  openGraph: {
    title: "Password-Protected Bank Statement to Excel — Converter",
    description:
      "Convert locked PDF bank statements to Excel. The password is entered in the converter and never leaves your browser.",
    url: `${SITE}/tools/password-protected-bank-statement-to-excel`,
    type: "website",
    siteName: "InvoiceToData",
  },
};

/**
 * HowTo is one of the structured-data types Google still renders, unlike
 * FAQPage, which it removed entirely in May 2026 — so no FAQPage block here
 * even though the page carries questions and answers.
 */
const howToSchema = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "Convert a password-protected bank statement to Excel",
  description:
    "Open a locked PDF bank statement and convert it to Excel or CSV without removing the password yourself.",
  step: [
    {
      "@type": "HowToStep",
      position: 1,
      name: "Upload the statement as it came from the bank",
      text: "Drop the PDF onto the converter. There is no need to unlock or re-save it first.",
    },
    {
      "@type": "HowToStep",
      position: 2,
      name: "Enter the password when prompted",
      text: "A password box appears for protected files. The file is decrypted in your browser; the password is never sent to a server.",
    },
    {
      "@type": "HowToStep",
      position: 3,
      name: "Download Excel or CSV",
      text: "Transactions, dates, debit and credit columns and the running balance, ready to import into Xero or QuickBooks.",
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
      name: "Password-protected bank statements",
      item: `${SITE}/tools/password-protected-bank-statement-to-excel`,
    },
  ],
};

export default function PasswordProtectedBankStatementPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <header className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
            <Lock className="h-4 w-4" aria-hidden />
            Password stays in your browser
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Password-Protected Bank Statement to Excel
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
            Your bank locked the PDF. Upload it exactly as it arrived — enter the password
            when the converter asks, and get a spreadsheet back. No unlocking it yourself,
            no re-saving, no second tool.
          </p>
        </header>

        <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <BankStatementEmbed bankName="your bank" />
        </div>

        <section className="mt-16" aria-labelledby="privacy-heading">
          <h2 id="privacy-heading" className="text-2xl font-bold tracking-tight text-slate-900">
            The password never reaches our servers
          </h2>
          <p className="mt-4 text-slate-600">
            This is the part worth understanding before you type a password into any
            converter. The file is decrypted <strong>inside your browser</strong>, on your own
            machine. Only the unlocked pages are sent for extraction. We do not receive the
            password, store it, or write it to a log — not as a policy we promise to follow,
            but because of where the work happens.
          </p>
          <p className="mt-4 text-slate-600">
            Most converters take one of two other routes: refuse encrypted files outright, or
            upload the file and the password together and decrypt on their side. The second
            works, and it means your statement password sits in someone else&apos;s request
            logs.
          </p>
        </section>

        <section className="mt-16" aria-labelledby="how-heading">
          <h2 id="how-heading" className="text-2xl font-bold tracking-tight text-slate-900">
            How it works
          </h2>
          <ol className="mt-8 space-y-6">
            {[
              {
                icon: Upload,
                title: "Upload the locked PDF",
                body: "Exactly as the bank sent it. The converter detects that it is protected before anything is uploaded.",
              },
              {
                icon: Lock,
                title: "Enter the password",
                body: "A box appears asking for it. Usually a date of birth, part of an account number, or a customer ID — whatever your bank uses.",
              },
              {
                icon: Table2,
                title: "Download Excel or CSV",
                body: "Dates, descriptions, separate debit and credit columns, and the running balance — laid out for Xero and QuickBooks import.",
              },
            ].map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <s.icon className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h3 className="font-semibold text-slate-900">
                    {i + 1}. {s.title}
                  </h3>
                  <p className="mt-1 text-slate-600">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-16" aria-labelledby="check-heading">
          <h2 id="check-heading" className="text-2xl font-bold tracking-tight text-slate-900">
            How to check nothing was dropped
          </h2>
          <p className="mt-4 text-slate-600">
            The output carries the <strong>running balance</strong> from every row, not just the
            transactions. Compare the final figure against your statement: if it matches, every
            row made it across. A converter that returns a bare transaction list gives you no
            way to catch a missing one, and a single dropped row breaks a reconciliation weeks
            later when finding it is expensive.
          </p>
        </section>

        <section className="mt-16" aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="text-2xl font-bold tracking-tight text-slate-900">
            Questions
          </h2>
          <dl className="mt-8 space-y-8">
            <div>
              <dt className="font-semibold text-slate-900">
                I do not know my statement password. What is it usually?
              </dt>
              <dd className="mt-2 text-slate-600">
                Banks build it from something they already hold about you — commonly a date of
                birth in DDMMYYYY form, the last digits of the account number, a customer or
                reference ID, or a combination. The exact rule is in the email the statement
                arrived with, or in the statements section of your online banking. We cannot
                recover or guess it.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-900">
                Do I need to remove the password first?
              </dt>
              <dd className="mt-2 text-slate-600">
                No. That used to be the only way and it is what most guides still tell you to
                do — open the file in Preview or Acrobat, enter the password, save a copy
                without it, upload that. Upload the original instead.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-900">
                Does it work with scanned statements that are also protected?
              </dt>
              <dd className="mt-2 text-slate-600">
                Yes. Once unlocked, a scanned statement is read the same way any scanned
                statement is — the AI reads the transaction table off the page rather than
                lifting text out of the file.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-900">How many pages can it take?</dt>
              <dd className="mt-2 text-slate-600">
                Unlocking handles up to 120 pages in one file, which is past what a normal
                statement reaches — a year across three accounts is roughly 100. The first
                conversion is free, up to ten pages, with no account.
              </dd>
            </div>
          </dl>
        </section>

        <section className="mt-16 rounded-2xl border border-slate-200 bg-slate-50/60 px-6 py-8">
          <h2 className="text-lg font-semibold text-slate-900">Statements from a specific bank</h2>
          <p className="mt-2 text-slate-600">
            Guides covering the formats and quirks of individual banks, including which ones
            protect their downloads by default.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {[
              { slug: "hsbc", name: "HSBC" },
              { slug: "barclays", name: "Barclays" },
              { slug: "chase", name: "Chase" },
              { slug: "citi", name: "Citi" },
              { slug: "sparkasse", name: "Sparkasse" },
              { slug: "deutsche-bank", name: "Deutsche Bank" },
            ].map((b) => (
              <Link
                key={b.slug}
                href={`/tools/bank/${b.slug}`}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-blue-400 hover:text-blue-600"
              >
                {b.name}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            ))}
          </div>
          <p className="mt-5 text-sm text-slate-500">
            <ShieldCheck className="mr-1 inline h-4 w-4 align-text-bottom" aria-hidden />
            Statement not protected? The{" "}
            <Link href="/tools/bank-statement-to-excel" className="text-blue-600 hover:underline">
              standard bank statement converter
            </Link>{" "}
            handles it the same way.
          </p>
        </section>
      </main>
    </div>
  );
}
