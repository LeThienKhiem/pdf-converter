import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getSupabase } from "@/lib/supabase";
import { FUNNEL_EVENTS, type FunnelEvent } from "@/lib/funnel";

/**
 * Paywall funnel events. Written server-side so they don't depend on Firebase
 * (its key is rejected) or on ad blockers dropping third-party analytics.
 * Fire-and-forget from the client via sendBeacon — always answers 204.
 */

const ALLOWED = new Set<string>(FUNNEL_EVENTS);

const clip = (v: unknown, max: number): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(await req.text());
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  const event = clip(body.event, 40);
  if (!event || !ALLOWED.has(event)) return new NextResponse(null, { status: 204 });

  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  const ip = fwd ? fwd.split(",")[0]!.trim() : h.get("x-real-ip");
  const guestKey = (await cookies()).get("itd_gid")?.value ?? null;

  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    // no session — a guest event
  }

  const pages = Number(body.pagesTotal);
  const row = {
    event: event as FunnelEvent,
    variant: clip(body.variant, 40),
    tool: clip(body.tool, 60),
    source: clip(body.source, 60),
    pages_total: Number.isFinite(pages) && pages > 0 ? Math.min(Math.round(pages), 100000) : null,
    user_id: userId,
    guest_key: clip(guestKey, 64),
    ip: clip(ip, 64),
    path: clip(body.path, 200),
  };

  const { error } = await getSupabase().from("funnel_events").insert(row);
  if (error) console.error("[track] insert failed:", error.message);
  return new NextResponse(null, { status: 204 });
}
