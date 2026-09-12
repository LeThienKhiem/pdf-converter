"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import BlogEditor, { type BlogPostPayload } from "@/components/BlogEditor";

export default function BlogAdminClient() {
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSave = useCallback(async (data: BlogPostPayload) => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch("/api/blogs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        setSaveMessage({ type: "error", text: json?.error ?? "Failed to save." });
        return;
      }
      setSaveMessage({ type: "success", text: "Saved successfully." });
    } catch {
      setSaveMessage({ type: "error", text: "Network error." });
    } finally {
      setIsSaving(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
          <span className="text-sm text-slate-500">Blog Admin</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold text-slate-900">New Blog Post</h1>
          <p className="mt-1 text-slate-600">Write and preview your post, then save to publish.</p>

          {saveMessage && (
            <div
              className={`mt-4 rounded-lg px-4 py-3 text-sm ${
                saveMessage.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
              }`}
            >
              {saveMessage.text}
            </div>
          )}

          <div className="mt-8">
            <BlogEditor onSave={handleSave} isSaving={isSaving} />
          </div>
        </div>
      </main>
    </div>
  );
}
