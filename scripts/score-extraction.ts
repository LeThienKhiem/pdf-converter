/**
 * Score /api/extract output against known ground truth.
 * Usage: npx tsx scripts/score-extraction.ts <scratchpad-dir>
 */
import fs from "fs";
import path from "path";
import { gridToQuickBooksRows } from "../lib/quickbooks";

const dir = process.argv[2];
const gt = JSON.parse(fs.readFileSync(path.join(dir, "ground-truth.json"), "utf8"));
const bank = JSON.parse(fs.readFileSync(path.join(dir, "extract-bank.json"), "utf8")).data as (string | null)[][];
const invoice = JSON.parse(fs.readFileSync(path.join(dir, "extract-invoice.json"), "utf8")).data as (string | null)[][];

const norm = (s: string | null | undefined) =>
  (s ?? "").replace(/[$,\s]/g, "").replace(/^\((.*)\)$/, "-$1").toLowerCase();

const rowText = (row: (string | null)[]) => row.map((c) => norm(c)).join("|");

function findRow(grid: (string | null)[][], date: string, mustContain: string[]): (string | null)[] | null {
  const nd = norm(date);
  for (const row of grid) {
    const t = rowText(row);
    if (t.includes(nd) && mustContain.every((m) => t.includes(norm(m).slice(0, 12)))) return row;
  }
  return null;
}

// ── Bank statement scoring ───────────────────────────────────────────────────
console.log("=== BANK STATEMENT (24 rows expected) ===");
console.log("Extracted grid:", bank.length, "rows x", Math.max(...bank.map((r) => r.length)), "cols");

let found = 0, amountOk = 0, balanceOk = 0, colOk = 0;
const misses: string[] = [];
for (const [date, desc, wd, dep, bal] of gt.TX as string[][]) {
  const row = findRow(bank, date, [desc.split(" ")[0] === "POS" ? desc.split("- ")[1] ?? desc : desc.split(" - ")[0]]);
  if (!row) { misses.push(`MISSING: ${date} ${desc}`); continue; }
  found++;
  const cells = row.map(norm);
  const amount = wd || dep;
  if (!amount || cells.includes(norm(amount))) amountOk++;
  else misses.push(`AMOUNT WRONG: ${date} ${desc} expected ${amount} got [${row.join(" | ")}]`);
  if (cells.includes(norm(bal))) balanceOk++;
  else misses.push(`BALANCE WRONG: ${date} ${desc} expected ${bal}`);
  // column discipline: withdrawal must NOT sit in the same cell index as deposits do elsewhere —
  // approximate: amount cell index must differ from balance cell index
  if (amount) {
    const ai = cells.indexOf(norm(amount));
    const bi = cells.lastIndexOf(norm(bal));
    if (ai !== -1 && bi !== -1 && ai !== bi) colOk++;
  } else colOk++;
}
console.log(`Rows found:      ${found}/24`);
console.log(`Amounts exact:   ${amountOk}/24`);
console.log(`Balances exact:  ${balanceOk}/24`);
console.log(`Column separation sane: ${colOk}/24`);
misses.slice(0, 8).forEach((m) => console.log("  ⚠ " + m));

// Summary block check
const flat = norm(JSON.stringify(bank));
for (const v of ["8451.20", "16852.97", "8667.07", "16637.10"]) {
  if (!flat.includes(v)) console.log(`  ⚠ SUMMARY VALUE MISSING: ${v}`);
}

// ── QuickBooks conversion on real output ─────────────────────────────────────
console.log("\n=== QUICKBOOKS CSV (from real extracted grid) ===");
const qb = gridToQuickBooksRows(bank);
console.log(`Detected transaction rows: ${qb.length} (expect ~22-24)`);
console.log("First 3:", JSON.stringify(qb.slice(0, 3)));
console.log("Last 1:", JSON.stringify(qb.slice(-1)));

// ── Invoice scoring ──────────────────────────────────────────────────────────
console.log("\n=== INVOICE (8 line items expected) ===");
console.log("Extracted grid:", invoice.length, "rows x", Math.max(...invoice.map((r) => r.length)), "cols");
let itemsOk = 0;
for (const [no, desc, qty, unit, amount] of gt.INVOICE_ITEMS as string[][]) {
  const row = invoice.find((r) => {
    const t = rowText(r);
    return t.includes(norm(amount)) && t.includes(norm(qty)) && t.includes(norm(unit));
  });
  if (row) itemsOk++;
  else console.log(`  ⚠ ITEM ${no} incomplete: ${desc.slice(0, 30)} (qty=${qty} unit=${unit} amt=${amount})`);
}
console.log(`Line items fully correct (qty+unit+amount): ${itemsOk}/8`);
const iflat = norm(JSON.stringify(invoice));
const t = gt.INVOICE_TOTALS;
console.log(`Subtotal ${t.subtotal}: ${iflat.includes(norm(t.subtotal)) ? "OK" : "MISSING"}`);
console.log(`Tax ${t.tax}: ${iflat.includes(norm(t.tax)) ? "OK" : "MISSING"}`);
console.log(`Total ${t.total}: ${iflat.includes(norm(t.total)) ? "OK" : "MISSING"}`);
console.log(`Invoice number INV-2026-0142: ${iflat.includes(norm("INV-2026-0142")) ? "OK" : "MISSING"}`);
console.log(`Due date 03/12/2026: ${iflat.includes(norm("03/12/2026")) ? "OK" : "MISSING"}`);
