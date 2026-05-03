/**
 * Layer 4 — Programmatic SEO entity database.
 *
 * Each entry produces a long-tail SEO landing page at
 *   /tools/bank/{slug}-statement-to-excel
 * targeting search terms like "convert {bank} statement to excel".
 *
 * Hand-curated to AVOID hallucinated bank facts. We only encode
 * publicly-verifiable, stable facts:
 *   - Bank legal/marketing name
 *   - Country + primary currency
 *   - Public website domain
 *   - General statement format (PDF universally; CSV/QFX as alternates)
 *   - General login flow guidance (NOT specific URLs that may change)
 *   - Whether the institution typically password-protects PDF statements
 *
 * Things we deliberately DO NOT encode (to avoid wrong specifics):
 *   - Exact column names per bank (these vary by account type)
 *   - Exact PDF layout specifics
 *   - Bank-specific password formats (varies and changes)
 *
 * To add a bank: append an entry, redeploy. Pages auto-generate via
 * generateStaticParams(). To remove, delete the entry.
 */

export type BankEntity = {
  /** URL slug, kebab-case, no "convert" prefix or "statement" suffix. */
  slug: string;
  /** Display name (legal/marketing). */
  name: string;
  /** Two-letter country code (ISO 3166-1 alpha-2), uppercase. */
  country: string;
  /** Three-letter currency code (ISO 4217), uppercase. */
  currency: string;
  /** Primary public domain — used for "log in to your X account" guidance. */
  domain: string;
  /** Statement formats the bank typically offers for download. */
  statementFormats: ReadonlyArray<"PDF" | "CSV" | "QFX" | "OFX" | "QBO">;
  /** Whether the institution commonly password-protects PDF statements. */
  passwordProtected: boolean;
  /**
   * One sentence specific to this bank's statement workflow that adds
   * actual value (not generic). Keep it factual + general — no made-up
   * specifics like exact column names.
   */
  note: string;
  /** Common account types whose statements this tool handles for the bank. */
  accountTypes: ReadonlyArray<string>;
};

export const BANK_ENTITIES: ReadonlyArray<BankEntity> = [
  {
    slug: "chase",
    name: "Chase",
    country: "US",
    currency: "USD",
    domain: "chase.com",
    statementFormats: ["PDF", "CSV", "QFX"],
    passwordProtected: false,
    note: "Chase statements are typically issued monthly per account; if you have multiple Chase accounts (checking, savings, credit), you'll receive a separate PDF for each.",
    accountTypes: ["Checking", "Savings", "Credit Card", "Business"],
  },
  {
    slug: "bank-of-america",
    name: "Bank of America",
    country: "US",
    currency: "USD",
    domain: "bankofamerica.com",
    statementFormats: ["PDF", "CSV", "QFX", "QBO"],
    passwordProtected: false,
    note: "Bank of America statements include a transaction summary at the top followed by detailed transaction lines — both sections extract cleanly into separate sheet sections.",
    accountTypes: ["Checking", "Savings", "Credit Card", "Business"],
  },
  {
    slug: "wells-fargo",
    name: "Wells Fargo",
    country: "US",
    currency: "USD",
    domain: "wellsfargo.com",
    statementFormats: ["PDF", "CSV", "QFX"],
    passwordProtected: false,
    note: "Wells Fargo combined statements may bundle multiple accounts into one PDF; the tool will preserve each account's transaction table as a distinct section.",
    accountTypes: ["Checking", "Savings", "Credit Card", "Business"],
  },
  {
    slug: "citi",
    name: "Citi",
    country: "US",
    currency: "USD",
    domain: "citi.com",
    statementFormats: ["PDF", "CSV"],
    passwordProtected: false,
    note: "Citi credit card statements include a payment summary and a per-cardholder transaction breakdown for joint cards — both extract into structured rows.",
    accountTypes: ["Checking", "Credit Card", "Business"],
  },
  {
    slug: "us-bank",
    name: "U.S. Bank",
    country: "US",
    currency: "USD",
    domain: "usbank.com",
    statementFormats: ["PDF", "CSV"],
    passwordProtected: false,
    note: "U.S. Bank statements use a standard date / description / amount / balance layout that maps directly to four spreadsheet columns.",
    accountTypes: ["Checking", "Savings", "Credit Card"],
  },
  {
    slug: "capital-one",
    name: "Capital One",
    country: "US",
    currency: "USD",
    domain: "capitalone.com",
    statementFormats: ["PDF", "CSV"],
    passwordProtected: false,
    note: "Capital One credit card statements separate transactions into 'Payments / Other Credits' and 'Purchases' — useful when you want to filter inflows from outflows after extraction.",
    accountTypes: ["Checking", "Savings", "Credit Card", "Business"],
  },
  {
    slug: "pnc",
    name: "PNC Bank",
    country: "US",
    currency: "USD",
    domain: "pnc.com",
    statementFormats: ["PDF", "CSV", "QFX"],
    passwordProtected: false,
    note: "PNC Virtual Wallet statements roll up Spend, Reserve, and Growth accounts into one PDF — the extractor preserves each as its own table.",
    accountTypes: ["Checking", "Savings", "Credit Card", "Business"],
  },
  {
    slug: "td-bank",
    name: "TD Bank",
    country: "US",
    currency: "USD",
    domain: "td.com",
    statementFormats: ["PDF", "CSV"],
    passwordProtected: false,
    note: "TD Bank statements list transactions in chronological order with a daily ending balance — the running balance column extracts as-is into your spreadsheet.",
    accountTypes: ["Checking", "Savings", "Credit Card"],
  },
  {
    slug: "hsbc",
    name: "HSBC",
    country: "GB",
    currency: "GBP",
    domain: "hsbc.com",
    statementFormats: ["PDF", "CSV"],
    passwordProtected: true,
    note: "HSBC PDF statements are commonly password-protected on download; you'll need to remove the password (open in Preview/Acrobat, save without password) before uploading.",
    accountTypes: ["Current Account", "Savings", "Credit Card", "Business"],
  },
  {
    slug: "barclays",
    name: "Barclays",
    country: "GB",
    currency: "GBP",
    domain: "barclays.co.uk",
    statementFormats: ["PDF", "CSV", "OFX"],
    passwordProtected: true,
    note: "Barclays statements use DD/MM/YYYY date format and GBP amounts — the extractor preserves these without converting, so your spreadsheet matches the source exactly.",
    accountTypes: ["Current Account", "Savings", "Credit Card", "Business"],
  },
  {
    slug: "american-express",
    name: "American Express",
    country: "US",
    currency: "USD",
    domain: "americanexpress.com",
    statementFormats: ["PDF", "CSV", "QFX", "QBO"],
    passwordProtected: false,
    note: "Amex statements list transactions per cardmember (primary plus authorized users) — each cardmember's transactions extract as a separate labeled section.",
    accountTypes: ["Credit Card", "Charge Card", "Business"],
  },
  {
    slug: "discover",
    name: "Discover",
    country: "US",
    currency: "USD",
    domain: "discover.com",
    statementFormats: ["PDF", "CSV"],
    passwordProtected: false,
    note: "Discover statements include a 'Cashback Bonus' summary above transactions; the extractor isolates the transaction table from the rewards summary so your spreadsheet contains only line items.",
    accountTypes: ["Credit Card", "Checking", "Savings"],
  },
];

/** Lookup helper used by the dynamic route. */
export function getBankEntityBySlug(slug: string): BankEntity | undefined {
  return BANK_ENTITIES.find((b) => b.slug === slug);
}

/** All slugs — used by generateStaticParams() so each bank page is pre-rendered. */
export function getAllBankSlugs(): string[] {
  return BANK_ENTITIES.map((b) => b.slug);
}
