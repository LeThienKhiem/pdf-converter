"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileSpreadsheet, ChevronDown, Menu, X } from "lucide-react";

export default function Header() {
  const pathname = usePathname();
  const [toolsOpen, setToolsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        const portal = document.getElementById("tools-dropdown-portal");
        if (portal?.contains(target)) return;
        setToolsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (toolsOpen && dropdownRef.current && typeof document !== "undefined") {
      const rect = dropdownRef.current.getBoundingClientRect();
      setDropdownRect({ top: rect.bottom + 4, left: Math.max(8, rect.right - 200) });
    } else {
      setDropdownRect(null);
    }
  }, [toolsOpen]);

  // Freeze background scroll when mobile menu is open (reliable on iOS with position: fixed)
  useEffect(() => {
    if (mobileMenuOpen) {
      const scrollY = window.scrollY;
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      return () => {
        document.body.style.overflow = "";
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.left = "";
        document.body.style.right = "";
        window.scrollTo(0, scrollY);
      };
    }
  }, [mobileMenuOpen]);

  const isPdfToExcel = pathname === "/tools/pdf-to-excel";
  const isPdfToGsheet = pathname === "/tools/pdf-to-gsheet";

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const navLinks = (
    <>
      <Link
        href="/#features"
        onClick={closeMobileMenu}
        className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
      >
        Features
      </Link>
      <Link
        href="/#how-it-works"
        onClick={closeMobileMenu}
        className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
      >
        How it Works
      </Link>
      <Link
        href="/blog"
        onClick={closeMobileMenu}
        className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
      >
        Blog
      </Link>
      <div
        className="relative"
        ref={dropdownRef}
        onMouseEnter={() => setToolsOpen(true)}
        aria-expanded={toolsOpen}
        aria-haspopup="true"
      >
        <Link
          href="/tools"
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          Tools
          <ChevronDown className={`h-4 w-4 transition-transform ${toolsOpen ? "rotate-180" : ""}`} />
        </Link>
      </div>
      <Link
        href="/business"
        onClick={closeMobileMenu}
        className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700"
      >
        Business
      </Link>
      <Link
        href="/tools/pdf-to-excel"
        onClick={closeMobileMenu}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
      >
        Get Started
      </Link>
    </>
  );

  return (
    <header className="sticky top-0 z-50 w-full overflow-hidden border-b border-slate-200/80 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-w-0 shrink-0 items-center gap-2 font-semibold text-slate-900">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
            <FileSpreadsheet className="h-4 w-4" />
          </span>
          <span className="truncate">InvoiceToData</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex md:items-center md:gap-1 md:shrink-0 sm:gap-6" aria-label="Main">
          {navLinks}
        </nav>

        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 md:hidden"
          aria-label="Open menu"
          aria-expanded={mobileMenuOpen}
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>

      {/* Tools dropdown: portal so header can use overflow-hidden (no scroll) */}
      {toolsOpen &&
        dropdownRect &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            id="tools-dropdown-portal"
            role="menu"
            className="fixed z-[100] min-w-[200px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
            style={{ top: dropdownRect.top, left: dropdownRect.left }}
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
            </Link>
            <Link
              href="/tools#all-tools"
              onClick={() => setToolsOpen(false)}
              role="menuitem"
              className="block border-t border-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              All Tools
            </Link>
          </div>,
          document.body
        )}

      {/* Mobile menu overlay: rendered via portal so it is not clipped by header overflow-hidden */}
      {mobileMenuOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-x-0 top-16 z-[100] h-[calc(100dvh-4rem)] overflow-hidden bg-white md:hidden [touch-action:manipulation]"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile menu"
          >
            <div className="flex h-full w-full flex-col overflow-hidden px-4 pb-8 pt-4">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); closeMobileMenu(); }}
                  className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-600 [touch-action:manipulation] hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200"
                  aria-label="Close menu"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <nav className="mt-4 flex flex-col gap-1" aria-label="Main">
                <Link
                  href="/#features"
                  onClick={closeMobileMenu}
                  className="rounded-lg px-4 py-3 text-base font-medium text-slate-700 hover:bg-slate-100"
                >
                  Features
                </Link>
                <Link
                  href="/#how-it-works"
                  onClick={closeMobileMenu}
                  className="rounded-lg px-4 py-3 text-base font-medium text-slate-700 hover:bg-slate-100"
                >
                  How it Works
                </Link>
                <Link
                  href="/blog"
                  onClick={closeMobileMenu}
                  className="rounded-lg px-4 py-3 text-base font-medium text-slate-700 hover:bg-slate-100"
                >
                  Blog
                </Link>
                <div className="border-t border-slate-200 pt-2">
                  <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Tools</p>
                  <Link
                    href="/tools/pdf-to-excel"
                    onClick={closeMobileMenu}
                    className={`block rounded-lg px-4 py-3 text-base font-medium ${isPdfToExcel ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-100"}`}
                  >
                    PDF to Excel
                    {isPdfToExcel && <span className="ml-2 text-sm text-blue-600">(Current)</span>}
                  </Link>
                  <Link
                    href="/tools/pdf-to-gsheet"
                    onClick={closeMobileMenu}
                    className="block rounded-lg px-4 py-3 text-base font-medium text-slate-700 hover:bg-slate-100"
                  >
                    PDF to Google Sheet
                  </Link>
                  <Link
                    href="/tools#all-tools"
                    onClick={closeMobileMenu}
                    className="block rounded-lg px-4 py-3 text-base font-medium text-slate-700 hover:bg-slate-100"
                  >
                    All Tools
                  </Link>
                </div>
                <div className="border-t border-slate-200 pt-2">
                  <Link
                    href="/business"
                    onClick={closeMobileMenu}
                    className="block rounded-md bg-green-600 px-4 py-3 text-center text-base font-semibold text-white hover:bg-green-700"
                  >
                    Business
                  </Link>
                  <Link
                    href="/tools/pdf-to-excel"
                    onClick={closeMobileMenu}
                    className="block rounded-lg bg-blue-600 px-4 py-3 text-center text-base font-semibold text-white hover:bg-blue-700"
                  >
                    Get Started
                  </Link>
                </div>
              </nav>
            </div>
          </div>,
          document.body
        )}
    </header>
  );
}
