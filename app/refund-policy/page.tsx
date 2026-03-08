import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Refund Policy | InvoiceToData",
  description:
    "Refund policy for InvoiceToData. How refunds work for digital credits, Paddle as Merchant of Record, and how to request a refund.",
};

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="max-w-[1440px] mx-auto py-16 px-4 sm:px-6 lg:px-8 prose prose-slate max-w-prose">
        <Link href="/" className="inline-block text-sm font-medium text-slate-600 hover:text-slate-900 not-prose">
          ← Back to Home
        </Link>
        <h1 className="mt-8 text-3xl font-bold tracking-tight text-slate-900">
          Refund Policy
        </h1>
        <p className="mt-2 text-slate-500 text-base">Last Updated: February 19, 2026</p>

        <section className="mt-10 space-y-6">
          <h2 className="text-xl font-semibold text-slate-900">1. Merchant of Record</h2>
          <p className="text-slate-600 leading-relaxed">
            Our order process is conducted by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all our orders. Paddle provides all customer service inquiries related to billing and handles returns.
          </p>
        </section>

        <section className="mt-10 space-y-6">
          <h2 className="text-xl font-semibold text-slate-900">2. Digital Credits (Pay-as-you-go)</h2>
          <p className="text-slate-600 leading-relaxed">
            InvoiceToData sells digital, consumable credits that are used for AI-powered data extraction. When you purchase a credit pack, you receive a balance that is applied each time you convert a PDF (e.g., an invoice or bank statement) using our tools. Credits are consumed at the point of use and cannot be transferred or resold. This pay-as-you-go model means you only pay for the processing you actually use.
          </p>
        </section>

        <section className="mt-10 space-y-6">
          <h2 className="text-xl font-semibold text-slate-900">3. Eligibility for Refund</h2>
          <p className="text-slate-600 leading-relaxed">
            Refunds are handled in line with the following rules:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-slate-600 leading-relaxed">
            <li>
              <strong className="text-slate-900">Unused credits:</strong> Customers can request a full refund within 14 days of purchase if the purchased credits remain completely unused. Once we (or Paddle) confirm that no credits from the transaction have been consumed, a full refund may be issued at our discretion.
            </li>
            <li>
              <strong className="text-slate-900">Used credits:</strong> Once a credit has been consumed (e.g., a PDF or bank statement has been successfully converted), that portion of the purchase is strictly non-refundable due to the computing costs incurred by our AI engines. Partial refunds for unused credits from the same purchase may be considered on a case-by-case basis within the 14-day window.
            </li>
          </ul>
        </section>

        <section className="mt-10 space-y-6">
          <h2 className="text-xl font-semibold text-slate-900">4. How to Request a Refund</h2>
          <p className="text-slate-600 leading-relaxed">
            To request a refund, please contact our support team at{" "}
            <a href="mailto:support@invoicetodata.com" className="text-blue-600 hover:underline">
              support@invoicetodata.com
            </a>
            {" "}with your order receipt or transaction ID, or reach out to Paddle&apos;s buyer support directly. Include the email address used at checkout and, if applicable, the Paddle transaction ID from your confirmation email. We will respond within a few business days and, where eligible, coordinate with Paddle to process the refund in accordance with this policy.
          </p>
        </section>

        <p className="mt-12 text-slate-500 text-sm">
          For more information, see our{" "}
          <Link href="/terms" className="text-blue-600 hover:underline">Terms of Service</Link>
          {" "}and{" "}
          <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>.
        </p>
      </main>
    </div>
  );
}
