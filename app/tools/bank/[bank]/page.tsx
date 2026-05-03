import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  FileBarChart,
  ShieldCheck,
  Lock,
  CheckCircle2,
} from "lucide-react";
import {
  BANK_ENTITIES,
  getAllBankSlugs,
  getBankEntityBySlug,
  type BankEntity,
} from "@/lib/bankEntities";

/**
 * Layer 4 — Programmatic SEO route.
 *
 * Generates one server-rendered page per bank in `lib/bankEntities.ts`.
 * Each page targets long-tail "convert {bank} statement to excel" queries
 * with bank-specific copy + structured data, then funnels visitors to the
 * single shared interactive tool at /tools/bank-statement-to-excel.
 *
 * We deliberately do NOT embed the interactive extractor here — keeping
 * the bank pages as pure server-rendered content + CTA means they:
 *   1) load faster (no client JS for the tool),
 *   2) get indexed reliably (no JS rendering ambiguity for crawlers),
 *   3) concentrate funnel data on one tool URL.
 *
 * Adding a bank: add a row to BANK_ENTITIES — generateStaticParams() will
 * pick it up at next build.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.invoicetodata.com";
const TOOL_URL = `${SITE_URL}/tools/bank-statement-to-excel`;

type Props = { params: Promise<{ bank: string }> };

export function generateStaticParams(): { bank: string }[] {
  return getAllBankSlugs().map((bank) => ({ bank }));
}

/** Build per-page <title> + meta keyed off the bank entity. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { bank } = await params;
  const entity = getBankEntityBySlug(bank);
  if (!entity) return { title: "Bank Statement Converter" };

  const pageUrl = `${SITE_URL}/tools/bank/${entity.slug}`;
  const title = `Convert ${entity.name} Bank Statements to Excel — Free AI Converter`;
  const description = `Convert ${entity.name} (${entity.country}) PDF bank statements to Excel or CSV in seconds. AI-powered, ${entity.passwordProtected ? "handles password-protected statements (after unlocking)" : "no manual data entry"}, ready for Xero/QuickBooks.`;

  return {
    title,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: "InvoiceToData",
      type: "website",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

function buildStructuredData(entity: BankEntity, pageUrl: string) {
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Tools", item: `${SITE_URL}/tools` },
      {
        "@type": "ListItem",
        position: 3,
        name: "Bank Statement to Excel",
        item: TOOL_URL,
      },
      { "@type": "ListItem", position: 4, name: entity.name, item: pageUrl },
    ],
  };

  const howTo = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: `Convert a ${entity.name} bank statement to Excel`,
    description: `Step-by-step guide to converting a ${entity.name} PDF bank statement into a structured Excel or CSV file using AI.`,
    totalTime: "PT2M",
    step: [
      {
        "@type": "HowToStep",
        position: 1,
        name: `Download your ${entity.name} statement`,
        text: `Sign in to your ${entity.name} online banking at ${entity.domain} and download the statement as a PDF.`,
      },
      ...(entity.passwordProtected
        ? [
            {
              "@type": "HowToStep",
              position: 2,
              name: "Remove the PDF password",
              text: `${entity.name} typically password-protects statement PDFs. Open it in Preview (Mac) or Acrobat (Windows), enter the password, then save a copy without the password before uploading.`,
            },
          ]
        : []),
      {
        "@type": "HowToStep",
        position: entity.passwordProtected ? 3 : 2,
        name: "Upload to InvoiceToData",
        text: `Drop the unlocked PDF onto the converter. The AI reads the transaction table directly from the visual layout — no template setup needed.`,
      },
      {
        "@type": "HowToStep",
        position: entity.passwordProtected ? 4 : 3,
        name: "Download Excel or CSV",
        text: `Click "Download your Excel" to save a structured spreadsheet ready to import into Xero, QuickBooks, or your accounting workflow.`,
      },
    ],
  };

  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `Can I convert ${entity.name} statements to Excel for free?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Yes. The InvoiceToData converter is free for your first conversion (no signup) and offers 3 more free credits with a free account. ${entity.name} statements convert in seconds with no template setup.`,
        },
      },
      {
        "@type": "Question",
        name: `Does the converter handle ${entity.passwordProtected ? "password-protected" : "downloaded"} ${entity.name} PDFs?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: entity.passwordProtected
            ? `Not directly — for security we don't process encrypted PDFs. ${entity.name} typically password-protects statement downloads, so unlock the PDF first (open in Preview or Acrobat, enter the password, save a copy without the password) and then upload.`
            : `Yes. ${entity.name} downloads PDF statements without password protection by default, so you can upload directly without preprocessing.`,
        },
      },
      {
        "@type": "Question",
        name: `Will the Excel output work with QuickBooks or Xero?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Yes. The output is a standard .xlsx file with date, description, amount, and balance columns mapped to spreadsheet columns. You can map these fields directly to QuickBooks Online, Xero, Sage, or Wave during import.`,
        },
      },
      {
        "@type": "Question",
        name: `Are my ${entity.name} bank statements secure?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Yes. Statements are processed in memory and discarded immediately after extraction. We do not store the PDF or the extracted data, and we do not use your statements to train AI models.`,
        },
      },
    ],
  };

  return [breadcrumb, howTo, faq];
}

export default async function BankStatementLandingPage({ params }: Props) {
  const { bank } = await params;
  const entity = getBankEntityBySlug(bank);
  if (!entity) notFound();

  const pageUrl = `${SITE_URL}/tools/bank/${entity.slug}`;
  const structuredData = buildStructuredData(entity, pageUrl);

  // Suggest related banks (same country first, then any) for cross-linking
  const related = BANK_ENTITIES.filter(
    (b) => b.slug !== entity.slug
  )
    .sort((a, b) => {
      const sameCountryA = a.country === entity.country ? 0 : 1;
      const sameCountryB = b.country === entity.country ? 0 : 1;
      return sameCountryA - sameCountryB;
    })
    .slice(0, 6);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {structuredData.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}

      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Hero */}
        <header className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-white px-6 py-12 text-center shadow-sm sm:px-10 sm:py-16">
          <p className="mb-3 text-sm font-medium uppercase tracking-wide text-blue-600">
            {entity.country} • {entity.currency}
            {entity.passwordProtected && " • Password-protected PDFs"}
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
            Convert {entity.name} Bank Statements to Excel
          </h1>
          <p className="mt-4 text-lg text-slate-600 sm:text-xl">
            Free AI-powered converter for {entity.name} PDF statements. Drop the
            file, get a clean Excel or CSV ready for Xero, QuickBooks, or your
            accounting spreadsheet — in under a minute.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/tools/bank-statement-to-excel"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#217346] px-6 py-4 text-base font-semibold text-white shadow-md transition-all hover:bg-[#1d603d] hover:shadow-lg"
            >
              <FileBarChart className="h-5 w-5 shrink-0" aria-hidden />
              Convert your {entity.name} statement
              <ArrowRight className="h-4 w-4" />
            </Link>
            <span className="text-sm text-slate-500">
              No sign-up required for the first conversion
            </span>
          </div>
        </header>

        {/* Bank-specific note */}
        <section
          className="mt-10 rounded-2xl border border-blue-100 bg-blue-50/60 p-6 sm:p-8"
          aria-labelledby="bank-note-heading"
        >
          <h2 id="bank-note-heading" className="text-lg font-semibold text-slate-900">
            What to know about {entity.name} statements
          </h2>
          <p className="mt-3 text-slate-700">{entity.note}</p>
          <dl className="mt-6 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="font-medium text-slate-500">Country</dt>
              <dd className="mt-0.5 font-semibold text-slate-900">{entity.country}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Currency</dt>
              <dd className="mt-0.5 font-semibold text-slate-900">{entity.currency}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Statement formats</dt>
              <dd className="mt-0.5 font-semibold text-slate-900">
                {entity.statementFormats.join(", ")}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Account types covered</dt>
              <dd className="mt-0.5 font-semibold text-slate-900">
                {entity.accountTypes.join(", ")}
              </dd>
            </div>
          </dl>
        </section>

        {/* Step-by-step */}
        <section
          className="mt-14 rounded-2xl border border-slate-200 bg-white px-6 py-10 shadow-sm sm:px-8 sm:py-12"
          aria-labelledby="steps-heading"
        >
          <h2
            id="steps-heading"
            className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
          >
            How to convert a {entity.name} statement
          </h2>
          <ol className="mt-8 space-y-8">
            <li className="flex gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                1
              </span>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Download your statement from {entity.domain}
                </h3>
                <p className="mt-2 text-slate-600">
                  Sign in to your {entity.name} online banking at{" "}
                  <strong>{entity.domain}</strong>, navigate to your account
                  statements, and download the period you need as a PDF.
                </p>
              </div>
            </li>
            {entity.passwordProtected && (
              <li className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500 text-sm font-bold text-white">
                  <Lock className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    Remove the password from the PDF
                  </h3>
                  <p className="mt-2 text-slate-600">
                    {entity.name} typically protects statement PDFs with a
                    password (often a portion of your account number, date of
                    birth, or other identifier you set up). For security
                    reasons our converter does not process encrypted PDFs —
                    open the file in Preview (Mac) or Acrobat (Windows),
                    enter the password, then choose <em>File → Save As</em>{" "}
                    and save a copy without the password.
                  </p>
                </div>
              </li>
            )}
            <li className="flex gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                {entity.passwordProtected ? "3" : "2"}
              </span>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Upload to the InvoiceToData converter
                </h3>
                <p className="mt-2 text-slate-600">
                  Open the{" "}
                  <Link
                    href="/tools/bank-statement-to-excel"
                    className="text-blue-600 underline-offset-2 hover:underline"
                  >
                    bank statement converter
                  </Link>{" "}
                  and drop the PDF onto the upload zone (under 5MB). The AI
                  reads the document as a visual grid — transaction date,
                  description, amount, balance — and preserves every row.
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                {entity.passwordProtected ? "4" : "3"}
              </span>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Download Excel or CSV
                </h3>
                <p className="mt-2 text-slate-600">
                  Click <strong>Download your Excel</strong> to save a clean{" "}
                  .xlsx with bordered cells and bold section headers — ready
                  to import into Xero, QuickBooks, Sage, or Wave for
                  reconciliation.
                </p>
              </div>
            </li>
          </ol>
          <div className="mt-10 text-center">
            <Link
              href="/tools/bank-statement-to-excel"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-base font-semibold text-white shadow-md transition-all hover:bg-blue-700"
            >
              Try it with your {entity.name} statement
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* Why this works */}
        <section
          className="mt-14 rounded-2xl border border-slate-200 bg-slate-50/60 px-6 py-10 sm:px-8 sm:py-12"
          aria-labelledby="why-heading"
        >
          <h2
            id="why-heading"
            className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
          >
            Why this works for {entity.name} statements
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <CheckCircle2 className="h-6 w-6 text-green-600" aria-hidden />
              <h3 className="mt-3 font-semibold text-slate-900">
                No template setup
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                Most converters need a saved template per bank. Ours reads
                the visual layout directly, so {entity.name}&apos;s exact
                formatting doesn&apos;t need to be pre-configured.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <CheckCircle2 className="h-6 w-6 text-green-600" aria-hidden />
              <h3 className="mt-3 font-semibold text-slate-900">
                Preserves {entity.currency} amounts and dates
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                Numeric amounts in {entity.currency} and the date format used
                by {entity.name} pass through unchanged — what you see in the
                PDF is what you get in the spreadsheet.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <ShieldCheck className="h-6 w-6 text-blue-600" aria-hidden />
              <h3 className="mt-3 font-semibold text-slate-900">
                Bank-level privacy
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                Your statement is processed in memory and discarded as soon as
                the response is sent. We never store the PDF or the extracted
                data, and we don&apos;t use it to train models.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section
          className="mt-14 rounded-2xl border border-slate-200 bg-white px-6 py-10 shadow-sm sm:px-8 sm:py-12"
          aria-labelledby="faq-heading"
        >
          <h2
            id="faq-heading"
            className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
          >
            FAQ — {entity.name} statement conversion
          </h2>
          <dl className="mt-8 space-y-8">
            <div>
              <dt className="text-base font-semibold text-slate-900">
                Can I convert {entity.name} statements to Excel for free?
              </dt>
              <dd className="mt-2 text-slate-600">
                Yes. Your first conversion is free with no sign-up. Create a
                free account to get 3 more free credits, then $9.99 buys 50
                additional credits (about $0.20 per page).
              </dd>
            </div>
            <div>
              <dt className="text-base font-semibold text-slate-900">
                Does the converter handle{" "}
                {entity.passwordProtected ? "password-protected" : "downloaded"}{" "}
                {entity.name} PDFs?
              </dt>
              <dd className="mt-2 text-slate-600">
                {entity.passwordProtected
                  ? `Not directly — for security we don't process encrypted PDFs. ${entity.name} typically password-protects statement downloads, so unlock the PDF first (open in Preview or Acrobat, enter the password, save a copy without the password) and then upload.`
                  : `Yes. ${entity.name} downloads statement PDFs without password protection by default, so you can upload directly without preprocessing.`}
              </dd>
            </div>
            <div>
              <dt className="text-base font-semibold text-slate-900">
                Will the Excel output work with QuickBooks or Xero?
              </dt>
              <dd className="mt-2 text-slate-600">
                Yes. Output is a standard .xlsx with date, description,
                amount, and balance columns. Map these directly into
                QuickBooks Online, Xero, Sage, or Wave during the bank import
                step.
              </dd>
            </div>
            <div>
              <dt className="text-base font-semibold text-slate-900">
                Can it handle multi-account or multi-page {entity.name}{" "}
                statements?
              </dt>
              <dd className="mt-2 text-slate-600">
                Yes. The AI processes the entire PDF and preserves separate
                account sections as distinct labeled tables. Long statements
                stay structured row-for-row.
              </dd>
            </div>
            <div>
              <dt className="text-base font-semibold text-slate-900">
                Are my {entity.name} statements stored?
              </dt>
              <dd className="mt-2 text-slate-600">
                No. Files are processed in memory and discarded immediately
                after extraction. We do not retain the PDF or the structured
                data, and we do not train AI models on your content.
              </dd>
            </div>
          </dl>
        </section>

        {/* Related banks for internal linking */}
        {related.length > 0 && (
          <section
            className="mt-14 rounded-2xl border border-slate-200 bg-slate-50/40 px-6 py-10 sm:px-8 sm:py-12"
            aria-labelledby="related-heading"
          >
            <h2
              id="related-heading"
              className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
            >
              Other supported banks
            </h2>
            <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((b) => (
                <li key={b.slug}>
                  <Link
                    href={`/tools/bank/${b.slug}`}
                    className="block rounded-xl border border-slate-200 bg-white px-4 py-3 transition-colors hover:border-blue-300 hover:bg-blue-50/50"
                  >
                    <span className="font-semibold text-slate-900">
                      Convert {b.name} statements
                    </span>
                    <span className="ml-2 text-sm text-slate-500">
                      {b.country}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-6 text-center">
              <Link
                href="/tools/bank-statement-to-excel"
                className="text-sm font-semibold text-blue-600 hover:underline"
              >
                Don&apos;t see your bank? The converter works with any bank →
              </Link>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
