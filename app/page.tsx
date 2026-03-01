"use client";

import Link from "next/link";
import {
  FileSpreadsheet,
  Shield,
  Upload,
  FileDown,
  Sparkles,
  ArrowRight,
  FileBarChart,
  Calculator,
  FileSearch,
  Briefcase,
  Database,
  ShieldCheck,
} from "lucide-react";
import dynamic from "next/dynamic";

const SmartAdBanner = dynamic(() => import("@/components/SmartAdBanner"), {
  ssr: false,
});

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-slate-200/80 bg-gradient-to-b from-slate-50 to-white px-4 py-16 sm:px-6 sm:py-20 lg:px-8" aria-labelledby="hero-heading">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(37,99,235,0.08),transparent)]" />
          <div className="mx-auto max-w-4xl text-center">
            <h1 id="hero-heading" className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
              Automate Your Invoice Data Extraction
            </h1>
            <p className="mt-5 text-lg text-slate-600 sm:text-xl">
              Instantly convert your PDF invoices and reports into structured Google Sheets or Excel files.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-5">
              <Link
                href="/tools/pdf-to-excel"
                className="inline-flex w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-[#217346] px-6 py-4 text-base font-semibold text-white shadow-md transition-all hover:bg-[#1d603d] hover:shadow-lg sm:w-auto"
              >
                <FileBarChart className="h-5 w-5 shrink-0" aria-hidden />
                Convert PDF to Excel
              </Link>
              <Link
                href="/tools/pdf-to-gsheet"
                className="inline-flex w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0F9D58] to-[#1a73e8] px-6 py-4 text-base font-semibold text-white shadow-md transition-all hover:opacity-95 hover:shadow-lg sm:w-auto"
              >
                <FileSpreadsheet className="h-5 w-5 shrink-0" aria-hidden />
                Convert PDF to Google Sheet
              </Link>
            </div>
          </div>
        </section>

        {/* Ad Placement 1: below Hero */}
        <div className="border-b border-slate-200/80 bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <p className="mb-2 text-center text-xs font-medium uppercase tracking-wider text-slate-400">Advertisement</p>
            <div className="w-full flex justify-center my-8">
              <div className="hidden md:block">
                <SmartAdBanner width={728} height={90} />
              </div>
              <div className="block md:hidden">
                <SmartAdBanner width={300} height={250} />
              </div>
            </div>
          </div>
        </div>

        {/* Features */}
        <section id="features" className="border-b border-slate-200/80 bg-white px-4 py-16 sm:px-6 sm:py-20 lg:px-8" aria-labelledby="features-heading">
          <div className="mx-auto max-w-6xl">
            <div className="text-center">
              <h2 id="features-heading" className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Why Choose Our AI Converter?</h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
                Accurate extraction, secure processing, and one-click export to your workflow.
              </p>
            </div>
            <div className="mt-10 rounded-xl border border-blue-100 bg-blue-50/50 p-6 text-center">
              <h3 className="text-lg font-semibold text-slate-900">Layout-Aware Extraction with Powerful AI Model</h3>
              <p className="mt-2 text-slate-600">
                We use Google&apos;s Powerful AI Model to analyze your document as a visual grid. Every row and column from your PDF, invoice, or form is preserved in the Excel output—no merging or guessing. Section headers (Part I, Section A, Invoice lines) are detected and styled with bold and light grey background for clarity.
              </p>
            </div>
            <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              <div className="group relative rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">High Accuracy</h3>
                <p className="mt-2 text-slate-600">
                  AI-powered extraction reads line items, totals, and vendor details with high accuracy—even from scanned or messy PDFs.
                </p>
              </div>
              <div className="group relative rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Shield className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">Secure Processing</h3>
                <p className="mt-2 text-slate-600">
                  Your invoices are processed securely. We don&apos;t store sensitive data longer than needed and comply with data privacy standards.
                </p>
              </div>
              <div className="group relative rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <FileSpreadsheet className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">Excel & Google Sheets</h3>
                <p className="mt-2 text-slate-600">
                  Download as Excel or get a Google Sheet you can copy to your Drive. Layout and headers are preserved with styling.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="border-b border-slate-200/80 bg-slate-50/50 px-4 py-16 sm:px-6 sm:py-20 lg:px-8" aria-labelledby="how-heading">
          <div className="mx-auto max-w-6xl">
            <div className="text-center">
              <h2 id="how-heading" className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">How it works</h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">Three simple steps from PDF to spreadsheet.</p>
            </div>
            <div className="mt-14 grid gap-10 sm:grid-cols-3">
              <div className="relative flex flex-col items-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-blue-600 bg-white text-blue-600">
                  <Upload className="h-7 w-7" />
                </div>
                <div className="mt-4 font-mono text-sm font-medium text-blue-600">Step 1</div>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">Upload</h3>
                <p className="mt-2 text-slate-600">Drag and drop your PDF or image (under 5MB).</p>
                <div className="absolute -right-5 top-7 hidden text-slate-300 sm:block lg:right-0">
                  <ArrowRight className="h-6 w-6" />
                </div>
              </div>
              <div className="relative flex flex-col items-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-blue-600 bg-white text-blue-600">
                  <Sparkles className="h-7 w-7" />
                </div>
                <div className="mt-4 font-mono text-sm font-medium text-blue-600">Step 2</div>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">Extract</h3>
                <p className="mt-2 text-slate-600">AI converts the layout to a table (row/column preserved).</p>
                <div className="absolute -right-5 top-7 hidden text-slate-300 sm:block lg:right-0">
                  <ArrowRight className="h-6 w-6" />
                </div>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-blue-600 bg-white text-blue-600">
                  <FileDown className="h-7 w-7" />
                </div>
                <div className="mt-4 font-mono text-sm font-medium text-blue-600">Step 3</div>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">Download or Copy</h3>
                <p className="mt-2 text-slate-600">Get Excel with styled headers or make a copy to Google Sheets.</p>
              </div>
            </div>
            <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/tools/pdf-to-excel"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#217346] px-6 py-3.5 text-base font-semibold text-white shadow-sm transition-all hover:bg-[#1d603d] hover:shadow-md"
              >
                Convert PDF to Excel
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/tools/pdf-to-gsheet"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0F9D58] to-[#1a73e8] px-6 py-3.5 text-base font-semibold text-white shadow-sm transition-all hover:opacity-95 hover:shadow-md"
              >
                Convert PDF to Google Sheet
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* Comprehensive Benefits – 300+ words for AdSense, premium B2B layout */}
        <section className="border-b border-slate-200/80 bg-white px-4 py-16 sm:px-6 lg:px-8" aria-labelledby="benefits-heading">
          <div className="mx-auto max-w-6xl">
            <h2 id="benefits-heading" className="text-center text-3xl font-bold tracking-tight text-gray-900 mb-6 md:text-4xl">
              Comprehensive Benefits of AI-Powered PDF Extraction
            </h2>
            <p className="mx-auto max-w-3xl text-center text-lg text-gray-600 mb-12">
              Invoice To Data is built for professionals who need to turn PDF invoices, reports, and forms into structured data quickly and accurately. Our SaaS value proposition centers on three pillars: reducing manual work, preserving the integrity of your data, and fitting seamlessly into the tools you already use—whether that is Excel for desktop analysis or Google Sheets for collaboration and cloud workflows.
            </p>

            <p className="mb-6 text-center text-slate-700 font-medium">We serve a broad target audience.</p>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600" aria-hidden>
                  <Calculator className="h-6 w-6" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">Finance &amp; Accounting</h3>
                <p className="mt-2 text-slate-600">
                  Finance and accounting teams use the tool to digitize vendor invoices and statements for reconciliation and approval workflows.
                </p>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600" aria-hidden>
                  <FileSearch className="h-6 w-6" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">Auditors &amp; Compliance</h3>
                <p className="mt-2 text-slate-600">
                  Auditors and compliance staff extract tables from reports and tax documents without re-typing.
                </p>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600" aria-hidden>
                  <Briefcase className="h-6 w-6" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">Small Business &amp; Freelancers</h3>
                <p className="mt-2 text-slate-600">
                  Small business owners and freelancers convert receipts and estimates into spreadsheets for bookkeeping.
                </p>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600" aria-hidden>
                  <Database className="h-6 w-6" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">Data &amp; Operations</h3>
                <p className="mt-2 text-slate-600">
                  Data and operations teams migrate legacy PDFs into structured formats for reporting and integration.
                </p>
              </div>
            </div>
            <p className="mt-6 text-center text-slate-600 max-w-3xl mx-auto">
              In every case, the goal is the same: get from PDF to usable data in minutes, not hours, and avoid the errors that come with manual entry.
            </p>

            <div className="my-12 flex flex-col gap-8 rounded-3xl border border-green-100 bg-green-50 p-8 md:flex-row md:items-center md:p-10">
              <span className="flex shrink-0 items-center justify-center text-green-600" aria-hidden>
                <ShieldCheck className="h-16 w-16 md:h-[64px] md:w-[64px]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-slate-700">
                  Data privacy and security are non-negotiable. We do not store your documents or the data we extract. Files are processed in memory and discarded immediately after the request completes. We do not use your content to train models or share it with third parties. This approach aligns with data minimization and supports compliance with common privacy expectations in business and regulated environments. You keep full control of your data; we simply provide a fast, accurate conversion service that runs when you need it and leaves no trace afterward.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-8 rounded-3xl border border-slate-200 bg-slate-50 p-8 md:flex-row md:items-start">
              <span className="flex shrink-0 items-center justify-center text-indigo-600" aria-hidden>
                <Sparkles className="h-14 w-14 md:h-16 md:w-16" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-slate-600">
                  The underlying technology uses advanced AI to understand your document as a visual layout—rows, columns, headers, and sections—rather than as a flat stream of text. That is why tables stay aligned, numbers stay in the right cells, and multi-section documents are converted in one go. Whether your source is a native PDF or a scanned image, the same pipeline delivers consistent, high-quality output. No sign-up is required to try the free tools; you can convert PDFs to Excel or Google Sheets in seconds and see the benefits for yourself.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Ad Placement 2: before FAQ */}
        <div className="border-b border-slate-200/80 bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <p className="mb-2 text-center text-xs font-medium uppercase tracking-wider text-slate-400">Advertisement</p>
            <div className="w-full flex justify-center my-8">
              <div className="hidden md:block">
                <SmartAdBanner width={728} height={90} />
              </div>
              <div className="block md:hidden">
                <SmartAdBanner width={300} height={250} />
              </div>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <section className="border-b border-slate-200/80 bg-white px-4 py-16 sm:px-6 lg:px-8" aria-labelledby="faq-heading">
          <div className="mx-auto max-w-3xl">
            <h2 id="faq-heading" className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">
              Frequently Asked Questions
            </h2>
            <div className="mt-8 space-y-2">
              <details className="group rounded-lg border border-slate-200 bg-white px-4">
                <summary className="cursor-pointer list-none py-3 font-medium text-slate-900 marker:contents [&::-webkit-details-marker]:hidden">
                  What file types are supported?
                </summary>
                <p className="pb-3 text-slate-600">
                  We accept PDF files and images (JPEG, PNG, WebP, GIF). Files must be under 5MB for fast processing.
                </p>
              </details>
              <details className="group rounded-lg border border-slate-200 bg-white px-4">
                <summary className="cursor-pointer list-none py-3 font-medium text-slate-900 marker:contents [&::-webkit-details-marker]:hidden">
                  Is the PDF to Excel converter free?
                </summary>
                <p className="pb-3 text-slate-600">
                  Yes. You can upload documents and download Excel output at no cost. No sign-up required for basic use.
                </p>
              </details>
              <details className="group rounded-lg border border-slate-200 bg-white px-4">
                <summary className="cursor-pointer list-none py-3 font-medium text-slate-900 marker:contents [&::-webkit-details-marker]:hidden">
                  How accurate is the extraction?
                </summary>
                <p className="pb-3 text-slate-600">
                  We use Powerful AI Model for layout-aware extraction, so rows and columns from your PDF are preserved in the Excel output. Tables, forms, and invoices are converted with high fidelity.
                </p>
              </details>
              <details className="group rounded-lg border border-slate-200 bg-white px-4">
                <summary className="cursor-pointer list-none py-3 font-medium text-slate-900 marker:contents [&::-webkit-details-marker]:hidden">
                  Do you store my documents?
                </summary>
                <p className="pb-3 text-slate-600">
                  We process files in memory and do not store your PDFs or extracted data after the request completes. Your documents stay private.
                </p>
              </details>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-slate-900 px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Ready to automate your invoice data?</h2>
            <p className="mt-4 text-lg text-slate-300">Convert PDFs to Excel or Google Sheets in seconds—no sign-up required.</p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-5">
              <Link
                href="/tools/pdf-to-excel"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#217346] px-6 py-3.5 text-base font-semibold text-white shadow-md transition-all hover:bg-[#1d603d] hover:shadow-lg"
              >
                Convert PDF to Excel
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/tools/pdf-to-gsheet"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-base font-semibold text-slate-900 shadow-md transition-all hover:bg-slate-100 hover:shadow-lg"
              >
                Convert PDF to Google Sheet
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

    </div>
  );
}
