"use client";

import { formatMoney, type Reconciliation } from "@/lib/bankStatement";

type Props = {
  check: Reconciliation;
  /** Shown on a partial result: pages extracted vs total. */
  pages?: { extracted: number; total: number } | null;
  onUnlock?: () => void;
};

/**
 * The balance check, in the words an accountant would use. Arithmetic only —
 * see reconcileStatement — so a green tick means the numbers really add up.
 */
export default function ReconciliationBadge({ check: c, pages, onUnlock }: Props) {
  const m = (n: number | null) => formatMoney(n, c.currency);
  const totals = `${c.transactions} transactions · money in ${m(c.moneyIn)} · money out ${m(c.moneyOut)}`;
  const rows = c.rowsToCheck.slice(0, 6).join(", ") + (c.rowsToCheck.length > 6 ? "…" : "");

  if (c.status === "reconciled") {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900" role="status">
        <p className="font-semibold">
          ✓ {c.basis === "totals" ? "Balances reconcile to the cent" : "Running balance checks out on every line"}
        </p>
        <p className="mt-0.5 text-xs text-emerald-800">
          {c.basis === "totals" ? `Opening ${m(c.opening)} → closing ${m(c.closing)} · ` : ""}
          {totals}
        </p>
      </div>
    );
  }

  if (c.status === "mismatch") {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
        <p className="font-semibold">
          ⚠{" "}
          {c.basis === "totals" && c.difference != null
            ? `Doesn't reconcile — ${m(Math.abs(c.difference))} off the statement's closing balance`
            : `Running balance doesn't follow on ${c.rowsToCheck.length} row${c.rowsToCheck.length === 1 ? "" : "s"}`}
        </p>
        <p className="mt-0.5 text-xs text-amber-800">
          {rows ? `Check row${c.rowsToCheck.length === 1 ? "" : "s"} ${rows} against the PDF — highlighted yellow in the Excel file. ` : "Check the totals against the PDF before importing. "}
          {totals}
        </p>
      </div>
    );
  }

  if (c.status === "partial") {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700" role="status">
        <p className="font-semibold">
          Balance check needs the whole statement
          {pages ? ` — pages ${pages.extracted + 1}–${pages.total} aren't extracted yet` : ""}
        </p>
        <p className="mt-0.5 text-xs text-slate-600">
          {c.closing != null
            ? `The statement closes at ${m(c.closing)}; the extracted pages reach ${m(c.computedClosing)}. `
            : ""}
          {totals}
          {onUnlock && (
            <>
              {" · "}
              <button type="button" onClick={onUnlock} className="font-semibold text-blue-700 underline-offset-2 hover:underline">
                Unlock and reconcile →
              </button>
            </>
          )}
        </p>
      </div>
    );
  }

  return (
    <p className="text-xs text-slate-500" role="status">
      {totals} · this statement prints no balances to cross-check against
    </p>
  );
}
