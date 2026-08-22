import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getSupabase } from "@/lib/supabase";

/**
 * Server-side entitlement enforcement for extraction endpoints.
 * The client-side checks in tool pages are advisory UX only — this module is
 * the single authority on whether an extraction may run.
 *
 * Rules:
 *  - Guests: 1 successful extraction per guest cookie (ever) and max 3 per IP
 *    per 24h; identified by an httpOnly cookie + IP from the extractions log.
 *  - Logged-in users: consumption is delegated to the atomic `consume_page`
 *    RPC (paid plan → legacy credits → free monthly quota).
 *  - Everyone: burst rate limit from the extractions log.
 */

const GUEST_COOKIE = "itd_gid";
const GUEST_LIFETIME_LIMIT = 1;
const GUEST_IP_DAILY_LIMIT = 3;
const USER_PER_MINUTE_LIMIT = 10;
const IP_PER_MINUTE_LIMIT = 6;

export type PaidCheck = {
  isPaid: boolean;
  plan: string;
  credits: number;
};

export type EntitlementDenied = {
  allowed: false;
  status: 401 | 402 | 429;
  reason: "guest_limit" | "quota_exceeded" | "rate_limited";
  message: string;
};

export type EntitlementGranted = {
  allowed: true;
  userId: string | null;
  guestKey: string | null;
  ip: string | null;
  source: "plan" | "credits" | "free_quota" | "guest";
  plan: string;
  remaining: number | null;
};

export type Entitlement = EntitlementGranted | EntitlementDenied;

async function getClientIp(): Promise<string | null> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return h.get("x-real-ip");
}

async function getOrSetGuestKey(): Promise<string> {
  const store = await cookies();
  const existing = store.get(GUEST_COOKIE)?.value;
  if (existing) return existing;
  const key = crypto.randomUUID();
  try {
    store.set(GUEST_COOKIE, key, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  } catch {
    // read-only context; fall back to per-IP limits alone
  }
  return key;
}

async function countExtractions(
  filters: { userId?: string; guestKey?: string; ip?: string },
  sinceMs: number | null,
  successOnly: boolean
): Promise<number> {
  const admin = getSupabase();
  let q = admin.from("extractions").select("id", { count: "exact", head: true });
  if (filters.userId) q = q.eq("user_id", filters.userId);
  if (filters.guestKey) q = q.eq("guest_key", filters.guestKey);
  if (filters.ip) q = q.eq("ip", filters.ip);
  if (successOnly) q = q.eq("status", "success");
  if (sinceMs != null) q = q.gte("created_at", new Date(Date.now() - sinceMs).toISOString());
  const { count, error } = await q;
  if (error) {
    console.error("[Entitlements] count failed:", error.message);
    return 0; // fail open on infrastructure errors — never brick the product
  }
  return count ?? 0;
}

/**
 * Check and consume one extraction unit. Call BEFORE the AI request;
 * on AI failure call `refundExtraction` so the user is not charged.
 */
export async function checkAndConsume(): Promise<Entitlement> {
  const ip = await getClientIp();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Burst rate limit by IP for everyone.
  if (ip) {
    const perMinuteIp = await countExtractions({ ip }, 60_000, false);
    if (perMinuteIp >= IP_PER_MINUTE_LIMIT) {
      return {
        allowed: false,
        status: 429,
        reason: "rate_limited",
        message: "Too many requests. Please wait a minute and try again.",
      };
    }
  }

  if (!user) {
    const guestKey = await getOrSetGuestKey();
    const [byKey, byIpDay] = await Promise.all([
      countExtractions({ guestKey }, null, true),
      ip ? countExtractions({ ip }, 24 * 60 * 60_000, true) : Promise.resolve(0),
    ]);
    if (byKey >= GUEST_LIFETIME_LIMIT || byIpDay >= GUEST_IP_DAILY_LIMIT) {
      return {
        allowed: false,
        status: 402,
        reason: "guest_limit",
        message: "Free guest limit reached. Sign up to get 3 free pages every month.",
      };
    }
    return {
      allowed: true,
      userId: null,
      guestKey,
      ip,
      source: "guest",
      plan: "guest",
      remaining: GUEST_LIFETIME_LIMIT - byKey - 1,
    };
  }

  const perMinuteUser = await countExtractions({ userId: user.id }, 60_000, false);
  if (perMinuteUser >= USER_PER_MINUTE_LIMIT) {
    return {
      allowed: false,
      status: 429,
      reason: "rate_limited",
      message: "Too many requests. Please wait a minute and try again.",
    };
  }

  const admin = getSupabase();
  const { data, error } = await admin.rpc("consume_page", { p_user_id: user.id });
  if (error) {
    console.error("[Entitlements] consume_page failed:", error.message);
    // Fail open only on infrastructure errors, never on a clean quota verdict.
    return {
      allowed: true,
      userId: user.id,
      guestKey: null,
      ip,
      source: "free_quota",
      plan: "free",
      remaining: null,
    };
  }

  const verdict = data as {
    allowed: boolean;
    reason?: string;
    source?: "plan" | "credits" | "free_quota";
    plan?: string;
    remaining?: number;
  };

  if (!verdict.allowed) {
    return {
      allowed: false,
      status: 402,
      reason: "quota_exceeded",
      message:
        verdict.plan && verdict.plan !== "free"
          ? "You've reached this period's page limit."
          : "You're out of free pages this month. Upgrade to keep converting.",
    };
  }

  return {
    allowed: true,
    userId: user.id,
    guestKey: null,
    ip,
    source: verdict.source ?? "free_quota",
    plan: verdict.plan ?? "free",
    remaining: verdict.remaining ?? null,
  };
}

/** Log the extraction outcome (usage analytics + guest/IP limits). */
export async function recordExtraction(
  ent: EntitlementGranted,
  tool: string,
  status: "success" | "failed"
): Promise<void> {
  try {
    const admin = getSupabase();
    await admin.from("extractions").insert({
      user_id: ent.userId,
      guest_key: ent.guestKey,
      ip: ent.ip,
      tool,
      status,
      plan: ent.plan,
    });
  } catch (err) {
    console.error("[Entitlements] recordExtraction failed:", err);
  }
}

/** Give back the consumed unit when the AI call fails. */
export async function refundExtraction(ent: EntitlementGranted): Promise<void> {
  if (!ent.userId || ent.source === "guest") return;
  try {
    const admin = getSupabase();
    await admin.rpc("refund_page", { p_user_id: ent.userId, p_source: ent.source });
  } catch (err) {
    console.error("[Entitlements] refund failed:", err);
  }
}

/** Current plan/credit snapshot for UI decisions (watermark, badges). */
export async function getPaidStatus(userId: string): Promise<PaidCheck> {
  const admin = getSupabase();
  const { data } = await admin
    .from("users")
    .select("plan, plan_expires_at, credits")
    .eq("id", userId)
    .single();
  if (!data) return { isPaid: false, plan: "free", credits: 0 };
  const row = data as { plan?: string; plan_expires_at?: string | null; credits?: number };
  let plan = row.plan ?? "free";
  if (plan === "week_pass" && row.plan_expires_at && new Date(row.plan_expires_at) < new Date()) {
    plan = "free";
  }
  const credits = row.credits ?? 0;
  const isPaid = plan === "week_pass" || plan === "pro" || plan === "pro_yearly" || credits > 0;
  return { isPaid, plan, credits };
}
