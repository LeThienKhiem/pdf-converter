import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://invoicetodata.com";

export const metadata: Metadata = {
  title: "AI PDF to Excel Converter - Fast & Accurate Extraction",
  description:
    "Free online tool to extract data from any PDF, Invoice, or Form into structured Excel files using Gemini AI.",
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: "AI PDF to Excel Converter - Fast & Accurate Extraction",
    description:
      "Free online tool to extract data from any PDF, Invoice, or Form into structured Excel files using Gemini AI.",
    url: siteUrl,
    siteName: "InvoiceToData",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI PDF to Excel Converter - Fast & Accurate Extraction",
    description:
      "Free online tool to extract data from any PDF, Invoice, or Form into structured Excel files using Gemini AI.",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
