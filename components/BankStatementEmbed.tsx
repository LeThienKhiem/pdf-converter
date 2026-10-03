"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileDown, FileUp, Loader2 } from "lucide-react";
import * as XLSX from "xlsx-js-style";
import { canGuestConvert, incrementGuestUsage } from "@/lib/pdfUsage";
import QuotaLimitModal, { type QuotaLimitVariant } from "@/components/QuotaLimitModal";
import { createClient } from "@/lib/supabase/client";
import { extractFileClient, PAID_MAX_BYTES, type GridData } from "@/lib/clientExtract";
import PdfPasswordPrompt from "@/components/PdfPasswordPrompt";
import { isEncryptedPdf } from "@/lib/pdfPassword";
import { downloadQuickBooksCsv } from "@/lib/quickbooks";
import { savePendingResult, takePendingResult } from "@/lib/pendingResult";
import { peekPendingIntent, takePendingFile } from "@/lib/pendingFile";
import { extractDocumentClient } from "@/lib/clientExtract";

/** Rows shown in the inline preview — enough to judge the result at a glance. */
const PREVIEW_ROWS = 8;

const WATERMARK_TEXT = "Converted free at invoicetodata.com — upgrade to remove this line";

type ConverterEmbedProps = {
  /** Bank SEO pages: personalises the copy ("Drop your Chase statement here"). */
  bankName?: string;
  /** Extraction tool id — drives server-side logging and bank-only categorisation. */
  tool?: string;
  /** What the upload is called in status copy: "statement", "document". */
  noun?: string;
  dropLabel?: string;
  footnote?: string;
};

/**
 * Compact converter — upload → extract → preview → download, with the full
 * paywall flow (10-page gate, in-place purchase, download wall) built in.
 *
 * Used on the homepage hero and on the bank SEO pages (/tools/bank/[bank]),
 * so visitors convert on the page they landed on instead of being sent away.
 */
export default function BankStatementEmbed({
  bankName,
  tool = "bank-statement-to-excel",
  noun = "statement",
  dropLabel,
  footnote,
}: ConverterEmbedProps) {
  // Per-tool so a result stashed on one page is never restored on another.
  const pendingKey = `itd_pending_embed:${tool}`;
  const [file, setFile] = useState<File | null>(null);
  /** Encrypted PDF waiting on its password — never reaches setFile. */
  const [lockedFile, setLockedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [grid, setGrid] = useState<GridData>([]);
  const [isPaidExtract, setIsPaidExtract] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalVariant, setModalVariant] = useState<QuotaLimitVariant>("guest");
  const [pageNotice, setPageNotice] = useState<{ extracted: number; total: number } | null>(null);
  const [unlockFile, setUnlockFile] = useState<File | null>(null);
  const [unlockProgress, setUnlockProgress] = useState<{ done: number; total: number } | null>(null);
  const supabase = useMemo(() => createClient(), []);

  // Restore a result stashed before the sign-in redirect (download wall).
  useEffect(() => {
    const grids = takePendingResult(pendingKey);
    if (grids && grids[0]) {
      queueMicrotask(() => setGrid(grids[0]!.grid));
    }
  }, [pendingKey]);

  /** Finish the paid job in place: full extraction, chunked, no re-upload. */
  const runFullUnlock = useCallback(
    async (f: File) => {
      setShowModal(false);
      setError(null);
      setIsExtracting(true);
      setUnlockProgress({ done: 0, total: 1 });
      const outcome = await extractDocumentClient(f, tool, supabase, {
        onProgress: (done, total) => setUnlockProgress({ done, total }),
      });
      if (outcome.ok) {
        setGrid(outcome.grid);
        setIsPaidExtract(outcome.source === "plan" || outcome.source === "credits");
        setPageNotice(null);
        setUnlockFile(null);
      } else {
        setError(outcome.error);
      }
      setUnlockProgress(null);
      setIsExtracting(false);
    },
    [supabase, tool]
  );

  // Back from the Google redirect mid-purchase — resume at the pay step.
  useEffect(() => {
    void (async () => {
      // Peek before taking: a visitor who backs out of the Google prompt and
      // returns must still have their document waiting, not silently dropped.
      const intent = peekPendingIntent();
      if (!intent || intent.tool !== tool) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const pending = await takePendingFile();
      if (!pending) return;
      setFile(pending.file);
      setUnlockFile(pending.file);
      setPageNotice({ extracted: 10, total: pending.intent.pagesTotal });
      setModalVariant("pages_limit");
      setShowModal(true);
    })();
  }, [supabase, tool]);

  const acceptFile = useCallback(async (f: File | undefined | null) => {
    if (!f) return;
    const okType = f.type === "application/pdf" || f.type.startsWith("image/");
    if (!okType) {
      setError("Only PDF and images are supported.");
      return;
    }
    if (f.size > PAID_MAX_BYTES) {
      setError("File too large. Maximum size is 23MB.");
      return;
    }
    if (await isEncryptedPdf(f)) {
      setError(null);
      setLockedFile(f);
      return;
    }
    setError(null);
    setFile(f);
  }, []);

  const handleExtract = useCallback(async () => {
    if (!file || isExtracting) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session && !canGuestConvert()) {
      setModalVariant("guest");
      setShowModal(true);
      return;
    }
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", "click_convert", { target_format: "excel", source: "bank_embed" });
    }
    setIsExtracting(true);
    setError(null);
    setGrid([]);

    const outcome = await extractFileClient(file, tool, supabase);
    if (outcome.ok) {
      if (!session) incrementGuestUsage();
      setIsPaidExtract(outcome.source === "plan" || outcome.source === "credits");
      setGrid(outcome.grid);
      if (
        outcome.pagesTotal != null &&
        outcome.pagesExtracted != null &&
        outcome.pagesExtracted < outcome.pagesTotal
      ) {
        setPageNotice({ extracted: outcome.pagesExtracted, total: outcome.pagesTotal });
        setUnlockFile(file);
      } else {
        setPageNotice(null);
      }
      if (outcome.truncated) {
        setError(
          `Very long document — extracted the first ${outcome.grid.length} rows. Split the PDF to convert the rest.`
        );
      }
    } else if (outcome.status === 402 || outcome.status === 413 || outcome.status === 401) {
      setModalVariant(
        outcome.reason === "guest_limit"
          ? "guest"
          : outcome.reason === "file_too_large"
            ? "file_too_large"
            : "out_of_credits"
      );
      setShowModal(true);
    } else {
      setError(outcome.error);
    }
    setIsExtracting(false);
  }, [file, isExtracting, supabase, tool]);

  const handleDownload = useCallback(async () => {
    if (grid.length === 0) return;
    // Download wall: viewing is free, downloading needs a (free) account.
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      savePendingResult(pendingKey, [{ name: "bank-statement", grid }]);
      setModalVariant("download_signin");
      setShowModal(true);
      return;
    }
    const rows = isPaidExtract ? grid : [...grid, [], [WATERMARK_TEXT]];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Statement");
    XLSX.writeFile(wb, "bank-statement.xlsx");
  }, [grid, isPaidExtract, supabase, pendingKey]);

  const handleQuickBooks = useCallback(() => {
    if (grid.length === 0) return;
    if (!isPaidExtract) {
      setModalVariant("pro_feature");
      setShowModal(true);
      return;
    }
    downloadQuickBooksCsv(grid);
  }, [grid, isPaidExtract]);

  return (
    <div className="rounded-2xl border-2 border-[#217346]/30 bg-white p-6 shadow-md sm:p-8">
    {lockedFile && (
      <PdfPasswordPrompt
        file={lockedFile}
        onCancel={() => setLockedFile(null)}
        onUnlocked={(unlocked) => { setError(null); setFile(unlocked); }}
      />
    )}
      <label
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          void acceptFile(e.dataTransfer.files?.[0]);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          isDragging ? "border-blue-500 bg-blue-50/50" : "border-slate-300 hover:border-slate-400 hover:bg-slate-50/50"
        }`}
      >
        <input
          type="file"
          accept=".pdf,image/*"
          className="sr-only"
          onChange={(e) => { void acceptFile(e.target.files?.[0]); e.target.value = ""; }}
          aria-label={bankName ? `Upload ${bankName} statement` : `Upload ${noun}`}
        />
        <FileUp className="h-9 w-9 text-slate-400" aria-hidden />
        <span className="mt-3 font-medium text-slate-700">
          {file ? file.name : dropLabel ?? (bankName ? `Drop your ${bankName} statement here` : "Drop your PDF here or click to browse")}
        </span>
        <span className="mt-1 text-sm text-slate-500">
          PDF or photo — first conversion free, no sign-up
        </span>
      </label>

      {error && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}

      {grid.length === 0 ? (
        <button
          type="button"
          onClick={handleExtract}
          disabled={!file || isExtracting}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#217346] px-4 py-3.5 font-semibold text-white shadow-sm transition-colors hover:bg-[#1d603d] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isExtracting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              {unlockProgress && unlockProgress.total > 1
                ? `Extracting batch ${unlockProgress.done + 1} of ${unlockProgress.total}…`
                : `Extracting your ${noun}…`}
            </>
          ) : (
            "Convert to Excel — Free"
          )}
        </button>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
            ✓ Extracted {grid.length} rows from your {noun}
          </p>
          {/* Preview before the wall: seeing their own data in rows and
              columns is what makes the sign-in-to-download ask worth it. */}
          <div className="overflow-x-auto rounded-lg border border-slate-200 text-left">
            <table className="min-w-full text-xs">
              <tbody className="divide-y divide-slate-100">
                {grid.slice(0, PREVIEW_ROWS).map((row, i) => (
                  <tr key={i} className={i === 0 ? "bg-slate-50 font-semibold text-slate-700" : "text-slate-600"}>
                    {row.map((cell, j) => (
                      <td key={j} className="whitespace-nowrap px-2.5 py-1.5">
                        {cell ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {grid.length > PREVIEW_ROWS && (
            <p className="text-xs text-slate-500">
              Showing {PREVIEW_ROWS} of {grid.length} rows — the download has all of them.
            </p>
          )}
          {pageNotice && (
            <button
              type="button"
              onClick={() => { setModalVariant("pages_limit"); setShowModal(true); }}
              className="block w-full rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-left text-sm text-amber-900 transition-colors hover:bg-amber-100"
            >
              <strong>First {pageNotice.extracted} of {pageNotice.total} pages extracted.</strong>{" "}
              Unlock the full {noun} — $2 →
            </button>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              <FileDown className="h-5 w-5" aria-hidden />
              Download Excel
            </button>
            <button
              type="button"
              onClick={handleQuickBooks}
              className="inline-flex items-center gap-2 rounded-xl border border-[#217346] bg-white px-4 py-3 font-semibold text-[#217346] transition-colors hover:bg-emerald-50"
            >
              Export for QuickBooks
              {!isPaidExtract && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Pro</span>
              )}
            </button>
          </div>
          <p className="text-xs text-slate-500">
            {footnote ??
              (bankName
                ? `Converting a whole year of ${bankName} statements? Paid plans unlock batch upload and 23MB files.`
                : "Long documents or a stack of files? Paid plans start at $2 — full documents, 23MB files, no watermark.")}
          </p>
        </div>
      )}

      <QuotaLimitModal
        open={showModal}
        onClose={() => setShowModal(false)}
        variant={modalVariant}
        unlockContext={
          unlockFile && pageNotice
            ? { file: unlockFile, tool, pagesTotal: pageNotice.total }
            : null
        }
        onPurchased={unlockFile ? () => void runFullUnlock(unlockFile) : undefined}
      />
    </div>
  );
}
