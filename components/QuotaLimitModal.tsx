"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { logAnalyticsEvent } from "@/lib/firebase";
import { createClient } from "@/lib/supabase/client";
import PaddleCheckoutButton from "@/components/PaddleCheckoutButton";
import { PADDLE_PRICES } from "@/lib/paddlePrices";

export type QuotaLimitVariant =
  | "guest"
  | "download_signin"
  | "out_of_credits"
  | "pro_feature"
  | "file_too_large"
  | "batch"
  | "pages_limit";

const GUEST_VARIANT_COPY: Record<string, { icon: string; title: string; body: string }> = {
  guest: {
    icon: "🎁",
    title: "Get 3 Free Pages Every Month",
    body: "You've used your free guest conversion. Sign in free — one click with Google — and get 3 pages every month. No credit card needed.",
  },
  download_signin: {
    icon: "📥",
    title: "Your File is Ready — Sign In to Download",
    body: "Previewing is free. Sign in with Google (one click, no credit card) to download the Excel file — you'll also get 3 free pages every month.",
  },
};

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
  pages_limit: {
    title: "Free Plan Covers the First 10 Pages",
    body: "We extracted the first 10 pages of your document. Unlock the full document — and files up to 25MB — with a $2 Week Pass, one-time payment.",
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

  const isGuest = variant === "guest" || variant === "download_signin";
  const guestCopy = GUEST_VARIANT_COPY[variant] ?? GUEST_VARIANT_COPY.guest!;
  const canBuyWeekPass = !isGuest && Boolean(userId && PADDLE_PRICES.weekPass);

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: typeof window !== "undefined" ? window.location.href : undefined },
    });
  };

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
              {isGuest ? guestCopy.icon : "🎟️"}
            </span>
          </div>
          <h2 id="limit-modal-title" className="mt-4 text-lg font-semibold text-slate-900">
            {isGuest
              ? guestCopy.title
              : (PAID_VARIANT_COPY[variant] ?? PAID_VARIANT_COPY.out_of_credits!).title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {isGuest
              ? guestCopy.body
              : (PAID_VARIANT_COPY[variant] ?? PAID_VARIANT_COPY.out_of_credits!).body}
          </p>
          <div className="mt-6 flex w-full flex-col gap-3">
            {isGuest ? (
              <>
                <button
                  type="button"
                  onClick={handleGoogle}
                  className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  Continue with Google
                </button>
                <Link
                  href="/login"
                  className="text-center text-sm font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
                >
                  or sign up with email
                </Link>
              </>
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
