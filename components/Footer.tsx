import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
        <p className="text-sm text-slate-500">
          © {new Date().getFullYear()} InvoiceToData.com. All rights reserved.
        </p>
        <div className="flex gap-6">
          <Link href="/privacy" className="text-sm text-slate-500 hover:text-slate-700">
            Privacy
          </Link>
          <Link href="/terms" className="text-sm text-slate-500 hover:text-slate-700">
            Terms
          </Link>
        </div>
      </div>
    </footer>
  );
}
