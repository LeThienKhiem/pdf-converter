import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Blogs | InvoiceToData",
  description: "Tips, guides, and updates on PDF to Excel conversion, document automation, and data extraction.",
};

export default function BlogsPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Blogs</h1>
        <p className="mt-4 text-slate-600">
          Tips, guides, and updates on PDF to Excel conversion and document automation. Check back soon for new posts.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-2 text-blue-600 font-medium hover:underline"
        >
          Back to Home
        </Link>
      </main>
    </div>
  );
}
