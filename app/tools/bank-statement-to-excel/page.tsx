"use client";

import { useCallback, useState, useEffect, useRef, useMemo } from "react";
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
} from "lucide-react";
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

const ACCEPT = ".pdf,image/*";
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
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

  const setFileWithValidation = useCallback((file: File | null) => {
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (!isValidFileType(file)) {
      setToastMessage("Please upload a PDF or image only.");
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setToastMessage("File too large. Please upload a PDF under 5MB for faster processing.");
      return;
    }
    setSelectedFile(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      setFileWithValidation(file ?? null);
    },
    [setFileWithValidation]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      setFileWithValidation(file ?? null);
      e.target.value = "";
    },
    [setFileWithValidation]
  );

  const handleZoneClick = useCallback(() => {
    document.getElementById("bank-statement-file-input")?.click();
  }, []);

  const handleExtract = useCallback(async () => {
    if (!selectedFile) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      if (!canGuestConvert()) {
        setQuotaModalVariant("guest");
        setShowQuotaModal(true);
        return;
      }
    } else {
      const credRes = await fetch("/api/credits");
      if (!credRes.ok) {
        setQuotaModalVariant("out_of_credits");
        setShowQuotaModal(true);
        return;
      }
      const { credits } = await credRes.json();
      if (credits <= 0) {
        setQuotaModalVariant("out_of_credits");
        setShowQuotaModal(true);
        return;
      }
    }

    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", "click_convert", { target_format: "excel" });
    }
    setExtractError(null);
    setExtractionResult([]);
    setExtractedFileName("");
    setTableExpanded(false);
    setIsExtracting(true);
    setProgress(0);
    const nameForResult = selectedFile.name;

    const startTime = Date.now();
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      if (elapsed >= PROGRESS_DURATION_MS) {
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        setProgress((p) => (p < 90 ? 90 : p));
        return;
      }
      setProgress((p) => Math.min(90, (elapsed / PROGRESS_DURATION_MS) * 90));
    }, PROGRESS_TICK_MS);

    const formData = new FormData();
    formData.append("file", selectedFile);

    fetch("/api/extract", { method: "POST", body: formData })
      .then(async (res) => {
        const json = await res.json();
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        setProgress(100);

        if (res.ok && Array.isArray(json.data) && json.data.every((r: unknown) => Array.isArray(r))) {
          if (session) {
            await fetch("/api/credits", { method: "POST" });
          } else {
            incrementGuestUsage();
          }
          setExtractionResult(json.data as GridData);
          setExtractedFileName(nameForResult);
        } else {
          setExtractError(json?.error ?? "Extraction failed.");
        }
        setTimeout(() => setProgress(-1), 500);
      })
      .catch((err) => {
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        setProgress(-1);
        setExtractError(err instanceof Error ? err.message : "Network error.");
      })
      .finally(() => {
        setIsExtracting(false);
      });
  }, [selectedFile, supabase]);

  const handleExportExcel = useCallback(() => {
    if (extractionResult.length === 0) return;
    const ws = XLSX.utils.aoa_to_sheet(extractionResult);
    applyStylesAndAutoFit(ws, extractionResult);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, "extracted-data.xlsx");
  }, [extractionResult]);

  const colCount = getColumnCount(extractionResult);
  const headers = Array.from({ length: colCount }, (_, i) => `Column ${i + 1}`);
  const showProgress = progress >= 0 && isExtracting;
  const showResult = extractionResult.length > 0 && !isExtracting;

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
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
          onChange={handleFileChange}
          className="sr-only"
          aria-label="Upload PDF or image (bank statement)"
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
            {selectedFile ? selectedFile.name : "Drop a file here or click to browse"}
          </span>
          <span className="mt-1 text-sm text-slate-500">PDF and images under 5MB</span>
        </div>
        <p className="mt-3 text-center text-xs font-medium text-slate-500">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100/80 px-2.5 py-1 text-slate-600 shadow-sm">
            ✨ Powered by Google Gemini AI Vision
          </span>
        </p>

        <div className="mt-6">
          <button
            type="button"
            onClick={handleExtract}
            disabled={!selectedFile || isExtracting}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isExtracting ? "Extracting…" : "Extract"}
          </button>
        </div>

        {showProgress && (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-label="Extraction progress">
            <div className="flex items-center gap-4">
              <Loader2 className="h-8 w-8 shrink-0 animate-spin text-blue-600" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-900">Extracting your bank statement</p>
                <p className="text-sm text-slate-500">Using Gemini to preserve layout…</p>
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
                Extract to Excel
              </button>
              <button
                type="button"
                disabled
                className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-5 py-3 font-semibold text-slate-400"
                aria-disabled="true"
              >
                Extract to Google Sheet
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
              Traditional OCR treats your statement as plain text, which often breaks transaction tables, misaligns dates and amounts, and loses running balances—making reconciliation tedious. Our converter uses Google&apos;s Gemini to understand the document as a visual grid: it recognizes transaction rows, column headers, and sections the way a bookkeeper would, so your Excel output matches the original statement layout and is ready for Xero, QuickBooks, or any accounting workflow.
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
                  Gemini identifies dates and amounts with high accuracy, even in scanned or multi-column statements, so you get clean data for matching and reporting.
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
                  We use Google&apos;s Gemini model for layout-aware extraction. It analyzes your statement as a visual structure, so transaction tables, dates, amounts, and running balances are captured with high fidelity—whether the source is a PDF or a scanned image.
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
