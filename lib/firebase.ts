import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
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

// Analytics disabled until Firebase Installations API is enabled in Google Cloud Console.
// See: https://console.developers.google.com/apis/api/firebaseinstallations.googleapis.com
// Once enabled, uncomment the block below to restore Analytics.
let analytics: ReturnType<typeof getAnalytics> | null = null;
// if (typeof window !== "undefined") {
//   isSupported().then((supported) => {
//     if (supported) {
//       analytics = getAnalytics(app);
//     }
//   });
// }

export { app, db, analytics };
