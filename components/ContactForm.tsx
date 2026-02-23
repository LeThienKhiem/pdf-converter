"use client";

export default function ContactForm() {
  return (
    <form
      className="mt-6 space-y-5"
      onSubmit={(e) => e.preventDefault()}
    >
      <div>
        <label htmlFor="contact-name" className="block text-sm font-medium text-slate-700">
          Name
        </label>
        <input
          id="contact-name"
          type="text"
          name="name"
          autoComplete="name"
          className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Your name"
        />
      </div>
      <div>
        <label htmlFor="contact-email" className="block text-sm font-medium text-slate-700">
          Email
        </label>
        <input
          id="contact-email"
          type="email"
          name="email"
          autoComplete="email"
          className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label htmlFor="contact-message" className="block text-sm font-medium text-slate-700">
          Message
        </label>
        <textarea
          id="contact-message"
          name="message"
          rows={4}
          className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="How can we help?"
        />
      </div>
      <button
        type="submit"
        className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        Send message
      </button>
    </form>
  );
}
