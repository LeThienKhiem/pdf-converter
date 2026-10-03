"use client";

/**
 * Holds the user's uploaded file across a Google OAuth redirect.
 *
 * The 10-page gate fires for guests, and buying requires an account, so the
 * unlock flow has to survive a full-page redirect. localStorage can't hold a
 * 23MB binary; IndexedDB can. The file is restored on return so the user
 * never re-uploads — re-uploading a 240-page statement after paying is the
 * kind of friction that loses the sale.
 */

const DB_NAME = "itd-pending";
const STORE = "files";
const META_KEY = "itd_unlock_intent";
const TTL_MS = 30 * 60 * 1000;

export type UnlockIntent = {
  tool: string;
  fileName: string;
  pagesTotal: number;
  savedAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Stash the file + what the user was trying to unlock. Never throws. */
export async function savePendingFile(file: File, intent: Omit<UnlockIntent, "savedAt">): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(file, "pending");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    localStorage.setItem(META_KEY, JSON.stringify({ ...intent, savedAt: Date.now() } satisfies UnlockIntent));
  } catch (err) {
    console.warn("[pendingFile] could not stash file:", err);
  }
}

/** Read back the stashed file + intent, clearing both. Null if absent/stale. */
export async function takePendingFile(): Promise<{ file: File; intent: UnlockIntent } | null> {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return null;
    localStorage.removeItem(META_KEY);
    const intent = JSON.parse(raw) as UnlockIntent;
    if (Date.now() - intent.savedAt > TTL_MS) return null;

    const db = await openDb();
    const file = await new Promise<File | null>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const get = store.get("pending");
      get.onsuccess = () => {
        store.delete("pending");
        resolve((get.result as File) ?? null);
      };
      get.onerror = () => resolve(null);
    });
    db.close();
    return file ? { file, intent } : null;
  } catch {
    return null;
  }
}

export function clearPendingFile(): void {
  try {
    localStorage.removeItem(META_KEY);
  } catch {
    /* ignore */
  }
}
