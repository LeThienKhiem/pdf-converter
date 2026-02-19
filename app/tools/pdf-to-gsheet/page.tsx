import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, LayoutGrid, Cloud, Shield } from "lucide-react";
import WaitlistForm from "./WaitlistForm";

export const metadata: Metadata = {
  title: "Convert PDF to Google Sheets with AI - Free Online Tool",
  description:
    "Automatically extract data from PDFs, invoices, and forms directly into Google Sheets using Powerful AI Model. Join the waitlist for early access.",
  openGraph: {
    title: "Convert PDF to Google Sheets with AI - Free Online Tool",
    description:
      "Automatically extract data from PDFs, invoices, and forms directly into Google Sheets using Powerful AI Model. Join the waitlist for early access.",
  },
};

export default function PdfToGsheetPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-slate-200/80 bg-gradient-to-b from-slate-50 to-white px-4 py-16 sm:px-6 sm:py-24 lg:px-8" aria-labelledby="pdf-gsheet-hero-heading">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(37,99,235,0.08),transparent)]" />
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-block rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-sm font-semibold text-blue-700">
              Coming Soon
            </span>
            <h1 id="pdf-gsheet-hero-heading" className="mt-6 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
              Seamlessly Extract PDF Data to Google Sheets
            </h1>
            <p className="mt-6 text-lg text-slate-600 sm:text-xl">
              Skip the manual data entry. Our AI-powered tool will analyze your documents and sync the rows and columns directly to your Google Workspace in seconds.
            </p>
            <WaitlistForm />
          </div>
        </section>

        {/* Value proposition */}
        <section className="border-b border-slate-200/80 bg-white px-4 py-16 sm:px-6 sm:py-20 lg:px-8" aria-labelledby="value-prop-heading">
          <div className="mx-auto max-w-6xl">
            <h2 id="value-prop-heading" className="text-center text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Why Choose Our AI PDF to Google Sheets Converter?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-lg text-slate-600">
              Built for accuracy, speed, and security—so you can focus on your work, not copy-pasting.
            </p>
            <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <LayoutGrid className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">Layout Aware AI</h3>
                <p className="mt-2 text-slate-600">
                  Powered by advanced models to keep your rows and columns perfectly aligned. Tables, invoices, and multi-section forms map directly into spreadsheet cells—no merging or guessing.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Cloud className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">Cloud Sync</h3>
                <p className="mt-2 text-slate-600">
                  No need to download files; push data straight to your cloud. Connect your Google account once and send extracted data to any Sheet with one click.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md sm:col-span-2 lg:col-span-1">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Shield className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">Bank-level Security</h3>
                <p className="mt-2 text-slate-600">
                  Files are processed and deleted immediately. We never store your documents or extracted data on our servers after the request completes.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-b border-slate-200/80 bg-slate-50/50 px-4 py-16 sm:px-6 sm:py-20 lg:px-8" aria-labelledby="faq-heading">
          <div className="mx-auto max-w-3xl">
            <h2 id="faq-heading" className="text-center text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Frequently Asked Questions
            </h2>
            <div className="mt-10 space-y-2">
              <details className="group rounded-xl border border-slate-200 bg-white px-5 shadow-sm">
                <summary className="cursor-pointer list-none py-4 font-semibold text-slate-900 marker:contents [&::-webkit-details-marker]:hidden">
                  How does the AI PDF to Google Sheets tool work?
                </summary>
                <p className="pb-4 text-slate-600">
                  It uses visual reasoning AI to map document structures directly to spreadsheet cells. You upload a PDF or image; our system analyzes the layout (tables, forms, invoices) and sends the extracted rows and columns straight to a Google Sheet of your choice—no manual copy-paste.
                </p>
              </details>
              <details className="group rounded-xl border border-slate-200 bg-white px-5 shadow-sm">
                <summary className="cursor-pointer list-none py-4 font-semibold text-slate-900 marker:contents [&::-webkit-details-marker]:hidden">
                  Is it free to use?
                </summary>
                <p className="pb-4 text-slate-600">
                  Yes, we will offer a generous free tier for daily tasks. Paid plans will be available for higher volume and team features. Join the waitlist to be notified at launch and for early-access offers.
                </p>
              </details>
              <details className="group rounded-xl border border-slate-200 bg-white px-5 shadow-sm">
                <summary className="cursor-pointer list-none py-4 font-semibold text-slate-900 marker:contents [&::-webkit-details-marker]:hidden">
                  Can it handle complex forms like tax documents?
                </summary>
                <p className="pb-4 text-slate-600">
                  Absolutely. Our AI excels at complex, multi-layered PDFs—including tax forms (e.g. Form 8862), invoices with line items, and schedules. Rows and columns are preserved so your data lands in the right cells every time.
                </p>
              </details>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-blue-600 px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Need PDF to Excel today?
            </h2>
            <p className="mt-4 text-blue-100">
              Use our free PDF to Excel tool now and import the file into Google Sheets manually until direct sync is ready.
            </p>
            <Link
              href="/tools/pdf-to-excel"
              className="mt-8 inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3.5 text-base font-semibold text-blue-600 transition-colors hover:bg-blue-50"
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
