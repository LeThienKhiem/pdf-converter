
// Replace with your Firebase project config from Firebase Console
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAxalen-YkYUpyQ_-_gVbmGP7EcP5LINio",
  authDomain: "invoice-to-data-f8c0c.firebaseapp.com",
  projectId: "invoice-to-data-f8c0c",
  storageBucket: "invoice-to-data-f8c0c.firebasestorage.app",
  messagingSenderId: "798898747024",
  appId: "1:798898747024:web:1987ae09b561938bc8ca15",
  measurementId: "G-3QTWRVS4TF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

let app: FirebaseApp | null = null;
let analytics: Analytics | null = null;

export function getFirebase(): { app: FirebaseApp; analytics: Analytics | null } | null {
  if (typeof window === "undefined") return null;

  if (!app) {
    app = initializeApp(firebaseConfig);
  }

  return { app, analytics };
}

export async function initFirebaseAnalytics(): Promise<Analytics | null> {
  if (typeof window === "undefined") return null;

  if (analytics) return analytics;

  const supported = await isSupported();
  if (!supported) return null;

  if (!app) {
    app = initializeApp(firebaseConfig);
  }
  analytics = getAnalytics(app);
  return analytics;
}
