"use client";

import { useEffect } from "react";
import { Clock } from "lucide-react";

type QuotaLimitModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function QuotaLimitModal({ open, onClose }: QuotaLimitModalProps) {
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quota-modal-title"
    >
      {/* Dark overlay */}
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        aria-label="Close"
      />
      {/* Modal card */}
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <Clock className="h-7 w-7" aria-hidden />
          </div>
          <h2 id="quota-modal-title" className="mt-4 text-lg font-semibold text-slate-900">
            Daily limit reached
          </h2>
          <p className="mt-2 text-slate-600">
            Out of limit, try again after 24 hours.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-6 w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white transition-colors hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
