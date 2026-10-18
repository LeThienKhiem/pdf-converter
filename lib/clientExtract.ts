"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { mergeStatementMeta, type StatementMeta } from "@/lib/bankStatement";

/**
 * Client-side extraction call that routes by file size:
 *  - ≤5MB: multipart POST to /api/extract (fits the serverless body limit)
 *  - >5MB: signed upload to Supabase Storage (paid users only, gated by
 *    /api/upload-url), then /api/extract with { storagePath }
 */

/**
 * Mirrors of the server's caps in app/api/extract/route.ts, which is the
 * authority — these exist only to fail fast in the browser before an upload.
 *
 * Keep them in step. When the paid cap moved 25MB -> 23MB (base64 inflates by
 * 4/3 against Anthropic's 32MB request ceiling) this copy was missed, so the
 * browser accepted a 24MB file, spent the upload, and the server rejected it.
 * A client cap above the server's is worse than no client cap at all.
 */
export const FREE_MAX_BYTES = 5 * 1024 * 1024;
export const PAID_MAX_BYTES = 23 * 1024 * 1024;

export type GridData = (string | null)[][];

/**
 * Count a PDF's pages in the browser (lazy-loads pdf-lib only when needed).
 * Returns null for images, encrypted, or unparseable files.
 */
export async function countPdfPagesClient(file: File): Promise<number | null> {
  if (file.type !== "application/pdf") return null;
  try {
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
    return doc.getPageCount();
  } catch {
    return null;
  }
}

/**
 * Progress-bar duration estimate, calibrated on production timings
 * (1 page ≈ 12s, 12 pages ≈ 68s). Slight overestimates are fine — the bar
 * jumps to 100% when the response lands, which reads as "faster than expected".
 */
export function estimateExtractMs(pages: number | null): number {
  if (!pages || pages < 1) return 15000;
  return Math.min(8000 + pages * 6000, 280000);
}

export type ExtractOutcome =
  | {
      ok: true;
      grid: GridData;
      source?: string;
      plan?: string;
      categorized?: boolean;
      /** Bank tool only: the statement's opening/closing balances, for the balance check. */
      statement?: StatementMeta | null;
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
        return { ok: true, grid: json.data, source: json.source, plan: json.plan, categorized: json.categorized, statement: json.statement ?? null, truncated: json.truncated, pagesTotal: json.pagesTotal, pagesExtracted: json.pagesExtracted };
      }
      return { ok: false, status: res.status, reason: json?.reason, error: json?.error ?? "Extraction failed." };
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("tool", tool);
    const res = await fetch("/api/extract", { method: "POST", body: formData });
    const json = await res.json();
    if (res.ok && Array.isArray(json.data) && json.data.every((r: unknown) => Array.isArray(r))) {
      return { ok: true, grid: json.data, source: json.source, plan: json.plan, categorized: json.categorized, statement: json.statement ?? null, truncated: json.truncated, pagesTotal: json.pagesTotal, pagesExtracted: json.pagesExtracted };
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

/**
 * Pages per request when extracting a long document. One model call can only
 * emit so many rows before hitting its output cap, and one serverless request
 * can only run so long — so a 240-page statement is split client-side and the
 * grids are stitched back together. This is what makes "unlock all 240 pages"
 * a promise we can keep.
 */
export const CHUNK_PAGES = 12;

/** Rows are identical across chunk boundaries only for the repeated header. */
function sameRow(a: (string | null)[] | undefined, b: (string | null)[] | undefined): boolean {
  if (!a || !b || a.length !== b.length) return false;
  return a.every((cell, i) => (cell ?? "") === (b[i] ?? ""));
}

type PdfDoc = Awaited<ReturnType<typeof import("pdf-lib").PDFDocument.load>>;

async function sliceToFile(src: PdfDoc, name: string, start: number, count: number): Promise<File> {
  const { PDFDocument } = await import("pdf-lib");
  const out = await PDFDocument.create();
  const indices = Array.from({ length: count }, (_, i) => start + i).filter((i) => i < src.getPageCount());
  const pages = await out.copyPages(src, indices);
  for (const p of pages) out.addPage(p);
  const bytes = await out.save();
  return new File([bytes as BlobPart], name, { type: "application/pdf" });
}

/**
 * Chunks in flight at once. Each chunk is itself split into parallel model
 * calls server-side, so 2 here means up to 6 concurrent calls — a 400-page
 * statement finishes in minutes instead of the best part of an hour.
 */
const CHUNK_CONCURRENCY = 2;

/**
 * Extract a whole document, chunking it when it is longer than one model call
 * can handle. Short documents take the plain single-request path.
 */
export async function extractDocumentClient(
  file: File,
  tool: string,
  supabase: SupabaseClient,
  opts: { onProgress?: (chunksDone: number, chunksTotal: number) => void } = {}
): Promise<ExtractOutcome> {
  const pages = await countPdfPagesClient(file);
  if (!pages || pages <= CHUNK_PAGES) {
    opts.onProgress?.(0, 1);
    const single = await extractFileClient(file, tool, supabase);
    opts.onProgress?.(1, 1);
    return single;
  }

  const chunkCount = Math.ceil(pages / CHUNK_PAGES);
  const { PDFDocument } = await import("pdf-lib");
  const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });

  const outcomes: (ExtractOutcome | undefined)[] = new Array(chunkCount);
  let next = 0;
  let done = 0;
  let stop = false;
  opts.onProgress?.(0, chunkCount);

  const worker = async () => {
    while (!stop && next < chunkCount) {
      const c = next++;
      const part = await sliceToFile(src, file.name, c * CHUNK_PAGES, CHUNK_PAGES);
      let outcome = await extractFileClient(part, tool, supabase);
      // Chunking fires many requests in a row; a burst limit is a pacing
      // problem, not a failure. Back off once and continue.
      if (!outcome.ok && outcome.status === 429) {
        await new Promise((r) => setTimeout(r, 20000));
        outcome = await extractFileClient(part, tool, supabase);
      }
      outcomes[c] = outcome;
      // A hard failure stops new chunks; 422 (no transactions on these
      // pages — often closing disclosures) is not a failure of the document.
      if (!outcome.ok && outcome.status !== 422) stop = true;
      opts.onProgress?.(++done, chunkCount);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CHUNK_CONCURRENCY, chunkCount) }, worker));

  // Stitch in page order, up to the first hard failure — partial success
  // still beats nothing, but only as a contiguous run from page 1.
  const merged: GridData = [];
  let header: (string | null)[] | undefined;
  let meta: Extract<ExtractOutcome, { ok: true }> | null = null;
  const statements: (StatementMeta | null | undefined)[] = [];
  let firstError: ExtractOutcome | null = null;
  for (const outcome of outcomes) {
    if (!outcome) break;
    if (!outcome.ok) {
      if (outcome.status === 422) continue;
      firstError = outcome;
      break;
    }
    meta = outcome;
    statements.push(outcome.statement);
    const rows = outcome.grid;
    if (!header) {
      header = rows[0];
      merged.push(...rows);
    } else {
      merged.push(...(sameRow(rows[0], header) ? rows.slice(1) : rows));
    }
  }
  if (merged.length === 0) {
    return firstError ?? outcomes.find((o) => o && !o.ok) ?? { ok: false, status: 500, error: "Extraction failed." };
  }

  opts.onProgress?.(chunkCount, chunkCount);
  return {
    ok: true,
    grid: merged,
    source: meta?.source,
    plan: meta?.plan,
    categorized: meta?.categorized,
    statement: mergeStatementMeta(statements),
    truncated: false,
    pagesTotal: pages,
    pagesExtracted: pages,
  };
}
