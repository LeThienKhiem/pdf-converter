"use client";

import type { GridData } from "@/lib/clientExtract";

/**
 * The download wall sends guests through Google OAuth, which is a full-page
 * redirect — their extraction result would be lost. Save it right before
 * opening the sign-in modal and restore it when the page mounts again.
 */

export type PendingResult = {
  grids: { name: string; grid: GridData }[];
  savedAt: number;
};

const TTL_MS = 30 * 60 * 1000;

export function savePendingResult(key: string, grids: PendingResult["grids"]): void {
  try {
    localStorage.setItem(key, JSON.stringify({ grids, savedAt: Date.now() } satisfies PendingResult));
  } catch {
    // storage full or blocked — the wall still works, result just won't survive the redirect
  }
}

export function takePendingResult(key: string): PendingResult["grids"] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    localStorage.removeItem(key);
    const parsed = JSON.parse(raw) as PendingResult;
    if (!Array.isArray(parsed.grids) || Date.now() - parsed.savedAt > TTL_MS) return null;
    return parsed.grids;
  } catch {
    return null;
  }
}
