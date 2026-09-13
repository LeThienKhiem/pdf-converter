"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Lock, Loader2, X } from "lucide-react";
import { MAX_UNLOCK_PAGES, unlockPdf } from "@/lib/pdfPassword";

/**
 * Asks for the password on an encrypted PDF and hands back an unlocked copy.
 *
 * Sits between file selection and the normal upload path, so callers keep
 * whatever batch or single-file model they already have — what comes out of
 * `onUnlocked` is an ordinary PDF that needs no special handling downstream.
 *
 * The password is used in this component and nowhere else. It is never put in
 * state that outlives the modal, never sent anywhere, and the input is cleared
 * on close. That is the whole point of doing the decryption in the browser, so
 * the UI says so rather than leaving the user to wonder.
 */
export default function PdfPasswordPrompt({
  file,
  onUnlocked,
  onCancel,
}: {
  file: File;
  onUnlocked: (unlocked: File, pages: number) => void;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const close = useCallback(() => {
    setPassword("");
    onCancel();
  }, [onCancel]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, close]);

  const submit = useCallback(async () => {
    if (!password || busy) return;
    setBusy(true);
    setError(null);

    const result = await unlockPdf(file, password);

    if (result.ok) {
      setPassword("");
      onUnlocked(result.file, result.pagesRendered);
      return;
    }

    setBusy(false);
    if (result.reason === "wrong_password") {
      setError("That password did not open the file. Check it and try again.");
      inputRef.current?.select();
    } else if (result.reason === "too_many_pages") {
      setError(
        `This PDF has ${result.pagesTotal} pages; unlocking is limited to ${MAX_UNLOCK_PAGES}. ` +
          `Remove the password in your PDF reader and upload it directly.`
      );
    } else {
      setError("Could not read this PDF. It may be damaged or use an unsupported format.");
    }
  }, [password, busy, file, onUnlocked]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdf-password-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <Lock className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 id="pdf-password-title" className="text-lg font-semibold text-slate-900">
                This statement is password-protected
              </h2>
              <p className="mt-0.5 truncate text-sm text-slate-500" title={file.name}>
                {file.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            disabled={busy}
            aria-label="Cancel"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <p className="mt-4 text-sm text-slate-600">
          Enter the password your bank uses for this statement — often a date of birth,
          part of your account number, or a customer ID.
        </p>

        <input
          ref={inputRef}
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submit();
            }
          }}
          disabled={busy}
          placeholder="PDF password"
          autoComplete="off"
          className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
        />

        {error && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={close}
            disabled={busy}
            className="flex-1 rounded-xl border border-slate-300 px-4 py-3 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!password || busy}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-40"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {busy ? "Unlocking…" : "Unlock and convert"}
          </button>
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Your password is used in this browser only. It is never sent to our servers,
          and the unlocked copy is created on your own device.
        </p>
      </div>
    </div>
  );
}
