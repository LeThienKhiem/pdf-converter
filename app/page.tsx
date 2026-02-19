"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  FileSpreadsheet,
  Shield,
  Upload,
  FileDown,
  Sparkles,
  ArrowRight,
  FileUp,
  Loader2,
  TableIcon,
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

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState(-1);
  const [extractionResult, setExtractionResult] = useState<GridData>([]);
  const [extractError, setExtractError] = useState<string | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    document.getElementById("home-file-input")?.click();
  }, []);

  const handleExtract = useCallback(() => {
    if (!selectedFile) return;
    setExtractError(null);
    setExtractionResult([]);
    setIsExtracting(true);
    setProgress(0);

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
          setExtractionResult(json.data as GridData);
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
  }, [selectedFile]);

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
      <header className="border-b border-slate-200/80 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2 font-semibold text-slate-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
              <FileSpreadsheet className="h-4 w-4" />
            </span>
            InvoiceToData
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="#features" className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900">
              Features
            </Link>
            <Link href="/how-it-works" className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900">
              How it works
            </Link>
            <Link href="/login" className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900">
              Log in
            </Link>
            <Link href="/signup" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700">
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero + Upload */}
        <section className="relative overflow-hidden border-b border-slate-200/80 bg-gradient-to-b from-slate-50 to-white px-4 py-12 sm:px-6 sm:py-16 lg:px-8" aria-labelledby="extract-heading">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(37,99,235,0.12),transparent)]" />
          <div className="mx-auto max-w-2xl">
            <h1 id="extract-heading" className="text-center text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Free AI-Powered PDF to Excel Converter
            </h1>
            <h2 className="sr-only">Extract Data from Any Document</h2>
            <p className="mt-3 text-center text-slate-600">
              Upload a PDF or image. We preserve the exact layout and give you a downloadable Excel file.
            </p>

            <input
              id="home-file-input"
              type="file"
              accept={ACCEPT}
              onChange={handleFileChange}
              className="sr-only"
              aria-label="Upload PDF or image"
            />
            <div
              onClick={handleZoneClick}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`mt-8 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
                isDragging ? "border-blue-500 bg-blue-50/50" : "border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50/50"
              }`}
            >
              <FileUp className="h-10 w-10 text-slate-400" />
              <span className="mt-3 font-medium text-slate-700">
                {selectedFile ? selectedFile.name : "Drop a file here or click to browse"}
              </span>
              <span className="mt-1 text-sm text-slate-500">PDF and images under 5MB</span>
            </div>

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

            {/* Progress bar (0–100%) right below upload zone */}
            {showProgress && (
              <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-label="Extraction progress">
                <div className="flex items-center gap-4">
                  <Loader2 className="h-8 w-8 shrink-0 animate-spin text-blue-600" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">Extracting your document</p>
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
                <div className="mt-6 flex justify-center rounded-lg border border-slate-200 bg-slate-50 py-8 text-center text-sm text-slate-500">
                  Ad placeholder (loading)
                </div>
              </section>
            )}

            {extractError && !isExtracting && (
              <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800" role="alert">
                <p className="font-medium">Extraction failed</p>
                <p className="mt-1 text-sm">{extractError}</p>
              </div>
            )}

            {/* Post-extraction: Table of Content + buttons + ad */}
            {showResult && (
              <>
                <section className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby="extracted-table-heading">
                  <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 sm:px-6">
                    <TableIcon className="h-5 w-5 text-slate-500" />
                    <h2 id="extracted-table-heading" className="text-lg font-semibold text-slate-900">Table of Content</h2>
                  </div>
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
                      Coming Soon
                    </span>
                  </button>
                </div>

                <div className="mt-8 flex justify-center rounded-lg border border-slate-200 bg-slate-50 py-8 text-center text-sm text-slate-500">
                  Ad placeholder (after download)
                </div>
              </>
            )}

            {toastMessage && (
              <div className="fixed right-4 top-4 z-50 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-lg" role="alert">
                {toastMessage}
              </div>
            )}
            {/* FAQ */}
            <section className="mt-12 border-t border-slate-200 pt-10" aria-labelledby="faq-heading">
              <h2 id="faq-heading" className="text-center text-xl font-bold text-slate-900 sm:text-2xl">
                Frequently Asked Questions
              </h2>
              <div className="mt-6 space-y-2">
                <details className="group rounded-lg border border-slate-200 bg-white px-4">
                  <summary className="cursor-pointer list-none py-3 font-medium text-slate-900 marker:contents [&::-webkit-details-marker]:hidden">
                    What file types are supported?
                  </summary>
                  <p className="pb-3 text-slate-600">
                    We accept PDF files and images (JPEG, PNG, WebP, GIF). Files must be under 5MB for fast processing.
                  </p>
                </details>
                <details className="group rounded-lg border border-slate-200 bg-white px-4">
                  <summary className="cursor-pointer list-none py-3 font-medium text-slate-900 marker:contents [&::-webkit-details-marker]:hidden">
                    Is the PDF to Excel converter free?
                  </summary>
                  <p className="pb-3 text-slate-600">
                    Yes. You can upload documents and download Excel output at no cost. No sign-up required for basic use.
                  </p>
                </details>
                <details className="group rounded-lg border border-slate-200 bg-white px-4">
                  <summary className="cursor-pointer list-none py-3 font-medium text-slate-900 marker:contents [&::-webkit-details-marker]:hidden">
                    How accurate is the extraction?
                  </summary>
                  <p className="pb-3 text-slate-600">
                    We use Gemini 1.5 Robotics-ER for layout-aware extraction, so rows and columns from your PDF are preserved in the Excel output. Tables, forms, and invoices are converted with high fidelity.
                  </p>
                </details>
                <details className="group rounded-lg border border-slate-200 bg-white px-4">
                  <summary className="cursor-pointer list-none py-3 font-medium text-slate-900 marker:contents [&::-webkit-details-marker]:hidden">
                    Do you store my documents?
                  </summary>
                  <p className="pb-3 text-slate-600">
                    We process files in memory and do not store your PDFs or extracted data after the request completes. Your documents stay private.
                  </p>
                </details>
              </div>
            </section>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-b border-slate-200/80 bg-white px-4 py-16 sm:px-6 sm:py-20 lg:px-8" aria-labelledby="features-heading">
          <div className="mx-auto max-w-6xl">
            <div className="text-center">
              <h2 id="features-heading" className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Why Choose Our AI Converter?</h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
                Accurate extraction, secure processing, and one-click export to your workflow.
              </p>
            </div>
            <div className="mt-10 rounded-xl border border-blue-100 bg-blue-50/50 p-6 text-center">
              <h3 className="text-lg font-semibold text-slate-900">Layout-Aware Extraction with Gemini 1.5 Robotics-ER</h3>
              <p className="mt-2 text-slate-600">
                We use Google&apos;s Gemini 1.5 Robotics-ER model to analyze your document as a visual grid. Every row and column from your PDF, invoice, or form is preserved in the Excel output—no merging or guessing. Section headers (Part I, Section A, Invoice lines) are detected and styled with bold and light grey background for clarity.
              </p>
            </div>
            <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              <div className="group relative rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">High Accuracy</h3>
                <p className="mt-2 text-slate-600">
                  AI-powered extraction reads line items, totals, and vendor details with high accuracy—even from scanned or messy PDFs.
                </p>
              </div>
              <div className="group relative rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Shield className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">Secure Processing</h3>
                <p className="mt-2 text-slate-600">
                  Your invoices are processed securely. We don't store sensitive data longer than needed and comply with data privacy standards.
                </p>
              </div>
              <div className="group relative rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <FileSpreadsheet className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">Export to Excel</h3>
                <p className="mt-2 text-slate-600">
                  Download structured data as Excel. Layout and headers are preserved with styling and auto-fit columns.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="border-b border-slate-200/80 bg-slate-50/50 px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">How it works</h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">Three simple steps from PDF to spreadsheet.</p>
            </div>
            <div className="mt-14 grid gap-10 sm:grid-cols-3">
              <div className="relative flex flex-col items-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-blue-600 bg-white text-blue-600">
                  <Upload className="h-7 w-7" />
                </div>
                <div className="mt-4 font-mono text-sm font-medium text-blue-600">Step 1</div>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">Upload</h3>
                <p className="mt-2 text-slate-600">Drag and drop your PDF or image (under 5MB).</p>
                <div className="absolute -right-5 top-7 hidden text-slate-300 sm:block lg:right-0">
                  <ArrowRight className="h-6 w-6" />
                </div>
              </div>
              <div className="relative flex flex-col items-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-blue-600 bg-white text-blue-600">
                  <Sparkles className="h-7 w-7" />
                </div>
                <div className="mt-4 font-mono text-sm font-medium text-blue-600">Step 2</div>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">Extract</h3>
                <p className="mt-2 text-slate-600">AI converts the layout to a table (row/column preserved).</p>
                <div className="absolute -right-5 top-7 hidden text-slate-300 sm:block lg:right-0">
                  <ArrowRight className="h-6 w-6" />
                </div>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-blue-600 bg-white text-blue-600">
                  <FileDown className="h-7 w-7" />
                </div>
                <div className="mt-4 font-mono text-sm font-medium text-blue-600">Step 3</div>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">Download</h3>
                <p className="mt-2 text-slate-600">Get your Excel file with styled headers and auto-fit columns.</p>
              </div>
            </div>
            <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/how-it-works"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3.5 text-base font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                How it works
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-blue-700"
              >
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-blue-600 px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Ready to automate your invoice data?</h2>
            <p className="mt-4 text-lg text-blue-100">Join teams that save hours every week with InvoiceToData.</p>
            <Link
              href="/signup"
              className="mt-8 inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3.5 text-base font-semibold text-blue-600 transition-colors hover:bg-blue-50"
            >
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-slate-500">© {new Date().getFullYear()} InvoiceToData.com. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="text-sm text-slate-500 hover:text-slate-700">Privacy</Link>
            <Link href="/terms" className="text-sm text-slate-500 hover:text-slate-700">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
