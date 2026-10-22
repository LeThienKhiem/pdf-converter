import { createClient } from "@/lib/supabase/server";
import { getSupabase } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { NEXT_COOKIE, safeNextPath } from "@/lib/authRedirect";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Resume where the user started (set by oauthRedirectTo), else the dashboard.
  const store = await cookies();
  const next =
    safeNextPath(searchParams.get("next")) ?? safeNextPath(store.get(NEXT_COOKIE)?.value) ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await recordSignin(data.user?.id ?? null, store.get("itd_gid")?.value ?? null, next);
      const res = NextResponse.redirect(`${origin}${next}`);
      res.cookies.delete(NEXT_COOKIE);
      return res;
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}

/**
 * "Came back signed in" for the paywall funnel. Recorded here rather than on
 * the page so it counts every return — including ones with nothing stashed to
 * restore, which the page-side resume events never saw.
 */
async function recordSignin(userId: string | null, guestKey: string | null, path: string) {
  try {
    const h = await headers();
    const fwd = h.get("x-forwarded-for");
    const ip = fwd ? fwd.split(",")[0]!.trim() : h.get("x-real-ip");
    const { error } = await getSupabase().from("funnel_events").insert({
      event: "signin_completed",
      user_id: userId,
      guest_key: guestKey?.slice(0, 64) ?? null,
      ip: ip?.slice(0, 64) ?? null,
      path: path.slice(0, 200),
    });
    if (error) console.error("[auth/callback] funnel insert failed:", error.message);
  } catch (err) {
    console.error("[auth/callback] funnel insert failed:", err);
  }
}
