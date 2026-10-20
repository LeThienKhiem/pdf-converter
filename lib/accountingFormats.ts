"use client";

import { BANK_HEADER, parseAmount, type BankGrid, type StatementMeta } from "@/lib/bankStatement";

/**
 * Export the extracted statement in the formats accounting software imports
 * directly, rather than only as a spreadsheet somebody has to map by hand.
 *
 * Why these four and not the obvious two
 * --------------------------------------
 * QBO and QFX are the formats people ask for most, and both are deliberately
 * left out. Intuit's own OFX partner documentation states that "Web Connect
 * and Direct Connect are directly associated with a contracted Intuit
 * Branding ID (BID)" — the identifier is part of a contract between Intuit and
 * a financial institution, not a value a third party can issue itself. The
 * workaround circulating among converter tools is to put some bank's BID in
 * the file anyway, which makes it claim to have come from an institution's
 * Web Connect service when it did not. Intuit points developers at its
 * Accounting API for writing data instead.
 *
 * QFX is the same shape of gate on Quicken's side (a separate company since
 * 2016, with its own branding identifier).
 *
 * This is a narrower loss than it first appears — see OFX below.
 *
 * What is here are open formats that need no vendor's permission:
 *
 *   QIF    Quicken Interchange Format. Plain text, no identifiers, read by
 *          Quicken, GnuCash, Banktivity, YNAB imports and many others.
 *   OFX    Open Financial Exchange 1.0.2, SGML form. An open spec, and the
 *          reason the missing QBO matters less than it looks: Intuit's own
 *          help pages list .ofx among the file types QuickBooks Online
 *          accepts for a manual bank upload, alongside .csv, .qbo and .qfx.
 *          So Online users are served by this file; it is QuickBooks Desktop
 *          Web Connect that strictly wants a .qbo, and IIF covers Desktop.
 *          The <INTU.BID> that would turn this into a QBO is omitted.
 *   IIF    Intuit Interchange Format for QuickBooks Desktop. Tab-delimited
 *          and documented by Intuit as an import path; no identifier gate.
 *   Tally  Tally's XML import envelope. Tally is the dominant SMB accounting
 *          package in India, which is 41% of this site's search clicks.
 *
 * Every writer takes the same BankGrid the spreadsheet export uses, so what
 * the reader downloads is the same extraction in a different envelope.
 */

export type AccountingFormat = "qif" | "ofx" | "iif" | "tally";

export const FORMAT_LABELS: Record<AccountingFormat, { label: string; ext: string; mime: string; note: string }> = {
  qif: { label: "QIF", ext: "qif", mime: "application/qif", note: "Quicken, GnuCash, YNAB, Banktivity" },
  ofx: { label: "OFX", ext: "ofx", mime: "application/x-ofx", note: "QuickBooks Online, Quicken, Xero" },
  iif: { label: "IIF", ext: "iif", mime: "text/plain", note: "QuickBooks Desktop" },
  tally: { label: "Tally XML", ext: "xml", mime: "application/xml", note: "Tally ERP / TallyPrime" },
};

/** One transaction, normalised out of the grid. */
type Txn = {
  /** ISO yyyy-mm-dd, or null when the row had no parseable date. */
  date: string | null;
  description: string;
  /** Signed: negative for money out, positive for money in. */
  amount: number;
};

/**
 * Pull transactions out of the grid.
 *
 * Rows without a date or without any amount are dropped rather than written
 * as zero-value entries — an accounting import treats those as real
 * transactions, and a statement's header or summary lines are not.
 */
function toTransactions(grid: BankGrid): Txn[] {
  const out: Txn[] = [];
  const hasHeader = grid[0]?.[0]?.toLowerCase?.() === BANK_HEADER[0].toLowerCase();
  for (const row of grid.slice(hasHeader ? 1 : 0)) {
    const [rawDate, rawDesc, rawDebit, rawCredit] = row;
    const date = typeof rawDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : null;
    if (!date) continue;

    const debit = parseAmount(rawDebit);
    const credit = parseAmount(rawCredit);
    if (debit === null && credit === null) continue;

    // Debit is money leaving the account, so it is negative in every one of
    // these formats; a statement that prints it unsigned still means out.
    const amount = credit !== null && credit !== 0 ? Math.abs(credit) : -Math.abs(debit ?? 0);
    if (amount === 0) continue;

    out.push({ date, description: (rawDesc ?? "").trim() || "Transaction", amount });
  }
  return out;
}

const two = (n: number) => String(n).padStart(2, "0");

/** yyyymmdd, the date form OFX and Tally both use. */
function compactDate(iso: string): string {
  return iso.replace(/-/g, "");
}

/** mm/dd/yyyy, the date form QIF and IIF use. */
function usDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${two(Number(m))}/${two(Number(d))}/${y}`;
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * QIF — Quicken Interchange Format.
 *
 * Record per transaction, fields keyed by a leading letter, terminated by a
 * lone "^". !Type:Bank is the account type; amounts are signed decimal.
 */
export function toQIF(grid: BankGrid): string {
  const lines = ["!Type:Bank"];
  for (const t of toTransactions(grid)) {
    lines.push(`D${usDate(t.date!)}`);
    lines.push(`T${t.amount.toFixed(2)}`);
    lines.push(`P${t.description}`);
    lines.push("^");
  }
  return lines.join("\r\n") + "\r\n";
}

/**
 * OFX 1.0.2 in its SGML form — the one with the header block and unclosed
 * tags, which is what importers of this version expect.
 *
 * No <INTU.BID>: including one is what would make this a QBO, and we have no
 * right to any institution's value. FITID has to be unique per transaction
 * within the account or importers deduplicate wrongly, so it is built from
 * the date, the index and the amount.
 */
export function toOFX(grid: BankGrid, meta: StatementMeta | null): string {
  const txns = toTransactions(grid);
  const currency = (meta?.currency || "USD").toUpperCase().slice(0, 3);
  const now = new Date();
  const stamp =
    `${now.getUTCFullYear()}${two(now.getUTCMonth() + 1)}${two(now.getUTCDate())}` +
    `${two(now.getUTCHours())}${two(now.getUTCMinutes())}${two(now.getUTCSeconds())}`;

  const start = meta?.periodStart ?? txns[0]?.date ?? null;
  const end = meta?.periodEnd ?? txns[txns.length - 1]?.date ?? null;

  const body = txns
    .map((t, i) => {
      const kind = t.amount < 0 ? "DEBIT" : "CREDIT";
      const fitid = `${compactDate(t.date!)}${String(i).padStart(4, "0")}${Math.round(Math.abs(t.amount) * 100)}`;
      return [
        "<STMTTRN>",
        `<TRNTYPE>${kind}`,
        `<DTPOSTED>${compactDate(t.date!)}`,
        `<TRNAMT>${t.amount.toFixed(2)}`,
        `<FITID>${fitid}`,
        `<NAME>${t.description.slice(0, 32)}`,
        "</STMTTRN>",
      ].join("\n");
    })
    .join("\n");

  return [
    "OFXHEADER:100",
    "DATA:OFXSGML",
    "VERSION:102",
    "SECURITY:NONE",
    "ENCODING:USASCII",
    "CHARSET:1252",
    "COMPRESSION:NONE",
    "OLDFILEUID:NONE",
    "NEWFILEUID:NONE",
    "",
    "<OFX>",
    "<SIGNONMSGSRSV1><SONRS>",
    "<STATUS><CODE>0<SEVERITY>INFO</STATUS>",
    `<DTSERVER>${stamp}`,
    "<LANGUAGE>ENG",
    "</SONRS></SIGNONMSGSRSV1>",
    "<BANKMSGSRSV1><STMTTRNRS>",
    "<TRNUID>1",
    "<STATUS><CODE>0<SEVERITY>INFO</STATUS>",
    "<STMTRS>",
    `<CURDEF>${currency}`,
    "<BANKACCTFROM><BANKID>000000000<ACCTID>STATEMENT<ACCTTYPE>CHECKING</BANKACCTFROM>",
    "<BANKTRANLIST>",
    start ? `<DTSTART>${compactDate(start)}` : "",
    end ? `<DTEND>${compactDate(end)}` : "",
    body,
    "</BANKTRANLIST>",
    meta?.closing !== null && meta?.closing !== undefined
      ? `<LEDGERBAL><BALAMT>${meta.closing.toFixed(2)}<DTASOF>${end ? compactDate(end) : stamp.slice(0, 8)}</LEDGERBAL>`
      : "",
    "</STMTRS>",
    "</STMTTRNRS></BANKMSGSRSV1>",
    "</OFX>",
  ]
    .filter((l) => l !== "")
    .join("\n");
}

/**
 * IIF — tab-delimited, for QuickBooks Desktop.
 *
 * Each transaction is a TRNS line, one or more SPL lines, then ENDTRNS. The
 * split mirrors the transaction with the opposite sign, which is what makes
 * the entry balance; it is posted to Uncategorized so the reader codes it in
 * QuickBooks rather than having a guess imposed.
 */
export function toIIF(grid: BankGrid): string {
  const lines = [
    ["!TRNS", "TRNSID", "TRNSTYPE", "DATE", "ACCNT", "NAME", "AMOUNT", "MEMO"].join("\t"),
    ["!SPL", "SPLID", "TRNSTYPE", "DATE", "ACCNT", "NAME", "AMOUNT", "MEMO"].join("\t"),
    ["!ENDTRNS"].join("\t"),
  ];
  toTransactions(grid).forEach((t, i) => {
    const type = t.amount < 0 ? "CHECK" : "DEPOSIT";
    const date = usDate(t.date!);
    const memo = t.description.replace(/\t/g, " ");
    lines.push(["TRNS", String(i + 1), type, date, "Bank Account", "", t.amount.toFixed(2), memo].join("\t"));
    lines.push(["SPL", String(i + 1), type, date, "Uncategorized Expense", "", (-t.amount).toFixed(2), memo].join("\t"));
    lines.push("ENDTRNS");
  });
  return lines.join("\r\n") + "\r\n";
}

/**
 * Tally XML import envelope.
 *
 * Vouchers are Receipt for money in and Payment for money out, each with the
 * pair of ledger entries Tally requires. The bank ledger is named generically
 * because we do not know the reader's chart of accounts; Tally prompts for an
 * unknown ledger on import rather than failing, so a name they recognise and
 * can remap is better than a guess that looks authoritative.
 */
export function toTallyXML(grid: BankGrid): string {
  const vouchers = toTransactions(grid)
    .map((t) => {
      const isIn = t.amount > 0;
      const abs = Math.abs(t.amount).toFixed(2);
      const type = isIn ? "Receipt" : "Payment";
      const party = xmlEscape(t.description.slice(0, 64));
      // Tally signs ledger amounts: negative is a debit, positive a credit.
      const bankAmt = isIn ? `-${abs}` : abs;
      const otherAmt = isIn ? abs : `-${abs}`;
      return `   <TALLYMESSAGE xmlns:UDF="TallyUDF">
    <VOUCHER VCHTYPE="${type}" ACTION="Create">
     <DATE>${compactDate(t.date!)}</DATE>
     <VOUCHERTYPENAME>${type}</VOUCHERTYPENAME>
     <NARRATION>${party}</NARRATION>
     <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>Bank Account</LEDGERNAME>
      <ISDEEMEDPOSITIVE>${isIn ? "Yes" : "No"}</ISDEEMEDPOSITIVE>
      <AMOUNT>${bankAmt}</AMOUNT>
     </ALLLEDGERENTRIES.LIST>
     <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>Suspense</LEDGERNAME>
      <ISDEEMEDPOSITIVE>${isIn ? "No" : "Yes"}</ISDEEMEDPOSITIVE>
      <AMOUNT>${otherAmt}</AMOUNT>
     </ALLLEDGERENTRIES.LIST>
    </VOUCHER>
   </TALLYMESSAGE>`;
    })
    .join("\n");

  return `<ENVELOPE>
 <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
 <BODY>
  <IMPORTDATA>
   <REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME></REQUESTDESC>
   <REQUESTDATA>
${vouchers}
   </REQUESTDATA>
  </IMPORTDATA>
 </BODY>
</ENVELOPE>
`;
}

/** Render the grid in one of the supported formats. */
export function renderFormat(
  format: AccountingFormat,
  grid: BankGrid,
  meta: StatementMeta | null
): string {
  switch (format) {
    case "qif":
      return toQIF(grid);
    case "ofx":
      return toOFX(grid, meta);
    case "iif":
      return toIIF(grid);
    case "tally":
      return toTallyXML(grid);
  }
}

/** How many transactions a given grid would export — for an empty-state check. */
export function countTransactions(grid: BankGrid): number {
  return toTransactions(grid).length;
}
