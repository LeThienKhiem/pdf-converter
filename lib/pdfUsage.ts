const GUEST_LIMIT = 1;
const GUEST_USAGE_KEY = "guest_usage_count";

/** Current guest conversion count (0 if none). Safe to call in SSR; returns 0. */
export function getGuestUsage(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(GUEST_USAGE_KEY);
    if (raw == null) return 0;
    const n = parseInt(raw, 10);
    return Number.isNaN(n) ? 0 : Math.max(0, n);
  } catch {
    return 0;
  }
}

/** Increment guest usage by 1. Call after a successful conversion (guest only). */
export function incrementGuestUsage(): void {
  if (typeof window === "undefined") return;
  try {
    const current = getGuestUsage();
    localStorage.setItem(GUEST_USAGE_KEY, String(current + 1));
  } catch {
    // ignore
  }
}

/** True if guest can still convert (usage < limit). Use only when user is not logged in. */
export function canGuestConvert(): boolean {
  return getGuestUsage() < GUEST_LIMIT;
}

export const GUEST_CONVERSION_LIMIT = GUEST_LIMIT;
