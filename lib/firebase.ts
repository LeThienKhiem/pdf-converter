import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported, logEvent, type Analytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: "invoice-to-data-f8c0c.firebaseapp.com",
  projectId: "invoice-to-data-f8c0c",
  storageBucket: "invoice-to-data-f8c0c.firebasestorage.app",
  messagingSenderId: "798898747024",
  appId: "1:798898747024:web:1987ae09b561938bc8ca15",
  measurementId: "G-3QTWRVS4TF",
};

// Initialize Firebase safely for Next.js (Singleton pattern)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

/** Lazily resolves Analytics on the client (requires Firebase Installations API enabled in GCP). */
let analyticsReady: Promise<Analytics | null> | null = null;

function getAnalyticsWhenReady(): Promise<Analytics | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!firebaseConfig.apiKey) return Promise.resolve(null);
  if (!analyticsReady) {
    analyticsReady = isSupported()
      .then((supported) => {
        if (!supported) return null;
        try {
          return getAnalytics(app);
        } catch {
          return null;
        }
      })
      .catch(() => null);
  }
  return analyticsReady;
}

/** Logs a custom event to Firebase Analytics when supported; no-ops on server or if init fails. */
export function logAnalyticsEvent(
  name: string,
  params?: Record<string, string | number | boolean>
): void {
  if (typeof window === "undefined") return;
  void getAnalyticsWhenReady().then((analytics) => {
    if (analytics) logEvent(analytics, name, params);
  });
}

export { app, db };
