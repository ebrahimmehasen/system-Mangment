import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { formatEgp } from "@/lib/money";
import { employeeListWhere } from "@/lib/services/employees";
import { computeEmployeePayrollSummary } from "@/lib/services/payroll";
import { buildWorkbook } from "@/lib/export/excel";
import type { ReportTable } from "@/lib/reports/tables";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const q = sp.get("q") ?? "";
  const statusParam = sp.get("status");
  const status =
    statusParam === "active" || statusParam === "inactive" ? statusParam : undefined;

  const employees = await prisma.employee.findMany({
    where: employeeListWhere(q, status),
    orderBy: { name: "asc" },
    include: {
      _count: { select: { assignments: true } },
      payments: {
        select: {
          payType: true,
          amountEgp: true,
          projectId: true,
          project: { select: { name: true, client: { select: { name: true } } } },
        },
      },
    },
  });

  const table: ReportTable = {
    key: "employees",
    title: "قائمة الموظفين",
    columns: [
      "الاسم",
      "المؤهل / الوظيفة",
      "العمر",
      "الدولة",
      "المحافظة",
      "الهاتف",
      "التقييم",
      "الحالة",
      "عدد المشاريع",
      "إجمالي المصروف",
      "إجمالي الخصومات",
      "الصافي المستلَم",
    ],
    rows: employees.map((e) => {
      const pr = computeEmployeePayrollSummary(e.payments);
      return [
        e.name,
        e.qualification ?? "",
        e.age ?? "",
        e.country ?? "",
        e.governorate ?? "",
        e.phone ?? "",
        e.rating && e.rating > 0 ? `${e.rating} / 10` : "",
        e.status === "active" ? "نشط" : "مؤرشف",
        e._count.assignments,
        formatEgp(pr.disbursed),
        formatEgp(pr.deducted),
        formatEgp(pr.net),
      ];
    }),
  };

  const stamp = new Date().toISOString().slice(0, 10);
  const buffer = await buildWorkbook(
    {
      docTitle: "قائمة الموظفين",
      period: `${employees.length} موظف`,
      generatedAt: new Date(),
    },
    [table],
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="employees-${stamp}.xlsx"`,
    },
  });
}
