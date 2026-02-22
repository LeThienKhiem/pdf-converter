import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileSpreadsheet, Upload, Sparkles, Download } from "lucide-react";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";

export const metadata: Metadata = {
  title: "Free AI PDF to Excel & Google Sheets Converters | Invoice To Data",
  description:
    "Professional AI tools to extract data from PDF invoices to Excel and Google Sheets while keeping exact formatting. Fast, accurate, and secure.",
};

type BlogRow = {
  id: string;
  title: string;
  slug: string;
  created_at: string;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function ToolsPage() {
  let latestPosts: BlogRow[] = [];

  if (hasSupabaseConfig) {
    try {
      const supabase = getSupabase();
      const { data } = await supabase
        .from("blogs")
        .select("id, title, slug, created_at")
        .order("created_at", { ascending: false })
        .limit(3);
      if (data) latestPosts = data as BlogRow[];
    } catch {
      // ignore
    }
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
            AI-Powered PDF Extraction Tools
          </h1>
          <p className="mt-4 text-lg text-slate-600 sm:text-xl">
            Convert complex invoices and tables to structured data in seconds with 99% accuracy.
          </p>
        </header>

        {/* Tool Cards */}
        <section className="mt-14 grid gap-8 sm:grid-cols-2" aria-label="Tools">
          <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md sm:p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#217346]/10 text-[#217346]">
              <FileSpreadsheet className="h-6 w-6" aria-hidden />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-slate-900 sm:text-2xl">
              PDF to Excel Converter
            </h2>
            <p className="mt-3 flex-1 text-slate-600">
              Keeps original formatting, handles multi-line rows, and supports batch processing.
            </p>
            <Link
              href="/tools/pdf-to-excel"
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#217346] hover:underline"
            >
              Start Converting to Excel
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md sm:p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0F9D58]/10 text-[#0F9D58]">
              <FileSpreadsheet className="h-6 w-6" aria-hidden />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-slate-900 sm:text-2xl">
              PDF to Google Sheets
            </h2>
            <p className="mt-3 flex-1 text-slate-600">
              Direct integration. Export your extracted data straight to your cloud spreadsheets without downloading files.
            </p>
            <Link
              href="/tools/pdf-to-gsheet"
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#0F9D58] hover:underline"
            >
              Export to Google Sheets
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* How it works */}
        <section className="mt-20 border-t border-slate-200 pt-16" aria-labelledby="how-it-works">
          <h2 id="how-it-works" className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            How it works
          </h2>
          <p className="mt-3 text-slate-600">
            Three simple steps from PDF to spreadsheet.
          </p>
          <ul className="mt-10 grid gap-8 sm:grid-cols-3">
            <li className="flex flex-col items-center text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-blue-600 bg-white text-blue-600" aria-hidden>
                <Upload className="h-7 w-7" />
              </span>
              <span className="mt-4 font-mono text-sm font-medium text-blue-600">Step 1</span>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">Upload</h3>
              <p className="mt-2 text-slate-600">Drop your PDF or image (under 5MB). No sign-up required.</p>
            </li>
            <li className="flex flex-col items-center text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-blue-600 bg-white text-blue-600" aria-hidden>
                <Sparkles className="h-7 w-7" />
              </span>
              <span className="mt-4 font-mono text-sm font-medium text-blue-600">Step 2</span>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">AI Analysis</h3>
              <p className="mt-2 text-slate-600">Our AI maps rows and columns and preserves layout.</p>
            </li>
            <li className="flex flex-col items-center text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-blue-600 bg-white text-blue-600" aria-hidden>
                <Download className="h-7 w-7" />
              </span>
              <span className="mt-4 font-mono text-sm font-medium text-blue-600">Step 3</span>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">Download</h3>
              <p className="mt-2 text-slate-600">Get Excel or make a copy to Google Sheets.</p>
            </li>
          </ul>
        </section>

        {/* From our Blog */}
        <section className="mt-20 border-t border-slate-200 pt-16" aria-labelledby="from-blog">
          <h2 id="from-blog" className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            From our Blog
          </h2>
          <p className="mt-3 text-slate-600">
            Tips and guides on PDF extraction and automation.
          </p>
          {latestPosts.length > 0 ? (
            <>
              <ul className="mt-8 space-y-4">
                {latestPosts.map((post) => (
                  <li key={post.id}>
                    <Link
                      href={`/blog/${post.slug}`}
                      className="group flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-4 transition-colors hover:border-slate-300 hover:bg-slate-50/50 sm:px-6"
                    >
                      <span className="font-medium text-slate-900 group-hover:text-blue-600">{post.title}</span>
                      <span className="flex shrink-0 items-center gap-1 text-sm text-slate-500">
                        {formatDate(post.created_at)}
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-6">
                <Link href="/blog" className="text-sm font-medium text-blue-600 hover:underline">
                  View all articles →
                </Link>
              </p>
            </>
          ) : (
            <p className="mt-6 text-slate-500">
              <Link href="/blog" className="text-blue-600 hover:underline">
                Visit our blog
              </Link> for guides and updates.
            </p>
          )}
        </section>

        <p className="mt-16 text-slate-500">
          <Link href="/" className="text-blue-600 hover:underline">
            ← Back to Home
          </Link>
        </p>
      </main>
    </div>
  );
}
