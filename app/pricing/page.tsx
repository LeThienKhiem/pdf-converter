import type { Metadata } from "next";
import Link from "next/link";
import { Check, Zap, Shield, Star, Clock, Lock, Crown, Ticket } from "lucide-react";
import PaddleCheckoutButton from "@/components/PaddleCheckoutButton";
import { createClient } from "@/lib/supabase/server";
import { getSupabase } from "@/lib/supabase";
import { PADDLE_PRICES, FOUNDING_MEMBER_CAP } from "@/lib/paddlePrices";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.invoicetodata.com";

export const metadata: Metadata = {
  title: "Pricing — Invoice OCR & PDF to Excel from $2",
  description:
    "Convert PDF invoices and bank statements to Excel. Free 3 pages/month, $2 Week Pass, or Pro from $5/month. 7-day money-back guarantee.",
  keywords:
    "invoice OCR pricing, PDF to Excel cost, bank statement converter pricing, invoice automation pricing, cheap invoice OCR",
  alternates: {
    canonical: `${siteUrl}/pricing`,
  },
  openGraph: {
    title: "Pricing — Invoice OCR & PDF to Excel from $2 | InvoiceToData",
    description:
      "Free 3 pages/month, $2 Week Pass, or Pro from $5/month. 7-day money-back guarantee.",
    url: `${siteUrl}/pricing`,
    type: "website",
    siteName: "InvoiceToData",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing — Invoice OCR & PDF to Excel from $2 | InvoiceToData",
    description:
      "Free 3 pages/month, $2 Week Pass, or Pro from $5/month. 7-day money-back guarantee.",
  },
};

function PricingStructuredData() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "InvoiceToData Pricing",
    description:
      "AI-powered invoice OCR pricing. Free tier, $2 Week Pass, and Pro subscription from $5/month.",
    url: `${siteUrl}/pricing`,
    mainEntity: {
      "@type": "Product",
      name: "InvoiceToData — AI Invoice OCR",
      description:
        "AI-powered tool to convert PDF invoices and bank statements into structured Excel and Google Sheets data using OCR technology.",
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
          description: "3 free pages every month — no credit card required",
          availability: "https://schema.org/InStock",
        },
        {
          "@type": "Offer",
          name: "Week Pass",
          price: "2.00",
          priceCurrency: "USD",
          description: "Unlimited conversions for 7 days, one-time payment",
          availability: "https://schema.org/InStock",
        },
        {
          "@type": "Offer",
          name: "Pro Monthly",
          price: "5.00",
          priceCurrency: "USD",
          description: "200 pages per month, batch-ready, priority processing",
          availability: "https://schema.org/InStock",
        },
        {
          "@type": "Offer",
          name: "Pro Yearly",
          price: "39.00",
          priceCurrency: "USD",
          description: "200 pages per month billed yearly — save 35%",
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
          text: "InvoiceToData is free for 3 pages every month. Need more? Get a $2 Week Pass (unlimited for 7 days, one-time) or go Pro for $5/month (200 pages/month) — $39/year if billed yearly.",
        },
      },
      {
        "@type": "Question",
        name: "What is the Week Pass?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "The Week Pass is a one-time $2 purchase that unlocks unlimited conversions for 7 days. Perfect for one-off jobs like converting a year of bank statements for a loan application or tax season. It is not a subscription — it simply expires after 7 days.",
        },
      },
      {
        "@type": "Question",
        name: "Is there a money-back guarantee?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Every paid plan comes with a 7-day no-questions-asked money-back guarantee. Email us and we refund you in full.",
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
          text: "InvoiceToData uses Anthropic Claude AI for OCR extraction, achieving high accuracy on both digital and scanned PDF invoices including line items, totals, dates, and vendor information.",
        },
      },
      {
        "@type": "Question",
        name: "I bought a credit pack before — do my credits still work?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Existing credits never expire and are used automatically before your free monthly quota.",
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

async function getFoundingSeatsLeft(): Promise<number> {
  try {
    const admin = getSupabase();
    const { count } = await admin
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("founding_member", true);
    return Math.max(0, FOUNDING_MEMBER_CAP - (count ?? 0));
  } catch {
    return 0;
  }
}

function FeatureItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-slate-600">
      <Check className="h-5 w-5 shrink-0 text-emerald-500 mt-0.5" aria-hidden />
      <span>{children}</span>
    </li>
  );
}

export default async function PricingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const foundingSeatsLeft = PADDLE_PRICES.proFounding ? await getFoundingSeatsLeft() : 0;
  const foundingActive = foundingSeatsLeft > 0;
  const proPriceId = foundingActive ? PADDLE_PRICES.proFounding : PADDLE_PRICES.proMonthly;

  const loginButton = (label: string) => (
    <Link
      href="/login"
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#217346] px-6 py-4 text-base font-semibold text-white shadow-md transition-all hover:bg-[#1d603d] hover:shadow-lg"
    >
      {label}
    </Link>
  );

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
            Simple Pricing — Start Free, Upgrade from $2
          </h1>
          <p className="mt-4 text-lg text-slate-600 leading-relaxed">
            3 free pages every month. Need more? A one-off{" "}
            <strong>$2 Week Pass</strong> or <strong>Pro from $5/month</strong>.
            Every paid plan has a 7-day money-back guarantee — no questions asked.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto items-stretch">
          {/* Free Tier */}
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm flex flex-col">
            <div className="flex items-center gap-2 text-slate-500 font-medium">
              <Zap className="h-5 w-5" aria-hidden />
              Free
            </div>
            <h2 className="mt-4 text-2xl font-bold text-slate-900">$0</h2>
            <p className="mt-1 text-slate-600">forever — no credit card</p>
            <ul className="mt-6 space-y-4 flex-1">
              <FeatureItem>
                <strong>3 pages free every month</strong> — resets monthly
              </FeatureItem>
              <FeatureItem>
                AI extraction for invoices, bank statements &amp; receipts
              </FeatureItem>
              <FeatureItem>Export to Excel and Google Sheets</FeatureItem>
              <FeatureItem>Scanned &amp; digital PDF support</FeatureItem>
            </ul>
            <Link
              href="/tools/pdf-to-excel"
              className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-6 py-4 text-base font-semibold text-slate-900 shadow-sm transition-all hover:border-slate-400 hover:bg-slate-50"
            >
              Try Free Now
            </Link>
          </div>

          {/* Week Pass */}
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm flex flex-col relative">
            <div className="absolute -top-3 left-6 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
              One-time — not a subscription
            </div>
            <div className="flex items-center gap-2 text-blue-600 font-medium">
              <Ticket className="h-5 w-5" aria-hidden />
              Week Pass
            </div>
            <h2 className="mt-4 text-2xl font-bold text-slate-900">
              $2 <span className="text-base font-medium text-slate-500">once</span>
            </h2>
            <p className="mt-1 text-slate-600">unlimited for 7 days</p>
            <ul className="mt-6 space-y-4 flex-1">
              <FeatureItem>
                <strong>Unlimited conversions for 7 days</strong>
              </FeatureItem>
              <FeatureItem>
                Perfect for one-off jobs: loan applications, tax season, year-end
                cleanup
              </FeatureItem>
              <FeatureItem>Expires by itself — nothing to cancel</FeatureItem>
              <FeatureItem>7-day money-back guarantee</FeatureItem>
            </ul>
            <div className="mt-8 w-full">
              {user?.id ? (
                <PaddleCheckoutButton
                  priceId={PADDLE_PRICES.weekPass}
                  userEmail={user.email ?? undefined}
                  userId={user.id}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-4 text-base font-semibold text-white shadow-md transition-all hover:bg-blue-700 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  successMessage="Your Week Pass is active — unlimited conversions for the next 7 days."
                >
                  Get Week Pass — $2
                </PaddleCheckoutButton>
              ) : (
                loginButton("Log In to Get Week Pass — $2")
              )}
            </div>
          </div>

          {/* Pro */}
          <div className="rounded-2xl border-2 border-[#217346] bg-white p-8 shadow-lg flex flex-col relative">
            <div className="absolute -top-3 left-6 rounded-full bg-[#217346] px-3 py-1 text-xs font-semibold text-white">
              {foundingActive
                ? `Founding Member — ${foundingSeatsLeft}/${FOUNDING_MEMBER_CAP} seats left`
                : "Best Value"}
            </div>
            <div className="flex items-center gap-2 text-[#217346] font-medium">
              <Crown className="h-5 w-5" aria-hidden />
              Pro
            </div>
            {foundingActive ? (
              <>
                <h2 className="mt-4 text-2xl font-bold text-slate-900">
                  $3<span className="text-base font-medium text-slate-500">/month forever</span>
                </h2>
                <p className="mt-1 text-slate-600">
                  <span className="line-through text-slate-400">$5/month</span>{" "}
                  — founding price, locked in for life
                </p>
              </>
            ) : (
              <>
                <h2 className="mt-4 text-2xl font-bold text-slate-900">
                  $5<span className="text-base font-medium text-slate-500">/month</span>
                </h2>
                <p className="mt-1 text-slate-600">
                  or <strong>$39/year</strong>{" "}
                  <span className="text-sm text-emerald-600 font-medium">(save 35%)</span>
                </p>
              </>
            )}
            <ul className="mt-6 space-y-4 flex-1">
              <FeatureItem>
                <strong>200 pages every month</strong>
              </FeatureItem>
              <FeatureItem>QuickBooks-ready CSV export</FeatureItem>
              <FeatureItem>No watermark on exported files</FeatureItem>
              <FeatureItem>Priority processing — faster results</FeatureItem>
              <li className="flex items-start gap-3 text-slate-600">
                <Shield className="h-5 w-5 shrink-0 text-slate-400 mt-0.5" aria-hidden />
                <span>Secure in-memory processing — zero data retention</span>
              </li>
              <FeatureItem>Cancel anytime · 7-day money-back guarantee</FeatureItem>
            </ul>
            <div className="mt-8 w-full space-y-3">
              {user?.id ? (
                <>
                  <PaddleCheckoutButton
                    priceId={proPriceId}
                    userEmail={user.email ?? undefined}
                    userId={user.id}
                    successMessage="Welcome to Pro! Your account is upgraded — 200 pages/month, QuickBooks export, and no watermarks."
                  >
                    {foundingActive
                      ? "Become a Founding Member — $3/mo"
                      : "Go Pro — $5/mo"}
                  </PaddleCheckoutButton>
                  {!foundingActive && PADDLE_PRICES.proYearly && (
                    <PaddleCheckoutButton
                      priceId={PADDLE_PRICES.proYearly}
                      userEmail={user.email ?? undefined}
                      userId={user.id}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[#217346] bg-white px-6 py-3 text-sm font-semibold text-[#217346] shadow-sm transition-all hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      successMessage="Welcome to Pro Yearly! Your account is upgraded for a full year."
                    >
                      Or pay yearly — $39/yr
                    </PaddleCheckoutButton>
                  )}
                </>
              ) : (
                loginButton(
                  foundingActive
                    ? "Log In to Claim Founding Price — $3/mo"
                    : "Log In to Go Pro — $5/mo"
                )
              )}
            </div>
          </div>
        </div>

        {/* Legacy credit pack — demoted */}
        <div className="mt-10 max-w-6xl mx-auto rounded-xl border border-slate-200 bg-slate-50/60 p-5 text-center text-sm text-slate-600">
          Prefer one-time credits instead? The classic{" "}
          <strong>50-credit pack is still available for $9.99</strong>{" "}
          ($0.20/page, never expires).{" "}
          {user?.id ? (
            <PaddleCheckoutButton
              priceId={PADDLE_PRICES.credits50}
              userEmail={user.email ?? undefined}
              userId={user.id}
              className="ml-1 inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50"
              successMessage="50 credits have been added to your account."
            >
              Buy 50 credits
            </PaddleCheckoutButton>
          ) : (
            <Link href="/login" className="font-semibold text-slate-900 underline">
              Log in to buy
            </Link>
          )}
        </div>

        {/* Trust Signals */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <Lock className="h-6 w-6 text-slate-400 shrink-0" aria-hidden />
            <div>
              <p className="text-sm font-medium text-slate-900">Zero data retention</p>
              <p className="text-xs text-slate-500">
                Files processed in memory, deleted instantly
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <Clock className="h-6 w-6 text-slate-400 shrink-0" aria-hidden />
            <div>
              <p className="text-sm font-medium text-slate-900">Results in seconds</p>
              <p className="text-xs text-slate-500">AI extracts data in under 30 seconds</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <Star className="h-6 w-6 text-slate-400 shrink-0" aria-hidden />
            <div>
              <p className="text-sm font-medium text-slate-900">7-day money back</p>
              <p className="text-xs text-slate-500">
                Not happy? Full refund, no questions asked
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
              <h3 className="mt-3 font-semibold text-slate-900">AI Extracts Data</h3>
              <p className="mt-1 text-sm text-slate-600">
                Claude AI reads and structures all line items, totals, and dates.
              </p>
            </div>
            <div>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-lg font-bold">
                3
              </div>
              <h3 className="mt-3 font-semibold text-slate-900">Get Excel/Sheets</h3>
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
                It&apos;s free for 3 pages every month. Need more? Get a $2 Week
                Pass (unlimited for 7 days, one-time payment) or go Pro for
                $5/month — $39/year if billed yearly.
              </dd>
            </div>
            <div className="rounded-xl border border-slate-200 p-6">
              <dt className="font-semibold text-slate-900">What is the Week Pass?</dt>
              <dd className="mt-2 text-slate-600">
                A one-time $2 purchase that unlocks unlimited conversions for 7
                days. Perfect for one-off jobs — converting a year of bank
                statements for a loan application, tax season, or a year-end
                cleanup. It is not a subscription and expires by itself.
              </dd>
            </div>
            <div className="rounded-xl border border-slate-200 p-6">
              <dt className="font-semibold text-slate-900">
                What is the Founding Member deal?
              </dt>
              <dd className="mt-2 text-slate-600">
                The first {FOUNDING_MEMBER_CAP} Pro subscribers lock in $3/month
                — forever. The price never increases for as long as you stay
                subscribed. Once the seats are gone, Pro is $5/month.
              </dd>
            </div>
            <div className="rounded-xl border border-slate-200 p-6">
              <dt className="font-semibold text-slate-900">
                Is there a money-back guarantee?
              </dt>
              <dd className="mt-2 text-slate-600">
                Yes — every paid plan has a 7-day no-questions-asked money-back
                guarantee. Email us and we refund you in full.
              </dd>
            </div>
            <div className="rounded-xl border border-slate-200 p-6">
              <dt className="font-semibold text-slate-900">
                I bought a credit pack before — do my credits still work?
              </dt>
              <dd className="mt-2 text-slate-600">
                Yes. Existing credits never expire and are used automatically
                before your free monthly quota.
              </dd>
            </div>
            <div className="rounded-xl border border-slate-200 p-6">
              <dt className="font-semibold text-slate-900">Is my invoice data secure?</dt>
              <dd className="mt-2 text-slate-600">
                All documents are processed in memory and deleted immediately
                after extraction. No invoice data is stored on our servers. Your
                financial data never touches a database.
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
          All payments are processed securely by Paddle. Subscriptions can be
          canceled anytime from your dashboard. 7-day money-back guarantee on
          every paid plan.
        </p>
      </main>
    </div>
  );
}
