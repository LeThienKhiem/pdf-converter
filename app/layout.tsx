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
    default: "PDF to Excel Free: AI Invoice OCR | Invoice To Data",
    // Spaced form on purpose — it matches how the brand is actually searched
    // ("invoice to data", 65 impressions), and until today no page title
    // carried it at all. Earlier metadata work removed the one title that did,
    // on /tools, without noticing it was the site's only spaced-brand signal.
    // Flagged as a hypothesis to measure, not a certainty: Google tokenises
    // "InvoiceToData" too, so the gain may be small.
    template: "%s | Invoice To Data",
  },
  description:
    "Convert PDF invoices, bank statements, and receipts to Excel or Google Sheets free. AI OCR extracts tables in seconds — no sign-up needed.",
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
    title: "PDF to Excel Free: AI Invoice OCR",
    description:
      "Convert PDF invoices, bank statements, and receipts to Excel or Google Sheets free. AI OCR extracts tables in seconds — no sign-up needed.",
    url: siteUrl,
    siteName: "InvoiceToData",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PDF to Excel Free: AI Invoice OCR",
    description:
      "Convert PDF invoices, bank statements, and receipts to Excel or Google Sheets free. AI OCR extracts tables in seconds.",
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
              // Search Console shows "invoice to data" — the spaced form of our
              // own name — returning this site at position 48.5 on 65
              // impressions. A site should not be buried on page 5 for its own
              // brand. Part of the cause is that nothing told Google the
              // spaced and unspaced forms are one entity, so the queries were
              // never being treated as navigational.
              //
              // Worth being clear-eyed that this is only part of it: "invoice
              // to data" is also a literal description of the product
              // category, so Google has grounds to read it as informational
              // intent rather than as a brand. alternateName helps establish
              // the entity; it cannot make a generic phrase distinctive.
              alternateName: [
                "Invoice To Data",
                "Invoice to Data",
                "invoicetodata",
                "invoicetodata.com",
              ],
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
              alternateName: ["Invoice To Data", "invoicetodata.com"],
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
              // No aggregateRating here on purpose. It previously claimed
              // 4.8 from 127 ratings, but no rating or review is displayed
              // anywhere on the site. Google requires review markup to
              // reflect content visible on the page, so unsupported ratings
              // risk a structured-data manual action for no CTR benefit
              // (Search Console reports zero rich results for this site
              // either way). Add it back only alongside real, visible reviews.
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
                    text: "Yes. You get 1 free extraction without signing up, and 3 free pages every month when you create an account. Need more? Get a $2 Week Pass (unlimited for 7 days) or Pro from $5/month.",
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
