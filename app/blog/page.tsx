import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { ArrowRight } from "lucide-react";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";
import AdBanner from "@/components/AdBanner";

export const revalidate = 0;

export const metadata: Metadata = {
  title: "Blog | Convert PDF to Excel & Bank Statements with AI",
  description:
    "Guides on converting PDF to Excel without losing format, and the fastest way to convert PDF bank statements to CSV or Excel. AI-powered extraction tips.",
};

type BlogRow = {
  id: string;
  title: string;
  slug: string;
  meta_description: string | null;
  created_at: string;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function BlogPage() {
  let posts: BlogRow[] = [];
  let error: string | null = null;

  if (hasSupabaseConfig) {
    try {
      const supabase = getSupabase();
      const { data, error: fetchError } = await supabase
        .from("blogs")
        .select("id, title, slug, meta_description, created_at")
        .order("created_at", { ascending: false })
        .limit(10000);

      if (fetchError) {
        error = fetchError.message;
      } else if (data) {
        posts = data as BlogRow[];
      }
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to load posts.";
    }
  } else {
    error = "Blog is not configured (missing Supabase credentials).";
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Blog
        </h1>
        <p className="mt-4 text-lg text-slate-600">
          Guides and tips on converting PDFs to Excel and Google Sheets without losing format—powered by AI.
        </p>

        <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
          <p className="mb-2 text-center text-xs font-medium uppercase tracking-wider text-slate-400">Advertisement</p>
          <AdBanner dataAdSlot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_BLOG ?? "0000000004"} />
        </div>

        {error && (
          <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800" role="alert">
            <p className="font-medium">Unable to load posts</p>
            <p className="mt-1 text-sm">{error}</p>
          </div>
        )}

        {!error && posts.length === 0 && (
          <div className="mt-12 rounded-2xl border border-slate-200 bg-slate-50/50 p-12 text-center">
            <p className="text-slate-600">No blog posts yet. Check back soon.</p>
          </div>
        )}

        {!error && posts.length > 0 && (
          <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:gap-8" aria-label="Blog articles">
            {posts.map((post, index) => (
              <Fragment key={post.id}>
                <li>
                  <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-slate-300 hover:shadow-md sm:p-8">
                    <time
                      className="text-sm font-medium text-slate-500"
                      dateTime={post.created_at}
                    >
                      {formatDate(post.created_at)}
                    </time>
                    <h2 className="mt-2 text-xl font-semibold text-slate-900 sm:text-2xl">
                      {post.title}
                    </h2>
                    {post.meta_description && (
                      <p className="mt-3 flex-1 text-slate-600 line-clamp-3">
                        {post.meta_description}
                      </p>
                    )}
                    <Link
                      href={`/blog/${post.slug}`}
                      className="group mt-4 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:gap-2 hover:text-blue-700"
                    >
                      Read Article
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </article>
                </li>
                {(index + 1) % 6 === 0 && index !== posts.length - 1 && (
                  <li className="col-span-full my-8 w-full rounded-xl border border-dashed border-gray-300 bg-gray-100 p-8 text-center">
                    <p className="mb-2 text-center text-xs font-medium uppercase tracking-wider text-slate-400">
                      Advertisement
                    </p>
                    <AdBanner dataAdSlot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_BLOG ?? "0000000004"} />
                  </li>
                )}
              </Fragment>
            ))}
          </ul>
        )}

        <div className="my-8 w-full rounded-xl border border-slate-200 bg-slate-50/50 p-4">
          <p className="mb-2 text-center text-xs font-medium uppercase tracking-wider text-slate-400">Advertisement</p>
          <AdBanner dataAdSlot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_BLOG ?? "0000000004"} />
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
