"use client";

import { useEffect } from "react";
import Link from "next/link";

export type QuotaLimitVariant = "guest" | "out_of_credits";

type QuotaLimitModalProps = {
  open: boolean;
  onClose: () => void;
  variant: QuotaLimitVariant;
};

export default function QuotaLimitModal({ open, onClose, variant }: QuotaLimitModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const isGuest = variant === "guest";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="limit-modal-title"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        aria-label="Close"
      />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200/50">
        <div className="flex flex-col items-center text-center">
          <div
            className={
              isGuest
                ? "flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"
                : "flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600"
            }
          >
            <span className="text-2xl" aria-hidden>
              {isGuest ? "🎁" : "⚡"}
            </span>
          </div>
          <h2 id="limit-modal-title" className="mt-4 text-lg font-semibold text-slate-900">
            {isGuest ? "Welcome! Get 3 Free Credits" : "Out of Credits"}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {isGuest
              ? "You've reached your free guest limit. Sign up now to receive 3 free credits and continue extracting data."
              : "You've used up your credits. Top up your balance to keep the data flowing."}
          </p>
          <div className="mt-6 flex w-full flex-col gap-3">
            <Link
              href={isGuest ? "/login" : "/pricing"}
              className="rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-slate-800"
            >
              {isGuest ? "Sign Up for Free" : "Buy More Credits"}
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-3 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
