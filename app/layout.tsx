import type { Metadata } from "next";
import { GoogleAnalytics } from "@next/third-parties/google";
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
    default: "Invoice OCR — Convert PDF Invoices to Excel & Google Sheets Free | InvoiceToData",
    template: "%s | InvoiceToData",
  },
  description:
    "Free AI-powered invoice OCR tool. Extract data from PDF invoices, bank statements, and receipts into Excel or Google Sheets in seconds. No sign-up required.",
  keywords: [
    "invoice OCR",
    "PDF to Excel",
    "invoice data extraction",
    "convert invoice to Excel",
    "PDF to Google Sheets",
    "invoice parser",
    "invoice scanning",
    "automated invoice processing",
    "bank statement to Excel",
    "AI OCR",
  ],
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    title: "Invoice OCR — Convert PDF Invoices to Excel Free",
    description:
      "Free AI-powered invoice OCR. Extract data from PDF invoices into Excel or Google Sheets in seconds. No sign-up required.",
    url: siteUrl,
    siteName: "InvoiceToData",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Invoice OCR — Convert PDF Invoices to Excel Free",
    description:
      "Free AI-powered invoice OCR. Extract data from PDF invoices into Excel or Google Sheets in seconds.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "InvoiceToData",
              url: siteUrl,
              logo: `${siteUrl}/favicon.ico`,
              description:
                "AI-powered invoice OCR tool that converts PDF invoices, bank statements, and receipts into structured Excel and Google Sheets data.",
              sameAs: [
                "https://x.com/_pdftodata",
              ],
              contactPoint: {
                "@type": "ContactPoint",
                contactType: "customer support",
                email: "support@invoicetodata.com",
              },
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "InvoiceToData",
              url: siteUrl,
              description:
                "Free AI-powered invoice OCR. Convert PDF invoices to Excel and Google Sheets.",
              potentialAction: {
                "@type": "SearchAction",
                target: `${siteUrl}/blog?q={search_term_string}`,
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "InvoiceToData",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              url: siteUrl,
              description:
                "AI-powered invoice OCR tool. Upload PDF invoices and get structured data in Excel or Google Sheets in seconds.",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
                description: "Free tier with 3 credits. Credit packs from $9.99.",
              },
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: "4.8",
                ratingCount: "127",
                bestRating: "5",
              },
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: [
                {
                  "@type": "Question",
                  name: "What file types are supported?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "InvoiceToData accepts PDF files and images (JPEG, PNG, WebP, GIF). Files must be under 15MB with a maximum of 50 pages per document.",
                  },
                },
                {
                  "@type": "Question",
                  name: "Is the PDF to Excel converter free?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Yes. You get 1 free extraction without signing up, and 3 free credits when you create an account. Additional credits are $9.99 for 50 (about $0.20 per page).",
                  },
                },
                {
                  "@type": "Question",
                  name: "How accurate is the invoice OCR extraction?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "InvoiceToData uses Anthropic Claude AI for layout-aware extraction. Rows, columns, tables, line items, and financial data are preserved with high accuracy in the Excel output.",
                  },
                },
                {
                  "@type": "Question",
                  name: "Do you store my documents?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "No. All files are processed in memory and deleted immediately after extraction. Your invoices and financial documents are never stored on our servers.",
                  },
                },
                {
                  "@type": "Question",
                  name: "Does it support multiple languages and international currencies?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Yes. The AI recognizes international currency symbols (EUR, GBP, JPY, AUD) and distinguishes between regional date formats (DD/MM/YYYY vs MM/DD/YYYY).",
                  },
                },
                {
                  "@type": "Question",
                  name: "Will the Excel file work with QuickBooks or Xero?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Yes. Data is exported in clean tabular format (.xlsx or .csv) with standard columns (Date, Description, Amount, Balance) ready for direct import into QuickBooks, Xero, or Sage.",
                  },
                },
              ],
            }),
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased overflow-x-hidden`}
      >
        <GoogleAnalytics gaId="G-3QTWRVS4TF" />
        <FirebaseProvider />
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
