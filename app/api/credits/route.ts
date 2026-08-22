import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabase } from "@/lib/supabase";
import { getPaidStatus } from "@/lib/entitlements";

/** GET: current user's credits + plan snapshot (used for UI decisions like watermark). */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabase();
  const { data, error } = await admin
    .from("users")
    .select("credits, plan, plan_expires_at, pages_used")
    .eq("id", user.id)
    .single();

  if (error || data == null) {
    return NextResponse.json(
      { error: error?.message ?? "User not found" },
      { status: 404 }
    );
  }

  const { isPaid, plan, credits } = await getPaidStatus(user.id);
  const pagesUsed = (data as { pages_used?: number }).pages_used ?? 0;

  return NextResponse.json({ credits, plan, isPaid, pagesUsed });
}

/**
 * POST: DEPRECATED — deduction now happens server-side inside /api/extract
 * and /api/gsheet. Kept as a no-op so older cached clients that still call
 * it after a conversion don't double-charge users. Returns current balance.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { credits, plan, isPaid } = await getPaidStatus(user.id);
  return NextResponse.json({ credits, plan, isPaid, deprecated: true });
}
