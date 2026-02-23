"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function BlogPostContent({ content }: { content: string }) {
  if (!content || typeof content !== "string") return null;
  return (
    <div className="mt-8 prose prose-slate max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-p:text-slate-600 prose-li:text-slate-600 prose-table:border-collapse prose-th:bg-gray-50 prose-th:p-4 prose-th:border prose-th:border-gray-200 prose-td:p-4 prose-td:border prose-td:border-gray-200 prose-table:w-full">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
