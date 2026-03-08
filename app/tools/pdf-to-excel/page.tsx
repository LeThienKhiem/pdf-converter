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

export default function PdfToExcelPage() {
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
    document.getElementById("pdf-to-excel-file-input")?.click();
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
          Extract Data from PDF Invoice to Excel
        </h1>
        <p className="mt-2 text-slate-600">
          Upload a PDF or image to extract data from PDF invoice to Excel or Google Sheets. We preserve the exact layout and give you a downloadable Excel file.
        </p>

        <input
          id="pdf-to-excel-file-input"
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
              How to Convert PDF to Excel with AI
            </h2>
            <div className="mt-8 grid gap-8 sm:grid-cols-3">
              <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Upload className="h-6 w-6" />
                </div>
                <p className="mt-4 font-mono text-sm font-medium text-blue-600">Step 1</p>
                <h3 className="mt-1 font-semibold text-slate-900">Upload Document</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Drag and drop your PDF or image (under 5MB), or click to browse. We accept invoices, forms, and scanned documents.
                </p>
              </div>
              <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Sparkles className="h-6 w-6" />
                </div>
                <p className="mt-4 font-mono text-sm font-medium text-blue-600">Step 2</p>
                <h3 className="mt-1 font-semibold text-slate-900">AI Analyzes Layout</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Our AI maps the visual structure of your document and converts it into rows and columns—preserving tables and sections.
                </p>
              </div>
              <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <FileDown className="h-6 w-6" />
                </div>
                <p className="mt-4 font-mono text-sm font-medium text-blue-600">Step 3</p>
                <h3 className="mt-1 font-semibold text-slate-900">Download Spreadsheet</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Get your Excel file with styled headers and auto-fit columns. No sign-up required.
                </p>
              </div>
            </div>
          </section>

          <section className="prose prose-slate max-w-4xl mx-auto py-12 px-4" aria-labelledby="why-ai-heading">
            <h2 id="why-ai-heading" className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Why Choose Our AI?
            </h2>
            <p className="mt-6 text-slate-600">
              Traditional OCR tools treat your PDF as a flat stream of text, which often breaks table layout, merges cells incorrectly, and loses the visual structure that makes your data meaningful. Our converter uses Google&apos;s Gemini model to understand the document as a visual grid: it recognizes rows, columns, headers, and sections the way a human would, so your Excel output matches the original layout. This approach preserves merged cells, indentation, and multi-level headings that generic OCR simply cannot handle.
            </p>
            <p className="mt-4 text-slate-600">
              Speed is another key advantage. AI-based extraction processes pages in seconds instead of requiring manual correction of misaligned columns or misread numbers. Gemini is optimized for both native digital PDFs and scanned images, so whether your source is a generated report or a photographed form, you get fast, consistent results. There&apos;s no need to re-upload or tweak settings for different document types—the same pipeline delivers high-quality output across invoices, tax forms, and statement tables.
            </p>
            <p className="mt-4 text-slate-600">
              Accuracy matters especially when the data feeds into finance, auditing, or compliance workflows. Our AI is trained to preserve numeric precision, date formats, and text exactly as they appear in the source. Combined with layout retention and speed, this makes the tool suitable for professionals who need reliable PDF-to-Excel conversion without manual cleanup. You get a spreadsheet that mirrors your document, ready for analysis or import into your existing systems.
            </p>
          </section>

          <section aria-labelledby="why-choose-heading">
            <h2 id="why-choose-heading" className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Why Choose Our PDF to Excel Converter?
            </h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-1 lg:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <LayoutGrid className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold text-slate-900">Exact Layout Preservation</h3>
                <p className="mt-2 text-slate-600">
                  Unlike standard OCR, our AI understands visual structures, keeping your rows and columns exactly as they appear in the original PDF.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Sparkles className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold text-slate-900">Powered by Advanced AI</h3>
                <p className="mt-2 text-slate-600">
                  Gemini Robotics-ER drives complex spatial reasoning, so multi-section forms, tables, and invoices are converted with high fidelity.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Shield className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold text-slate-900">Secure & Private</h3>
                <p className="mt-2 text-slate-600">
                  Your files are processed securely and never stored on our servers. Data is handled in memory and discarded after the request completes.
                </p>
              </div>
            </div>
          </section>

          <section aria-labelledby="use-cases-heading">
            <h2 id="use-cases-heading" className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              What can you extract?
            </h2>
            <p className="mt-4 text-slate-600">
              Our PDF to Excel tool works with a wide range of documents. Extract data from:
            </p>
            <ul className="mt-6 list-inside list-disc space-y-2 text-slate-600 sm:list-outside sm:pl-6">
              <li><strong className="text-slate-900">Invoices</strong> — line items, totals, vendor details, and due dates</li>
              <li><strong className="text-slate-900">Receipts</strong> — purchase details and amounts</li>
              <li><strong className="text-slate-900">Bank Statements</strong> — transactions and balances</li>
              <li><strong className="text-slate-900">Tax Forms</strong> — including complex IRS forms and schedules</li>
            </ul>
          </section>

          <section aria-labelledby="faq-heading">
            <h2 id="faq-heading" className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Frequently Asked Questions
            </h2>
            <div className="mt-8 space-y-2">
              <details className="group rounded-xl border border-slate-200 bg-white px-5 shadow-sm">
                <summary className="cursor-pointer list-none py-4 font-semibold text-slate-900 marker:contents [&::-webkit-details-marker]:hidden">
                  Is my data safe?
                </summary>
                <p className="pb-4 text-slate-600">
                  Yes. We do not store your documents. Files are processed in memory and deleted immediately after extraction. Your PDFs and the extracted data are never retained on our servers, so your sensitive invoices and financial data stay private.
                </p>
              </details>
              <details className="group rounded-xl border border-slate-200 bg-white px-5 shadow-sm">
                <summary className="cursor-pointer list-none py-4 font-semibold text-slate-900 marker:contents [&::-webkit-details-marker]:hidden">
                  How accurate is the conversion?
                </summary>
                <p className="pb-4 text-slate-600">
                  Our AI delivers high accuracy for tables, invoices, and forms. Rows and columns are preserved from the original layout, and numeric values, dates, and text are extracted as they appear. For complex or scanned documents, results are typically ready to use with minimal or no manual correction.
                </p>
              </details>
              <details className="group rounded-xl border border-slate-200 bg-white px-5 shadow-sm">
                <summary className="cursor-pointer list-none py-4 font-semibold text-slate-900 marker:contents [&::-webkit-details-marker]:hidden">
                  Will my tables look the same?
                </summary>
                <p className="pb-4 text-slate-600">
                  Yes. Our AI preserves the visual layout: rows and columns map directly to spreadsheet cells. Section headers (e.g. Part I, Invoice) are detected and styled with bold and light grey background in the Excel output. Merged cells and table structure are maintained so your spreadsheet mirrors the original document.
                </p>
              </details>
              <details className="group rounded-xl border border-slate-200 bg-white px-5 shadow-sm">
                <summary className="cursor-pointer list-none py-4 font-semibold text-slate-900 marker:contents [&::-webkit-details-marker]:hidden">
                  What is the maximum file size?
                </summary>
                <p className="pb-4 text-slate-600">
                  5MB per file for fast, reliable processing. We recommend keeping files under this limit for the best experience. For larger documents, consider splitting the PDF or compressing images before upload.
                </p>
              </details>
              <details className="group rounded-xl border border-slate-200 bg-white px-5 shadow-sm">
                <summary className="cursor-pointer list-none py-4 font-semibold text-slate-900 marker:contents [&::-webkit-details-marker]:hidden">
                  What AI model do you use?
                </summary>
                <p className="pb-4 text-slate-600">
                  We use Google&apos;s Gemini model for layout-aware extraction. It analyzes your document as a visual structure rather than plain text, so tables, forms, and multi-section layouts are converted with high fidelity. The same pipeline handles both native PDFs and scanned images.
                </p>
              </details>
            </div>
          </section>

        </div>

        {/* Heavy content block — 1440px wrapper, fully responsive */}
        <div className="max-w-[1440px] mx-auto py-16 px-4 sm:px-6 lg:px-8 space-y-16">
          {/* Section 1: The Evolution of Document Extraction */}
          <section className="space-y-6" aria-labelledby="evolution-heading">
            <h2 id="evolution-heading" className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              The Evolution of Document Extraction: AI vs. Traditional OCR
            </h2>
            <p className="text-slate-600 leading-relaxed">
              Traditional Optical Character Recognition (OCR) has been the default for turning PDFs into editable text for decades. It works by detecting characters and words in a linear, left-to-right flow. That approach falls apart when your document contains complex tables, merged cells, multi-column layouts, or financial statements where the relationship between a date, a description, and an amount depends on their position in a grid. OCR will often dump everything into a single column, split a number across two rows, or merge header cells with data cells—leaving you with a spreadsheet that requires hours of manual cleanup before it can be used in any accounting or reporting workflow.
            </p>
            <p className="text-slate-600 leading-relaxed">
              Our AI-powered extraction engine takes a fundamentally different approach. Instead of treating the PDF as a stream of characters, it understands the document as a visual layout: it identifies table boundaries, row and column structure, section headers, and the semantic relationship between labels and values. That context-aware processing preserves perfect row and column alignment, so a bank statement&apos;s date, description, debit, credit, and running balance stay in the correct cells. Merged cells, indented sub-items, and multi-level headings are retained in the Excel output, making the result suitable for direct import into ERPs, reconciliation tools, or custom analyses without reformatting.
            </p>
            <p className="text-slate-600 leading-relaxed">
              For financial documents in particular—invoices, statements, tax forms, and reports—this difference is critical. A single misaligned column can break formulas, cause incorrect totals, or trigger audit issues. Our AI is optimized to recognize numeric precision, date formats, and table geometry so that the exported spreadsheet is not only readable but trustworthy for downstream use. Whether your source is a native PDF or a scanned image, you get consistent, layout-faithful extraction that traditional OCR simply cannot deliver.
            </p>
          </section>

          {/* Section 2: Supported Document Types */}
          <section className="space-y-8" aria-labelledby="supported-docs-heading">
            <h2 id="supported-docs-heading" className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Supported Document Types
            </h2>
            <p className="text-slate-600 leading-relaxed max-w-3xl">
              Our converter handles a wide variety of business and financial documents. Below is a clear breakdown of what you can convert and what kind of data you can expect to extract.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col">
                <h3 className="text-lg font-semibold text-slate-900 mb-3">Invoices &amp; Bills</h3>
                <p className="text-slate-600 text-sm leading-relaxed flex-1">
                  Extract vendor details, line items, quantities, unit prices, tax totals, and due dates securely. Perfect for accounts payable, expense tracking, and audit trails. Data is processed in-memory and never stored.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col">
                <h3 className="text-lg font-semibold text-slate-900 mb-3">Scanned Receipts</h3>
                <p className="text-slate-600 text-sm leading-relaxed flex-1">
                  Digitize faded or crumpled paper receipts from business trips, petty cash, or one-off purchases. Our AI handles low contrast and uneven layouts better than standard OCR, so you get clean rows and amounts for expense reports.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col">
                <h3 className="text-lg font-semibold text-slate-900 mb-3">Financial Reports</h3>
                <p className="text-slate-600 text-sm leading-relaxed flex-1">
                  Convert balance sheets, income statements, and trial balances into editable Excel formats. Preserve section headers, subtotals, and nested rows so your analysis and consolidation workflows stay accurate.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col">
                <h3 className="text-lg font-semibold text-slate-900 mb-3">Purchase Orders</h3>
                <p className="text-slate-600 text-sm leading-relaxed flex-1">
                  Streamline your supply chain by turning POs into structured CSVs or Excel files. Extract item codes, quantities, prices, and delivery terms for integration with inventory and procurement systems.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3: A Comprehensive Guide (How it Works in Detail) */}
          <section className="space-y-10" aria-labelledby="comprehensive-guide-heading">
            <h2 id="comprehensive-guide-heading" className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              A Comprehensive Guide: How It Works in Detail
            </h2>
            <div className="space-y-8">
              <div className="rounded-xl border border-slate-200 bg-slate-50/30 p-6 sm:p-8">
                <h3 className="text-xl font-semibold text-slate-900 mb-4">1. Secure Upload</h3>
                <p className="text-slate-600 leading-relaxed mb-4">
                  The entire conversion process starts in your browser. Our drag-and-drop upload zone accepts PDFs and common image formats (e.g. PNG, JPEG) so you can upload native digital documents or photos of printed pages. There is no need to email files or send them to a third-party server before processing: the file is transmitted over an encrypted connection to our infrastructure only at the moment you click &quot;Extract.&quot; We do not retain copies of your documents after the request completes. Our system is designed so that each file is processed in isolation and then immediately discarded from memory, giving you full control over your sensitive financial and business data.
                </p>
                <p className="text-slate-600 leading-relaxed">
                  We recommend keeping files under 5MB for fast, reliable processing. If you have a multi-page or larger document, consider splitting it into smaller PDFs or compressing images before upload. The upload interface works on both desktop and mobile, so you can convert documents from the office or on the go without installing any software.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/30 p-6 sm:p-8">
                <h3 className="text-xl font-semibold text-slate-900 mb-4">2. AI Processing &amp; Recognition</h3>
                <p className="text-slate-600 leading-relaxed mb-4">
                  Once your file is received, our AI engine analyzes the document as a visual layout rather than a flat stream of text. It scans for table structures, detects rows and columns, and distinguishes data regions from headers, footers, logos, and boilerplate text. This context-aware approach means that irrelevant elements—such as company logos or disclaimer blocks—are ignored, while every meaningful table and list is captured with correct alignment. The model recognizes merged cells, indentation, and multi-level section headings, so the resulting grid mirrors the original document&apos;s structure.
                </p>
                <p className="text-slate-600 leading-relaxed">
                  The same pipeline handles both native PDFs (with selectable text) and scanned or image-based documents. For low-quality or faded scans, the AI uses visual reasoning to infer table boundaries and cell contents, often outperforming traditional OCR that fails on complex layouts. Processing typically completes within seconds, and you see a live progress indicator until your extracted data is ready for review and download.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/30 p-6 sm:p-8">
                <h3 className="text-xl font-semibold text-slate-900 mb-4">3. Download &amp; Integration</h3>
                <p className="text-slate-600 leading-relaxed mb-4">
                  The output is delivered as a standard Excel workbook (.xlsx) with one or more sheets, depending on the structure of your source document. Headers and section rows are styled (e.g. bold, light background) for clarity, and column widths are auto-fitted so the spreadsheet is immediately usable. You can open the file in Microsoft Excel, Google Sheets, LibreOffice Calc, or any compatible spreadsheet application. The clean, consistent column layout makes it easy to map fields for import into major ERPs (e.g. SAP, Oracle, Microsoft Dynamics), accounting platforms (e.g. Xero, QuickBooks, Sage), or your own custom databases and reporting tools.
                </p>
                <p className="text-slate-600 leading-relaxed">
                  No sign-up or account is required to download your file. You keep full ownership of the extracted data, and we do not use it for training or any other purpose. If you need to re-run the conversion (for example, after correcting the source PDF), you can upload again and receive a fresh export at any time.
                </p>
              </div>
            </div>
          </section>

          {/* Section 4: Expanded FAQ */}
          <section className="space-y-8" aria-labelledby="expanded-faq-heading">
            <h2 id="expanded-faq-heading" className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Expanded Frequently Asked Questions
            </h2>
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 mb-3">What is your data retention policy? Do you store my documents?</h3>
                <p className="text-slate-600 leading-relaxed">
                  We do not retain your documents or the extracted data. Our data retention policy is simple: as soon as the conversion request is complete, your file and the resulting spreadsheet data are removed from our systems. Processing is done in-memory where possible, and we do not write uploaded PDFs or output Excel files to long-term storage. We do not use your documents for model training, analytics, or any other purpose. Your uploads and extractions are treated as ephemeral and are deleted immediately after the response is sent to your browser.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 mb-3">What are the file size and page limits?</h3>
                <p className="text-slate-600 leading-relaxed">
                  The recommended maximum file size is 5MB per upload. This keeps processing fast and reliable for most single documents, including multi-page invoices and statements. We do not enforce a strict page count, but very long documents (e.g. dozens of pages) may take longer to process or may hit time limits. For best results, split very large PDFs into smaller chunks or compress scanned images before uploading. If you need to process many files, you can run multiple conversions in sequence; each file is handled independently.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 mb-3">Do you support non-English documents?</h3>
                <p className="text-slate-600 leading-relaxed">
                  Yes. Our AI model is capable of recognizing text and table structure in multiple languages and scripts. Documents in English, Spanish, French, German, and other common languages are supported. Layout and numeric extraction (dates, amounts, quantities) work regardless of language, so you can convert invoices, receipts, and reports from international vendors or subsidiaries. If your document uses a mix of languages or special characters, the extraction will preserve them in the Excel output. For best accuracy on rare scripts or very dense text, we still recommend clear, well-formatted source documents.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 mb-3">What is the difference between CSV and Excel export?</h3>
                <p className="text-slate-600 leading-relaxed">
                  Currently we provide download in Excel (.xlsx) format. Excel workbooks support multiple sheets, styling (bold headers, borders, column widths), and formulas, which makes them ideal for structured tables with sections and formatting. CSV (comma-separated values) is a plain-text format that many accounting and ERP systems accept for bulk import; it has no styling or multiple sheets but is widely compatible. If you need CSV, you can open the downloaded Excel file in any spreadsheet application and use &quot;Save As&quot; to export as CSV. The underlying data structure is the same—rows and columns—so mapping to your system is straightforward in either format.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 mb-3">How accurate is the extraction on low-quality or scanned documents?</h3>
                <p className="text-slate-600 leading-relaxed">
                  Our AI-driven extraction is designed to be resilient to scan quality issues. For clearly scanned or digital PDFs, users typically see high accuracy with minimal or no manual correction. For low-quality scans—faded print, skew, or low resolution—the model uses visual context to infer table boundaries and cell contents, often outperforming traditional OCR that tends to misalign columns or split values across rows. Accuracy can vary with extremely poor images or unusual layouts; we recommend reviewing the first few rows of the output for critical documents and re-uploading with a clearer scan if needed. In general, the more structured and readable the source (even if scanned), the better the result.
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>
      <QuotaLimitModal open={showQuotaModal} onClose={() => setShowQuotaModal(false)} variant={quotaModalVariant} />
    </div>
  );
}
