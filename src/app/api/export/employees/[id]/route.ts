import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApi } from "@/lib/api-auth";
import {
  buildEmployeeReportPdf,
  employeeReportContentDisposition,
} from "@/lib/services/employee-report";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Admin-only: any employee's report. An employee's own report is served
  // by /api/export/employees/self instead — this stops an employee-role
  // login from reading another employee's payroll data by guessing an id.
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

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
