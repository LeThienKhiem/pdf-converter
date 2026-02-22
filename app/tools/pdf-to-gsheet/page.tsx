"use client";

import { Users, Sparkles, Cloud, Receipt, Database, ClipboardCheck, Upload, Scan, FileCheck, ChevronRight } from "lucide-react";
import PdfToGsheetTool from "@/components/PdfToGsheetTool";

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
          </div>
        </section>
      </main>
    </div>
  );
}
