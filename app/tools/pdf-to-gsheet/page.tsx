"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { FileUp, Loader2, FileSpreadsheet, ExternalLink } from "lucide-react";
import { canConvert, incrementUsage } from "@/lib/pdfUsage";
import QuotaLimitModal from "@/components/QuotaLimitModal";

export default function PdfToGsheetPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copyUrl, setCopyUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showQuotaModal, setShowQuotaModal] = useState(false);

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

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (!canConvert()) {
      setShowQuotaModal(true);
      return;
    }
    const f = e.dataTransfer.files?.[0];
    if (f?.type === "application/pdf") {
      setFile(f);
      setErrorMessage(null);
    } else if (f) {
      setErrorMessage("Only PDF files are accepted.");
      setFile(null);
    }
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canConvert()) {
      setShowQuotaModal(true);
      e.target.value = "";
      return;
    }
    const f = e.target.files?.[0];
    if (f?.type === "application/pdf") {
      setFile(f);
      setErrorMessage(null);
    } else if (f) {
      setErrorMessage("Only PDF files are accepted.");
      setFile(null);
    } else {
      setFile(null);
    }
    e.target.value = "";
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    setCopyUrl(null);
    setErrorMessage(null);

    if (!file) {
      setErrorMessage("Please select a PDF file.");
      return;
    }
    if (!canConvert()) {
      setShowQuotaModal(true);
      return;
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/gsheet", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();

      if (!res.ok) {
        setErrorMessage(json?.error ?? "Something went wrong. Please try again.");
        return;
      }

      incrementUsage();
      setSuccessMessage(json?.message ?? "Your sheet is ready.");
      setCopyUrl(json?.copyUrl ?? null);
      setFile(null);
    } catch {
      setErrorMessage("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [file]);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          PDF to Google Sheets
        </h1>
        <p className="mt-2 text-slate-600">
          Upload a PDF. We extract table and invoice data with AI and create a Google Sheet you can copy to your Drive.
        </p>

        <form onSubmit={handleSubmit} className="mt-10 space-y-8">
          {/* PDF upload zone */}
          <div>
            <label className="block text-sm font-medium text-slate-700">PDF file</label>
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileChange}
              className="sr-only"
              id="gsheet-file-input"
              aria-label="Upload PDF"
            />
            <div
              role="button"
              tabIndex={0}
              onClick={() => document.getElementById("gsheet-file-input")?.click()}
              onKeyDown={(e) => e.key === "Enter" && document.getElementById("gsheet-file-input")?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`mt-2 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
                isDragging
                  ? "border-blue-500 bg-blue-50/60"
                  : "border-slate-300 bg-slate-50/50 hover:border-slate-400 hover:bg-slate-100/50"
              }`}
            >
              <FileUp className="h-12 w-12 text-slate-400" />
              <span className="mt-4 font-medium text-slate-700">
                {file ? file.name : "Drop a PDF here or click to browse"}
              </span>
              <span className="mt-1 text-sm text-slate-500">PDF only, max 5MB</span>
            </div>
          </div>

          {/* Error */}
          {errorMessage && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
              {errorMessage}
            </div>
          )}

          {/* Success + Make a Copy CTA */}
          {successMessage && copyUrl && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-6" role="status">
              <p className="font-medium text-green-800">{successMessage}</p>
              <a
                href={copyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3.5 font-semibold text-white shadow-sm transition-colors hover:bg-green-700"
              >
                🎉 Success! Click here to Make a Copy of your Data
                <ExternalLink className="h-5 w-5 shrink-0" aria-hidden />
              </a>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading || !file}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3.5 font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                Converting…
              </>
            ) : (
              <>
                <FileSpreadsheet className="h-5 w-5" />
                Convert to Google Sheet
              </>
            )}
          </button>
        </form>

        <p className="mt-10 text-sm text-slate-500">
          <Link href="/tools/pdf-to-excel" className="text-blue-600 hover:underline">
            Prefer to download as Excel instead?
          </Link>
        </p>
      </main>
      <QuotaLimitModal open={showQuotaModal} onClose={() => setShowQuotaModal(false)} />
    </div>
  );
}
