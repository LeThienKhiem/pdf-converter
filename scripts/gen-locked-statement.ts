/**
 * Generate a password-protected bank statement for testing the unlock flow.
 *
 * Deliberately realistic rather than a placeholder page: dates, descriptions,
 * debits, credits and a running balance that actually reconciles. That way one
 * file tests both halves — the password prompt, and whether the extraction is
 * any good once the page has been flattened to an image.
 *
 * The running balance is the check to make afterwards. Every row carries it,
 * so if the final balance in the exported sheet matches the last row here,
 * nothing was dropped. That is the failure this flow is most likely to have,
 * since unlocking turns text into pixels.
 *
 * Encryption is applied by scripts/encrypt-statement.py — pdf-lib cannot write
 * an encrypted PDF, so the two steps are separate.
 *
 * Usage: npx tsx scripts/gen-locked-statement.ts
 */

import * as fs from "fs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const OUT = "test-statement-plain.pdf";
const OPENING = 4820.55;

type Txn = { date: string; desc: string; debit?: number; credit?: number };

const TXNS: Txn[] = [
  { date: "01 Aug 2026", desc: "OPENING BALANCE" },
  { date: "02 Aug 2026", desc: "CARD PAYMENT - TESCO STORES 3412", debit: 84.32 },
  { date: "03 Aug 2026", desc: "DIRECT DEBIT - BRITISH GAS", debit: 112.0 },
  { date: "05 Aug 2026", desc: "FASTER PAYMENT - ACME LTD INVOICE 2041", credit: 2450.0 },
  { date: "06 Aug 2026", desc: "CARD PAYMENT - SHELL FILLING STN", debit: 67.4 },
  { date: "08 Aug 2026", desc: "STANDING ORDER - RENT AUGUST", debit: 1250.0 },
  { date: "09 Aug 2026", desc: "CARD PAYMENT - CAFE NERO 881", debit: 4.95 },
  { date: "11 Aug 2026", desc: "DIRECT DEBIT - VODAFONE UK", debit: 38.99 },
  { date: "12 Aug 2026", desc: "FASTER PAYMENT - J WHITMORE", credit: 320.0 },
  { date: "14 Aug 2026", desc: "CARD PAYMENT - AMAZON EU SARL", debit: 129.87 },
  { date: "15 Aug 2026", desc: "ATM WITHDRAWAL - HIGH ST 0142", debit: 200.0 },
  { date: "16 Aug 2026", desc: "DIRECT DEBIT - AVIVA INSURANCE", debit: 46.2 },
  { date: "18 Aug 2026", desc: "CARD PAYMENT - WAITROSE 219", debit: 156.44 },
  { date: "19 Aug 2026", desc: "FASTER PAYMENT - NORTHGATE CO", credit: 1875.5 },
  { date: "20 Aug 2026", desc: "CARD PAYMENT - TRAINLINE", debit: 88.7 },
  { date: "21 Aug 2026", desc: "DIRECT DEBIT - COUNCIL TAX", debit: 198.0 },
  { date: "22 Aug 2026", desc: "CARD PAYMENT - PRET A MANGER", debit: 11.25 },
  { date: "23 Aug 2026", desc: "TRANSFER TO SAVINGS 8821", debit: 500.0 },
  { date: "25 Aug 2026", desc: "CARD PAYMENT - JOHN LEWIS 004", debit: 342.1 },
  { date: "26 Aug 2026", desc: "FASTER PAYMENT - REDWOOD PARTNERS", credit: 940.0 },
  { date: "27 Aug 2026", desc: "DIRECT DEBIT - SKY SUBSCRIPTION", debit: 62.0 },
  { date: "28 Aug 2026", desc: "CARD PAYMENT - SAINSBURYS 7712", debit: 97.63 },
  { date: "29 Aug 2026", desc: "BANK CHARGE - OVERSEAS TXN FEE", debit: 2.75 },
  { date: "30 Aug 2026", desc: "CARD PAYMENT - IKEA WEMBLEY", debit: 415.0 },
  { date: "31 Aug 2026", desc: "INTEREST PAID", credit: 3.18 },
];

const money = (n: number) =>
  n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function main() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const W = 595;
  const H = 842;
  const ROWS_PER_PAGE = 10;
  const ink = rgb(0.09, 0.11, 0.15);
  const grey = rgb(0.45, 0.48, 0.55);

  let balance = OPENING;
  const rows = TXNS.map((t) => {
    if (t.debit) balance -= t.debit;
    if (t.credit) balance += t.credit;
    return { ...t, balance };
  });

  const pageCount = Math.ceil(rows.length / ROWS_PER_PAGE);

  for (let p = 0; p < pageCount; p++) {
    const page = doc.addPage([W, H]);
    let y = H - 60;

    page.drawText("NORTHBRIDGE BANK", { x: 45, y, size: 16, font: bold, color: ink });
    page.drawText(`Page ${p + 1} of ${pageCount}`, { x: W - 130, y, size: 10, font, color: grey });
    y -= 18;
    page.drawText("Current Account Statement", { x: 45, y, size: 10, font, color: grey });
    y -= 26;

    page.drawText("Account: 20-41-77  ****4192", { x: 45, y, size: 9, font, color: ink });
    page.drawText("Period: 01 Aug 2026 - 31 Aug 2026", { x: 300, y, size: 9, font, color: ink });
    y -= 24;

    page.drawLine({ start: { x: 45, y }, end: { x: W - 45, y }, thickness: 1, color: grey });
    y -= 16;

    for (const [label, x] of [["Date", 45], ["Description", 130], ["Debit", 350], ["Credit", 420], ["Balance", 490]] as const) {
      page.drawText(label, { x, y, size: 9, font: bold, color: ink });
    }
    y -= 6;
    page.drawLine({ start: { x: 45, y }, end: { x: W - 45, y }, thickness: 0.5, color: grey });
    y -= 16;

    for (const r of rows.slice(p * ROWS_PER_PAGE, (p + 1) * ROWS_PER_PAGE)) {
      page.drawText(r.date, { x: 45, y, size: 8.5, font, color: ink });
      page.drawText(r.desc.slice(0, 40), { x: 130, y, size: 8.5, font, color: ink });
      if (r.debit) page.drawText(money(r.debit), { x: 350, y, size: 8.5, font, color: ink });
      if (r.credit) page.drawText(money(r.credit), { x: 420, y, size: 8.5, font, color: ink });
      page.drawText(money(r.balance), { x: 490, y, size: 8.5, font, color: ink });
      y -= 17;
    }

    if (p === pageCount - 1) {
      y -= 10;
      page.drawLine({ start: { x: 45, y }, end: { x: W - 45, y }, thickness: 1, color: grey });
      y -= 18;
      page.drawText("CLOSING BALANCE", { x: 130, y, size: 9.5, font: bold, color: ink });
      page.drawText(money(rows[rows.length - 1].balance), { x: 490, y, size: 9.5, font: bold, color: ink });
    }

    page.drawText("Northbridge Bank plc. Test document — not a real statement.", {
      x: 45, y: 40, size: 7.5, font, color: grey,
    });
  }

  fs.writeFileSync(OUT, await doc.save());
  console.log(`${OUT} — ${pageCount} pages, ${TXNS.length} rows`);
  console.log(`opening ${money(OPENING)}   closing ${money(rows[rows.length - 1].balance)}`);
  console.log(`\nNow encrypt it:  python scripts/encrypt-statement.py`);
}

main();
