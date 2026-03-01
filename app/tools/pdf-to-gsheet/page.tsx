"use client";

import { Users, Sparkles, Cloud, Receipt, Database, ClipboardCheck, Upload, Scan, FileCheck, ChevronRight } from "lucide-react";
import PdfToGsheetTool from "@/components/PdfToGsheetTool";
import SmartAdBanner from "@/components/SmartAdBanner";

export default function PdfToGsheetPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main>
        {/* Narrow container: tool only */}
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <PdfToGsheetTool
            title="PDF to Google Sheets"
            subtitle="Upload a PDF. We extract table and invoice data with AI and create a Google Sheet you can copy to your Drive."
            showExcelLink={true}
          />
        </div>

        {/* Ad: above first content section */}
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <p className="mb-2 text-center text-xs font-medium uppercase tracking-wider text-slate-400">Advertisement</p>
            <div className="w-full flex justify-center my-8 max-w-full overflow-hidden">
              {/* Desktop Banner - Safe for large screens */}
              <div className="hidden lg:flex justify-center w-full overflow-hidden">
                <SmartAdBanner width={728} height={90} />
              </div>

              {/* Mobile/Tablet Banner - Fallback for smaller screens to prevent overflow */}
              <div className="flex lg:hidden justify-center w-full">
                <SmartAdBanner width={300} height={250} />
              </div>
            </div>
          </div>
        </div>

        {/* Full-width SEO section */}
        <section className="w-full bg-slate-50 py-24" aria-labelledby="why-extract-heading">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 id="why-extract-heading" className="text-center text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
              Why Extract PDF Data Directly to Google Sheets?
            </h2>
            <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-3">
              <div className="flex h-full flex-col rounded-3xl border border-gray-100 bg-white p-6 shadow-lg transition-all duration-300 hover:-translate-y-2 hover:shadow-xl">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-green-100 text-green-600" aria-hidden>
                  <Users className="h-6 w-6" />
                </span>
                <h3 className="mt-5 text-lg font-semibold text-slate-900">Real-Time Collaboration</h3>
                <p className="mt-3 flex-1 text-slate-600">
                  Share and edit extracted data with your team instantly in Google Sheets.
                </p>
              </div>
              <div className="flex h-full flex-col rounded-3xl border border-gray-100 bg-white p-6 shadow-lg transition-all duration-300 hover:-translate-y-2 hover:shadow-xl">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-green-100 text-green-600" aria-hidden>
                  <Sparkles className="h-6 w-6" />
                </span>
                <h3 className="mt-5 text-lg font-semibold text-slate-900">AI Precision</h3>
                <p className="mt-3 flex-1 text-slate-600">
                  Powered by Gemini 2.5 Flash-Lite to maintain table structure, merged cells, and complex formatting.
                </p>
              </div>
              <div className="flex h-full flex-col rounded-3xl border border-gray-100 bg-white p-6 shadow-lg transition-all duration-300 hover:-translate-y-2 hover:shadow-xl">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-green-100 text-green-600" aria-hidden>
                  <Cloud className="h-6 w-6" />
                </span>
                <h3 className="mt-5 text-lg font-semibold text-slate-900">Cloud Workflow</h3>
                <p className="mt-3 flex-1 text-slate-600">
                  Direct export to Drive. No manual downloads, no file conversion headaches.
                </p>
              </div>
            </div>

            <h2 id="how-it-works-heading" className="mt-24 text-center text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
              How It Works
            </h2>
            <div className="mt-14 flex flex-col items-stretch gap-8 md:flex-row md:items-center md:justify-between md:gap-4">
              <div className="group flex flex-1 flex-col items-center rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md md:flex-[1]">
                <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white" aria-hidden>Step 1</span>
                <span className="mt-5 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-transform duration-300 group-hover:scale-110" aria-hidden>
                  <Upload className="h-6 w-6" />
                </span>
                <h3 className="mt-5 text-xl font-bold text-gray-900">Upload PDF</h3>
                <p className="mt-2 text-sm text-gray-500">Select your invoice or report.</p>
              </div>
              <span className="hidden shrink-0 text-gray-300 md:block" aria-hidden>
                <ChevronRight className="h-8 w-8" />
              </span>
              <div className="group flex flex-1 flex-col items-center rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md md:flex-[1]">
                <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white" aria-hidden>Step 2</span>
                <span className="mt-5 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-transform duration-300 group-hover:scale-110" aria-hidden>
                  <Scan className="h-6 w-6" />
                </span>
                <h3 className="mt-5 text-xl font-bold text-gray-900">AI Extraction</h3>
                <p className="mt-2 text-sm text-gray-500">Our engine scans and structures the data.</p>
              </div>
              <span className="hidden shrink-0 text-gray-300 md:block" aria-hidden>
                <ChevronRight className="h-8 w-8" />
              </span>
              <div className="group flex flex-1 flex-col items-center rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md md:flex-[1]">
                <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white" aria-hidden>Step 3</span>
                <span className="mt-5 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-transform duration-300 group-hover:scale-110" aria-hidden>
                  <FileCheck className="h-6 w-6" />
                </span>
                <h3 className="mt-5 text-xl font-bold text-gray-900">Direct Sync</h3>
                <p className="mt-2 text-sm text-gray-500">Data appears in your Google Sheet automatically.</p>
              </div>
            </div>

            <h2 id="perfect-for-heading" className="mt-24 text-center text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
              Perfect for Business Workflows
            </h2>
            <div className="mt-14 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex h-full flex-col rounded-3xl border border-gray-100 bg-white p-6 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl lg:col-span-2">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-600" aria-hidden>
                  <Receipt className="h-6 w-6" />
                </span>
                <div className="mt-5 flex flex-1 flex-col">
                  <h3 className="text-lg font-semibold text-slate-900">Accounts Payable</h3>
                  <p className="mt-2 flex-1 text-slate-600">Turn vendor invoices and statements into sheets for reconciliation and approval.</p>
                </div>
              </div>
              <div className="flex h-full flex-col rounded-3xl border border-gray-100 bg-white p-6 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-600" aria-hidden>
                  <Database className="h-6 w-6" />
                </span>
                <div className="mt-5 flex flex-1 flex-col">
                  <h3 className="text-lg font-semibold text-slate-900">Data Migration</h3>
                  <p className="mt-2 flex-1 text-slate-600">Move tables from legacy PDFs into Google Sheets for reporting and analysis.</p>
                </div>
              </div>
              <div className="flex h-full flex-col rounded-3xl border border-gray-100 bg-white p-6 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-100 text-teal-600" aria-hidden>
                  <ClipboardCheck className="h-6 w-6" />
                </span>
                <div className="mt-5 flex flex-1 flex-col">
                  <h3 className="text-lg font-semibold text-slate-900">Financial Auditing</h3>
                  <p className="mt-2 flex-1 text-slate-600">Extract transaction lists and summaries into a single sheet for review and audit trails.</p>
                </div>
              </div>
            </div>

            {/* Why Choose Our AI – thick content */}
            <div className="prose prose-slate mx-auto max-w-4xl py-12 px-4" aria-labelledby="why-ai-heading">
              <h2 id="why-ai-heading" className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Why Choose Our AI?
              </h2>
              <p className="mt-6 text-slate-600">
                Traditional OCR treats your PDF as a flat stream of text, which often breaks table layout and loses the visual structure that makes your data useful. Our converter uses Google&apos;s Gemini model to understand the document as a visual grid: it recognizes rows, columns, headers, and sections the way a human would, so your Google Sheet output matches the original layout. Merged cells, indentation, and multi-level headings are preserved in a way that generic OCR cannot achieve.
              </p>
              <p className="mt-4 text-slate-600">
                Speed is a major advantage. AI-based extraction processes pages in seconds instead of requiring manual correction of misaligned columns or misread numbers. Gemini handles both native digital PDFs and scanned images, so whether your source is a generated report or a photographed form, you get fast, consistent results. The same pipeline delivers high-quality output for invoices, tax forms, and statement tables without re-uploading or changing settings.
              </p>
              <p className="mt-4 text-slate-600">
                Accuracy is critical when data feeds into finance, auditing, or compliance. Our AI preserves numeric precision, date formats, and text exactly as they appear in the source. Together with layout retention and speed, this makes the tool suitable for professionals who need reliable PDF-to-Sheets conversion without manual cleanup—ready for analysis or import into your workflows.
              </p>
            </div>

            {/* Comprehensive FAQ */}
            <div className="mx-auto max-w-4xl px-4 pb-16" aria-labelledby="faq-heading">
              <h2 id="faq-heading" className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Frequently Asked Questions
              </h2>
              <div className="mt-8 space-y-2">
                <details className="group rounded-xl border border-slate-200 bg-white px-5 shadow-sm">
                  <summary className="cursor-pointer list-none py-4 font-semibold text-slate-900 marker:contents [&::-webkit-details-marker]:hidden">Is my data safe?</summary>
                  <p className="pb-4 text-slate-600">Yes. We do not store your documents. Files are processed in memory and deleted immediately after extraction. Your PDFs and extracted data are never retained on our servers.</p>
                </details>
                <details className="group rounded-xl border border-slate-200 bg-white px-5 shadow-sm">
                  <summary className="cursor-pointer list-none py-4 font-semibold text-slate-900 marker:contents [&::-webkit-details-marker]:hidden">How accurate is the conversion?</summary>
                  <p className="pb-4 text-slate-600">Our AI delivers high accuracy for tables, invoices, and forms. Rows and columns are preserved from the original layout; numeric values, dates, and text are extracted as they appear, with minimal or no manual correction needed.</p>
                </details>
                <details className="group rounded-xl border border-slate-200 bg-white px-5 shadow-sm">
                  <summary className="cursor-pointer list-none py-4 font-semibold text-slate-900 marker:contents [&::-webkit-details-marker]:hidden">Will my tables look the same?</summary>
                  <p className="pb-4 text-slate-600">Yes. Our AI preserves the visual layout so rows and columns map directly to sheet cells. Section headers and table structure are maintained in the Google Sheet output.</p>
                </details>
                <details className="group rounded-xl border border-slate-200 bg-white px-5 shadow-sm">
                  <summary className="cursor-pointer list-none py-4 font-semibold text-slate-900 marker:contents [&::-webkit-details-marker]:hidden">What is the maximum file size?</summary>
                  <p className="pb-4 text-slate-600">5MB per file for fast, reliable processing. We recommend keeping files under this limit. For larger documents, consider splitting the PDF or compressing images first.</p>
                </details>
                <details className="group rounded-xl border border-slate-200 bg-white px-5 shadow-sm">
                  <summary className="cursor-pointer list-none py-4 font-semibold text-slate-900 marker:contents [&::-webkit-details-marker]:hidden">What AI model do you use?</summary>
                  <p className="pb-4 text-slate-600">We use Google&apos;s Gemini model (including Gemini 2.5 Flash-Lite) for layout-aware extraction. It analyzes your document as a visual structure so tables, forms, and multi-section layouts are converted with high fidelity to Google Sheets.</p>
                </details>
              </div>
            </div>

            {/* Ad: below FAQ */}
            <div className="mx-auto max-w-4xl px-4 py-8">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="mb-2 text-center text-xs font-medium uppercase tracking-wider text-slate-400">Advertisement</p>
                <div className="w-full flex justify-center my-8 max-w-full overflow-hidden">
                  {/* Desktop Banner - Safe for large screens */}
                  <div className="hidden lg:flex justify-center w-full overflow-hidden">
                    <SmartAdBanner width={728} height={90} />
                  </div>

                  {/* Mobile/Tablet Banner - Fallback for smaller screens to prevent overflow */}
                  <div className="flex lg:hidden justify-center w-full">
                    <SmartAdBanner width={300} height={250} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
