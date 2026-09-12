import { createClient } from "@/lib/supabase/server";

/**
 * Admin access control for /admin and its APIs.
 *
 * Allowlist lives in the ADMIN_EMAILS env var (comma-separated). It is NOT
 * hardcoded and NOT checked into the repo, and the check fails CLOSED: with
 * the var unset nobody is an admin, so a misconfigured deploy locks the owner
 * out rather than opening the dashboard to the internet.
 */

export type AdminCheck =
  | { ok: true; email: string }
  | { ok: false; reason: "signed_out" | "forbidden" | "unconfigured"; email?: string };

function allowlist(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export async function checkAdmin(): Promise<AdminCheck> {
  const emails = allowlist();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return { ok: false, reason: "signed_out" };
  if (emails.length === 0) return { ok: false, reason: "unconfigured", email: user.email };
  if (!emails.includes(user.email.toLowerCase())) {
    return { ok: false, reason: "forbidden", email: user.email };
  }
  return { ok: true, email: user.email };
}

/** True when the caller is an allow-listed admin — for API routes. */
export async function isAdminRequest(): Promise<boolean> {
  return (await checkAdmin()).ok;
}
