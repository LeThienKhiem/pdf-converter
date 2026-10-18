/**
 * Where Google OAuth should send people back to.
 *
 * Supabase only redirects to URLs on its allow list, and ours lists exactly
 * `/auth/callback`. Passing `window.location.href` (any other page) is
 * silently rejected and Supabase falls back to the Site URL — the homepage.
 * That broke every "sign in, then carry on" flow: the paywall stashes the
 * user's document on /tools/bank-statement-to-excel, Google returned them to
 * /, and the stash was never picked up.
 *
 * So OAuth always returns to the allow-listed /auth/callback, and the page to
 * resume on travels in a short-lived cookie that the callback reads. (A
 * `?next=` query param would change the URL and miss the allow-list match.)
 */

export const NEXT_COOKIE = "itd_next";

/** Only same-site paths: "/x" yes, "//evil.com" and "/\evil.com" no. */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value) return null;
  let v: string;
  try {
    v = decodeURIComponent(value);
  } catch {
    return null;
  }
  if (!v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return null;
  return v.slice(0, 500);
}

/** Call right before signInWithOAuth; returns the redirectTo to pass. */
export function oauthRedirectTo(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const here = window.location.pathname + window.location.search;
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${NEXT_COOKIE}=${encodeURIComponent(here)}; path=/; max-age=900; samesite=lax${secure}`;
  return `${window.location.origin}/auth/callback`;
}
