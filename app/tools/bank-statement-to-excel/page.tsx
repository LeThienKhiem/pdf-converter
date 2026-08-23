"use client";

import { useCallback, useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import {
  FileDown,
  FileUp,
  Loader2,
  TableIcon,
  ChevronDown,
  ChevronRight,
  Upload,
  Sparkles,
  Shield,
  LayoutGrid,
  Building2,
  ArrowRight,
} from "lucide-react";
import { BANK_ENTITIES } from "@/lib/bankEntities";
import * as XLSX from "xlsx-js-style";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { canGuestConvert, incrementGuestUsage } from "@/lib/pdfUsage";
import QuotaLimitModal, { type QuotaLimitVariant } from "@/components/QuotaLimitModal";
import { createClient } from "@/lib/supabase/client";
import { gridToQuickBooksRows, quickBooksCsv } from "@/lib/quickbooks";
import { extractFileClient, PAID_MAX_BYTES } from "@/lib/clientExtract";

const WATERMARK_TEXT = "Converted free at invoicetodata.com — upgrade to remove this line";
const MAX_BATCH_FILES = 20;

function reasonToVariant(reason: string | undefined): QuotaLimitVariant {
  if (reason === "guest_limit") return "guest";
  if (reason === "file_too_large") return "file_too_large";
  return "out_of_credits";
}

/** Excel sheet names: ≤31 chars, no []:*?/\ and unique per workbook. */
function sheetNameFor(fileName: string, index: number, used: Set<string>): string {
  let base = fileName.replace(/\.[^.]+$/, "").replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 28);
  if (!base) base = `Statement ${index + 1}`;
  let name = base;
  let n = 2;
  while (used.has(name)) name = `${base.slice(0, 25)} ${n++}`;
  used.add(name);
  return name;
}

type FileStatus = "pending" | "processing" | "done" | "error";
type BatchItem = { file: File; status: FileStatus; rows: number; error?: string };

const ACCEPT = ".pdf,image/*";
const PROGRESS_DURATION_MS = 15000;
const PROGRESS_TICK_MS = 100;

function isValidFileType(file: File): boolean {
  if (file.type === "application/pdf") return true;
  return file.type.startsWith("image/");
}

type GridData = (string | null)[][];

function getColumnCount(rows: GridData): number {
  if (rows.length === 0) return 0;
  return Math.max(...rows.map((r) => r.length));
}

function formatCell(value: string | null | undefined): string {
  if (value == null) return "";
  return String(value).trim();
}

const THIN_BORDER = { style: "thin" as const, color: { rgb: "000000" } };
const DEFAULT_CELL_STYLE = {
  border: { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER },
  alignment: { vertical: "center" as const },
};
const SECTION_HEADER_STYLE = {
  ...DEFAULT_CELL_STYLE,
  font: { bold: true },
  fill: { fgColor: { rgb: "E9E9E9" }, patternType: "solid" as const },
};

function isHeaderRow(row: (string | null)[], rowIndex: number): boolean {
  if (rowIndex === 0) return true;
  const first = formatCell(row[0]);
  if (!first) return false;
  if (/^Part\s/i.test(first) || /^Section\s/i.test(first) || /^Schedule\s/i.test(first) || /^Invoice\s/i.test(first)) return true;
  if (/^Part\s+[IVXLCDM0-9]+$/i.test(first)) return true;
  if (first.length <= 20 && !first.includes(",")) return true;
  return false;
}

function colToLetter(n: number): string {
  let s = "";
  let k = n;
  while (k >= 0) {
    s = String.fromCharCode(65 + (k % 26)) + s;
    k = Math.floor(k / 26) - 1;
  }
  return s;
}

function applyStylesAndAutoFit(ws: XLSX.WorkSheet, tableRows: GridData): void {
  const rows = tableRows.length;
  const cols = getColumnCount(tableRows);
  const colWidths: number[] = new Array(cols).fill(10);
  for (let i = 0; i < rows; i++) {
    const row = tableRows[i] ?? [];
    const isHeader = isHeaderRow(row, i);
    for (let j = 0; j < cols; j++) {
      const ref = colToLetter(j) + (i + 1);
      const cell = ws[ref];
      if (cell) {
        const len = String(cell.v ?? "").length;
        if (len > colWidths[j]) colWidths[j] = Math.min(len + 1, 50);
        cell.s = isHeader ? SECTION_HEADER_STYLE : DEFAULT_CELL_STYLE;
      }
    }
  }
  ws["!cols"] = colWidths.map((wch) => ({ wch }));
}

export default function BankStatementToExcelPage() {
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [batchResults, setBatchResults] = useState<{ name: string; grid: GridData }[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState(-1);
  const [extractionResult, setExtractionResult] = useState<GridData>([]);
  const [extractedFileName, setExtractedFileName] = useState<string>("");
  const [tableExpanded, setTableExpanded] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [quotaModalVariant, setQuotaModalVariant] = useState<QuotaLimitVariant>("guest");
  const [isPaidExtract, setIsPaidExtract] = useState(false);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 4000);
    return () => clearTimeout(t);
  }, [toastMessage]);

  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const addFiles = useCallback((list: FileList | null) => {
    if (!list || list.length === 0) return;
    const valid: BatchItem[] = [];
    for (const file of Array.from(list)) {
      if (!isValidFileType(file)) {
        setToastMessage(`${file.name}: only PDF and images are supported.`);
        continue;
      }
      if (file.size > PAID_MAX_BYTES) {
        setToastMessage(`${file.name}: over the 25MB limit.`);
        continue;
      }
      valid.push({ file, status: "pending", rows: 0 });
    }
    setBatch((prev) => [...prev, ...valid].slice(0, MAX_BATCH_FILES));
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      addFiles(e.target.files);
      e.target.value = "";
    },
    [addFiles]
  );

  const handleZoneClick = useCallback(() => {
    document.getElementById("bank-statement-file-input")?.click();
  }, []);

  const handleExtract = useCallback(async () => {
    if (batch.length === 0 || isExtracting) return;
    const { data: { session } } = await supabase.auth.getSession();
    // Advisory fast-path only — the server inside /api/extract is the
    // authority and returns 402 with a reason code when the limit is hit.
    if (!session && !canGuestConvert()) {
      setQuotaModalVariant("guest");
      setShowQuotaModal(true);
      return;
    }

    // Batch (2+ files) is a paid feature — check before burning quota.
    if (batch.length > 1) {
      if (!session) {
        setQuotaModalVariant("batch");
        setShowQuotaModal(true);
        return;
      }
      const credRes = await fetch("/api/credits");
      const cred = credRes.ok ? await credRes.json() : null;
      if (!cred?.isPaid) {
        setQuotaModalVariant("batch");
        setShowQuotaModal(true);
        return;
      }
    }

    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", "click_convert", {
        target_format: "excel",
        batch_size: batch.length,
      });
    }
    setExtractError(null);
    setExtractionResult([]);
    setBatchResults([]);
    setExtractedFileName("");
    setTableExpanded(false);
    setIsExtracting(true);
    setProgress(0);
    setBatch((prev) => prev.map((b) => ({ ...b, status: "pending" as FileStatus, rows: 0, error: undefined })));

    const items = batch;
    const results: { name: string; grid: GridData }[] = [];
    let paidSeen = false;
    let hitPaywall = false;

    for (let i = 0; i < items.length; i++) {
      setBatch((prev) => prev.map((b, j) => (j === i ? { ...b, status: "processing" as FileStatus } : b)));

      // Smooth per-file progress ramp within this file's share of the bar.
      const startTime = Date.now();
      const base = (i / items.length) * 100;
      const span = 95 / items.length;
      progressIntervalRef.current = setInterval(() => {
        const elapsed = Math.min(Date.now() - startTime, PROGRESS_DURATION_MS);
        setProgress(base + (elapsed / PROGRESS_DURATION_MS) * span);
      }, PROGRESS_TICK_MS);

      const outcome = await extractFileClient(items[i]!.file, "bank-statement-to-excel", supabase);

      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      setProgress(((i + 1) / items.length) * 100);

      if (outcome.ok) {
        if (!session) incrementGuestUsage();
        paidSeen = outcome.source === "plan" || outcome.source === "credits";
        results.push({ name: items[i]!.file.name, grid: outcome.grid });
        setBatch((prev) =>
          prev.map((b, j) => (j === i ? { ...b, status: "done" as FileStatus, rows: outcome.grid.length } : b))
        );
      } else if (outcome.status === 402 || outcome.status === 413 || outcome.status === 401) {
        setQuotaModalVariant(reasonToVariant(outcome.reason));
        setShowQuotaModal(true);
        hitPaywall = true;
        setBatch((prev) =>
          prev.map((b, j) => (j === i ? { ...b, status: "error" as FileStatus, error: outcome.error } : b))
        );
        break;
      } else {
        setBatch((prev) =>
          prev.map((b, j) => (j === i ? { ...b, status: "error" as FileStatus, error: outcome.error } : b))
        );
      }
    }

    setIsPaidExtract(paidSeen);
    setBatchResults(results);
    if (results.length > 0) {
      setExtractionResult(results[0]!.grid);
      setExtractedFileName(
        results.length > 1 ? `${results.length} statements` : results[0]!.name
      );
    } else if (!hitPaywall) {
      setExtractError("Extraction failed. Please check the files and try again.");
    }
    setTimeout(() => setProgress(-1), 500);
    setIsExtracting(false);
  }, [batch, isExtracting, supabase]);

  const handleExportExcel = useCallback(() => {
    if (batchResults.length === 0) return;
    const wb = XLSX.utils.book_new();
    const used = new Set<string>();
    batchResults.forEach((r, i) => {
      const exportRows = isPaidExtract ? r.grid : [...r.grid, [], [WATERMARK_TEXT]];
      const ws = XLSX.utils.aoa_to_sheet(exportRows);
      applyStylesAndAutoFit(ws, r.grid);
      if (!isPaidExtract) {
        const ref = "A" + exportRows.length;
        if (ws[ref]) ws[ref].s = { font: { italic: true, color: { rgb: "999999" } } };
      }
      XLSX.utils.book_append_sheet(wb, ws, sheetNameFor(r.name, i, used));
    });
    XLSX.writeFile(wb, batchResults.length > 1 ? "bank-statements.xlsx" : "extracted-data.xlsx");
  }, [batchResults, isPaidExtract]);

  const handleExportQuickBooks = useCallback(() => {
    if (batchResults.length === 0) return;
    if (!isPaidExtract) {
      setQuotaModalVariant("pro_feature");
      setShowQuotaModal(true);
      return;
    }
    const allRows = batchResults.flatMap((r) => gridToQuickBooksRows(r.grid));
    if (allRows.length === 0) {
      setToastMessage("No transaction rows (date + amount) were detected in these documents.");
      return;
    }
    const blob = new Blob([quickBooksCsv(allRows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "quickbooks-import.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [batchResults, isPaidExtract]);

  const colCount = getColumnCount(extractionResult);
  const headers = Array.from({ length: colCount }, (_, i) => `Column ${i + 1}`);
  const showProgress = progress >= 0 && isExtracting;
  const showResult = batchResults.length > 0 && !isExtracting;
  const isBatch = batch.length > 1;

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main>
        {/* Narrow container: the tool itself only — SEO sections below get full width */}
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          AI Bank Statement to Excel Converter
        </h1>
        <p className="mt-2 text-slate-600">
          Instantly extract tables and transactions from scanned bank statements into clean, ready-to-import CSV/Excel files for seamless reconciliation.
        </p>

        <input
          id="bank-statement-file-input"
          type="file"
          accept={ACCEPT}
          multiple
          onChange={handleFileChange}
          className="sr-only"
          aria-label="Upload PDFs or images (bank statements)"
        />
        <div
          onClick={handleZoneClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`mt-6 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
            isDragging ? "border-blue-500 bg-blue-50/50" : "border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50/50"
          }`}
        >
          <FileUp className="h-10 w-10 text-slate-400" />
          <span className="mt-3 font-medium text-slate-700">
            {batch.length === 0
              ? "Drop files here or click to browse"
              : batch.length === 1
                ? batch[0]!.file.name
                : `${batch.length} statements selected`}
          </span>
          <span className="mt-1 text-sm text-slate-500">
            PDF and images — 5MB free, up to 25MB &amp; batch on paid plans
          </span>
        </div>

        {batch.length > 0 && (
          <div className="mt-4 space-y-1.5">
            {batch.map((item, i) => (
              <div
                key={`${item.file.name}-${i}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm"
              >
                <span className="truncate text-slate-700">{item.file.name}</span>
                <span className="shrink-0 text-xs font-medium">
                  {item.status === "pending" && <span className="text-slate-400">queued</span>}
                  {item.status === "processing" && <span className="text-blue-600">extracting…</span>}
                  {item.status === "done" && <span className="text-emerald-600">✓ {item.rows} rows</span>}
                  {item.status === "error" && <span className="text-red-600">failed</span>}
                </span>
              </div>
            ))}
            {!isExtracting && (
              <button
                type="button"
                onClick={() => { setBatch([]); setBatchResults([]); setExtractionResult([]); }}
                className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
              >
                Clear files
              </button>
            )}
          </div>
        )}
        <p className="mt-3 text-center text-xs font-medium text-slate-500">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100/80 px-2.5 py-1 text-slate-600 shadow-sm">
            ✨ Powered by Anthropic Claude AI Vision
          </span>
        </p>

        <div className="mt-6">
          <button
            type="button"
            onClick={handleExtract}
            disabled={batch.length === 0 || isExtracting}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isExtracting
              ? "Extracting…"
              : isBatch
                ? `Extract ${batch.length} Statements`
                : "Extract"}
          </button>
        </div>

        {showProgress && (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-label="Extraction progress">
            <div className="flex items-center gap-4">
              <Loader2 className="h-8 w-8 shrink-0 animate-spin text-blue-600" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-900">Extracting your bank statement</p>
                <p className="text-sm text-slate-500">Using Claude to preserve layout…</p>
                <div className="mt-3" role="status" aria-live="polite" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
                  <progress
                    max={100}
                    value={progress}
                    className="h-2 w-full overflow-hidden rounded-full bg-slate-200 [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-blue-600 [&::-moz-progress-bar]:bg-blue-600"
                  />
                  <p className="mt-1 text-sm font-medium text-slate-600">{Math.round(progress)}%</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {extractError && !isExtracting && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800" role="alert">
            <p className="font-medium">Extraction failed</p>
            <p className="mt-1 text-sm">{extractError}</p>
          </div>
        )}

        {showResult && (
          <>
            <section className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby="extracted-table-heading">
              <h2 id="extracted-table-heading" className="sr-only">Table of Content</h2>
              <button
                type="button"
                onClick={() => setTableExpanded((e) => !e)}
                className="flex w-full items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 text-left sm:px-6 hover:bg-slate-50"
                aria-expanded={tableExpanded}
              >
                <span className="flex items-center gap-2 font-medium text-slate-900">
                  {tableExpanded ? (
                    <ChevronDown className="h-5 w-5 text-slate-500" aria-hidden />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-slate-500" aria-hidden />
                  )}
                  <TableIcon className="h-5 w-5 text-slate-500" />
                  Extracted Data – {extractedFileName || "Document"}
                </span>
              </button>
              {tableExpanded && (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {headers.map((key) => (
                          <TableHead key={key} className="whitespace-nowrap bg-slate-50 font-medium text-slate-600">
                            {key}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {extractionResult.map((row, index) => (
                        <TableRow key={index} className="transition-colors hover:bg-slate-50/50">
                          {headers.map((_, j) => (
                            <TableCell key={j} className="whitespace-nowrap">
                              {formatCell(row[j])}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={handleExportExcel}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
              >
                <FileDown className="h-5 w-5" />
                Download your Excel
              </button>
              <button
                type="button"
                onClick={handleExportQuickBooks}
                className="inline-flex items-center gap-2 rounded-xl border border-[#217346] bg-white px-5 py-3 font-semibold text-[#217346] shadow-sm transition-colors hover:bg-emerald-50"
              >
                <FileDown className="h-5 w-5" />
                Export for QuickBooks
                {!isPaidExtract && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    Pro
                  </span>
                )}
              </button>
              <button
                type="button"
                disabled
                className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-5 py-3 font-semibold text-slate-400"
                aria-disabled="true"
              >
                Download your Google Sheet
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-500">
                  
                </span>
              </button>
            </div>

          </>
        )}

        {toastMessage && (
          <div className="fixed right-4 top-4 z-50 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-lg" role="alert">
            {toastMessage}
          </div>
        )}
        </div>

        {/* SEO content */}
        <div className="mx-auto max-w-4xl mt-20 space-y-16 px-4 pb-20 sm:px-6 lg:px-8">
          <section aria-labelledby="how-to-heading">
            <h2 id="how-to-heading" className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              How to Convert Bank Statements to Excel with AI
            </h2>
            <div className="mt-8 grid gap-8 sm:grid-cols-3">
              <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Upload className="h-6 w-6" />
                </div>
                <p className="mt-4 font-mono text-sm font-medium text-blue-600">Step 1</p>
                <h3 className="mt-1 font-semibold text-slate-900">Upload Your Statement</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Drag and drop your PDF or scanned bank statement (under 5MB), or click to browse. We accept statements from any bank.
                </p>
              </div>
              <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Sparkles className="h-6 w-6" />
                </div>
                <p className="mt-4 font-mono text-sm font-medium text-blue-600">Step 2</p>
                <h3 className="mt-1 font-semibold text-slate-900">AI Extracts Transactions</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Our AI identifies dates, amounts, descriptions, and running balances—preserving the table layout for clean reconciliation.
                </p>
              </div>
              <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <FileDown className="h-6 w-6" />
                </div>
                <p className="mt-4 font-mono text-sm font-medium text-blue-600">Step 3</p>
                <h3 className="mt-1 font-semibold text-slate-900">Download for Xero or QuickBooks</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Get your Excel or CSV file with styled columns. Ready to import into your accounting software—no sign-up required.
                </p>
              </div>
            </div>
          </section>

          <section className="prose prose-slate max-w-4xl mx-auto py-12 px-4" aria-labelledby="why-ai-heading">
            <h2 id="why-ai-heading" className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Why Use AI for Bank Statement Extraction?
            </h2>
            <p className="mt-6 text-slate-600">
              Traditional OCR treats your statement as plain text, which often breaks transaction tables, misaligns dates and amounts, and loses running balances—making reconciliation tedious. Our converter uses Anthropic&apos;s Claude to understand the document as a visual grid: it recognizes transaction rows, column headers, and sections the way a bookkeeper would, so your Excel output matches the original statement layout and is ready for Xero, QuickBooks, or any accounting workflow.
            </p>
            <p className="mt-4 text-slate-600">
              Speed and accuracy are critical when you&apos;re closing books or matching bank feeds. AI-based extraction processes statements in seconds and preserves numeric precision and date formats, so you spend less time fixing misread amounts or realigning columns. Whether your source is a downloaded PDF or a scanned statement, you get consistent, reconciliation-ready output. No re-upload or manual tweaks—the same pipeline works across different banks and statement formats.
            </p>
            <p className="mt-4 text-slate-600">
              We keep your data private. Files are processed in memory and discarded after extraction, so your bank statements never linger on our servers. That bank-level privacy, combined with layout preservation and export to Excel or CSV, makes this tool a trusted choice for accountants and finance teams who need reliable statement-to-spreadsheet conversion without manual data entry.
            </p>
          </section>

          <section aria-labelledby="why-choose-heading" className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 id="why-choose-heading" className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Why Choose Our Bank Statement to Excel Converter?
              </h2>
              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="flex flex-col p-6 bg-white rounded-xl shadow-sm border border-slate-200">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <LayoutGrid className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3 mt-4">Extract Running Balances</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Our AI captures transaction tables with dates, amounts, descriptions, and running balances—exactly as they appear on your statement—so reconciliation is straightforward.
                </p>
              </div>
              <div className="flex flex-col p-6 bg-white rounded-xl shadow-sm border border-slate-200">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Sparkles className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3 mt-4">Identify Dates and Amounts</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Claude identifies dates and amounts with high accuracy, even in scanned or multi-column statements, so you get clean data for matching and reporting.
                </p>
              </div>
              <div className="flex flex-col p-6 bg-white rounded-xl shadow-sm border border-slate-200">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <FileDown className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3 mt-4">Export to Xero/QuickBooks Format</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Download Excel or CSV with columns ready for import into Xero, QuickBooks, or your preferred accounting software. No manual reformatting—just upload and reconcile.
                </p>
              </div>
              <div className="flex flex-col p-6 bg-white rounded-xl shadow-sm border border-slate-200">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Shield className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3 mt-4">Bank-Level Privacy</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Your statements are processed securely and never stored. Data is handled in memory and discarded after the request—so your financial data stays private.
                </p>
              </div>
            </div>
            </div>
          </section>

          {/* How to Convert Bank Statements to Excel - SEO-rich step-by-step */}
          <section className="max-w-4xl mx-auto py-12 px-4 sm:px-6" aria-labelledby="how-it-works-heading">
            <h2 id="how-it-works-heading" className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              How to Convert Bank Statements to Excel (Step-by-Step)
            </h2>
            <div className="mt-8 space-y-10">
              <div className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white" aria-hidden>1</span>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">Step 1: Upload Your Statement Securely.</h3>
                  <p className="text-slate-600 leading-relaxed">
                    Drag and drop your scanned PDF bank statements. Our system uses bank-level encryption, ensuring your financial documents remain completely private and are never stored on our servers.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white" aria-hidden>2</span>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">Step 2: AI Data Extraction.</h3>
                  <p className="text-slate-600 leading-relaxed">
                    Unlike outdated OCR tools that mess up columns, our advanced AI reads the context of the document. It accurately identifies dates, transaction descriptions, withdrawals, deposits, and running balances, even on multi-page or heavily formatted statements.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white" aria-hidden>3</span>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">Step 3: Download and Reconcile.</h3>
                  <p className="text-slate-600 leading-relaxed">
                    Instantly download a perfectly formatted Excel (.xlsx) or CSV file. The clean data structure is ready to be directly imported into Xero, QuickBooks, Wave, or your custom accounting spreadsheet.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* FAQ - SEO-rich, fully visible for crawlers */}
          <section className="max-w-4xl mx-auto py-12 px-4 sm:px-6" aria-labelledby="faq-converter-heading">
            <h2 id="faq-converter-heading" className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Frequently Asked Questions
            </h2>
            <div className="mt-8 space-y-8">
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 mb-3">Is my financial data secure?</h3>
                <p className="text-slate-600 leading-relaxed">
                  Absolutely. We understand that bank statements contain highly sensitive information. Your files are processed in-memory and instantly deleted from our servers the moment the conversion is complete. We do not store, train on, or look at your documents.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 mb-3">Can it handle multi-page PDFs?</h3>
                <p className="text-slate-600 leading-relaxed">
                  Yes! Our AI engine can process lengthy, multi-page statements from any major bank seamlessly.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 mb-3">Does it work with scanned or low-quality PDFs?</h3>
                <p className="text-slate-600 leading-relaxed">
                  Yes, our AI-driven extraction is highly resilient and can read scanned documents, photos of statements, and documents with complex watermarks much better than traditional OCR.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 mb-3">Which accounting software is this compatible with?</h3>
                <p className="text-slate-600 leading-relaxed">
                  The output is a standard Excel or CSV file. You can easily map the columns to import the data into QuickBooks Online, Xero, Sage, Wave, and most major ERP systems.
                </p>
              </div>
            </div>
          </section>

          {/* Bank-specific landing page links — Layer 4 internal-link equity */}
          <section aria-labelledby="banks-heading" className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Building2 className="h-5 w-5" />
              </div>
              <h2 id="banks-heading" className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Specific bank guides
              </h2>
            </div>
            <p className="mt-3 text-slate-600">
              Step-by-step instructions for downloading and converting statements from major banks. The converter above works with any bank — these pages cover the specifics.
            </p>
            <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {BANK_ENTITIES.map((b) => (
                <li key={b.slug}>
                  <Link
                    href={`/tools/bank/${b.slug}`}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 transition-colors hover:border-blue-300 hover:bg-blue-50/50"
                  >
                    <span>
                      <span className="font-semibold text-slate-900">{b.name}</span>
                      <span className="ml-2 text-xs text-slate-500">{b.country}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 text-slate-400" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="use-cases-heading">
            <h2 id="use-cases-heading" className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              What We Extract from Bank Statements
            </h2>
            <p className="mt-4 text-slate-600">
              Our bank statement converter is built for bookkeepers and accountants. We extract:
            </p>
            <ul className="mt-6 list-inside list-disc space-y-2 text-slate-600 sm:list-outside sm:pl-6">
              <li><strong className="text-slate-900">Transaction dates and amounts</strong> — ready for matching and reconciliation</li>
              <li><strong className="text-slate-900">Descriptions and references</strong> — payees, memos, and check numbers</li>
              <li><strong className="text-slate-900">Running balances</strong> — so your Excel matches the statement layout</li>
              <li><strong className="text-slate-900">Multi-account summaries</strong> — when your statement has several sections or accounts</li>
            </ul>
          </section>

          <section aria-labelledby="faq-heading">
            <h2 id="faq-heading" className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Frequently Asked Questions
            </h2>
            <div className="mt-8 space-y-2">
              <details className="group rounded-xl border border-slate-200 bg-white px-5 shadow-sm">
                <summary className="cursor-pointer list-none py-4 font-semibold text-slate-900 marker:contents [&::-webkit-details-marker]:hidden">
                  Is my bank statement data safe?
                </summary>
                <p className="pb-4 text-slate-600">
                  Yes. We do not store your documents. Statements are processed in memory and deleted immediately after extraction. Your PDFs and the extracted data are never retained on our servers, so your bank details stay private—ideal for accountants and finance teams.
                </p>
              </details>
              <details className="group rounded-xl border border-slate-200 bg-white px-5 shadow-sm">
                <summary className="cursor-pointer list-none py-4 font-semibold text-slate-900 marker:contents [&::-webkit-details-marker]:hidden">
                  Can I use this for Xero or QuickBooks reconciliation?
                </summary>
                <p className="pb-4 text-slate-600">
                  Yes. The tool outputs Excel and CSV with dates, amounts, and descriptions in columns that you can map to your accounting software. Many users import the file into Xero or QuickBooks for bank reconciliation without manual data entry.
                </p>
              </details>
              <details className="group rounded-xl border border-slate-200 bg-white px-5 shadow-sm">
                <summary className="cursor-pointer list-none py-4 font-semibold text-slate-900 marker:contents [&::-webkit-details-marker]:hidden">
                  Does it work with scanned bank statements?
                </summary>
                <p className="pb-4 text-slate-600">
                  Yes. Our AI handles both digital PDFs and scanned or photographed statements. It recognizes tables, dates, and amounts from the visual layout, so you get accurate extraction even from image-based statements.
                </p>
              </details>
              <details className="group rounded-xl border border-slate-200 bg-white px-5 shadow-sm">
                <summary className="cursor-pointer list-none py-4 font-semibold text-slate-900 marker:contents [&::-webkit-details-marker]:hidden">
                  What is the maximum file size?
                </summary>
                <p className="pb-4 text-slate-600">
                  5MB per file for fast, reliable processing. For longer statements, consider splitting the PDF or compressing scans before upload.
                </p>
              </details>
              <details className="group rounded-xl border border-slate-200 bg-white px-5 shadow-sm">
                <summary className="cursor-pointer list-none py-4 font-semibold text-slate-900 marker:contents [&::-webkit-details-marker]:hidden">
                  What AI model do you use?
                </summary>
                <p className="pb-4 text-slate-600">
                  We use Anthropic&apos;s Claude model for layout-aware extraction. It analyzes your statement as a visual structure, so transaction tables, dates, amounts, and running balances are captured with high fidelity—whether the source is a PDF or a scanned image.
                </p>
              </details>
            </div>
          </section>

        </div>
      </main>
      <QuotaLimitModal open={showQuotaModal} onClose={() => setShowQuotaModal(false)} variant={quotaModalVariant} />
    </div>
  );
}
