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
import SmartAdBanner from "@/components/SmartAdBanner";

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-slate-200/80 bg-gradient-to-b from-slate-50 to-white px-4 py-16 sm:px-6 sm:py-20 lg:px-8" aria-labelledby="hero-heading">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(37,99,235,0.08),transparent)]" />
          <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl text-center">
              <h1 id="hero-heading" className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
                Automate Financial Data Entry with AI
              </h1>
              <p className="mt-6 text-lg text-slate-600 leading-relaxed sm:text-xl max-w-3xl mx-auto">
                InvoiceToData eliminates manual typing by converting complex PDFs, receipts, and bank statements into Excel, CSV, or Google Sheets in seconds. Our context-aware AI understands tables, line items, and financial layouts—so you get structured data that matches your source document without reformatting. No more copy-pasting from invoices or re-keying statement lines; just upload, extract, and integrate into your existing workflows.
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

        {/* Text-rich content block — 1440px wrapper for AdSense */}
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-24">
          {/* The Hidden Cost of Manual Data Entry */}
          <section className="space-y-6" aria-labelledby="problem-heading">
            <h2 id="problem-heading" className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              The Hidden Cost of Manual Data Entry
            </h2>
            <p className="text-gray-600 text-lg leading-relaxed">
              Businesses and accounting firms lose hundreds of billable hours every year copying line items from invoices, re-keying bank statement transactions, and transcribing receipts into spreadsheets. What looks like a simple task—entering a vendor name, an amount, or a date—compounds into a major drain on productivity when multiplied across dozens of clients or hundreds of documents per month. Staff who could be focused on analysis, reconciliation, or advisory work instead spend their time on repetitive data entry that adds little strategic value and increases the risk of costly errors.
            </p>
            <p className="text-gray-600 text-lg leading-relaxed">
              Human error in manual data entry is one of the leading causes of month-end reconciliation mistakes, delayed closes, and audit findings. A single misplaced decimal, transposed digit, or duplicated line can throw off totals, break formulas, and force teams to hunt for discrepancies long after the fact. InvoiceToData removes that risk by using AI to extract data directly from your source documents with layout-aware precision, so the numbers that land in your Excel or Google Sheets match the PDF—every time. Free your team from typing and let them focus on what matters: interpreting the data, not re-entering it.
            </p>
          </section>

          {/* Our Suite of AI Data Extraction Tools */}
          <section className="space-y-8" aria-labelledby="tools-heading">
            <h2 id="tools-heading" className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Our Suite of AI Data Extraction Tools
            </h2>
            <p className="text-gray-600 text-lg leading-relaxed max-w-3xl">
              Each tool is built for a specific use case but shares the same secure, AI-powered engine. Choose the one that fits your workflow and start converting in seconds.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600 mb-4">
                  <FileBarChart className="h-6 w-6" aria-hidden />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-3">AI PDF to Excel Converter</h3>
                <p className="text-gray-600 leading-relaxed flex-1">
                  Extract line items, totals, vendor details, and due dates from invoices and receipts. Our AI preserves table structure and section headers so your Excel output is ready for approval workflows, expense coding, or import into your accounting system. Handles both native PDFs and scanned images.
                </p>
                <Link
                  href="/tools/pdf-to-excel"
                  className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-[#217346] px-5 py-3 text-base font-semibold text-white shadow-sm transition-all hover:bg-[#1d603d] hover:shadow-md w-full sm:w-auto"
                >
                  Try it now
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600 mb-4">
                  <Calculator className="h-6 w-6" aria-hidden />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-3">Bank Statement Extractor</h3>
                <p className="text-gray-600 leading-relaxed flex-1">
                  Turn PDF bank statements into clean Excel or CSV in one click. The tool isolates transaction dates, descriptions, withdrawals, deposits, and running balances so you can reconcile faster and import directly into Xero, QuickBooks, or your own spreadsheets. Built for bookkeepers and finance teams who need accuracy without manual re-keying.
                </p>
                <Link
                  href="/tools/bank-statement-to-excel"
                  className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-[#217346] px-5 py-3 text-base font-semibold text-white shadow-sm transition-all hover:bg-[#1d603d] hover:shadow-md w-full sm:w-auto"
                >
                  Try it now
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600 mb-4">
                  <FileSpreadsheet className="h-6 w-6" aria-hidden />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-3">PDF to Google Sheets</h3>
                <p className="text-gray-600 leading-relaxed flex-1">
                  Convert PDFs directly into Google Sheets for cloud collaboration. Share extracted tables with your team, link to other sheets, or use Sheets formulas and add-ons without leaving the browser. Ideal for remote teams and anyone who prefers Google Workspace over desktop Excel.
                </p>
                <Link
                  href="/tools/pdf-to-gsheet"
                  className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0F9D58] to-[#1a73e8] px-5 py-3 text-base font-semibold text-white shadow-sm transition-all hover:opacity-95 hover:shadow-md w-full sm:w-auto"
                >
                  Try it now
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </section>

          {/* Who Is This Platform For? */}
          <section className="space-y-8" aria-labelledby="audience-heading">
            <h2 id="audience-heading" className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Who Is This Platform For?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 mb-3">Accountants &amp; Bookkeepers</h3>
                <p className="text-gray-600 leading-relaxed">
                  Speed up month-end close and client reporting by converting client invoices, bank statements, and receipts into structured data in minutes. Reduce re-keying errors and free up time for review and advisory work. Export to Excel or CSV for direct import into your practice management or accounting software.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 mb-3">Small Business Owners</h3>
                <p className="text-gray-600 leading-relaxed">
                  Digitize vendor bills and expenses without hiring data entry clerks. Upload invoices and receipts as they arrive, get clean spreadsheets for your bookkeeper or tax preparer, and keep your records organized. No accounting degree required—just drag, drop, and download.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 mb-3">Financial Analysts</h3>
                <p className="text-gray-600 leading-relaxed">
                  Pull structured tables out of dense annual reports, earnings releases, and regulatory filings. Our AI identifies financial statement sections, schedules, and multi-column layouts so you can analyze data in Excel or Google Sheets instead of scrolling through hundreds of PDF pages.
                </p>
              </div>
            </div>
          </section>

          {/* Enterprise-Grade Security & Privacy */}
          <section className="space-y-6" aria-labelledby="security-heading">
            <h2 id="security-heading" className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Enterprise-Grade Security &amp; Privacy
            </h2>
            <p className="text-gray-600 text-lg leading-relaxed">
              We take data protection seriously. InvoiceToData operates on a <strong className="text-slate-900">Zero Data Retention</strong> policy: your files are never written to long-term storage. All processing is performed <strong className="text-slate-900">in-memory</strong>—your PDF or image is held only for the duration of the conversion request. The moment the extraction is complete and the response is sent to your browser, we perform <strong className="text-slate-900">instant deletion</strong> of both the uploaded document and the extracted output from our systems. We do not train AI models on your content, share it with third parties, or use it for any purpose other than fulfilling your single conversion request. For financial documents, invoices, and bank statements, that means your sensitive data is processed securely and leaves no trace. This approach supports compliance with common privacy and data-minimization expectations in business and regulated environments, so you can use our tools with confidence.
            </p>
          </section>
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
          <div className="mx-auto max-w-[1440px]">
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
              <details className="group rounded-lg border border-slate-200 bg-white px-4">
                <summary className="cursor-pointer list-none py-3 font-medium text-slate-900 marker:contents [&::-webkit-details-marker]:hidden">
                  Can the AI extract data from password-protected bank statements?
                </summary>
                <p className="pb-3 text-slate-600">
                  For security and privacy reasons, our system cannot process encrypted or password-protected PDF files directly. Most banks secure downloaded statements with a default password (often your tax ID or date of birth). You will need to unlock and save the PDF without a password using your system&apos;s built-in PDF viewer before uploading it to our converter.
                </p>
              </details>
              <details className="group rounded-lg border border-slate-200 bg-white px-4">
                <summary className="cursor-pointer list-none py-3 font-medium text-slate-900 marker:contents [&::-webkit-details-marker]:hidden">
                  Does the converter support multiple languages and international currencies?
                </summary>
                <p className="pb-3 text-slate-600">
                  Yes. Our AI engine is trained on a vast array of global financial documents. It effortlessly recognizes international currency symbols (such as EUR, GBP, JPY, and AUD) and can intelligently distinguish between different regional date formats (like DD/MM/YYYY in Europe versus MM/DD/YYYY in the US), ensuring your Excel output is perfectly localized.
                </p>
              </details>
              <details className="group rounded-lg border border-slate-200 bg-white px-4">
                <summary className="cursor-pointer list-none py-3 font-medium text-slate-900 marker:contents [&::-webkit-details-marker]:hidden">
                  How accurate is the extraction for low-quality scanned receipts or crumpled invoices?
                </summary>
                <p className="pb-3 text-slate-600">
                  While traditional OCR fails when dealing with skewed scans, watermarks, or background noise, our context-aware AI looks at the structure of the document. For best results, we recommend scans of at least 300 DPI. However, the AI can still reconstruct tables and identify line items from smartphone photos and lower-quality scans with industry-leading accuracy.
                </p>
              </details>
              <details className="group rounded-lg border border-slate-200 bg-white px-4">
                <summary className="cursor-pointer list-none py-3 font-medium text-slate-900 marker:contents [&::-webkit-details-marker]:hidden">
                  What is the maximum file size and page limit for uploads?
                </summary>
                <p className="pb-3 text-slate-600">
                  To ensure lightning-fast processing times and maintain server stability, the current limit is set to 15MB per file, with a maximum of 50 pages per document. This comfortably covers 99% of standard monthly bank statements, vendor invoices, and annual expense reports.
                </p>
              </details>
              <details className="group rounded-lg border border-slate-200 bg-white px-4">
                <summary className="cursor-pointer list-none py-3 font-medium text-slate-900 marker:contents [&::-webkit-details-marker]:hidden">
                  Will the downloaded Excel file be ready to import into Xero or QuickBooks?
                </summary>
                <p className="pb-3 text-slate-600">
                  Absolutely. The data is exported into a clean, strictly formatted tabular structure (.xlsx or .csv) without merged cells or hidden formatting. You will get standard columns (Date, Description, Amount, Balance), making it incredibly easy to map the fields directly into your preferred accounting software like Xero, QuickBooks Online, or Sage.
                </p>
              </details>
              <details className="group rounded-lg border border-slate-200 bg-white px-4">
                <summary className="cursor-pointer list-none py-3 font-medium text-slate-900 marker:contents [&::-webkit-details-marker]:hidden">
                  Can I process multiple PDF files at the same time (Batch Processing)?
                </summary>
                <p className="pb-3 text-slate-600">
                  Currently, our free tool optimizes for high-fidelity extraction of single documents to guarantee 100% accuracy on complex tables. We are actively developing a bulk-processing feature and an API for enterprise users who need to convert hundreds of invoices simultaneously. Stay tuned for updates!
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
