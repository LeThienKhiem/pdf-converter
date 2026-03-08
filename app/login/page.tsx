"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [signUpSuccess, setSignUpSuccess] = useState(false);
  const [loadingSignIn, setLoadingSignIn] = useState(false);
  const [loadingSignUp, setLoadingSignUp] = useState(false);

  const supabase = createClient();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSignUpSuccess(false);
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setLoadingSignIn(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (err) {
        setError(err.message);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoadingSignIn(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSignUpSuccess(false);
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setLoadingSignUp(true);
    try {
      const { error: err } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (err) {
        setError(err.message);
        return;
      }
      setSignUpSuccess(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoadingSignUp(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-sm border border-gray-100">
        <div>
          <Link
            href="/"
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            ← Back to Home
          </Link>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
            Welcome back to InvoiceToData
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Sign in to your account to manage your credits and conversions.
          </p>
        </div>

        {signUpSuccess && (
          <div
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
            role="status"
          >
            Registration successful! Please check your email inbox to verify your account before logging in.
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSignIn}>
          {error && (
            <div
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              role="alert"
            >
              {error}
            </div>
          )}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-[#217346] focus:outline-none focus:ring-1 focus:ring-[#217346] sm:text-sm"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-[#217346] focus:outline-none focus:ring-1 focus:ring-[#217346] sm:text-sm"
              placeholder="••••••••"
            />
          </div>
          <div className="flex flex-col gap-3">
            <button
              type="submit"
              disabled={loadingSignIn}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#217346] px-4 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-[#1d603d] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingSignIn ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                  Signing in…
                </>
              ) : (
                "Sign In"
              )}
            </button>
            <button
              type="button"
              onClick={handleSignUp}
              disabled={loadingSignUp}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingSignUp ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                  Creating account…
                </>
              ) : (
                "Create Account"
              )}
            </button>
          </div>
        </form>

        <p className="text-center text-xs text-slate-500">
          By continuing, you agree to our{" "}
          <Link href="/terms" className="text-[#217346] hover:underline">Terms</Link>
          {" "}and{" "}
          <Link href="/privacy" className="text-[#217346] hover:underline">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
