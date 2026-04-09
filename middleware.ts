import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware to enforce www subdomain for SEO consistency.
 * Redirects invoicetodata.com → www.invoicetodata.com with 301 (permanent).
 * This fixes the duplicate homepage issue in Google Search Console.
 */
export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const hostname = request.headers.get("host") ?? url.hostname;

  // Only redirect in production (not localhost or Vercel preview)
  if (
    hostname === "invoicetodata.com" &&
    !hostname.startsWith("localhost") &&
    !hostname.includes("vercel.app")
  ) {
    url.hostname = "www.invoicetodata.com";
    url.host = "www.invoicetodata.com";
    return NextResponse.redirect(url, 301);
  }

  return NextResponse.next();
}

export const config = {
  // Run on all paths except static assets and API routes
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.png$|.*\\.jpg$|.*\\.svg$|api/).*)",
  ],
};
