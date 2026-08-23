/**
 * QuickBooks 3-column CSV export (Date, Description, Amount).
 * Heuristically maps the extracted visual grid to transaction rows:
 * a row qualifies when it contains a parseable date and a parseable amount;
 * the description is the longest remaining text cell.
 */

type GridData = (string | null)[][];

const DATE_PATTERNS = [
  /^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}$/, // 12/31/2025, 31-12-25
  /^\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2}$/, // 2025-12-31
  /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(,?\s+\d{2,4})?$/i, // Mar 5, 2025
  /^\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(\s+\d{2,4})?$/i, // 5 Mar 2025
];

function isDateLike(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  return DATE_PATTERNS.some((re) => re.test(v));
}

/** Parse "1,234.56", "$1,234.56", "(45.00)" → number; null when not an amount. */
function parseAmount(value: string): number | null {
  let v = value.trim();
  if (!v) return null;
  let negative = false;
  if (/^\(.*\)$/.test(v)) {
    negative = true;
    v = v.slice(1, -1);
  }
  if (v.endsWith("-")) {
    negative = true;
    v = v.slice(0, -1);
  }
  if (v.startsWith("-")) {
    negative = true;
    v = v.slice(1);
  }
  v = v.replace(/^[$€£]\s?/, "").replace(/\s/g, "");
  if (!/^\d{1,3}(,\d{3})*(\.\d{1,4})?$|^\d+(\.\d{1,4})?$/.test(v)) return null;
  const n = parseFloat(v.replace(/,/g, ""));
  if (Number.isNaN(n)) return null;
  return negative ? -n : n;
}

export type QuickBooksRow = { date: string; description: string; amount: number };

type ColumnRoles = {
  balance: number;
  debit: number;
  credit: number;
  amount: number;
};

/** Find the header row and map column indexes to semantic roles. */
function detectColumnRoles(grid: GridData): ColumnRoles {
  const roles: ColumnRoles = { balance: -1, debit: -1, credit: -1, amount: -1 };
  for (const row of grid.slice(0, 12)) {
    let hits = 0;
    const found: ColumnRoles = { balance: -1, debit: -1, credit: -1, amount: -1 };
    row.forEach((cell, i) => {
      const v = (cell ?? "").toLowerCase();
      if (!v) return;
      if (/balance/.test(v)) { found.balance = i; hits++; }
      else if (/withdraw|debit|payment|charge/.test(v)) { found.debit = i; hits++; }
      else if (/deposit|credit/.test(v)) { found.credit = i; hits++; }
      else if (/^amount/.test(v)) { found.amount = i; hits++; }
      else if (/date|description|detail|transaction/.test(v)) hits++;
    });
    // A real header names at least two known columns.
    if (hits >= 2 && (found.balance !== -1 || found.debit !== -1 || found.credit !== -1 || found.amount !== -1)) {
      return found;
    }
  }
  return roles;
}

/** Rows like "Beginning/Ending Balance" are markers, not transactions. */
function isBalanceMarkerRow(cells: string[]): boolean {
  return cells.some((c) => /^(beginning|ending|opening|closing)\s+balance/i.test(c));
}

export function gridToQuickBooksRows(grid: GridData): QuickBooksRow[] {
  const roles = detectColumnRoles(grid);
  const rows: QuickBooksRow[] = [];

  for (const row of grid) {
    const cells = row.map((c) => (c == null ? "" : String(c).trim()));
    const dateIdx = cells.findIndex(isDateLike);
    if (dateIdx === -1) continue;
    if (isBalanceMarkerRow(cells)) continue;

    // Transaction amount: use semantic columns when the header told us where
    // they are (withdrawals become negative). The running balance column is
    // never the amount — that was the failure mode of naive rightmost-pick.
    let amount: number | null = null;
    if (roles.debit !== -1 || roles.credit !== -1 || roles.amount !== -1) {
      const debit = roles.debit !== -1 ? parseAmount(cells[roles.debit] ?? "") : null;
      const credit = roles.credit !== -1 ? parseAmount(cells[roles.credit] ?? "") : null;
      const plain = roles.amount !== -1 ? parseAmount(cells[roles.amount] ?? "") : null;
      if (debit != null) amount = -Math.abs(debit);
      else if (credit != null) amount = Math.abs(credit);
      else if (plain != null) amount = plain;
    } else {
      // No header found: collect numeric cells right-to-left (skipping the
      // date and bare years). With 2+ numbers assume the last is a running
      // balance and take the one before it; with 1 number take it as-is.
      const numeric: number[] = [];
      for (let i = cells.length - 1; i >= 0; i--) {
        if (i === dateIdx || (roles.balance !== -1 && i === roles.balance)) continue;
        const parsed = parseAmount(cells[i]!);
        if (parsed != null && !/^\d{4}$/.test(cells[i]!)) numeric.push(parsed);
      }
      if (numeric.length >= 2) amount = numeric[1]!;
      else if (numeric.length === 1) amount = numeric[0]!;
    }
    if (amount == null) continue;

    let description = "";
    for (let i = 0; i < cells.length; i++) {
      if (i === dateIdx) continue;
      const c = cells[i]!;
      if (!c || parseAmount(c) != null) continue;
      if (c.length > description.length) description = c;
    }

    rows.push({ date: cells[dateIdx]!, description, amount });
  }
  return rows;
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function quickBooksCsv(rows: QuickBooksRow[]): string {
  const lines = ["Date,Description,Amount"];
  for (const r of rows) {
    lines.push(`${csvEscape(r.date)},${csvEscape(r.description)},${r.amount.toFixed(2)}`);
  }
  return lines.join("\r\n");
}

/** Build and trigger a download of the QuickBooks CSV. Returns row count (0 = nothing detected). */
export function downloadQuickBooksCsv(grid: GridData, filename = "quickbooks-import.csv"): number {
  const rows = gridToQuickBooksRows(grid);
  if (rows.length === 0) return 0;
  const blob = new Blob([quickBooksCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return rows.length;
}
