import { NextResponse } from "next/server";
import { Environment, Paddle } from "@paddle/paddle-node-sdk";
import { getSupabase } from "@/lib/supabase";
import { classifyPriceId, type PurchaseKind } from "@/lib/paddlePrices";

/**
 * Paddle Billing webhook.
 * - transaction.completed → route by price ID: credit pack, week pass, or
 *   subscription payment (recorded only; plan changes come from subscription.*).
 * - subscription.activated/updated → set plan (pro / pro_yearly / founding).
 * - subscription.canceled/past_due/paused → downgrade to free.
 * - Idempotent: transactions are keyed by paddle_transaction_id (unique index);
 *   effects apply only when the transaction row inserts for the first time.
 * - Signature verification is mandatory; returns 401 on failure (no bypass).
 * - Env: PADDLE_API_KEY, PADDLE_WEBHOOK_SECRET; NEXT_PUBLIC_PADDLE_ENV=production for live.
 */

const CREDITS_PACK_AMOUNT = 50;
const WEEK_PASS_DAYS = 7;

/** Normalize Paddle total to USD number (handles cents or decimal string). */
function toAmountUsd(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "string" ? parseFloat(value) : Number(value);
  if (Number.isNaN(n)) return null;
  if (Number.isInteger(n) && n >= 10) return Math.round(n) / 100;
  return n;
}

type PaddleEventData = Record<string, unknown> & {
  id?: string;
  customData?: { userId?: string };
  custom_data?: { userId?: string; user_id?: string };
  items?: Array<{ price?: { id?: string } }>;
  details?: { totals?: { total?: unknown } };
  status?: string;
};

function getUserId(data: PaddleEventData): string | null {
  const userId =
    data?.customData?.userId ||
    data?.custom_data?.userId ||
    data?.custom_data?.user_id;
  if (!userId || userId === "guest") return null;
  return userId;
}

function getFirstPriceId(data: PaddleEventData): string | null {
  return data?.items?.[0]?.price?.id ?? null;
}

/**
 * Record the transaction. Returns true only when this event is seen for the
 * first time (unique paddle_transaction_id) — callers apply effects then.
 */
async function recordTransactionOnce(
  supabase: ReturnType<typeof getSupabase>,
  params: {
    userId: string;
    paddleTransactionId: string | null;
    creditsAdded: number | null;
    amountUsd: number | null;
    kind: PurchaseKind;
  }
): Promise<boolean> {
  const { data, error } = await supabase
    .from("transactions")
    .upsert(
      {
        user_id: params.userId,
        paddle_transaction_id: params.paddleTransactionId,
        credits_added: params.creditsAdded,
        amount_usd: params.amountUsd,
        status: "completed",
      },
      { onConflict: "paddle_transaction_id", ignoreDuplicates: true }
    )
    .select("user_id");

  if (error) {
    // 23505 = unique violation race; treat as duplicate.
    if (error.code === "23505") return false;
    throw new Error(`Transaction record failed: ${error.message}`);
  }
  return (data?.length ?? 0) > 0;
}

async function handleTransactionCompleted(data: PaddleEventData) {
  const userId = getUserId(data);
  if (!userId) {
    return NextResponse.json({ error: "Missing or invalid userId" }, { status: 400 });
  }

  const supabase = getSupabase();
  const kind = classifyPriceId(getFirstPriceId(data));
  const amountUsd = toAmountUsd(data.details?.totals?.total);
  const paddleTransactionId = data.id ?? null;

  const isFirstDelivery = await recordTransactionOnce(supabase, {
    userId,
    paddleTransactionId,
    creditsAdded: kind === "credits50" ? CREDITS_PACK_AMOUNT : null,
    amountUsd,
    kind,
  });

  if (!isFirstDelivery) {
    console.log("[Paddle] Duplicate transaction, skipping:", paddleTransactionId);
    return NextResponse.json({ message: "Duplicate ignored" }, { status: 200 });
  }

  if (kind === "credits50" || kind === "unknown") {
    // Unknown price IDs fall back to the legacy behavior (credit pack) so a
    // misconfigured env var fails toward giving the customer what they paid for.
    const { data: userRow, error: fetchError } = await supabase
      .from("users")
      .select("credits")
      .eq("id", userId)
      .single();
    if (fetchError || userRow == null) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const current = (userRow as { credits: number }).credits ?? 0;
    const { error: updateError } = await supabase
      .from("users")
      .update({ credits: current + CREDITS_PACK_AMOUNT })
      .eq("id", userId);
    if (updateError) {
      return NextResponse.json({ error: "Database update failed" }, { status: 500 });
    }
    return NextResponse.json({ message: "Credits added" }, { status: 200 });
  }

  if (kind === "week_pass") {
    const expires = new Date(Date.now() + WEEK_PASS_DAYS * 24 * 60 * 60 * 1000);
    const { error: updateError } = await supabase
      .from("users")
      .update({
        plan: "week_pass",
        plan_expires_at: expires.toISOString(),
        pages_used: 0,
        usage_period_start: new Date().toISOString(),
      })
      .eq("id", userId);
    if (updateError) {
      return NextResponse.json({ error: "Database update failed" }, { status: 500 });
    }
    return NextResponse.json({ message: "Week pass activated" }, { status: 200 });
  }

  // Subscription payment — plan state is handled by subscription.* events.
  return NextResponse.json({ message: "Subscription payment recorded" }, { status: 200 });
}

async function handleSubscriptionActive(data: PaddleEventData) {
  const userId = getUserId(data);
  if (!userId) {
    return NextResponse.json({ error: "Missing or invalid userId" }, { status: 400 });
  }

  const status = (data.status ?? "").toString();
  if (status && !["active", "trialing"].includes(status)) {
    // subscription.updated with non-active status (past_due etc.) → downgrade.
    return handleSubscriptionEnded(data);
  }

  const kind = classifyPriceId(getFirstPriceId(data));
  const plan =
    kind === "pro_yearly" ? "pro_yearly" : kind === "pro" || kind === "pro_founding" ? "pro" : null;
  if (!plan) {
    console.warn("[Paddle] Subscription event with unknown price, ignoring");
    return NextResponse.json({ message: "Unknown subscription price ignored" }, { status: 200 });
  }

  const supabase = getSupabase();
  const update: Record<string, unknown> = {
    plan,
    plan_expires_at: null,
    paddle_subscription_id: data.id ?? null,
    pages_used: 0,
    usage_period_start: new Date().toISOString(),
  };
  if (kind === "pro_founding") update.founding_member = true;

  const { error } = await supabase.from("users").update(update).eq("id", userId);
  if (error) {
    return NextResponse.json({ error: "Database update failed" }, { status: 500 });
  }
  return NextResponse.json({ message: `Plan set to ${plan}` }, { status: 200 });
}

async function handleSubscriptionEnded(data: PaddleEventData) {
  const userId = getUserId(data);
  const supabase = getSupabase();

  // Prefer userId from customData; fall back to matching the subscription id.
  const query = supabase
    .from("users")
    .update({ plan: "free", plan_expires_at: null, paddle_subscription_id: null });
  const { error } = userId
    ? await query.eq("id", userId)
    : await query.eq("paddle_subscription_id", data.id ?? "__none__");

  if (error) {
    return NextResponse.json({ error: "Database update failed" }, { status: 500 });
  }
  return NextResponse.json({ message: "Downgraded to free" }, { status: 200 });
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

    let eventData: { eventType: string; data: PaddleEventData };
    try {
      eventData = (await paddle.webhooks.unmarshal(rawBody, secret, signature)) as unknown as {
        eventType: string;
        data: PaddleEventData;
      };
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e));
      console.error("❌ Signature Verification Failed:", err.message || e);
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    console.log("✅ Paddle event:", eventData?.eventType);

    switch (eventData.eventType) {
      case "transaction.completed":
        return await handleTransactionCompleted(eventData.data);
      case "subscription.activated":
      case "subscription.updated":
        return await handleSubscriptionActive(eventData.data);
      case "subscription.canceled":
      case "subscription.paused":
      case "subscription.past_due":
        return await handleSubscriptionEnded(eventData.data);
      default:
        return NextResponse.json({ message: "Ignored" }, { status: 200 });
    }
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("❌ Global Webhook Error:", err.message || error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
