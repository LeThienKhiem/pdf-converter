"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Client-side extraction call that routes by file size:
 *  - ≤5MB: multipart POST to /api/extract (fits the serverless body limit)
 *  - >5MB: signed upload to Supabase Storage (paid users only, gated by
 *    /api/upload-url), then /api/extract with { storagePath }
 */

export const FREE_MAX_BYTES = 5 * 1024 * 1024;
export const PAID_MAX_BYTES = 25 * 1024 * 1024;

export type GridData = (string | null)[][];

export type ExtractOutcome =
  | {
      ok: true;
      grid: GridData;
      source?: string;
      plan?: string;
      categorized?: boolean;
      truncated?: boolean;
      pagesTotal?: number | null;
      pagesExtracted?: number | null;
    }
  | { ok: false; status: number; reason?: string; error: string };

export async function extractFileClient(
  file: File,
  tool: string,
  supabase: SupabaseClient
): Promise<ExtractOutcome> {
  try {
    if (file.size > FREE_MAX_BYTES) {
      // Large-file path — ask for a signed upload slot (402 here = not paid).
      const urlRes = await fetch("/api/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name }),
      });
      const urlJson = await urlRes.json();
      if (!urlRes.ok) {
        return {
          ok: false,
          status: urlRes.status,
          reason: urlJson?.reason ?? (urlRes.status === 401 ? "guest_limit" : undefined),
          error: urlJson?.error ?? "Upload not allowed.",
        };
      }

      const { error: upError } = await supabase.storage
        .from("uploads")
        .uploadToSignedUrl(urlJson.path, urlJson.token, file, {
          contentType: file.type || "application/pdf",
        });
      if (upError) {
        return { ok: false, status: 500, error: `Upload failed: ${upError.message}` };
      }

      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storagePath: urlJson.path, tool }),
      });
      const json = await res.json();
      if (res.ok && Array.isArray(json.data)) {
        return { ok: true, grid: json.data, source: json.source, plan: json.plan, categorized: json.categorized, truncated: json.truncated, pagesTotal: json.pagesTotal, pagesExtracted: json.pagesExtracted };
      }
      return { ok: false, status: res.status, reason: json?.reason, error: json?.error ?? "Extraction failed." };
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("tool", tool);
    const res = await fetch("/api/extract", { method: "POST", body: formData });
    const json = await res.json();
    if (res.ok && Array.isArray(json.data) && json.data.every((r: unknown) => Array.isArray(r))) {
      return { ok: true, grid: json.data, source: json.source, plan: json.plan, categorized: json.categorized, truncated: json.truncated, pagesTotal: json.pagesTotal, pagesExtracted: json.pagesExtracted };
    }
    return { ok: false, status: res.status, reason: json?.reason, error: json?.error ?? "Extraction failed." };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : "Network error.",
    };
  }
}
