import type { Metadata } from "next";
import Link from "next/link";
import { Layers, Zap, Infinity, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Enterprise-Grade PDF Extraction",
  description:
    "Batch processing, unlimited file size, and uncapped usage. PDF extraction built for business scale.",
};

export default function BusinessPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white">
          <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 sm:py-28 lg:px-8">
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Enterprise-Grade PDF Extraction
            </h1>
            <p className="mt-6 text-lg text-slate-600 sm:text-xl">
              Scale your document workflows with batch processing, no file limits, and uncapped usage. Built for teams that move fast.
            </p>
            <div className="mt-10">
              <Link
                href="mailto:j.thompson.kari@gmail.com"
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-8 py-4 text-base font-semibold text-white shadow-lg transition-colors hover:bg-green-700"
              >
                Contact Sales
                <ArrowRight className="h-5 w-5" aria-hidden />
              </Link>
              <p className="mt-4">
                <Link href="/contact" className="text-sm font-medium text-slate-600 hover:text-slate-900 hover:underline">
                  Or get early access →
                </Link>
              </p>
            </div>
          </div>
        </section>

        {/* Key features */}
        <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8" aria-labelledby="features-heading">
          <h2 id="features-heading" className="sr-only">
            Key features
          </h2>
          <div className="grid gap-8 sm:grid-cols-3">
            <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-shadow hover:shadow-md">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 text-green-600" aria-hidden>
                <Layers className="h-6 w-6" />
              </span>
              <h3 className="mt-5 text-xl font-bold text-slate-900">Batch Processing</h3>
              <p className="mt-3 text-slate-600">
                Upload multiple files simultaneously. Save time and keep your team moving.
              </p>
            </div>
            <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-shadow hover:shadow-md">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 text-green-600" aria-hidden>
                <Zap className="h-6 w-6" />
              </span>
              <h3 className="mt-5 text-xl font-bold text-slate-900">Unlimited Power</h3>
              <p className="mt-3 text-slate-600">
                No file size limits. Process large reports and complex documents without constraints.
              </p>
            </div>
            <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-shadow hover:shadow-md">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 text-green-600" aria-hidden>
                <Infinity className="h-6 w-6" />
              </span>
              <h3 className="mt-5 text-xl font-bold text-slate-900">Uncapped Usage</h3>
              <p className="mt-3 text-slate-600">
                Process as many documents as your business needs. No per-document caps or throttling.
              </p>
            </div>
          </div>
        </section>

        {/* CTA strip */}
        <section className="border-t border-slate-200 bg-slate-50 py-16">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Ready to scale your PDF workflow?
            </h2>
            <p className="mt-4 text-slate-600">
              Talk to our team for custom plans and early access.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="mailto:j.thompson.kari@gmail.com"
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-green-700"
              >
                Contact Sales
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-lg border-2 border-slate-300 bg-white px-6 py-3.5 text-base font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
              >
                Get Early Access
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
