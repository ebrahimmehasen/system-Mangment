import { formatEgp } from "@/lib/money";
import type { ReportsData } from "./data";

export interface ReportTable {
  key: string;
  title: string;
  columns: string[];
  rows: (string | number)[][];
}

/** All /reports sections as flat, exportable tables. */
export function reportsToTables(d: ReportsData): ReportTable[] {
  return [
    {
      key: "revenue",
      title: "تقرير الإيرادات",
      columns: ["الشهر", "الإيرادات (ج.م)"],
      rows: [
        ...d.revenue.map((r) => [r.month, formatEgp(r.total)]),
        ["الإجمالي", formatEgp(d.revenueTotal)],
      ],
    },
    {
      key: "expenses-type",
      title: "المصروفات حسب النوع",
      columns: ["النوع", "الإجمالي (ج.م)"],
      rows: [
        ["مصروفات مشاريع", formatEgp(d.projectExpenseTotal)],
        ["مصروفات شركة", formatEgp(d.companyExpenseTotal)],
      ],
    },
    {
      key: "expenses-category",
      title: "المصروفات حسب التصنيف",
      columns: ["التصنيف", "الإجمالي (ج.م)"],
      rows: d.expenseByCategory.map((c) => [c.category, formatEgp(c.total)]),
    },
    {
      key: "profit",
      title: "تقرير الأرباح (خلال الفترة)",
      columns: ["المشروع", "العميل", "الإيرادات", "المصروفات", "الربح"],
      rows: [
        ...d.profitRows.map((r) => [
          r.name,
          r.client,
          formatEgp(r.revenue),
          formatEgp(r.expenses),
          formatEgp(r.profit),
        ]),
        ["صافي الشركة", "", "", "", formatEgp(d.companyNet)],
      ],
    },
    {
      key: "outstanding",
      title: "تقرير المستحقات",
      columns: ["العميل", "المشروع", "القيمة النهائية", "المدفوع", "المتبقي"],
      rows: [
        ...d.outstanding.map((r) => [
          r.clientName,
          r.name,
          formatEgp(r.finalContractValue),
          formatEgp(r.paid),
          formatEgp(r.remaining),
        ]),
        ["الإجمالي", "", "", "", formatEgp(d.outstandingTotal)],
      ],
    },
    {
      key: "clients",
      title: "التقرير المالي للعملاء",
      columns: [
        "العميل",
        "المشاريع",
        "القيمة النهائية",
        "المدفوع",
        "المتبقي",
        "المصروفات",
        "الربح",
      ],
      rows: d.clientRows.map((r) => [
        r.name,
        r.projectCount,
        formatEgp(r.finalValue),
        formatEgp(r.paid),
        formatEgp(r.remaining),
        formatEgp(r.expenses),
        formatEgp(r.profit),
      ]),
    },
    {
      key: "profitability",
      title: "تقرير ربحية المشاريع",
      columns: [
        "المشروع",
        "العميل",
        "قيمة العقد",
        "النهائية",
        "المدفوع",
        "المصروفات",
        "المتبقي",
        "الربح",
      ],
      rows: d.profitability.map((r) => [
        r.name,
        r.clientName,
        formatEgp(r.contractValue),
        formatEgp(r.finalContractValue),
        formatEgp(r.paid),
        formatEgp(r.expenses),
        formatEgp(r.remaining),
        formatEgp(r.profit),
      ]),
    },
  ];
}
