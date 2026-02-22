"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Lock, ArrowLeft } from "lucide-react";
import BlogEditor, { type BlogPostPayload } from "@/components/BlogEditor";

// Security placeholder: replace with real auth later (e.g. NextAuth, Supabase Auth).
const ADMIN_ACCESS_KEY = "admin"; // In production: use env var and real authentication.

export default function AdminBlogPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [accessKey, setAccessKey] = useState("");
  const [accessError, setAccessError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleUnlock = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setAccessError("");
      if (accessKey.trim() === ADMIN_ACCESS_KEY) {
        setUnlocked(true);
      } else {
        setAccessError("Invalid access key. Try again.");
      }
    },
    [accessKey]
  );

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

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-slate-50 py-16">
        <main className="mx-auto max-w-md px-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex justify-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <Lock className="h-6 w-6" />
              </span>
            </div>
            <h1 className="mt-4 text-center text-xl font-semibold text-slate-900">
              Admin Access
            </h1>
            <p className="mt-2 text-center text-sm text-slate-600">
              Enter the access key to manage blog posts. (Real auth will be added later.)
            </p>
            <form onSubmit={handleUnlock} className="mt-6 space-y-4">
              <input
                type="password"
                value={accessKey}
                onChange={(e) => setAccessKey(e.target.value)}
                placeholder="Access key"
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                autoComplete="current-password"
              />
              {accessError && (
                <p className="text-sm text-red-600">{accessError}</p>
              )}
              <button
                type="submit"
                className="w-full rounded-lg bg-slate-900 px-4 py-2.5 font-medium text-white hover:bg-slate-800"
              >
                Unlock
              </button>
            </form>
          </div>
          <p className="mt-6 text-center">
            <Link href="/" className="text-sm text-blue-600 hover:underline">
              ← Back to Home
            </Link>
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
          <span className="text-sm text-slate-500">Blog Admin</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold text-slate-900">New Blog Post</h1>
          <p className="mt-1 text-slate-600">Write and preview your post, then save to publish.</p>

          {saveMessage && (
            <div
              className={`mt-4 rounded-lg px-4 py-3 text-sm ${
                saveMessage.type === "success"
                  ? "bg-green-50 text-green-800"
                  : "bg-red-50 text-red-800"
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
