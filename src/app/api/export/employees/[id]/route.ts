import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import {
  buildEmployeeReportPdf,
  employeeReportContentDisposition,
} from "@/lib/services/employee-report";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  }

  // Admin-only: any employee's report. An employee's own report is served
  // by /api/export/employees/self instead — this stops an employee-role
  // login from reading another employee's payroll data by guessing an id.
  const profile = await prisma.user.findUnique({ where: { id: user.id } });
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
  }

  const report = await buildEmployeeReportPdf(id);
  if (!report) {
    return NextResponse.json({ error: "الموظف غير موجود" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(report.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": employeeReportContentDisposition(report.employeeName),
    },
  });
}
