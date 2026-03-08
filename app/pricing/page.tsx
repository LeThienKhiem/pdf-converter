import type { Metadata } from "next";
import Link from "next/link";
import { Check, Zap, Shield, FileSpreadsheet } from "lucide-react";
import PaddleCheckoutButton from "@/components/PaddleCheckoutButton";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Pricing | InvoiceToData",
  description:
    "Simple, pay-as-you-go pricing. No monthly subscriptions. Pay only for the data you extract with AI-powered PDF to Excel and bank statement tools.",
};

export default async function PricingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="max-w-[1440px] mx-auto py-16 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="inline-block text-sm font-medium text-slate-600 hover:text-slate-900 mb-8">
          ← Back to Home
        </Link>
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Simple, Pay-As-You-Go Pricing
          </h1>
          <p className="mt-4 text-lg text-slate-600 leading-relaxed">
            No monthly subscriptions. Only pay for the data you extract.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Card 1: Free Tier */}
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm flex flex-col">
            <div className="flex items-center gap-2 text-slate-500 font-medium">
              <Zap className="h-5 w-5" aria-hidden />
              Free tier
            </div>
            <h2 className="mt-4 text-2xl font-bold text-slate-900">Free</h2>
            <p className="mt-1 text-slate-600">$0</p>
            <ul className="mt-6 space-y-4 flex-1">
              <li className="flex items-start gap-3 text-slate-600">
                <Check className="h-5 w-5 shrink-0 text-emerald-500 mt-0.5" aria-hidden />
                <span>3 free credits to get started</span>
              </li>
              <li className="flex items-start gap-3 text-slate-600">
                <Check className="h-5 w-5 shrink-0 text-emerald-500 mt-0.5" aria-hidden />
                <span>Standard AI extraction (PDF to Excel, bank statements)</span>
              </li>
              <li className="flex items-start gap-3 text-slate-600">
                <Check className="h-5 w-5 shrink-0 text-emerald-500 mt-0.5" aria-hidden />
                <span>Basic support</span>
              </li>
            </ul>
            <Link
              href="/tools/pdf-to-excel"
              className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-6 py-4 text-base font-semibold text-slate-900 shadow-sm transition-all hover:border-slate-400 hover:bg-slate-50 sm:w-auto"
            >
              Get Started
            </Link>
          </div>

          {/* Card 2: Credit Pack */}
          <div className="rounded-2xl border-2 border-[#217346] bg-white p-8 shadow-lg flex flex-col relative">
            <div className="absolute -top-3 left-6 rounded-full bg-[#217346] px-3 py-1 text-xs font-semibold text-white">
              Popular
            </div>
            <div className="flex items-center gap-2 text-[#217346] font-medium">
              <FileSpreadsheet className="h-5 w-5" aria-hidden />
              Credit pack
            </div>
            <h2 className="mt-4 text-2xl font-bold text-slate-900">50 Credits</h2>
            <p className="mt-1 text-slate-600">
              <span className="text-2xl font-bold text-slate-900">$9.99</span> one-time
            </p>
            <ul className="mt-6 space-y-4 flex-1">
              <li className="flex items-start gap-3 text-slate-600">
                <Check className="h-5 w-5 shrink-0 text-emerald-500 mt-0.5" aria-hidden />
                <span>50 credits for PDF and bank statement extraction</span>
              </li>
              <li className="flex items-start gap-3 text-slate-600">
                <Check className="h-5 w-5 shrink-0 text-emerald-500 mt-0.5" aria-hidden />
                <span>Priority processing</span>
              </li>
              <li className="flex items-start gap-3 text-slate-600">
                <Check className="h-5 w-5 shrink-0 text-emerald-500 mt-0.5" aria-hidden />
                <span>Perfect Excel/CSV formatting</span>
              </li>
              <li className="flex items-start gap-3 text-slate-600">
                <Shield className="h-5 w-5 shrink-0 text-slate-400 mt-0.5" aria-hidden />
                <span>Secure in-memory processing</span>
              </li>
            </ul>
            <div className="mt-8 w-full">
              <PaddleCheckoutButton
                priceId={process.env.NEXT_PUBLIC_PADDLE_PRICE_ID!}
                userEmail={user?.email ?? undefined}
                userId={user?.id}
              >
                Buy 50 credits — $9.99
              </PaddleCheckoutButton>
            </div>
          </div>
        </div>

        <p className="mt-12 text-center text-sm text-slate-500 max-w-2xl mx-auto">
          All payments are processed securely by Paddle. You can purchase credit packs as needed; no recurring charges.
        </p>
      </main>
    </div>
  );
}
