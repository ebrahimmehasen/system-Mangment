import "server-only";

import { prisma } from "@/lib/db/prisma";
import { formatEgp, formatOriginalWithEgp } from "@/lib/money";
import { computeEmployeePayrollSummary, PAY_TYPE_LABELS, type PayType } from "@/lib/services/payroll";
import { buildEmployeePdf } from "@/lib/export/pdf";
import type { ReportTable } from "@/lib/reports/tables";

/**
 * Builds the branded employee-payroll PDF buffer for one employee. Shared by
 * the admin export route (/api/export/employees/[id]) and the employee's own
 * self-export route (/api/export/employees/self) — same report, different
 * authorization at the route level.
 */
export async function buildEmployeeReportPdf(
  employeeId: string,
): Promise<{ buffer: Buffer; employeeName: string } | null> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: {
      _count: { select: { assignments: true } },
      payments: {
        orderBy: { date: "desc" },
        include: {
          project: { select: { name: true, client: { select: { name: true } } } },
        },
      },
    },
  });
  if (!employee) return null;

  const pr = computeEmployeePayrollSummary(employee.payments);
  const dateFmt = new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium" });

  const info = [
    { label: "المؤهل / الوظيفة", value: employee.qualification ?? "" },
    { label: "الحالة", value: employee.status === "active" ? "نشط" : "مؤرشف" },
    {
      label: "التقييم",
      value: employee.rating && employee.rating > 0 ? `${employee.rating} / 10` : "غير مقيّم",
    },
    { label: "الهاتف", value: employee.phone ?? "" },
    {
      label: "الدولة / المحافظة",
      value: [employee.country, employee.governorate].filter(Boolean).join(" — "),
    },
    { label: "عدد المشاريع", value: String(employee._count.assignments) },
  ];

  const summary = [
    { label: "إجمالي المصروف", value: formatEgp(pr.disbursed) },
    { label: "إجمالي الخصومات", value: formatEgp(pr.deducted) },
    { label: "الصافي المستلَم", value: formatEgp(pr.net) },
  ];

  const byProject: ReportTable = {
    key: "by-project",
    title: "المدفوعات حسب المشروع",
    columns: ["المشروع", "العميل", "مصروف", "مخصوم", "الصافي"],
    rows: [
      ...pr.byProject.map((r) => [
        r.projectName,
        r.clientName,
        formatEgp(r.disbursed),
        formatEgp(r.deducted),
        formatEgp(r.net),
      ]),
      ["الإجمالي", "", formatEgp(pr.disbursed), formatEgp(pr.deducted), formatEgp(pr.net)],
    ],
  };

  const detail: ReportTable = {
    key: "payments",
    title: "تفصيل الدفعات",
    columns: ["التاريخ", "النوع", "المشروع", "المبلغ", "ملاحظات"],
    rows: employee.payments.map((p) => [
      dateFmt.format(p.date),
      PAY_TYPE_LABELS[p.payType as PayType],
      p.project.name,
      formatOriginalWithEgp(p.amountOriginal, p.currency, p.amountEgp),
      p.notes ?? "",
    ]),
  };

  const buffer = await buildEmployeePdf({
    name: employee.name,
    generatedAt: new Date(),
    info,
    summary,
    tables: [byProject, detail],
  });

  return { buffer, employeeName: employee.name };
}

/** RFC 5987 Content-Disposition value for a downloaded employee report PDF. */
export function employeeReportContentDisposition(employeeName: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  const utf8 = encodeURIComponent(`${employeeName.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 60)}-${stamp}.pdf`);
  return `attachment; filename="employee-report-${stamp}.pdf"; filename*=UTF-8''${utf8}`;
}
