import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | InvoiceToData",
  description:
    "Terms of Service for InvoiceToData. By using our PDF to Excel and data extraction tools, you agree to these terms.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <Link href="/" className="inline-block text-sm font-medium text-slate-600 hover:text-slate-900">
          ← Back to Home
        </Link>
        <h1 className="mt-8 text-3xl font-bold tracking-tight text-slate-900">
          Terms of Service
        </h1>
        <p className="mt-2 text-slate-500">Last Updated: February 19, 2026</p>

        <p className="mt-8 text-slate-600">
          Welcome to InvoiceToData (<a href="https://invoicetodata.com/" className="text-blue-600 hover:underline">https://invoicetodata.com/</a>). By accessing or using our website and services, you agree to comply with and be bound by the following terms.
        </p>

        <section className="mt-10 space-y-8">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">1. Description of Service</h2>
            <p className="mt-2 text-slate-600">
              InvoiceToData provides online tools for PDF conversion, data extraction, and parsing (PDF to Excel, JSON, etc.). The service is provided &quot;as is&quot; and &quot;as available.&quot;
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-slate-900">2. User Obligations</h2>
            <ul className="mt-2 list-inside list-disc space-y-1 text-slate-600 sm:list-outside sm:pl-6">
              <li>You must not use our service for any illegal or unauthorized purpose.</li>
              <li>You are responsible for any content (PDFs/Invoices) you upload.</li>
              <li>You agree not to attempt to disrupt the website&apos;s infrastructure or scrape data for commercial use without permission.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-slate-900">3. Intellectual Property</h2>
            <p className="mt-2 text-slate-600">
              All software, algorithms, and branding on this site are the property of InvoiceToData. You retain ownership of the files you upload; however, you grant us a temporary license to process them for the sole purpose of conversion.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-slate-900">4. Limitation of Liability</h2>
            <p className="mt-2 text-slate-600">
              InvoiceToData shall not be liable for any direct or indirect damages resulting from the use of our tools, including data loss or inaccuracies in the converted output. We recommend verifying all extracted data before professional use.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-slate-900">5. Termination</h2>
            <p className="mt-2 text-slate-600">
              We reserve the right to terminate or suspend access to our service immediately, without prior notice, for any breach of these Terms.
            </p>
          </div>
        </section>

        <p className="mt-12 text-slate-500 text-sm">
          For questions, please see our <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link> or contact us via the details listed there.
        </p>
      </main>
    </div>
  );
}
