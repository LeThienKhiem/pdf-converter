"use client";

import { useState, useCallback, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const META_DESC_MAX = 160;

function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export type BlogPostPayload = {
  title: string;
  slug: string;
  meta_description: string;
  keywords: string;
  content: string;
};

type BlogEditorProps = {
  initial?: Partial<BlogPostPayload>;
  onSave?: (data: BlogPostPayload) => void;
  isSaving?: boolean;
};

export default function BlogEditor({ initial, onSave, isSaving = false }: BlogEditorProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [metaDescription, setMetaDescription] = useState(initial?.meta_description ?? "");
  const [keywords, setKeywords] = useState(initial?.keywords ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [previewTab, setPreviewTab] = useState<"edit" | "preview">("edit");

  useEffect(() => {
    if (initial?.title && !initial?.slug && !slug) setSlug(slugify(initial.title));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setTitle(v);
    setSlug((prev) => (prev === slugify(title) ? slugify(v) : prev));
  }, [title]);

  const metaCount = metaDescription.length;
  const metaOver = metaCount > META_DESC_MAX;

  const payload: BlogPostPayload = {
    title,
    slug,
    meta_description: metaDescription,
    keywords,
    content,
  };

  return (
    <div className="space-y-8">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
        <div>
          <label htmlFor="blog-title" className="block text-sm font-medium text-slate-700">
            Title
          </label>
          <input
            id="blog-title"
            type="text"
            value={title}
            onChange={handleTitleChange}
            placeholder="Main H1 of the post"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <div>
          <label htmlFor="blog-slug" className="block text-sm font-medium text-slate-700">
            Slug
          </label>
          <input
            id="blog-slug"
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="url-friendly-slug"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <p className="mt-1 text-xs text-slate-500">URL path: /blog/{slug || "..."}</p>
        </div>
      </div>

      <div>
        <label htmlFor="blog-meta" className="block text-sm font-medium text-slate-700">
          Meta Description (SEO)
        </label>
        <textarea
          id="blog-meta"
          value={metaDescription}
          onChange={(e) => setMetaDescription(e.target.value)}
          placeholder="Short description for search results (max 160 characters)"
          rows={3}
          maxLength={META_DESC_MAX + 50}
          className={`mt-1 w-full rounded-lg border bg-white px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
            metaOver
              ? "border-amber-400 focus:border-amber-500 focus:ring-amber-500/20"
              : "border-slate-300 focus:border-blue-500 focus:ring-blue-500/20"
          }`}
        />
        <p className={`mt-1 text-xs ${metaOver ? "text-amber-600" : "text-slate-500"}`}>
          {metaCount} / {META_DESC_MAX} characters
        </p>
      </div>

      <div>
        <label htmlFor="blog-keywords" className="block text-sm font-medium text-slate-700">
          Keywords
        </label>
        <input
          id="blog-keywords"
          type="text"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="keyword1, keyword2, keyword3"
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label htmlFor="blog-content" className="block text-sm font-medium text-slate-700">
            Content (Markdown)
          </label>
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 lg:hidden">
            <button
              type="button"
              onClick={() => setPreviewTab("edit")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${previewTab === "edit" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setPreviewTab("preview")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${previewTab === "preview" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}
            >
              Preview
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className={previewTab === "preview" ? "hidden lg:block" : ""}>
            <textarea
              id="blog-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your post in Markdown..."
              rows={18}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div
            className={`min-h-[280px] rounded-lg border border-slate-200 bg-slate-50/50 p-4 lg:min-h-[400px] ${
              previewTab === "edit" ? "hidden lg:block" : ""
            }`}
          >
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">
              Live Preview
            </p>
            <div className="prose prose-slate max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-p:text-slate-600 prose-li:text-slate-600 prose-table:border-collapse prose-th:bg-gray-50 prose-th:p-4 prose-th:border prose-th:border-gray-200 prose-td:p-4 prose-td:border prose-td:border-gray-200 prose-table:w-full">
              {content ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              ) : (
                <p className="text-slate-400">Nothing to preview yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {onSave && (
        <div className="flex justify-end border-t border-slate-200 pt-6">
          <button
            type="button"
            onClick={() => onSave(payload)}
            disabled={isSaving || !title.trim() || !slug.trim()}
            className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? "Saving…" : "Save & Publish"}
          </button>
        </div>
      )}
    </div>
  );
}
