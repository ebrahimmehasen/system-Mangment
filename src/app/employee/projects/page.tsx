import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatEgp } from "@/lib/money";
import { computeEmployeePayrollSummary } from "@/lib/services/payroll";

export default async function EmployeeProjectsPage() {
  const user = await requireUser();
  const employee = await prisma.employee.findUniqueOrThrow({
    where: { userId: user.id },
    include: {
      assignments: {
        orderBy: { assignedAt: "desc" },
        include: {
          project: { select: { id: true, name: true, status: true, client: { select: { name: true } } } },
        },
      },
      payments: {
        include: { project: { select: { name: true, client: { select: { name: true } } } } },
      },
    },
  });

  const payroll = computeEmployeePayrollSummary(employee.payments);
  const byProject = new Map(payroll.byProject.map((r) => [r.projectId, r]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">مشاريعي</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          {employee.assignments.length} مشروع
        </p>
      </div>

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-right text-foreground-muted">
                <th className="px-4 py-3 font-medium">المشروع</th>
                <th className="px-4 py-3 font-medium">العميل</th>
                <th className="px-4 py-3 font-medium">الدور</th>
                <th className="px-4 py-3 font-medium">حالة المشروع</th>
                <th className="px-4 py-3 font-medium">عمولتي/مستحقاتي</th>
              </tr>
            </thead>
            <tbody>
              {employee.assignments.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-foreground-muted">
                    مش معيّن على أي مشروع حاليًا.
                  </td>
                </tr>
              )}
              {employee.assignments.map((a) => {
                const p = byProject.get(a.project.id);
                return (
                  <tr key={a.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">{a.project.name}</td>
                    <td className="px-4 py-3 text-foreground-muted">{a.project.client.name}</td>
                    <td className="px-4 py-3">
                      <Badge tone={a.role === "supervisor" ? "accent" : "neutral"}>
                        {a.role === "supervisor" ? "مشرف" : "موظف"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-foreground-muted">{a.project.status}</td>
                    <td className="px-4 py-3">{p ? formatEgp(p.net) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
