import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";
import { BlogPostContent } from "./BlogPostContent";

type Props = { params: Promise<{ slug: string }> };

type BlogPost = {
  id: string;
  title: string;
  slug: string;
  meta_description: string | null;
  content: string | null;
  created_at: string;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!hasSupabaseConfig) return { title: "Blog" };

  const supabase = getSupabase();
  const { data } = await supabase
    .from("blogs")
    .select("title, meta_description")
    .eq("slug", slug)
    .single();

  if (!data) return { title: "Blog" };
  const post = data as { title: string; meta_description: string | null };
  return {
    title: post.title,
    description: post.meta_description ?? undefined,
  };
}

export default async function BlogSlugPage({ params }: Props) {
  const { slug } = await params;

  if (!hasSupabaseConfig) {
    notFound();
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("blogs")
    .select("id, title, slug, meta_description, content, created_at")
    .eq("slug", slug)
    .single();

  if (error || !data) {
    notFound();
  }

  const post = data as BlogPost;

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="prose prose-lg prose-slate mx-auto max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-p:text-slate-600 prose-li:text-slate-600">
          <time className="text-sm font-medium text-slate-500" dateTime={post.created_at}>
            {formatDate(post.created_at)}
          </time>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {post.title}
          </h1>
          {post.meta_description && (
            <p className="mt-4 text-xl text-slate-600">{post.meta_description}</p>
          )}

          {post.content ? (
            <BlogPostContent key={post.id} content={post.content} />
          ) : (
            <p className="text-slate-500">No content yet.</p>
          )}

          <p className="mt-12 text-slate-500">
            <Link href="/blog" className="text-blue-600 hover:underline">
              ← Back to Blog
            </Link>
          </p>
        </div>
      </article>
    </div>
  );
}
