"use client";

import { useCallback, useMemo, useState, useId } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { FileUp, Loader2, FileSpreadsheet, ExternalLink } from "lucide-react";
import { canConvert, incrementUsage } from "@/lib/pdfUsage";
import QuotaLimitModal from "@/components/QuotaLimitModal";
import SmartAdBanner from "@/components/SmartAdBanner";

const GOOGLE_SHEETS_SCOPES =
  "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file";

type PdfToGsheetToolProps = {
  title?: string;
  subtitle?: string;
  showExcelLink?: boolean;
  className?: string;
};

export default function PdfToGsheetTool({
  title,
  subtitle,
  showExcelLink = true,
  className = "",
}: PdfToGsheetToolProps) {
  const inputId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copyUrl, setCopyUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showQuotaModal, setShowQuotaModal] = useState(false);

  const supabaseBrowser = useMemo(() => {
    if (typeof window === "undefined") return null;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    return url && anon ? createClient(url, anon) : null;
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

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSuccessMessage(null);
      setCopyUrl(null);
      setErrorMessage(null);
      if (typeof window !== "undefined" && window.gtag) {
        window.gtag("event", "click_convert", { target_format: "gsheet" });
      }
      if (!file) {
        setErrorMessage("Please select a PDF file.");
        return;
      }
      if (!canConvert()) {
        setShowQuotaModal(true);
        return;
      }
      setIsLoading(true);
      let isAuthRedirect = false;
      try {
        const formData = new FormData();
        formData.append("file", file);
        const headers: Record<string, string> = {};
        if (supabaseBrowser) {
          const { data: { session } } = await supabaseBrowser.auth.getSession();
          const providerRefresh = session?.provider_refresh_token;
          if (providerRefresh) headers["X-Google-Refresh-Token"] = providerRefresh;
        }
        const res = await fetch("/api/gsheet", {
          method: "POST",
          headers,
          body: formData,
        });
        const json = await res.json();

        if (!res.ok) {
          const isAuthError =
            res.status === 401 ||
            json?.error === "Google_Token_Expired" ||
            /token|auth|unauthorized|invalid_grant/i.test(json?.error ?? "");
          if (isAuthError && supabaseBrowser && typeof window !== "undefined") {
            isAuthRedirect = true;
            await supabaseBrowser.auth.signInWithOAuth({
              provider: "google",
              options: {
                scopes: GOOGLE_SHEETS_SCOPES,
                queryParams: { access_type: "offline", prompt: "consent" },
                redirectTo: window.location.href,
              },
            });
            return;
          }
          setErrorMessage(json?.error ?? "Something went wrong. Please try again.");
          return;
        }

        incrementUsage();
        setSuccessMessage(json?.message ?? "Your sheet is ready.");
        setCopyUrl(json?.copyUrl ?? null);
        setFile(null);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const isAuthError = /token|auth|unauthorized|invalid_grant|401/i.test(msg);
        if (isAuthError && supabaseBrowser && typeof window !== "undefined") {
          isAuthRedirect = true;
          await supabaseBrowser.auth.signInWithOAuth({
            provider: "google",
            options: {
              scopes: GOOGLE_SHEETS_SCOPES,
              queryParams: { access_type: "offline", prompt: "consent" },
              redirectTo: window.location.href,
            },
          });
          return;
        }
        setErrorMessage("Network error. Please try again.");
      } finally {
        if (!isAuthRedirect) setIsLoading(false);
      }
    },
    [file, supabaseBrowser]
  );

  return (
    <div className={className}>
      {title && (
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h2>
      )}
      {subtitle && <p className="mt-2 text-slate-600">{subtitle}</p>}

      <form onSubmit={handleSubmit} className={title || subtitle ? "mt-10 space-y-8" : "space-y-8"}>
        {/* Ad: just above PDF upload dropzone */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
          <p className="mb-2 text-center text-xs font-medium uppercase tracking-wider text-slate-400">Advertisement</p>
          <div className="w-full flex justify-center my-8 max-w-full overflow-hidden">
            {/* Desktop Banner - Safe for large screens */}
            <div className="hidden lg:flex justify-center w-full overflow-hidden">
              <SmartAdBanner width={728} height={90} />
            </div>

            {/* Mobile/Tablet Banner - Fallback for smaller screens to prevent overflow */}
            <div className="flex lg:hidden justify-center w-full">
              <SmartAdBanner width={300} height={250} />
            </div>
          </div>
        </div>

        <div>
          <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
            PDF file
          </label>
          <input
            id={inputId}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
            className="sr-only"
            aria-label="Upload PDF"
          />
          <div
            role="button"
            tabIndex={0}
            onClick={() => document.getElementById(inputId)?.click()}
            onKeyDown={(e) => e.key === "Enter" && document.getElementById(inputId)?.click()}
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

        {errorMessage && errorMessage !== "Google_Token_Expired" && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
            {errorMessage}
          </div>
        )}

        {successMessage && copyUrl && (
          <>
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
            {/* Ad: right below Google Sheet results */}
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/50 p-3">
              <p className="mb-2 text-center text-xs font-medium uppercase tracking-wider text-slate-400">Advertisement</p>
              <div className="w-full flex justify-center my-8 max-w-full overflow-hidden">
                {/* Desktop Banner - Safe for large screens */}
                <div className="hidden lg:flex justify-center w-full overflow-hidden">
                  <SmartAdBanner width={728} height={90} />
                </div>

                {/* Mobile/Tablet Banner - Fallback for smaller screens to prevent overflow */}
                <div className="flex lg:hidden justify-center w-full">
                  <SmartAdBanner width={300} height={250} />
                </div>
              </div>
            </div>
          </>
        )}

        {isLoading && (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-gray-100 bg-slate-50 p-6">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" aria-hidden />
            <p className="text-center text-sm font-medium text-slate-700">Converting to Google Sheet…</p>
            <p className="text-center text-xs text-slate-500">Please wait while our AI processes your document.</p>
            <div className="mt-4 w-full rounded-lg border border-slate-200 bg-white p-3">
              <p className="mb-2 text-center text-xs font-medium uppercase tracking-wider text-slate-400">Advertisement</p>
              <div className="w-full flex justify-center my-8 max-w-full overflow-hidden">
                {/* Desktop Banner - Safe for large screens */}
                <div className="hidden lg:flex justify-center w-full overflow-hidden">
                  <SmartAdBanner width={728} height={90} />
                </div>

                {/* Mobile/Tablet Banner - Fallback for smaller screens to prevent overflow */}
                <div className="flex lg:hidden justify-center w-full">
                  <SmartAdBanner width={300} height={250} />
                </div>
              </div>
            </div>
          </div>
        )}

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

      {showExcelLink && (
        <p className="mt-10 text-sm text-slate-500">
          <Link href="/tools/pdf-to-excel" className="text-blue-600 hover:underline">
            Prefer to download as Excel instead?
          </Link>
        </p>
      )}

      <QuotaLimitModal open={showQuotaModal} onClose={() => setShowQuotaModal(false)} />
    </div>
  );
}
