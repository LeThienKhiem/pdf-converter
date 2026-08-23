"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { logAnalyticsEvent } from "@/lib/firebase";
import { createClient } from "@/lib/supabase/client";
import PaddleCheckoutButton from "@/components/PaddleCheckoutButton";
import { PADDLE_PRICES } from "@/lib/paddlePrices";

export type QuotaLimitVariant =
  | "guest"
  | "out_of_credits"
  | "pro_feature"
  | "file_too_large"
  | "batch";

const PAID_VARIANT_COPY: Record<string, { title: string; body: string }> = {
  out_of_credits: {
    title: "You're Out of Free Pages",
    body: "Keep going right now with a $2 Week Pass — unlimited conversions for 7 days, one-time payment, nothing to cancel.",
  },
  pro_feature: {
    title: "QuickBooks Export is a Paid Feature",
    body: "Unlock QuickBooks-ready CSV exports (and unlimited conversions) with a $2 Week Pass — one-time payment, nothing to cancel.",
  },
  file_too_large: {
    title: "Files Over 5MB Need a Paid Plan",
    body: "Big statements and long documents (up to 25MB) are a paid feature. Unlock them with a $2 Week Pass — one-time payment, nothing to cancel.",
  },
  batch: {
    title: "Batch Upload is a Paid Feature",
    body: "Convert a whole stack of statements at once — one merged Excel file, one sheet per document. Unlock it with a $2 Week Pass.",
  },
};

type QuotaLimitModalProps = {
  open: boolean;
  onClose: () => void;
  variant: QuotaLimitVariant;
};

export default function QuotaLimitModal({ open, onClose, variant }: QuotaLimitModalProps) {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    logAnalyticsEvent("quota_limit_popup", { variant });
  }, [open, variant]);

  useEffect(() => {
    if (!open) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
      setUserEmail(session?.user?.email ?? undefined);
    });
  }, [open, supabase]);

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
  const canBuyWeekPass = !isGuest && Boolean(userId && PADDLE_PRICES.weekPass);

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
                : "flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-blue-600"
            }
          >
            <span className="text-2xl" aria-hidden>
              {isGuest ? "🎁" : "🎟️"}
            </span>
          </div>
          <h2 id="limit-modal-title" className="mt-4 text-lg font-semibold text-slate-900">
            {isGuest
              ? "Get 3 Free Pages Every Month"
              : (PAID_VARIANT_COPY[variant] ?? PAID_VARIANT_COPY.out_of_credits!).title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {isGuest
              ? "You've used your free guest conversion. Sign up free and get 3 pages every month — no credit card needed."
              : (PAID_VARIANT_COPY[variant] ?? PAID_VARIANT_COPY.out_of_credits!).body}
          </p>
          <div className="mt-6 flex w-full flex-col gap-3">
            {isGuest ? (
              <Link
                href="/login"
                className="rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-slate-800"
              >
                Sign Up for Free
              </Link>
            ) : (
              <>
                {canBuyWeekPass ? (
                  <PaddleCheckoutButton
                    priceId={PADDLE_PRICES.weekPass}
                    userId={userId ?? undefined}
                    userEmail={userEmail}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    successMessage="Your Week Pass is active — unlimited conversions for the next 7 days."
                  >
                    Unlock 7 Days Unlimited — $2
                  </PaddleCheckoutButton>
                ) : (
                  <Link
                    href="/pricing"
                    className="rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                  >
                    Unlock 7 Days Unlimited — $2
                  </Link>
                )}
                <Link
                  href="/pricing"
                  className="text-center text-sm font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
                >
                  Doing this every month? Pro is $5/mo →
                </Link>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-3 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              Close
            </button>
          </div>
          {!isGuest && (
            <p className="mt-3 text-xs text-slate-400">
              7-day money-back guarantee · Secure checkout by Paddle
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
