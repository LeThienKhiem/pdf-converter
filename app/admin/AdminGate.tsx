"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Google-only sign-in screen for /admin. The allowlist check happens on the
 * server (lib/adminAuth.ts); this is just the door.
 */
export default function AdminGate({
  reason,
  email,
}: {
  reason: "signed_out" | "forbidden" | "unconfigured";
  email?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    setBusy(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: typeof window !== "undefined" ? window.location.href : undefined },
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xl" aria-hidden>
          🔒
        </div>

        {reason === "signed_out" && (
          <>
            <h1 className="mt-4 text-lg font-semibold text-slate-900">Admin access</h1>
            <p className="mt-2 text-sm text-slate-600">Sign in with the owner Google account to continue.</p>
            <button
              type="button"
              onClick={signIn}
              disabled={busy}
              className="mt-6 inline-flex w-full items-center justify-center gap-2.5 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              {busy ? "Redirecting…" : "Continue with Google"}
            </button>
          </>
        )}

        {reason === "forbidden" && (
          <>
            <h1 className="mt-4 text-lg font-semibold text-slate-900">Not authorized</h1>
            <p className="mt-2 text-sm text-slate-600">
              <span className="font-medium">{email}</span> is not on the admin allowlist.
            </p>
            <button
              type="button"
              onClick={signOut}
              className="mt-6 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
            >
              Sign in with a different account
            </button>
          </>
        )}

        {reason === "unconfigured" && (
          <>
            <h1 className="mt-4 text-lg font-semibold text-slate-900">Admin not configured</h1>
            <p className="mt-2 text-sm text-slate-600">
              Set the <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">ADMIN_EMAILS</code> environment
              variable to your Google address, then redeploy. Access stays closed until you do.
            </p>
            {email && <p className="mt-3 text-xs text-slate-500">Signed in as {email}</p>}
          </>
        )}
      </div>
    </div>
  );
}
