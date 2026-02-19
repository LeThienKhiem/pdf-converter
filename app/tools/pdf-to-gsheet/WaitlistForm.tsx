"use client";

import { useState } from "react";

export default function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="mt-10 rounded-xl border border-green-200 bg-green-50 px-6 py-4 text-center text-green-800">
        <p className="font-medium">You&apos;re on the list!</p>
        <p className="mt-1 text-sm text-green-700">
          We&apos;ll notify you at <strong>{email}</strong> when PDF to Google Sheets is ready.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
      <label htmlFor="waitlist-email" className="sr-only">
        Email for waitlist
      </label>
      <input
        id="waitlist-email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter your email"
        required
        className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 sm:max-w-xs"
      />
      <button
        type="submit"
        className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        Notify Me
      </button>
    </form>
  );
}
