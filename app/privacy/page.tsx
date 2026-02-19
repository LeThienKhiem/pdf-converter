import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | InvoiceToData",
  description:
    "How InvoiceToData handles your data when you use our PDF to Excel and data extraction services. We do not store your files permanently.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <Link href="/" className="inline-block text-sm font-medium text-slate-600 hover:text-slate-900">
          ← Back to Home
        </Link>
        <h1 className="mt-8 text-3xl font-bold tracking-tight text-slate-900">
          Privacy Policy <span className="font-normal text-slate-500"></span>
        </h1>
        <p className="mt-2 text-slate-500">Last Updated: February 19, 2026</p>

        <p className="mt-8 text-slate-600">
          At InvoiceToData, we take your privacy seriously. This policy explains how we handle your data when you use our PDF to Data services.
        </p>

        <section className="mt-10 space-y-8">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">1. Data Collection</h2>
            <ul className="mt-2 space-y-2 text-slate-600">
              <li>
                <strong className="text-slate-900">Uploaded Files:</strong> We collect the files you upload (PDFs, Invoices) solely to perform the requested conversion.
              </li>
              <li>
                <strong className="text-slate-900">Usage Data:</strong> We may collect non-personal information such as IP addresses, browser types, and pages visited to improve our SEO and user experience.
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-slate-900">2. Data Security &amp; Storage</h2>
            <ul className="mt-2 space-y-2 text-slate-600">
              <li>
                <strong className="text-slate-900">Automatic Deletion:</strong> All uploaded files and converted data are automatically deleted from our servers after 1 hour (or immediately after your session ends). We do not store your private documents permanently.
              </li>
              <li>
                <strong className="text-slate-900">Encryption:</strong> We use SSL/TLS encryption to protect your data during transit from your device to our server.
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-slate-900">3. Cookies</h2>
            <p className="mt-2 text-slate-600">
              We use cookies to enhance your experience and analyze our traffic via Google Analytics. This helps us optimize our ranking for keywords like pdf to excel and pdf parse. You can disable cookies in your browser settings.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-slate-900">4. Third-Party Services</h2>
            <p className="mt-2 text-slate-600">
              We do not sell, trade, or transfer your files to third parties. We may use trusted third-party services (like payment processors or analytics) that adhere to strict privacy standards.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-slate-900">5. GDPR &amp; CCPA Compliance</h2>
            <p className="mt-2 text-slate-600">
              If you are an EU or California resident, you have the right to access, delete, or limit the use of your personal data. Given our automatic deletion policy, we ensure minimal data retention.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-slate-900">6. Contact Us</h2>
            <p className="mt-2 text-slate-600">
              If you have any questions about this Privacy Policy, please contact us at:
            </p>
            <ul className="mt-3 space-y-1 text-slate-600">
              <li><strong className="text-slate-900">Email:</strong> <a href="mailto:j.thompson.kari@gmail.com" className="text-blue-600 hover:underline">j.thompson.kari@gmail.com</a></li>
              <li><strong className="text-slate-900">Website:</strong> <a href="https://invoicetodata.com/" className="text-blue-600 hover:underline">https://invoicetodata.com/</a></li>
            </ul>
          </div>
        </section>

        <p className="mt-12 text-slate-500 text-sm">
          See also our <Link href="/terms" className="text-blue-600 hover:underline">Terms of Service</Link>.
        </p>
      </main>
    </div>
  );
}
