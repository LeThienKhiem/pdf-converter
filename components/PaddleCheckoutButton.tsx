"use client";

import { useEffect, useState, useCallback } from "react";
import { initializePaddle } from "@paddle/paddle-js";

type PaddleInstance = Awaited<ReturnType<typeof initializePaddle>>;

interface PaddleCheckoutButtonProps {
  priceId: string;
  userEmail?: string;
  userId?: string;
  children?: React.ReactNode;
  className?: string;
}

export default function PaddleCheckoutButton({
  priceId,
  userEmail,
  userId,
  children = "Buy credits",
  className = "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#217346] px-6 py-4 text-base font-semibold text-white shadow-md transition-all hover:bg-[#1d603d] hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed",
}: PaddleCheckoutButtonProps) {
  const [paddle, setPaddle] = useState<PaddleInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleEvent = useCallback((event: { name?: string; data?: unknown }) => {
    console.log("[Paddle] Event:", event.name, event);
    if (event.name === "checkout.completed") {
      console.log("[Paddle] Checkout completed!", event.data);
      setShowSuccess(true);
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
            <p className="mt-2 text-slate-600">
              50 credits have been added to your account. You can start converting invoices right away.
            </p>
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
