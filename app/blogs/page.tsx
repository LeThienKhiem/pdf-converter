import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Blog & Guides | AI PDF to Excel",
  description:
    "Tips, tutorials, and guides on how to automate document extraction and convert PDFs to Excel using AI.",
};

const posts = [
  {
    title: "How to Extract Tables from PDF to Excel Automatically",
    slug: "/blogs/how-to-extract-table-from-pdf-to-excel",
    excerpt:
      "Stop wasting time with manual data entry. Learn how AI can perfectly map PDF rows and columns directly into your spreadsheet.",
    date: new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
  },
];

export default function BlogsPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Resources & Guides
        </h1>
        <p className="mt-4 text-lg text-slate-600">
          Tips, tutorials, and guides on PDF to Excel conversion, document automation, and AI-powered data extraction.
        </p>

        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={post.slug}
              className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
            >
              <time className="text-sm font-medium text-slate-500" dateTime={post.date}>
                {post.date}
              </time>
              <h2 className="mt-2 text-xl font-semibold text-slate-900 group-hover:text-blue-600">
                {post.title}
              </h2>
              <p className="mt-2 flex-1 text-slate-600 line-clamp-3">
                {post.excerpt}
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-blue-600 group-hover:gap-2">
                Read more
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>

        <p className="mt-12 text-slate-500">
          <Link href="/" className="text-blue-600 hover:underline">
            ← Back to Home
          </Link>
        </p>
      </main>
    </div>
  );
}
