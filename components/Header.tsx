"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileSpreadsheet, ChevronDown } from "lucide-react";

export default function Header() {
  const pathname = usePathname();
  const [toolsOpen, setToolsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setToolsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isPdfToExcel = pathname === "/tools/pdf-to-excel";
  const isPdfToGsheet = pathname === "/tools/pdf-to-gsheet";

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 font-semibold text-slate-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
            <FileSpreadsheet className="h-4 w-4" />
          </span>
          InvoiceToData
        </Link>
        <nav className="flex items-center gap-1 sm:gap-6">
          <Link
            href="/#features"
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            Features
          </Link>
          <Link
            href="/#how-it-works"
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            How it Works
          </Link>
          <Link
            href="/blogs"
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            Blogs
          </Link>
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setToolsOpen((o) => !o)}
              className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              aria-expanded={toolsOpen}
              aria-haspopup="true"
            >
              Tools
              <ChevronDown className={`h-4 w-4 transition-transform ${toolsOpen ? "rotate-180" : ""}`} />
            </button>
            {toolsOpen && (
              <div
                className="absolute right-0 top-full mt-1 min-w-[200px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
                role="menu"
              >
                <Link
                  href="/tools/pdf-to-excel"
                  onClick={() => setToolsOpen(false)}
                  role="menuitem"
                  className={`block px-4 py-2 text-sm ${isPdfToExcel ? "bg-blue-50 font-medium text-blue-700" : "text-slate-700 hover:bg-slate-50"}`}
                >
                  PDF to Excel
                  {isPdfToExcel && <span className="ml-2 text-xs text-blue-600">(Current)</span>}
                </Link>
                <Link
                  href="/tools/pdf-to-gsheet"
                  onClick={() => setToolsOpen(false)}
                  role="menuitem"
                  className="block px-4 py-2 text-sm text-slate-500 hover:bg-slate-50"
                >
                  PDF to Google Sheet
                  <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-500">Coming Soon</span>
                </Link>
              </div>
            )}
          </div>
          <Link
            href="/login"
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            Log in
          </Link>
          <Link
            href="/tools/pdf-to-excel"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Get Started
          </Link>
        </nav>
      </div>
    </header>
  );
}
