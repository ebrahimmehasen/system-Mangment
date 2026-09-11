import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { Card } from "@/components/ui/Card";
import { formatEgp } from "@/lib/money";
import { computeEmployeePayrollSummary } from "@/lib/services/payroll";

export default async function EmployeeDashboardPage() {
  const user = await requireUser();
  const employee = await prisma.employee.findUniqueOrThrow({
    where: { userId: user.id },
    include: {
      payments: {
        include: { project: { select: { name: true, client: { select: { name: true } } } } },
      },
      assignments: { select: { id: true } },
      claimedTargetClients: { select: { status: true } },
    },
  });

  const payroll = computeEmployeePayrollSummary(employee.payments);
  const wonLeads = employee.claimedTargetClients.filter((t) => t.status === "won").length;
  const activeLeads = employee.claimedTargetClients.filter((t) => t.status === "claimed").length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">أهلًا، {employee.name}</h1>
        <p className="mt-1 text-sm text-foreground-muted">نظرة عامة على شغلك.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-xs text-foreground-muted">مشاريعي</p>
          <p className="mt-2 text-2xl font-semibold">{employee.assignments.length}</p>
        </Card>
        <Card>
          <p className="text-xs text-foreground-muted">عملاء نجحت معاهم</p>
          <p className="mt-2 text-2xl font-semibold text-success">{wonLeads}</p>
        </Card>
        <Card>
          <p className="text-xs text-foreground-muted">عملاء شغال عليهم دلوقتي</p>
          <p className="mt-2 text-2xl font-semibold text-accent">{activeLeads}</p>
        </Card>
        <Card>
          <p className="text-xs text-foreground-muted">الصافي المستلَم</p>
          <p className="mt-2 text-2xl font-semibold">{formatEgp(payroll.net)}</p>
        </Card>
      </div>

      <Card>
        <h2 className="mb-4 text-base font-semibold">ملخص المدفوعات</h2>
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-foreground-muted">إجمالي المصروف</dt>
            <dd className="mt-1 font-semibold text-success">{formatEgp(payroll.disbursed)}</dd>
          </div>
          <div>
            <dt className="text-xs text-foreground-muted">إجمالي الخصومات</dt>
            <dd className="mt-1 font-semibold text-danger">{formatEgp(payroll.deducted)}</dd>
          </div>
          <div>
            <dt className="text-xs text-foreground-muted">الصافي</dt>
            <dd className="mt-1 font-semibold">{formatEgp(payroll.net)}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
