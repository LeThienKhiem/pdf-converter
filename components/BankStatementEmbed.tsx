"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileDown, FileUp, Loader2 } from "lucide-react";
import * as XLSX from "xlsx-js-style";
import { canGuestConvert, incrementGuestUsage } from "@/lib/pdfUsage";
import QuotaLimitModal, { type QuotaLimitVariant } from "@/components/QuotaLimitModal";
import { createClient } from "@/lib/supabase/client";
import { extractFileClient, PAID_MAX_BYTES, type GridData } from "@/lib/clientExtract";
import { downloadQuickBooksCsv } from "@/lib/quickbooks";
import { savePendingResult, takePendingResult } from "@/lib/pendingResult";

const PENDING_KEY = "itd_pending_embed";

const WATERMARK_TEXT = "Converted free at invoicetodata.com — upgrade to remove this line";

/**
 * Compact bank-statement converter embedded in the SEO bank pages
 * (/tools/bank/[bank]) — same server-enforced pipeline as the full tool,
 * trimmed to upload → extract → download so visitors convert on the page
 * they landed on instead of being sent away.
 */
export default function BankStatementEmbed({ bankName }: { bankName: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [grid, setGrid] = useState<GridData>([]);
  const [isPaidExtract, setIsPaidExtract] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalVariant, setModalVariant] = useState<QuotaLimitVariant>("guest");
  const [pageNotice, setPageNotice] = useState<{ extracted: number; total: number } | null>(null);
  const supabase = useMemo(() => createClient(), []);

  // Restore a result stashed before the sign-in redirect (download wall).
  useEffect(() => {
    const grids = takePendingResult(PENDING_KEY);
    if (grids && grids[0]) {
      queueMicrotask(() => setGrid(grids[0]!.grid));
    }
  }, []);

  const acceptFile = useCallback((f: File | undefined | null) => {
    if (!f) return;
    const okType = f.type === "application/pdf" || f.type.startsWith("image/");
    if (!okType) {
      setError("Only PDF and images are supported.");
      return;
    }
    if (f.size > PAID_MAX_BYTES) {
      setError("File too large. Maximum size is 25MB.");
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

    const outcome = await extractFileClient(file, "bank-statement-to-excel", supabase);
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
  }, [file, isExtracting, supabase]);

  const handleDownload = useCallback(async () => {
    if (grid.length === 0) return;
    // Download wall: viewing is free, downloading needs a (free) account.
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      savePendingResult(PENDING_KEY, [{ name: "bank-statement", grid }]);
      setModalVariant("download_signin");
      setShowModal(true);
      return;
    }
    const rows = isPaidExtract ? grid : [...grid, [], [WATERMARK_TEXT]];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Statement");
    XLSX.writeFile(wb, "bank-statement.xlsx");
  }, [grid, isPaidExtract, supabase]);

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
      <label
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          acceptFile(e.dataTransfer.files?.[0]);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          isDragging ? "border-blue-500 bg-blue-50/50" : "border-slate-300 hover:border-slate-400 hover:bg-slate-50/50"
        }`}
      >
        <input
          type="file"
          accept=".pdf,image/*"
          className="sr-only"
          onChange={(e) => { acceptFile(e.target.files?.[0]); e.target.value = ""; }}
          aria-label={`Upload ${bankName} statement`}
        />
        <FileUp className="h-9 w-9 text-slate-400" aria-hidden />
        <span className="mt-3 font-medium text-slate-700">
          {file ? file.name : `Drop your ${bankName} statement here`}
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
              Extracting transactions…
            </>
          ) : (
            "Convert to Excel — Free"
          )}
        </button>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
            ✓ Extracted {grid.length} rows from your statement
          </p>
          {pageNotice && (
            <button
              type="button"
              onClick={() => { setModalVariant("pages_limit"); setShowModal(true); }}
              className="block w-full rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-left text-sm text-amber-900 transition-colors hover:bg-amber-100"
            >
              <strong>First {pageNotice.extracted} of {pageNotice.total} pages extracted.</strong>{" "}
              Unlock the full statement — $2 →
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
            Converting a whole year of {bankName} statements? Paid plans unlock batch upload and 25MB files.
          </p>
        </div>
      )}

      <QuotaLimitModal open={showModal} onClose={() => setShowModal(false)} variant={modalVariant} />
    </div>
  );
}
