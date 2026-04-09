import type { Metadata } from "next";
import Link from "next/link";
import { Check, Zap, Shield, FileSpreadsheet, Star, Clock, Lock } from "lucide-react";
import PaddleCheckoutButton from "@/components/PaddleCheckoutButton";
import { createClient } from "@/lib/supabase/server";

const siteUrl = "https://invoicetodata.com";

export const metadata: Metadata = {
  title: "Pricing — Invoice OCR & PDF to Excel | InvoiceToData",
  description:
    "Convert PDF invoices to Excel from $0.20/page. Start free with 3 credits. No subscription required. AI-powered invoice OCR with 99% accuracy.",
  keywords:
    "invoice OCR pricing, PDF to Excel cost, invoice data extraction pricing, invoice automation pricing, cheap invoice OCR",
  alternates: {
    canonical: `${siteUrl}/pricing`,
  },
  openGraph: {
    title: "Pricing — Invoice OCR & PDF to Excel | InvoiceToData",
    description:
      "Convert PDF invoices to Excel from $0.20/page. Start free with 3 credits. No subscription.",
    url: `${siteUrl}/pricing`,
    type: "website",
    siteName: "InvoiceToData",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing — Invoice OCR & PDF to Excel | InvoiceToData",
    description:
      "Convert PDF invoices to Excel from $0.20/page. Start free. No subscription.",
  },
};

function PricingStructuredData() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "InvoiceToData Pricing",
    description:
      "AI-powered invoice OCR pricing. Convert PDF invoices to Excel starting from $0.20 per page.",
    url: `${siteUrl}/pricing`,
    mainEntity: {
      "@type": "Product",
      name: "InvoiceToData — AI Invoice OCR",
      description:
        "AI-powered tool to convert PDF invoices into structured Excel and Google Sheets data using OCR technology.",
      brand: {
        "@type": "Organization",
        name: "InvoiceToData",
      },
      offers: [
        {
          "@type": "Offer",
          name: "Free Tier",
          price: "0",
          priceCurrency: "USD",
          description: "3 free credits to try invoice OCR extraction",
          availability: "https://schema.org/InStock",
        },
        {
          "@type": "Offer",
          name: "Credit Pack — 50 Credits",
          price: "9.99",
          priceCurrency: "USD",
          description:
            "50 credits for PDF invoice extraction with priority processing",
          availability: "https://schema.org/InStock",
        },
      ],
    },
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How much does InvoiceToData cost?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "InvoiceToData offers a free tier with 3 credits. Additional credits can be purchased in packs of 50 for $9.99 (about $0.20 per extraction). No monthly subscription required.",
        },
      },
      {
        "@type": "Question",
        name: "Is there a free trial for InvoiceToData?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes! Every new user gets 3 free credits to try the service. You can also use 1 free extraction without signing up. No credit card required.",
        },
      },
      {
        "@type": "Question",
        name: "What does one credit include?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "One credit allows you to extract data from one PDF document (invoice or bank statement) and convert it to Excel or Google Sheets format using AI OCR.",
        },
      },
      {
        "@type": "Question",
        name: "Is my invoice data secure?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. All documents are processed in memory and deleted immediately after extraction. No invoice data is stored on our servers.",
        },
      },
      {
        "@type": "Question",
        name: "How accurate is the invoice OCR?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "InvoiceToData uses Gemini AI for OCR extraction, achieving high accuracy on both digital and scanned PDF invoices including line items, totals, dates, and vendor information.",
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    </>
  );
}

export default async function PricingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <PricingStructuredData />

      <main className="max-w-[1440px] mx-auto py-16 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="inline-block text-sm font-medium text-slate-600 hover:text-slate-900 mb-8"
        >
          ← Back to Home
        </Link>

        {/* Hero */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Invoice OCR Pricing — Simple, Pay-As-You-Go
          </h1>
          <p className="mt-4 text-lg text-slate-600 leading-relaxed">
            Convert PDF invoices to Excel or Google Sheets from just{" "}
            <strong>$0.20 per page</strong>. Start free — no credit card
            required. No monthly subscriptions.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Free Tier */}
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm flex flex-col">
            <div className="flex items-center gap-2 text-slate-500 font-medium">
              <Zap className="h-5 w-5" aria-hidden />
              Free tier
            </div>
            <h2 className="mt-4 text-2xl font-bold text-slate-900">Free</h2>
            <p className="mt-1 text-slate-600">$0 — no credit card needed</p>
            <ul className="mt-6 space-y-4 flex-1">
              <li className="flex items-start gap-3 text-slate-600">
                <Check
                  className="h-5 w-5 shrink-0 text-emerald-500 mt-0.5"
                  aria-hidden
                />
                <span>
                  <strong>3 free credits</strong> to get started
                </span>
              </li>
              <li className="flex items-start gap-3 text-slate-600">
                <Check
                  className="h-5 w-5 shrink-0 text-emerald-500 mt-0.5"
                  aria-hidden
                />
                <span>
                  AI-powered extraction (invoices, bank statements, receipts)
                </span>
              </li>
              <li className="flex items-start gap-3 text-slate-600">
                <Check
                  className="h-5 w-5 shrink-0 text-emerald-500 mt-0.5"
                  aria-hidden
                />
                <span>Export to Excel and Google Sheets</span>
              </li>
              <li className="flex items-start gap-3 text-slate-600">
                <Check
                  className="h-5 w-5 shrink-0 text-emerald-500 mt-0.5"
                  aria-hidden
                />
                <span>Scanned &amp; digital PDF support</span>
              </li>
            </ul>
            <Link
              href="/tools/pdf-to-excel"
              className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-6 py-4 text-base font-semibold text-slate-900 shadow-sm transition-all hover:border-slate-400 hover:bg-slate-50 sm:w-auto"
            >
              Try Free Now
            </Link>
          </div>

          {/* Credit Pack */}
          <div className="rounded-2xl border-2 border-[#217346] bg-white p-8 shadow-lg flex flex-col relative">
            <div className="absolute -top-3 left-6 rounded-full bg-[#217346] px-3 py-1 text-xs font-semibold text-white">
              Best Value
            </div>
            <div className="flex items-center gap-2 text-[#217346] font-medium">
              <FileSpreadsheet className="h-5 w-5" aria-hidden />
              Credit pack
            </div>
            <h2 className="mt-4 text-2xl font-bold text-slate-900">
              50 Credits
            </h2>
            <p className="mt-1 text-slate-600">
              <span className="text-2xl font-bold text-slate-900">$9.99</span>{" "}
              one-time{" "}
              <span className="text-sm text-emerald-600 font-medium">
                ($0.20/page)
              </span>
            </p>
            <ul className="mt-6 space-y-4 flex-1">
              <li className="flex items-start gap-3 text-slate-600">
                <Check
                  className="h-5 w-5 shrink-0 text-emerald-500 mt-0.5"
                  aria-hidden
                />
                <span>
                  <strong>50 credits</strong> for PDF &amp; bank statement
                  extraction
                </span>
              </li>
              <li className="flex items-start gap-3 text-slate-600">
                <Check
                  className="h-5 w-5 shrink-0 text-emerald-500 mt-0.5"
                  aria-hidden
                />
                <span>Priority processing — faster results</span>
              </li>
              <li className="flex items-start gap-3 text-slate-600">
                <Check
                  className="h-5 w-5 shrink-0 text-emerald-500 mt-0.5"
                  aria-hidden
                />
                <span>Perfect Excel/CSV formatting with line items</span>
              </li>
              <li className="flex items-start gap-3 text-slate-600">
                <Shield
                  className="h-5 w-5 shrink-0 text-slate-400 mt-0.5"
                  aria-hidden
                />
                <span>Secure in-memory processing — zero data retention</span>
              </li>
              <li className="flex items-start gap-3 text-slate-600">
                <Check
                  className="h-5 w-5 shrink-0 text-emerald-500 mt-0.5"
                  aria-hidden
                />
                <span>Credits never expire</span>
              </li>
            </ul>
            <div className="mt-8 w-full">
              {user?.id ? (
                <PaddleCheckoutButton
                  priceId={process.env.NEXT_PUBLIC_PADDLE_PRICE_ID ?? ""}
                  userEmail={user.email ?? undefined}
                  userId={user.id}
                >
                  Buy 50 Credits — $9.99
                </PaddleCheckoutButton>
              ) : (
                <Link
                  href="/login"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#217346] px-6 py-4 text-base font-semibold text-white shadow-md transition-all hover:bg-[#1d603d] hover:shadow-lg"
                >
                  Log In to Buy 50 Credits — $9.99
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Trust Signals */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <Lock className="h-6 w-6 text-slate-400 shrink-0" aria-hidden />
            <div>
              <p className="text-sm font-medium text-slate-900">
                Zero data retention
              </p>
              <p className="text-xs text-slate-500">
                Files processed in memory, deleted instantly
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <Clock className="h-6 w-6 text-slate-400 shrink-0" aria-hidden />
            <div>
              <p className="text-sm font-medium text-slate-900">
                Results in seconds
              </p>
              <p className="text-xs text-slate-500">
                AI extracts data in under 30 seconds
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <Star className="h-6 w-6 text-slate-400 shrink-0" aria-hidden />
            <div>
              <p className="text-sm font-medium text-slate-900">
                No subscriptions
              </p>
              <p className="text-xs text-slate-500">
                Buy credits when you need them
              </p>
            </div>
          </div>
        </div>

        {/* How it works */}
        <section className="mt-20 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 text-center">
            How Invoice OCR Extraction Works
          </h2>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            <div>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-lg font-bold">
                1
              </div>
              <h3 className="mt-3 font-semibold text-slate-900">Upload PDF</h3>
              <p className="mt-1 text-sm text-slate-600">
                Upload any invoice — scanned, digital, or photographed.
              </p>
            </div>
            <div>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-lg font-bold">
                2
              </div>
              <h3 className="mt-3 font-semibold text-slate-900">
                AI Extracts Data
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Gemini AI reads and structures all line items, totals, and
                dates.
              </p>
            </div>
            <div>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-lg font-bold">
                3
              </div>
              <h3 className="mt-3 font-semibold text-slate-900">
                Get Excel/Sheets
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Download structured data in Excel or copy to Google Sheets.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="mt-20 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 text-center">
            Frequently Asked Questions
          </h2>
          <dl className="mt-8 space-y-6">
            <div className="rounded-xl border border-slate-200 p-6">
              <dt className="font-semibold text-slate-900">
                How much does InvoiceToData cost?
              </dt>
              <dd className="mt-2 text-slate-600">
                InvoiceToData offers a free tier with 3 credits. Additional
                credits can be purchased in packs of 50 for $9.99 (about $0.20
                per extraction). No monthly subscription required — buy credits
                when you need them.
              </dd>
            </div>
            <div className="rounded-xl border border-slate-200 p-6">
              <dt className="font-semibold text-slate-900">
                Is there a free trial?
              </dt>
              <dd className="mt-2 text-slate-600">
                Yes! Every new user gets 3 free credits. You can also try 1
                extraction without signing up. No credit card required to start.
              </dd>
            </div>
            <div className="rounded-xl border border-slate-200 p-6">
              <dt className="font-semibold text-slate-900">
                What does one credit include?
              </dt>
              <dd className="mt-2 text-slate-600">
                One credit allows you to extract data from one PDF document —
                invoice, bank statement, or receipt — and convert it to Excel or
                Google Sheets format using AI OCR.
              </dd>
            </div>
            <div className="rounded-xl border border-slate-200 p-6">
              <dt className="font-semibold text-slate-900">
                Is my invoice data secure?
              </dt>
              <dd className="mt-2 text-slate-600">
                All documents are processed in memory and deleted immediately
                after extraction. No invoice data is stored on our servers. Your
                financial data never touches a database.
              </dd>
            </div>
            <div className="rounded-xl border border-slate-200 p-6">
              <dt className="font-semibold text-slate-900">
                Do credits expire?
              </dt>
              <dd className="mt-2 text-slate-600">
                No. Your credits never expire. Use them at your own pace.
              </dd>
            </div>
            <div className="rounded-xl border border-slate-200 p-6">
              <dt className="font-semibold text-slate-900">
                What types of documents can I extract?
              </dt>
              <dd className="mt-2 text-slate-600">
                InvoiceToData handles PDF invoices, bank statements, receipts,
                and financial reports — both digital PDFs and scanned documents.
                The AI accurately extracts tables, line items, totals, dates,
                and vendor information.
              </dd>
            </div>
          </dl>
        </section>

        {/* Bottom CTA */}
        <div className="mt-20 text-center">
          <h2 className="text-2xl font-bold text-slate-900">
            Ready to automate your invoice processing?
          </h2>
          <p className="mt-2 text-slate-600">
            Start free — extract your first invoice in under 30 seconds.
          </p>
          <Link
            href="/tools/pdf-to-excel"
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-blue-600 px-8 py-4 text-base font-semibold text-white shadow-md transition-all hover:bg-blue-700 hover:shadow-lg"
          >
            Try Free Now — No Sign Up Required
          </Link>
        </div>

        <p className="mt-12 text-center text-sm text-slate-500 max-w-2xl mx-auto">
          All payments are processed securely by Paddle. You can purchase credit
          packs as needed; no recurring charges.
        </p>
      </main>
    </div>
  );
}
