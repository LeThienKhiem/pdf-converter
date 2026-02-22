"use client";

import ReactMarkdown from "react-markdown";

export function BlogPostContent({ content }: { content: string }) {
  if (!content || typeof content !== "string") return null;
  return (
    <div className="mt-8">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
