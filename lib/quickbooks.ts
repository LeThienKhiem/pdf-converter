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

export function gridToQuickBooksRows(grid: GridData): QuickBooksRow[] {
  const rows: QuickBooksRow[] = [];
  for (const row of grid) {
    const cells = row.map((c) => (c == null ? "" : String(c).trim()));
    const dateIdx = cells.findIndex(isDateLike);
    if (dateIdx === -1) continue;

    // Rightmost parseable amount that isn't the date cell (bank statements
    // usually end lines with amount / balance — prefer the amount column,
    // i.e. the first parseable number from the right that isn't a bare year).
    let amount: number | null = null;
    for (let i = cells.length - 1; i >= 0; i--) {
      if (i === dateIdx) continue;
      const parsed = parseAmount(cells[i]!);
      if (parsed != null && !/^\d{4}$/.test(cells[i]!)) {
        amount = parsed;
        break;
      }
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
