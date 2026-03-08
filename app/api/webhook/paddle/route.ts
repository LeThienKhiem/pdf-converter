import { NextResponse } from "next/server";
import { Environment, Paddle } from "@paddle/paddle-node-sdk";
import { getSupabase } from "@/lib/supabase";

/**
 * Paddle Billing webhook (production-ready).
 * - Handles transaction.completed: updates users.credits and inserts into transactions (Billing history).
 * - Signature verification is mandatory; returns 401 on failure (no bypass).
 * - Env: PADDLE_API_KEY, PADDLE_WEBHOOK_SECRET; NEXT_PUBLIC_PADDLE_ENV=production for live.
 */
const CREDITS_TO_ADD = 50;

/** Normalize Paddle total to USD number (handles cents or decimal string). */
function toAmountUsd(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "string" ? parseFloat(value) : Number(value);
  if (Number.isNaN(n)) return null;
  if (Number.isInteger(n) && n >= 10) return Math.round(n) / 100;
  return n;
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("paddle-signature") ?? req.headers.get("Paddle-Signature");

    if (!rawBody || !signature) {
      return NextResponse.json({ error: "Missing body or signature" }, { status: 400 });
    }

    const secret = process.env.PADDLE_WEBHOOK_SECRET;
    const apiKey = process.env.PADDLE_API_KEY;
    if (!secret || !apiKey) {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    const paddle = new Paddle(apiKey, {
      environment: process.env.NEXT_PUBLIC_PADDLE_ENV === "production"
        ? Environment.production
        : Environment.sandbox,
    });

    let eventData: { eventType: string; data: Record<string, unknown> };
    try {
      eventData = (await paddle.webhooks.unmarshal(rawBody, secret, signature)) as unknown as {
        eventType: string;
        data: Record<string, unknown>;
      };
    } catch {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    if (eventData.eventType !== "transaction.completed") {
      return NextResponse.json({ message: "Ignored" }, { status: 200 });
    }

    const data = eventData.data as {
      customData?: { userId?: string };
      custom_data?: { userId?: string; user_id?: string };
    };
    const userId =
      data?.customData?.userId ||
      data?.custom_data?.userId ||
      data?.custom_data?.user_id;

    if (!userId || userId === "guest") {
      return NextResponse.json({ error: "Missing or invalid userId" }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data: userRow, error: fetchError } = await supabase
      .from("users")
      .select("credits")
      .eq("id", userId)
      .single();

    if (fetchError || userRow == null) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const currentCredits = (userRow as { credits: number }).credits ?? 0;
    const newBalance = currentCredits + CREDITS_TO_ADD;

    const { error: updateError } = await supabase
      .from("users")
      .update({ credits: newBalance })
      .eq("id", userId);

    if (updateError) {
      return NextResponse.json({ error: "Database update failed" }, { status: 500 });
    }

    const paddleTransactionId = (eventData.data as { id?: string }).id ?? null;
    const details = eventData.data.details as { totals?: { total?: unknown } } | undefined;
    const amountUsd = toAmountUsd(details?.totals?.total);

    const { error: insertError } = await supabase.from("transactions").insert({
      user_id: userId,
      paddle_transaction_id: paddleTransactionId,
      credits_added: CREDITS_TO_ADD,
      amount_usd: amountUsd,
      status: "completed",
    });

    if (insertError) {
      return NextResponse.json({ error: "Transaction record failed" }, { status: 500 });
    }

    return NextResponse.json({ message: "Success" }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
