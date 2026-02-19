"use client";

import Link from "next/link";
import {
  FileSpreadsheet,
  Shield,
  Upload,
  FileDown,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import AdBanner from "@/components/AdBanner";

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-slate-200/80 bg-gradient-to-b from-slate-50 to-white px-4 py-12 sm:px-6 sm:py-16 lg:px-8" aria-labelledby="hero-heading">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(37,99,235,0.12),transparent)]" />
          <div className="mx-auto max-w-3xl text-center">
            <h1 id="hero-heading" className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Free AI-Powered PDF to Excel Converter
            </h1>
            <p className="mt-4 text-lg text-slate-600">
              Upload a PDF or image. We preserve the exact layout and give you a downloadable Excel file using Powerful AI Model.
            </p>
            <Link
              href="/tools/pdf-to-excel"
              className="mt-8 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-blue-700"
            >
              Convert PDF to Excel
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </section>

        {/* Ad Placement 1: below Hero */}
        <div className="border-b border-slate-200/80 bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <p className="mb-2 text-center text-xs font-medium uppercase tracking-wider text-slate-400">Advertisement</p>
            <AdBanner dataAdSlot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_HERO ?? "0000000000"} />
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
                <h3 className="mt-4 text-lg font-semibold text-slate-900">Export to Excel</h3>
                <p className="mt-2 text-slate-600">
                  Download structured data as Excel. Layout and headers are preserved with styling and auto-fit columns.
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
                <h3 className="mt-1 text-lg font-semibold text-slate-900">Download</h3>
                <p className="mt-2 text-slate-600">Get your Excel file with styled headers and auto-fit columns.</p>
              </div>
            </div>
            <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/tools/pdf-to-excel"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-blue-700"
              >
                Try PDF to Excel
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3.5 text-base font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* Ad Placement 2: before FAQ */}
        <div className="border-b border-slate-200/80 bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <p className="mb-2 text-center text-xs font-medium uppercase tracking-wider text-slate-400">Advertisement</p>
            <AdBanner dataAdSlot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_MID ?? "0000000001"} />
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
        <section className="bg-blue-600 px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Ready to automate your invoice data?</h2>
            <p className="mt-4 text-lg text-blue-100">Join teams that save hours every week with InvoiceToData.</p>
            <Link
              href="/tools/pdf-to-excel"
              className="mt-8 inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3.5 text-base font-semibold text-blue-600 transition-colors hover:bg-blue-50"
            >
              Convert PDF to Excel
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

    </div>
  );
}
