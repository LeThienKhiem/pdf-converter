import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
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
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const res = NextResponse.redirect(`${origin}${next}`);
      res.cookies.delete(NEXT_COOKIE);
      return res;
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
