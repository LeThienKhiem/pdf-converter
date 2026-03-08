"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
    const env = process.env.NEXT_PUBLIC_PADDLE_ENV;
    if (!token) {
      setLoading(false);
      return;
    }
    initializePaddle({
      environment: (env === "production" ? "production" : "sandbox") as "sandbox" | "production",
      token,
    })
      .then((instance) => {
        setPaddle(instance ?? null);
      })
      .catch(() => setPaddle(null))
      .finally(() => setLoading(false));
  }, []);

  const openCheckout = () => {
    if (!paddle) return;
    paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      ...(userEmail && { customer: { email: userEmail } }),
      ...(userId && { customData: { userId } }),
    });
  };

  return (
    <button
      type="button"
      onClick={openCheckout}
      disabled={loading || !paddle}
      className={className}
    >
      {loading ? "Loading…" : children}
    </button>
  );
}
