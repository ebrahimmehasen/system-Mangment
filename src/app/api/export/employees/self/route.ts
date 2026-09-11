import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import {
  buildEmployeeReportPdf,
  employeeReportContentDisposition,
} from "@/lib/services/employee-report";

/** An employee's own payroll report — never someone else's. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  }

  const employee = await prisma.employee.findUnique({ where: { userId: user.id } });
  if (!employee) {
    return NextResponse.json({ error: "الحساب غير مربوط بملف موظف" }, { status: 404 });
  }

  const report = await buildEmployeeReportPdf(employee.id);
  if (!report) {
    return NextResponse.json({ error: "تعذّر إنشاء التقرير" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(report.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": employeeReportContentDisposition(report.employeeName),
    },
  });
}
