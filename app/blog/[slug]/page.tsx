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
  keywords: string | null;
  content: string | null;
  created_at: string;
};

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.invoicetodata.com";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Extract FAQ items from markdown content (### Question format) */
function extractFAQs(content: string): { question: string; answer: string }[] {
  const faqs: { question: string; answer: string }[] = [];
  const faqSection = content.split(/##\s*Frequently Asked Questions/i)[1];
  if (!faqSection) return faqs;

  const matches = faqSection.matchAll(/###\s*(.+?)\n([\s\S]*?)(?=###|$)/g);
  for (const m of matches) {
    const question = m[1].trim().replace(/\*/g, "");
    const answer = m[2].trim().replace(/\n+/g, " ").replace(/\[.*?\]\(.*?\)/g, "").replace(/\*/g, "").slice(0, 500);
    if (question && answer) {
      faqs.push({ question, answer });
    }
  }
  return faqs;
}

/** Generate JSON-LD structured data for the blog post */
function generateStructuredData(post: BlogPost) {
  const articleUrl = `${siteUrl}/blog/${post.slug}`;
  const faqs = post.content ? extractFAQs(post.content) : [];

  const schemas: object[] = [
    // Article schema
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: post.title,
      description: post.meta_description ?? "",
      url: articleUrl,
      datePublished: post.created_at,
      dateModified: post.created_at,
      author: {
        "@type": "Organization",
        name: "InvoiceToData",
        url: siteUrl,
      },
      publisher: {
        "@type": "Organization",
        name: "InvoiceToData",
        url: siteUrl,
        logo: {
          "@type": "ImageObject",
          url: `${siteUrl}/favicon.ico`,
        },
      },
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": articleUrl,
      },
      keywords: post.keywords ?? undefined,
    },
    // BreadcrumbList schema
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: siteUrl,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Blog",
          item: `${siteUrl}/blog`,
        },
        {
          "@type": "ListItem",
          position: 3,
          name: post.title,
          item: articleUrl,
        },
      ],
    },
  ];

  // FAQ schema (if FAQs found in content)
  if (faqs.length > 0) {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.answer,
        },
      })),
    });
  }

  return schemas;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!hasSupabaseConfig) return { title: "Blog" };

  const supabase = getSupabase();
  const { data } = await supabase
    .from("blogs")
    .select("title, meta_description, slug, keywords")
    .eq("slug", slug)
    .single();

  if (!data) return { title: "Blog" };
  const post = data as { title: string; meta_description: string | null; slug: string; keywords: string | null };
  const articleUrl = `${siteUrl}/blog/${post.slug}`;

  return {
    title: post.title,
    description: post.meta_description ?? undefined,
    keywords: post.keywords ?? undefined,
    alternates: {
      canonical: articleUrl,
    },
    openGraph: {
      title: post.title,
      description: post.meta_description ?? undefined,
      url: articleUrl,
      type: "article",
      siteName: "InvoiceToData",
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.meta_description ?? undefined,
    },
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
    .select("id, title, slug, meta_description, keywords, content, created_at")
    .eq("slug", slug)
    .single();

  if (error || !data) {
    notFound();
  }

  const post = data as BlogPost;
  const structuredData = generateStructuredData(post);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* JSON-LD Structured Data */}
      {structuredData.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}

      <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Breadcrumb navigation */}
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-slate-500">
          <ol className="flex items-center space-x-2">
            <li><Link href="/" className="hover:text-blue-600">Home</Link></li>
            <li><span className="mx-1">/</span></li>
            <li><Link href="/blog" className="hover:text-blue-600">Blog</Link></li>
            <li><span className="mx-1">/</span></li>
            <li className="text-slate-700 font-medium truncate max-w-xs">{post.title}</li>
          </ol>
        </nav>

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
