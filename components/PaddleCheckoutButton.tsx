"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { initializePaddle } from "@paddle/paddle-js";
import { trackFunnel, type FunnelEvent } from "@/lib/funnel";

type PaddleInstance = Awaited<ReturnType<typeof initializePaddle>>;

// Paddle overlay events worth a funnel row. Module-level state because every
// button on a page shares one Paddle instance: the overlay events carry no
// hint of which button opened it, and with several buttons mounted the same
// event can reach more than one callback.
const PADDLE_FUNNEL: Record<string, FunnelEvent> = {
  "checkout.loaded": "checkout_loaded",
  "checkout.customer.created": "checkout_customer",
  "checkout.payment.initiated": "checkout_payment_initiated",
  "checkout.payment.failed": "checkout_payment_failed",
  "checkout.error": "checkout_error",
  "checkout.closed": "checkout_closed",
  "checkout.completed": "checkout_completed",
};
let activeSource: string | null = null;
let lastTracked = { name: "", at: 0 };

function trackPaddleEvent(name: string | undefined) {
  const funnel = name ? PADDLE_FUNNEL[name] : undefined;
  if (!funnel) return;
  const now = Date.now();
  if (lastTracked.name === name && now - lastTracked.at < 1500) return;
  lastTracked = { name: name!, at: now };
  trackFunnel(funnel, { source: activeSource });
}

interface PaddleCheckoutButtonProps {
  priceId: string;
  userEmail?: string;
  userId?: string;
  children?: React.ReactNode;
  className?: string;
  successMessage?: string;
  /**
   * Called once the overlay reports a completed checkout. When provided, the
   * built-in success dialog is suppressed so the caller can continue the
   * user's actual job (e.g. finish extracting the document they just paid to
   * unlock) instead of showing a dead-end "payment successful" box.
   */
  onPurchased?: () => void;
  /** Where this button lives, e.g. "pricing:pro" or "paywall:pages_limit" — for the funnel. */
  source?: string;
}

export default function PaddleCheckoutButton({
  priceId,
  userEmail,
  userId,
  children = "Buy credits",
  className = "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#217346] px-6 py-4 text-base font-semibold text-white shadow-md transition-all hover:bg-[#1d603d] hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed",
  successMessage = "Your purchase is complete. You can start converting right away.",
  onPurchased,
  source,
}: PaddleCheckoutButtonProps) {
  const [paddle, setPaddle] = useState<PaddleInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  // Held in a ref so the Paddle event callback, which is registered once at
  // init, always reaches the current handler.
  const onPurchasedRef = useRef(onPurchased);
  useEffect(() => {
    onPurchasedRef.current = onPurchased;
  }, [onPurchased]);

  const handleEvent = useCallback((event: { name?: string; data?: unknown }) => {
    console.log("[Paddle] Event:", event.name, event);
    trackPaddleEvent(event.name);
    if (event.name === "checkout.completed") {
      console.log("[Paddle] Checkout completed!", event.data);
      if (onPurchasedRef.current) onPurchasedRef.current();
      else setShowSuccess(true);
    }
    if (event.name === "checkout.error") {
      console.error("[Paddle] Checkout error:", event);
    }
  }, []);

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
    const env = process.env.NEXT_PUBLIC_PADDLE_ENV;
    if (!token) {
      console.error("[Paddle] Missing NEXT_PUBLIC_PADDLE_CLIENT_TOKEN");
      setLoading(false);
      return;
    }
    initializePaddle({
      environment: (env === "production" ? "production" : "sandbox") as "sandbox" | "production",
      token,
      eventCallback: handleEvent,
    })
      .then((instance) => {
        console.log("[Paddle] Initialized successfully, env:", env);
        setPaddle(instance ?? null);
      })
      .catch((err) => {
        console.error("[Paddle] Init failed:", err);
        setPaddle(null);
      })
      .finally(() => setLoading(false));
  }, [handleEvent]);

  const openCheckout = () => {
    if (!paddle || !priceId) {
      console.error("[Paddle] Cannot open checkout — paddle:", !!paddle, "priceId:", priceId);
      return;
    }
    activeSource = source ?? null;
    trackFunnel("checkout_open", { source });
    console.log("[Paddle] Opening checkout with priceId:", priceId, "email:", userEmail, "userId:", userId);
    paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      ...(userEmail && { customer: { email: userEmail } }),
      ...(userId && { customData: { userId } }),
    });
  };

  const ready = Boolean(paddle && priceId);

  return (
    <>
      <button
        type="button"
        onClick={openCheckout}
        disabled={loading || !ready}
        className={className}
      >
        {loading ? "Loading…" : children}
      </button>

      {showSuccess && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
          <div className="mx-4 max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900">Payment Successful!</h2>
            <p className="mt-2 text-slate-600">{successMessage}</p>
            <button
              type="button"
              onClick={() => {
                setShowSuccess(false);
                window.location.reload();
              }}
              className="mt-6 inline-flex items-center justify-center rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-emerald-700"
            >
              Start Converting
            </button>
          </div>
        </div>
      )}
    </>
  );
}
