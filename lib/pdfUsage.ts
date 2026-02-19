const DAILY_LIMIT = 3;
const KEY_PREFIX = "pdf_usage_";

function getTodayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${KEY_PREFIX}${y}-${m}-${d}`;
}

/** Current usage count for today (0 if none). Safe to call in SSR; returns 0. */
export function getUsage(): number {
  if (typeof window === "undefined") return 0;
  try {
    const key = getTodayKey();
    const raw = localStorage.getItem(key);
    if (raw == null) return 0;
    const n = parseInt(raw, 10);
    return Number.isNaN(n) ? 0 : Math.max(0, n);
  } catch {
    return 0;
  }
}

/** Increment today's usage by 1. Call after a successful conversion. */
export function incrementUsage(): void {
  if (typeof window === "undefined") return;
  try {
    const key = getTodayKey();
    const current = getUsage();
    localStorage.setItem(key, String(current + 1));
  } catch {
    // ignore
  }
}

/** True if user can still convert (usage < limit). */
export function canConvert(): boolean {
  return getUsage() < DAILY_LIMIT;
}

export const PDF_DAILY_LIMIT = DAILY_LIMIT;
