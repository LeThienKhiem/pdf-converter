import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FirebaseProvider from "@/app/components/FirebaseProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.invoicetodata.com";

export const metadata: Metadata = {
  title: {
    default: "Free AI PDF to Excel Converter - Extract Data Instantly",
    template: "%s | AI PDF to Excel Converter",
  },
  description:
    "Convert invoices, tax forms, and complex PDFs to Excel spreadsheets with AI. Keep rows and columns perfectly aligned. Free online tool, no sign-up required.",
  keywords: [
    "pdf to excel",
    "ai data extraction",
    "convert invoice to excel",
    "pdf to google sheets",
    "gemini ai converter",
  ],
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: "Free AI PDF to Excel Converter - Extract Data Instantly",
    description:
      "Convert invoices, tax forms, and complex PDFs to Excel spreadsheets with AI. Keep rows and columns perfectly aligned. Free online tool, no sign-up required.",
    url: siteUrl,
    siteName: "InvoiceToData",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free AI PDF to Excel Converter - Extract Data Instantly",
    description:
      "Convert invoices, tax forms, and complex PDFs to Excel spreadsheets with AI. Free online tool, no sign-up required.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased overflow-x-hidden`}
      >
        {/* Google AdSense - loads async, available for all AdBanner instances */}
        <Script
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8938853828038526"
          strategy="afterInteractive"
          crossOrigin="anonymous"
        />
        <FirebaseProvider />
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
