import type { Metadata } from "next";
import Link from "next/link";
import {
  FileSpreadsheet,
  Upload,
  Sparkles,
  FileDown,
  ArrowRight,
} from "lucide-react";

export const metadata: Metadata = {
  title: "How It Works - PDF to Excel Converter | Step-by-Step Guide",
  description:
    "Learn how to convert PDF to Excel in 3 steps: upload your document, let Powerful AI Model extract the layout, and download your styled Excel file. Supports invoices, forms, and tax documents.",
  openGraph: {
    title: "How It Works - PDF to Excel Converter | Step-by-Step Guide",
    description:
      "Learn how to convert PDF to Excel in 3 steps: upload your document, let Powerful AI Model extract the layout, and download your styled Excel file.",
    type: "article",
  },
  twitter: {
    card: "summary",
    title: "How It Works - PDF to Excel Converter",
    description: "Step-by-step guide to converting PDFs and images to Excel with AI.",
  },
};

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2 font-semibold text-slate-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
              <FileSpreadsheet className="h-4 w-4" />
            </span>
            InvoiceToData
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/#features" className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900">
              Features
            </Link>
            <Link href="/" className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900">
              Converter
            </Link>
            <Link href="/signup" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700">
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <header className="mb-10">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              How to Convert PDF to Excel with AI
            </h1>
            <p className="mt-4 text-lg text-slate-600">
              This guide explains how our free PDF to Excel converter works, from upload to download. No sign-up required for basic use.
            </p>
          </header>

          <section className="space-y-10" aria-labelledby="steps-heading">
            <h2 id="steps-heading" className="text-2xl font-bold text-slate-900">
              Three Simple Steps
            </h2>

            <section className="flex gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-blue-600 bg-white text-blue-600">
                <Upload className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Step 1: Upload your document</h3>
                <p className="mt-2 text-slate-600">
                  Drag and drop a PDF or image (JPEG, PNG, WebP, GIF) into the upload zone on the home page, or click to browse. Files must be under 5MB for fast processing. We accept invoices, tax forms, schedules, and any document with tables or structured text.
                </p>
              </div>
            </section>

            <section className="flex gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-blue-600 bg-white text-blue-600">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Step 2: AI extracts the layout</h3>
                <p className="mt-2 text-slate-600">
                  Click &quot;Extract&quot; and our tool sends your document to Google&apos;s Powerful AI Model. It analyzes the page as a visual grid and returns a row-by-row, column-by-column representation—so the Excel output matches the original layout. A progress bar shows status; when extraction finishes, you&apos;re ready to download.
                </p>
              </div>
            </section>

            <section className="flex gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-blue-600 bg-white text-blue-600">
                <FileDown className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Step 3: Download your Excel file</h3>
                <p className="mt-2 text-slate-600">
                  After extraction, a &quot;Download Excel&quot; button appears. The file uses auto-fit column widths and light grey backgrounds for header rows (e.g. Part I, Section A, Invoice). Open it in Excel or Google Sheets and edit as needed.
                </p>
              </div>
            </section>
          </section>

          <section className="mt-14 border-t border-slate-200 pt-10" aria-labelledby="tech-heading">
            <h2 id="tech-heading" className="text-2xl font-bold text-slate-900">
              Technology: Powerful AI Model
            </h2>
            <p className="mt-4 text-slate-600">
              We use Google&apos;s Powerful AI Model for layout-aware document understanding. Unlike plain text extraction, it &quot;sees&quot; the document as a grid—so tables, multi-column sections, and form fields stay in the correct rows and columns. The result is an array of rows (AOA) that we write to Excel with styling, so your PDF structure is preserved in the spreadsheet.
            </p>
          </section>

          <section className="mt-14 border-t border-slate-200 pt-10" aria-labelledby="faq-heading">
            <h2 id="faq-heading" className="text-2xl font-bold text-slate-900">
              Common Questions
            </h2>
            <ul className="mt-4 list-inside list-disc space-y-2 text-slate-600">
              <li><strong>Is there a file size limit?</strong> Yes. Uploads must be under 5MB for reliable processing.</li>
              <li><strong>Which document types work best?</strong> Invoices, tax forms (e.g. 1040, W-2), schedules, and any PDF or image with tables or labeled fields.</li>
              <li><strong>Do you store my files?</strong> No. Documents are processed in memory and not stored after the request.</li>
            </ul>
          </section>

          <p className="mt-12 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-700"
            >
              Try the converter
              <ArrowRight className="h-4 w-4" />
            </Link>
          </p>
        </article>
      </main>
    </div>
  );
}
