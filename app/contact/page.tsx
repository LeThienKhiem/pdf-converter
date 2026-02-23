import type { Metadata } from "next";
import Link from "next/link";
import { Mail, ArrowLeft } from "lucide-react";
import ContactForm from "@/components/ContactForm";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Get in touch with Invoice To Data. Email for PDF extraction and automation.",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-600 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <header className="mt-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Contact Us
          </h1>
          <p className="mt-3 text-lg text-slate-600">
            Have a question or need help? We&apos;re here for you.
          </p>
        </header>

        <div className="mt-12 grid gap-10 sm:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6" aria-labelledby="direct-heading">
            <h2 id="direct-heading" className="text-lg font-semibold text-slate-900">
              Direct contact
            </h2>
            <ul className="mt-4 space-y-4">
              <li className="flex items-start gap-3">
                <Mail className="h-5 w-5 shrink-0 text-slate-500" aria-hidden />
                <div>
                  <span className="text-sm font-medium text-slate-700">Email</span>
                  <a
                    href="mailto:j.thompson.kari@gmail.com"
                    className="mt-0.5 block text-slate-900 hover:text-blue-600 hover:underline"
                  >
                    j.thompson.kari@gmail.com
                  </a>
                </div>
              </li>
            </ul>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="form-heading">
            <h2 id="form-heading" className="text-lg font-semibold text-slate-900">
              Send a message
            </h2>
            <ContactForm />
          </section>
        </div>
      </main>
    </div>
  );
}
