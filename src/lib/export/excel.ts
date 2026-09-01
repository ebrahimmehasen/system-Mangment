import "server-only";

import ExcelJS from "exceljs";
import type { ReportTable } from "@/lib/reports/tables";

export interface WorkbookMeta {
  docTitle: string;
  period: string;
  generatedAt: Date;
}

/** Build an .xlsx buffer with one sheet per table, RTL, Arabic headers. */
export async function buildWorkbook(
  meta: WorkbookMeta,
  tables: ReportTable[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "404 Legends";
  wb.created = meta.generatedAt;

  const dateFmt = new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  for (const table of tables) {
    // sheet names: max 31 chars, no []:*?/\
    const safeName = table.title.replace(/[[\]:*?/\\]/g, "").slice(0, 31);
    const ws = wb.addWorksheet(safeName || table.key, {
      views: [{ rightToLeft: true }],
    });

    ws.addRow(["404 Legends"]).font = { bold: true, size: 14 };
    ws.addRow([table.title]).font = { bold: true, size: 12 };
    ws.addRow([`الفترة: ${meta.period}`]);
    ws.addRow([`تاريخ التوليد: ${dateFmt.format(meta.generatedAt)}`]);
    ws.addRow([]);

    const headerRow = ws.addRow(table.columns);
    headerRow.font = { bold: true };
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFEDEDED" },
      };
    });

    for (const row of table.rows) ws.addRow(row);

    table.columns.forEach((col, i) => {
      const maxLen = Math.max(
        col.length,
        ...table.rows.map((r) => String(r[i] ?? "").length),
      );
      ws.getColumn(i + 1).width = Math.min(Math.max(maxLen + 2, 12), 40);
    });
  }

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
