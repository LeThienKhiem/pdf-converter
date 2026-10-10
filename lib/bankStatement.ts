/**
 * Bank statements as one clean transaction table, plus a balance check.
 *
 * The generic extractor copies a page's visual layout, which for a statement
 * means every page's header, footer, account summary and "balance carried
 * forward" line lands in the spreadsheet between the transactions. For the
 * bank tool the model instead returns a fixed shape —
 *
 *   ["@statement", opening, closing, currency, periodStart, periodEnd]
 *   [date, description, debit, credit, balance, (category)]
 *   ...
 *
 * — kept as a top-level array so a response cut off at max_tokens can still
 * be salvaged row by row. A document that turns out not to be a statement
 * comes back as ["@layout"] followed by the usual visual grid.
 *
 * The check is arithmetic done here, never asked of the model: an accountant's
 * first question is whether the numbers add up, and a model saying "yes" is
 * not an answer.
 *
 * Pure module — used by /api/extract and by the browser.
 */

export type BankGrid = (string | null)[][];

export const BANK_HEADER = ["Date", "Description", "Debit (out)", "Credit (in)", "Balance"] as const;

export type StatementMeta = {
  opening: number | null;
  closing: number | null;
  currency: string | null;
  periodStart: string | null;
  periodEnd: string | null;
};

export const BANK_SYSTEM_PROMPT = `You extract the transactions from a bank, credit card or account statement into ONE clean table.

**Output Format (CRITICAL)**
- Output ONLY a JSON array. Your entire response MUST start with \`[\` and end with \`]\`. No markdown, no commentary.
- The FIRST element is the statement summary row:
  ["@statement", opening_balance, closing_balance, currency, period_start, period_end]
  - opening_balance / closing_balance: the statement period's opening (beginning / previous) and closing (ending / new) balance, from the account summary or the first opening-balance / last closing-balance line. JSON numbers, or null if these pages don't show them. Never use a "balance brought forward" / "carried forward" line that only continues the list from one page to the next.
  - currency: ISO code such as "USD", "GBP", "EUR", or null.
  - period_start / period_end: "YYYY-MM-DD", or null.
- Every following element is ONE transaction, in the order printed:
  [date, description, debit, credit, balance]
  - date: "YYYY-MM-DD". When a line shows only day and month, take the year from the statement period (a December-to-January statement spans two years). If the year cannot be known, copy the date as printed.
  - description: the full transaction description. Join wrapped continuation lines into the same description. Keep reference numbers.
  - debit: money LEAVING the account (withdrawals, card purchases, payments made, fees, charges) as a positive number, else null.
  - credit: money ENTERING the account (deposits, transfers in, refunds, interest, payments received) as a positive number, else null.
  - On a credit card statement, purchases, charges, fees and interest are debit; payments and refunds are credit.
  - balance: the running balance printed on that line as a number (negative when overdrawn or marked DR/OD), or null when that line shows none.
  - Numbers are plain JSON numbers: no currency symbols, no thousands separators. Example: 1234.5
- Do NOT output column headers, page headers or footers, bank addresses, account summaries, opening / closing / brought-forward / carried-forward balance lines, subtotals or totals, "daily ending balance" tables, messages or disclosures. Transactions only.

Example:
[["@statement", 1520.4, 1873.15, "USD", "2026-03-01", "2026-03-31"],
 ["2026-03-02", "CARD PURCHASE STARBUCKS #1182", 6.45, null, 1513.95],
 ["2026-03-03", "PAYROLL ACME CORP DIRECT DEP", null, 2410, 3923.95]]

**Not a statement?**
If the document is not a bank, credit card or account statement (for example an invoice, receipt or form), output ["@layout"] as the first element instead, then copy the document as a visual grid: one array per visual line, each cell a string or null, in reading order.`;

export const BANK_CATEGORIZE_APPENDIX = `

**Categories (this request only)**
- Append a sixth value to every transaction: its category, one of: Income, Transfer, Rent/Mortgage, Utilities, Payroll, Insurance, Software/Subscriptions, Office/Supplies, Travel, Meals, Fuel, Bank Fees, Taxes, Loan Payment, Shopping, Healthcare, Other.
- Base it on the description. The "@statement" row stays at six values.`;

/** "1,234.56", "$1,234.56", "(45.00)", "45.00-", "45.00 DR", 45 → number. */
export function parseAmount(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  let v = value.trim();
  if (!v) return null;
  let negative = false;
  if (/^\(.*\)$/.test(v)) {
    negative = true;
    v = v.slice(1, -1);
  }
  if (/\s*(DR|OD)$/i.test(v)) {
    negative = true;
    v = v.replace(/\s*(DR|OD)$/i, "");
  }
  v = v.replace(/\s*CR$/i, "");
  if (v.endsWith("-")) {
    negative = true;
    v = v.slice(0, -1);
  }
  if (v.startsWith("-")) {
    negative = !negative;
    v = v.slice(1);
  }
  v = v.replace(/^[A-Z]{0,3}\s?[$€£¥₹]?\s?/, "").replace(/[\s,]/g, "");
  if (!/^\d+(\.\d+)?$/.test(v)) return null;
  const n = parseFloat(v);
  return negative ? -n : n;
}

const cents = (n: number) => Math.round(n * 100);

function amountCell(n: number | null): string | null {
  if (n == null) return null;
  // Two decimals for display; keep more only when the statement printed more.
  return Number.isInteger(n * 100) ? n.toFixed(2) : String(n);
}

function textCell(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

export type StructuredBank = {
  mode: "statement" | "layout";
  grid: BankGrid;
  statement: StatementMeta | null;
  transactions: number;
};

/** Turn the model's array into the spreadsheet grid (header + one row per transaction). */
export function structureBankResponse(parsed: unknown, categorize: boolean): StructuredBank {
  const rows = Array.isArray(parsed) ? parsed : [];
  const first = Array.isArray(rows[0]) ? (rows[0] as unknown[]) : null;

  if (first && first[0] === "@layout") {
    const grid = rows.slice(1).map((r) => (Array.isArray(r) ? r.map(textCell) : [textCell(r)]));
    return { mode: "layout", grid, statement: null, transactions: 0 };
  }

  let statement: StatementMeta | null = null;
  let body = rows;
  if (first && first[0] === "@statement") {
    statement = {
      opening: parseAmount(first[1]),
      closing: parseAmount(first[2]),
      currency: typeof first[3] === "string" && /^[A-Z]{3}$/.test(first[3]) ? first[3] : null,
      periodStart: textCell(first[4]),
      periodEnd: textCell(first[5]),
    };
    body = rows.slice(1);
  }

  const header: (string | null)[] = [...BANK_HEADER];
  if (categorize) header.push("Category");
  const grid: BankGrid = [header];

  for (const r of body) {
    if (!Array.isArray(r)) continue;
    const date = textCell(r[0]);
    const description = textCell(r[1]);
    let debit = parseAmount(r[2]);
    let credit = parseAmount(r[3]);
    const balance = parseAmount(r[4]);
    // A signed single amount put in the wrong column: normalise to positives.
    if (debit != null && debit < 0 && credit == null) {
      credit = -debit;
      debit = null;
    } else if (credit != null && credit < 0 && debit == null) {
      debit = -credit;
      credit = null;
    }
    const hasMoney = debit != null || credit != null || balance != null;
    if (!hasMoney) {
      // A wrapped description line the model split out — fold it back in.
      const prev = grid[grid.length - 1]!;
      if (grid.length > 1 && description && !date) prev[1] = `${prev[1] ?? ""} ${description}`.trim();
      continue;
    }
    const row: (string | null)[] = [date, description, amountCell(debit), amountCell(credit), amountCell(balance)];
    if (categorize) row.push(textCell(r[5]));
    grid.push(row);
  }

  return { mode: "statement", grid, statement, transactions: grid.length - 1 };
}

export function isBankGrid(grid: BankGrid): boolean {
  const h = grid[0];
  return Boolean(h && BANK_HEADER.every((name, i) => h[i] === name));
}

/** Combine per-chunk summaries: the first chunk's opening, the last chunk's closing. */
export function mergeStatementMeta(parts: (StatementMeta | null | undefined)[]): StatementMeta | null {
  const present = parts.filter((p): p is StatementMeta => Boolean(p));
  if (present.length === 0) return null;
  const firstOf = <K extends keyof StatementMeta>(k: K) => present.find((p) => p[k] != null)?.[k] ?? null;
  const lastOf = <K extends keyof StatementMeta>(k: K) =>
    [...present].reverse().find((p) => p[k] != null)?.[k] ?? null;
  return {
    opening: firstOf("opening"),
    closing: lastOf("closing"),
    currency: firstOf("currency"),
    periodStart: firstOf("periodStart"),
    periodEnd: lastOf("periodEnd"),
  };
}

export type Reconciliation = {
  status: "reconciled" | "mismatch" | "partial" | "unchecked";
  /** How the verdict was reached — totals against the summary, or the running balance line by line. */
  basis: "totals" | "running_balance" | null;
  transactions: number;
  moneyIn: number;
  moneyOut: number;
  opening: number | null;
  closing: number | null;
  computedClosing: number | null;
  difference: number | null;
  currency: string | null;
  /** Spreadsheet row numbers (1-based, header = row 1) where the running balance doesn't follow. */
  rowsToCheck: number[];
};

type Tx = { row: number; delta: number; balance: number | null };

/**
 * Walk the transactions keeping a running balance and count the lines whose
 * printed balance disagrees. `sign` = -1 handles credit card statements,
 * where the balance owed rises with spending.
 */
function chain(txs: Tx[], sign: 1 | -1, opening: number | null) {
  let running: number | null = opening;
  let checked = 0;
  const breaks: number[] = [];
  for (const t of txs) {
    const expected = running == null ? null : running + sign * t.delta;
    if (t.balance != null) {
      if (expected != null) {
        checked++;
        if (Math.abs(cents(expected) - cents(t.balance)) > 1) breaks.push(t.row);
      }
      running = t.balance;
    } else {
      running = expected;
    }
  }
  return { checked, breaks };
}

export function reconcileStatement(
  grid: BankGrid,
  statement: StatementMeta | null | undefined,
  opts: { partial?: boolean } = {}
): Reconciliation | null {
  if (!isBankGrid(grid)) return null;

  const forward: Tx[] = [];
  let moneyIn = 0;
  let moneyOut = 0;
  for (let i = 1; i < grid.length; i++) {
    const r = grid[i]!;
    const debit = parseAmount(r[2]) ?? 0;
    const credit = parseAmount(r[3]) ?? 0;
    moneyIn += credit;
    moneyOut += debit;
    forward.push({ row: i + 1, delta: credit - debit, balance: parseAmount(r[4]) });
  }

  const opening = statement?.opening ?? null;
  const closing = statement?.closing ?? null;
  const base = {
    transactions: forward.length,
    moneyIn: cents(moneyIn) / 100,
    moneyOut: cents(moneyOut) / 100,
    opening,
    closing,
    currency: statement?.currency ?? null,
  };

  // Some banks list newest first; try both orders and both balance signs and
  // keep the reading under which the printed balances agree best.
  const reversed = [...forward].reverse();
  const candidates = ([1, -1] as const).flatMap((sign) => [
    { sign, ...chain(forward, sign, opening) },
    { sign, ...chain(reversed, sign, null) },
  ]);
  const best = candidates.reduce((a, b) =>
    b.checked > 0 && (a.checked === 0 || b.breaks.length < a.breaks.length) ? b : a
  );

  const totalsFor = (sign: 1 | -1) =>
    opening == null ? null : cents(opening + sign * (moneyIn - moneyOut)) / 100;

  if (opts.partial) {
    return {
      ...base,
      status: "partial",
      basis: null,
      computedClosing: totalsFor(best.checked > 0 ? best.sign : 1),
      difference: null,
      rowsToCheck: [],
    };
  }

  if (opening != null && closing != null) {
    // Card statements often print no running balance, so the sign can't be
    // learned from the lines — accept whichever convention adds up.
    const signs: (1 | -1)[] = best.checked > 0 ? [best.sign, best.sign === 1 ? -1 : 1] : [1, -1];
    for (const sign of signs) {
      const computed = totalsFor(sign)!;
      if (Math.abs(cents(computed) - cents(closing)) <= 1) {
        return { ...base, status: "reconciled", basis: "totals", computedClosing: computed, difference: 0, rowsToCheck: [] };
      }
    }
    const computed = totalsFor(signs[0]!)!;
    return {
      ...base,
      status: "mismatch",
      basis: "totals",
      computedClosing: computed,
      difference: cents(closing - computed) / 100,
      rowsToCheck: [...best.breaks].sort((a, b) => a - b),
    };
  }

  if (best.checked >= 2) {
    return {
      ...base,
      status: best.breaks.length === 0 ? "reconciled" : "mismatch",
      basis: "running_balance",
      computedClosing: null,
      difference: null,
      rowsToCheck: [...best.breaks].sort((a, b) => a - b),
    };
  }

  return { ...base, status: "unchecked", basis: null, computedClosing: null, difference: null, rowsToCheck: [] };
}

/** ISO date → Excel serial day number, computed in UTC so no timezone can shift it a day. */
export function excelSerial(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(t) ? null : (t - Date.UTC(1899, 11, 30)) / 86400000;
}

/**
 * Spreadsheet rows with real numbers, so SUM() works the moment the file
 * opens: amount columns become numbers and ISO dates become Excel serial
 * dates (the caller applies the date format to column A).
 */
export function bankSheetRows(grid: BankGrid): (string | number | null)[][] {
  return grid.map((row, i) => {
    if (i === 0) return row;
    return row.map((cell, j) => {
      if (cell == null) return null;
      if (j === 0) return excelSerial(cell) ?? cell;
      if (j >= 2 && j <= 4) return parseAmount(cell) ?? cell;
      return cell;
    });
  });
}

const SYMBOLS: Record<string, string> = { USD: "$", GBP: "£", EUR: "€", CAD: "C$", AUD: "A$", INR: "₹", JPY: "¥" };

const money = (n: number | null, currency: string | null) => {
  if (n == null) return "—";
  const prefix = currency ? (SYMBOLS[currency] ?? `${currency} `) : "$";
  const digits = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n < 0 ? "-" : ""}${prefix}${digits}`;
};

export function formatMoney(n: number | null, currency: string | null): string {
  return money(n, currency);
}

/** Rows for a "Checks" sheet in the downloaded workbook. */
export function reconciliationSheetRows(items: { name: string; check: Reconciliation }[]): (string | number | null)[][] {
  const out: (string | number | null)[][] = [
    ["File", "Transactions", "Opening balance", "Money in", "Money out", "Closing balance (statement)", "Closing balance (calculated)", "Difference", "Result", "Rows to check"],
  ];
  const label: Record<Reconciliation["status"], string> = {
    reconciled: "Reconciled",
    mismatch: "Does not reconcile",
    partial: "Partial — not all pages extracted",
    unchecked: "Not checked — no balances printed",
  };
  for (const { name, check: c } of items) {
    out.push([
      name,
      c.transactions,
      c.opening,
      c.moneyIn,
      c.moneyOut,
      c.closing,
      c.computedClosing,
      c.difference,
      label[c.status],
      c.rowsToCheck.length ? c.rowsToCheck.slice(0, 50).join(", ") : null,
    ]);
  }
  return out;
}
