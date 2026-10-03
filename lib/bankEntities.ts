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
  /**
   * Statement formats the bank typically offers for download.
   *
   * QFX/QBO are Quicken and QuickBooks formats, in practice US-only. MT940 is
   * the SWIFT statement format German and other European banks commonly
   * publish for accounting import, and CAMT053 is its ISO 20022 successor
   * used across SEPA.
   */
  statementFormats: ReadonlyArray<
    "PDF" | "CSV" | "QFX" | "OFX" | "QBO" | "MT940" | "CAMT053"
  >;
  /**
   * Whether the institution commonly password-protects PDF statements.
   *
   * "unknown" is a first-class value, not a placeholder to fill in later.
   * Whether a given bank protects statement downloads is frequently not
   * publicly documented, and it changes. Forcing true/false meant the page
   * made a definite claim either way — `false` renders "downloads statement
   * PDFs without password protection by default", which is a real assurance
   * to put in front of a user on the strength of a guess. When we don't know,
   * the page should say what is actually true: it may be protected, and here
   * is what to do if it is.
   */
  passwordProtected: boolean | "unknown";
  /**
   * One sentence specific to this bank's statement workflow that adds
   * actual value (not generic). Keep it factual + general — no made-up
   * specifics like exact column names.
   */
  note: string;
  /** Common account types whose statements this tool handles for the bank. */
  accountTypes: ReadonlyArray<string>;
  /**
   * Optional expanded prose block (~120-160 words) rendered as an additional
   * on-page section. Populated only for high-impression bank pages where GSC
   * shows long-tail queries the short `note` doesn't cover (e.g. "download
   * chase statements as csv"). Must stay factual — no invented UI steps.
   */
  deepDive?: string;
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
    deepDive:
      "Chase provides several ways to access transaction data through the Chase online banking portal at chase.com — PDF statements are available for every account, and CSV or QFX downloads are offered for most checking, savings, and credit card accounts. If you already have a Chase CSV export, you can open it directly in Excel with no conversion. The AI converter is designed for the PDF case: if you only have the PDF statement, or you need to standardize multiple Chase accounts into one workbook, the extractor reads the transaction table straight from the PDF layout and outputs a structured Excel or CSV file with date, description, amount, and balance columns. This works for Chase checking, savings, credit card, and business account statements. USD amounts and Chase's date formatting pass through unchanged, and the resulting spreadsheet is ready to import into QuickBooks, Xero, Sage, or Wave.",
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
    deepDive:
      "Citi provides PDF and CSV statement downloads through the Citi online banking portal; the exact export options depend on your account type and region (Citibank US, Citi UK, Citi International). If your Citibank statement is already in CSV format, you can open it directly in Excel with no conversion needed. For PDF-only statements — common on international accounts and older records — the AI converter reads the Citi transaction table and outputs a structured Excel or CSV spreadsheet with date, description, amount, and balance columns. This works for Citi checking, credit card, and business banking statements. Joint credit card accounts include a per-cardholder transaction breakdown that the extractor preserves as separately labeled sections in the output. USD amounts and Citi's date formatting stay intact, and the resulting spreadsheet is ready to import into QuickBooks, Xero, or Sage without reformatting.",
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
    note: "HSBC commonly password-protects statement PDFs on download. Upload the file as it came — the converter asks for the password and opens it in your browser, so there is no need to unlock it yourself.",
    accountTypes: ["Current Account", "Savings", "Credit Card", "Business"],
    deepDive:
      "HSBC offers PDF statements through both HSBC UK and international online banking, with CSV exports available for many current accounts and business accounts. HSBC PDFs are commonly password-protected on download, which the converter handles directly: upload the file as it came and enter the password when prompted. The decryption happens in your browser, so the password never reaches a server and there is no need to re-save the file without it. Once uploaded, the AI extracts each transaction row into a structured Excel or CSV spreadsheet, preserving GBP amounts and HSBC's DD/MM/YYYY date format without conversion. This works for HSBC current accounts, savings, credit cards, and business banking statements. If your HSBC download is already in CSV format, you don't need conversion — but many international HSBC statements are PDF-only, which is where the AI extractor becomes essential. The output is ready for Xero, QuickBooks Online, or Sage import.",
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
    deepDive:
      "American Express provides several statement formats through the Amex online banking portal — PDF, CSV, QFX, and QuickBooks-compatible QBO. If you already have an Amex CSV or QBO export, you can import it directly into Excel or QuickBooks without conversion. The AI extractor is designed for the PDF case, which many cardholders receive by default with their monthly billing statement. The extractor handles Amex's per-cardmember transaction breakdown — primary cardmember plus authorized users — preserving each cardholder's line items as a separately labeled section in the Excel output. This works for Amex consumer credit cards, charge cards, and business cards. The resulting spreadsheet has date, description, amount, and cardmember columns ready for expense tracking, ROI analysis, or accounting import. USD amounts and Amex's MM/DD/YYYY dates pass through unchanged, matching what you see in the PDF exactly.",
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

  // ─── German institutions ──────────────────────────────────────────────
  //
  // Added because Germany is the third-highest impression country in Search
  // Console (434 impressions over 90 days) with zero clicks, and the
  // programmatic bank template is the cheapest content per page on the site.
  // Deliberately written in English: "Deutsche Bank statement to Excel" is a
  // query an English-speaking finance team at a German subsidiary would type,
  // and whether German-language pages are warranted is still unverified —
  // see docs/german-locale-pilot.md.
  //
  // passwordProtected is "unknown" on every entry here. That is honest rather
  // than lazy: I could not establish these banks' PDF protection behaviour
  // from a reliable source, and this file exists to keep invented facts off
  // public pages. The "unknown" copy covers both cases correctly.
  //
  // MT940 and CAMT053 are the genuinely distinguishing German fact — the
  // SWIFT and ISO 20022 statement formats German banks publish for import
  // into accounting software, which have no US equivalent in this list.

  {
    slug: "deutsche-bank",
    name: "Deutsche Bank",
    country: "DE",
    currency: "EUR",
    domain: "deutsche-bank.de",
    statementFormats: ["PDF", "CSV", "MT940", "CAMT053"],
    passwordProtected: "unknown",
    note: "German banks commonly offer MT940 or CAMT.053 alongside PDF, and those structured formats import directly into accounting software — check for them before converting a PDF, since it saves a step.",
    accountTypes: ["Current Account", "Savings", "Credit Card", "Business"],
  },
  {
    slug: "commerzbank",
    name: "Commerzbank",
    country: "DE",
    currency: "EUR",
    domain: "commerzbank.de",
    statementFormats: ["PDF", "CSV", "MT940", "CAMT053"],
    passwordProtected: "unknown",
    note: "Commerzbank statements use European conventions — DD.MM.YYYY dates and comma decimal separators — which the extractor preserves as-is rather than reformatting to US style.",
    accountTypes: ["Current Account", "Savings", "Credit Card", "Business"],
  },
  {
    slug: "sparkasse",
    name: "Sparkasse",
    country: "DE",
    currency: "EUR",
    domain: "sparkasse.de",
    statementFormats: ["PDF", "CSV", "MT940", "CAMT053"],
    passwordProtected: "unknown",
    note: "Sparkasse is a network of several hundred legally independent regional savings banks rather than one institution, so statement layouts differ between them — which is exactly the case template-based converters struggle with and a layout-reading approach handles.",
    accountTypes: ["Current Account", "Savings", "Credit Card", "Business"],
  },
  {
    slug: "dkb",
    name: "DKB",
    country: "DE",
    currency: "EUR",
    domain: "dkb.de",
    statementFormats: ["PDF", "CSV", "MT940"],
    passwordProtected: "unknown",
    note: "DKB is a direct bank, so statements are retrieved from online banking rather than posted — worth exporting regularly, as online archives of older statements are usually time-limited.",
    accountTypes: ["Current Account", "Savings", "Credit Card"],
  },
  {
    slug: "ing-germany",
    name: "ING Germany",
    country: "DE",
    currency: "EUR",
    domain: "ing.de",
    statementFormats: ["PDF", "CSV", "MT940"],
    passwordProtected: "unknown",
    note: "ING operates under different brands per country (ING-DiBa historically in Germany), so statement formats differ between ING entities — this page covers the German operation.",
    accountTypes: ["Current Account", "Savings", "Credit Card"],
  },
  {
    slug: "n26",
    name: "N26",
    country: "DE",
    currency: "EUR",
    domain: "n26.com",
    statementFormats: ["PDF", "CSV"],
    passwordProtected: "unknown",
    note: "N26 is mobile-first, so statements are generated in-app and often reach a desktop as a shared PDF — the converter reads that PDF without needing the original download session.",
    accountTypes: ["Current Account", "Savings", "Business"],
  },
  // ─── India ──────────────────────────────────────────────────────────────
  //
  // Added 2026-10-03 on the strength of the country split, which had gone
  // unexamined. India produced 95 of the site's 211 clicks over 90 days — 45%
  // — at a 5.33% click-through rate against a 1.06% site average, from 1,782
  // impressions at an average position of 15.8. The United States, by
  // contrast, generated 8,351 impressions and 23 clicks at 0.28%.
  //
  // The bank pages were allocated in the opposite proportion: ten US banks and
  // six German ones, with Germany contributing 779 impressions and two clicks,
  // and nothing at all for the market that converts best.
  //
  // passwordProtected is "unknown" for four of the five. ICICI states on its
  // own help pages that it sends statements as password-protected PDFs, which
  // is citable; the others do not publish the convention, and the exact rule —
  // a date of birth, a PAN fragment, a customer ID — is not something to
  // assert on their behalf. "unknown" renders the honest copy: upload it as it
  // came, and enter a password if one is asked for. That is the same action
  // either way, now that the converter opens locked files itself.
  //
  // statementFormats lists only what each bank is known to offer. PDF is
  // certain everywhere; ICICI documents CSV and MT940 as well. Understating is
  // the safe direction — a reader who finds an extra export option loses
  // nothing, one who is promised CSV and cannot find it does.
  {
    slug: "hdfc-bank",
    name: "HDFC Bank",
    country: "IN",
    currency: "INR",
    domain: "hdfcbank.com",
    statementFormats: ["PDF"],
    passwordProtected: "unknown",
    note: "HDFC Bank provides statement PDFs through NetBanking and the mobile app, with up to three years of history available. If the download opens with a password prompt, enter it in the converter — the file is unlocked in your browser.",
    accountTypes: ["Savings Account", "Current Account", "Credit Card", "NRI Account"],
    deepDive:
      "HDFC Bank statements are available as PDF downloads from NetBanking and from the mobile app, which carries up to three years of history. Amounts are in INR and dates follow the DD/MM/YYYY convention used across Indian banking; the converter preserves both rather than reformatting them, so the output reconciles against the original without adjustment. Statement PDFs from Indian banks are frequently password-protected, and whether yours is can depend on the account type and how the statement was delivered — emailed statements are protected more often than ones downloaded directly. Either way the step is the same: upload the file as it arrived, and if a password is requested, enter it when the converter asks. Decryption happens on your own device. The extracted output carries dates, narration, debit and credit columns and the running balance, laid out for import into Tally, Zoho Books, Xero or QuickBooks.",
  },
  {
    slug: "icici-bank",
    name: "ICICI Bank",
    country: "IN",
    currency: "INR",
    domain: "icicibank.com",
    statementFormats: ["PDF", "CSV", "MT940"],
    passwordProtected: true,
    note: "ICICI Bank states that it sends statements as password-protected PDFs. Upload the file as it came — the converter asks for the password and opens it in your browser, with no need to unlock it first.",
    accountTypes: ["Savings Account", "Current Account", "Credit Card", "Business Banking"],
    deepDive:
      "ICICI Bank offers statements as PDF and CSV from Internet Banking, and its business banking side publishes CSV, Excel and MT940 for accounting import. The bank documents that statements are sent in password-protected PDF format for security, so a locked file is the expected case rather than an exception — upload it as it came and enter the password when the converter asks. That decryption happens in your browser and the password never reaches a server. If your download is already CSV or MT940 there is nothing to convert; the extractor matters for the PDF path, which is what retail e-statements arrive as. Output preserves INR amounts and DD/MM/YYYY dates, with narration, debit, credit and running balance columns ready for Tally, Zoho Books, Xero or QuickBooks.",
  },
  {
    slug: "state-bank-of-india",
    name: "State Bank of India",
    country: "IN",
    currency: "INR",
    domain: "sbi.co.in",
    statementFormats: ["PDF"],
    passwordProtected: "unknown",
    note: "SBI statements download as PDF from OnlineSBI and the YONO app. If the file prompts for a password, enter it in the converter rather than unlocking the PDF yourself.",
    accountTypes: ["Savings Account", "Current Account", "Credit Card"],
    deepDive:
      "State Bank of India statements come as PDFs from OnlineSBI and the YONO app. SBI layouts carry a narration column that packs several fields — transaction mode, reference numbers, counterparty — into one string, and its width shifts between statement periods. That is where template-based extractors tend to fail, because the map they were given no longer matches the page. The AI reads the table from the layout itself rather than from a fixed map, so a shift of that kind does not break it. Amounts stay in INR and dates in DD/MM/YYYY. Whether the PDF is password-protected varies with account type and delivery method; if yours asks for one, enter it when prompted and the file is unlocked on your own device. The output carries date, narration, debit, credit and balance, ready for Tally, Zoho Books or a spreadsheet reconciliation.",
  },
  {
    slug: "axis-bank",
    name: "Axis Bank",
    country: "IN",
    currency: "INR",
    domain: "axisbank.com",
    statementFormats: ["PDF"],
    passwordProtected: "unknown",
    note: "Axis Bank statements download as PDF from Internet Banking and the mobile app. A password-protected file can be uploaded as it is — the converter asks for the password.",
    accountTypes: ["Savings Account", "Current Account", "Credit Card"],
  },
  {
    slug: "kotak-mahindra-bank",
    name: "Kotak Mahindra Bank",
    country: "IN",
    currency: "INR",
    domain: "kotak.com",
    statementFormats: ["PDF"],
    passwordProtected: "unknown",
    note: "Kotak Mahindra Bank provides statement PDFs through Net Banking and the mobile app. If the download is password-protected, enter the password in the converter instead of unlocking the file first.",
    accountTypes: ["Savings Account", "Current Account", "Credit Card"],
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
