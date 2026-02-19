"use client";

import { useEffect } from "react";
import { initFirebaseAnalytics } from "@/lib/firebase";

export default function FirebaseProvider() {
  useEffect(() => {
    initFirebaseAnalytics().catch(() => {
      // Analytics init can fail if blocked or invalid config; avoid breaking the app
    });
  }, []);

  return null;
}
