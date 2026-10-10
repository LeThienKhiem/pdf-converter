"use client";

import * as XLSX from "xlsx-js-style";
import {
  bankSheetRows,
  reconciliationSheetRows,
  type BankGrid,
  type Reconciliation,
} from "@/lib/bankStatement";

const BORDER = { style: "thin" as const, color: { rgb: "D0D0D0" } };
const CELL = { border: { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER } };
const HEADER = {
  ...CELL,
  font: { bold: true },
  fill: { fgColor: { rgb: "E9E9E9" }, patternType: "solid" as const },
};
const FLAGGED = { ...CELL, fill: { fgColor: { rgb: "FFF3B0" }, patternType: "solid" as const } };
const MONEY = "#,##0.00";

// xlsx-js-style reads the number format from the cell's style (numFmt), not
// from cell.z, so each formatted cell gets its own style object.
const withFormat = (style: object, numFmt: string | null) => (numFmt ? { ...style, numFmt } : style);

/**
 * The transaction table as a typed sheet: real dates and numbers, header
 * styled, and rows whose running balance doesn't follow highlighted yellow
 * so they can be checked against the PDF.
 */
export function bankWorksheet(grid: BankGrid, check: Reconciliation | null, watermark: string | null): XLSX.WorkSheet {
  const rows: (string | number | null)[][] = bankSheetRows(grid);
  if (watermark) rows.push([], [watermark]);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const flagged = new Set(check?.rowsToCheck ?? []);
  const cols = grid[0]?.length ?? 5;

  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (!cell) continue;
      const base = r === 0 ? HEADER : flagged.has(r + 1) ? FLAGGED : CELL;
      const fmt = r > 0 && cell.t === "n" ? (c === 0 ? "yyyy-mm-dd" : MONEY) : null;
      cell.s = withFormat(base, fmt);
      if (fmt) cell.z = fmt;
    }
  }
  if (watermark) {
    const ref = XLSX.utils.encode_cell({ r: rows.length - 1, c: 0 });
    if (ws[ref]) ws[ref].s = { font: { italic: true, color: { rgb: "999999" } } };
  }
  ws["!cols"] = [{ wch: 12 }, { wch: 50 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 20 }].slice(0, cols);
  return ws;
}

/** One "Checks" sheet summarising the balance check for every statement in the workbook. */
export function checksWorksheet(items: { name: string; check: Reconciliation }[]): XLSX.WorkSheet {
  const rows = reconciliationSheetRows(items);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[0]!.length; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (!cell) continue;
      const fmt = r > 0 && cell.t === "n" && c >= 2 && c <= 7 ? MONEY : null;
      cell.s = withFormat(r === 0 ? HEADER : CELL, fmt);
      if (fmt) cell.z = fmt;
    }
  }
  ws["!cols"] = [{ wch: 28 }, { wch: 13 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 26 }, { wch: 27 }, { wch: 12 }, { wch: 32 }, { wch: 24 }];
  return ws;
}
