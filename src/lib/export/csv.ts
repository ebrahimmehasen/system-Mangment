import type { ReportTable } from "@/lib/reports/tables";

function escapeCell(value: string | number): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * CSV for a single table, prefixed with a UTF-8 BOM so Excel opens the
 * Arabic text correctly.
 */
export function buildCsv(table: ReportTable, meta: string[] = []): string {
  const lines: string[] = [];
  for (const m of meta) lines.push(escapeCell(m));
  if (meta.length) lines.push("");
  lines.push(table.columns.map(escapeCell).join(","));
  for (const row of table.rows) lines.push(row.map(escapeCell).join(","));
  return "﻿" + lines.join("\r\n");
}
