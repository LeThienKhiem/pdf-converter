/**
 * Paywall funnel tracking — one row per step in `funnel_events`, written by
 * /api/track. Safe to import from client and server code.
 */

export const FUNNEL_EVENTS = [
  "paywall_shown", // a QuotaLimitModal variant opened
  "paywall_dismiss", // closed without acting
  "paywall_google_click", // "Continue with Google" inside the paywall
  "paywall_email_click", // "or sign up with email" → /login
  "paywall_pricing_click", // a /pricing link inside the paywall
  "unlock_resumed", // came back from Google sign-in, stashed document picked up
  "download_resumed", // came back from Google sign-in, stashed result restored
  "excel_downloaded",
  "checkout_open", // Paddle overlay requested
  "checkout_loaded",
  "checkout_customer", // entered email / country
  "checkout_payment_initiated",
  "checkout_payment_failed",
  "checkout_error",
  "checkout_closed",
  "checkout_completed",
] as const;

export type FunnelEvent = (typeof FUNNEL_EVENTS)[number];

export type FunnelProps = {
  variant?: string | null;
  tool?: string | null;
  source?: string | null;
  pagesTotal?: number | null;
};

/** Fire-and-forget; survives the page unloading (e.g. the Google redirect). */
export function trackFunnel(event: FunnelEvent, props: FunnelProps = {}): void {
  if (typeof window === "undefined") return;
  try {
    const body = JSON.stringify({ event, ...props, path: window.location.pathname });
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon?.("/api/track", blob)) return;
    void fetch("/api/track", { method: "POST", body, keepalive: true }).catch(() => {});
  } catch {
    // tracking must never break the page
  }
}
