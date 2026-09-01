import Link from "next/link";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { formatEgp } from "@/lib/money";
import { computeDashboard } from "@/lib/services/dashboard";
import { buildActivityFeed } from "@/lib/services/activity";

export default async function DashboardPage() {
  const user = await requireUser();

  const [
    projects,
    clients,
    incomeAgg,
    projectExpAgg,
    companyExpAgg,
    recentPayments,
    recentExpenses,
    recentProjects,
    recentClients,
  ] = await Promise.all([
    prisma.project.findMany({
      select: {
        id: true,
        clientId: true,
        status: true,
        contractValue: true,
        discount: true,
        expectedDeliveryDate: true,
        payments: { select: { amountEgp: true } },
      },
    }),
    prisma.client.findMany({ select: { id: true, status: true } }),
    prisma.transaction.aggregate({
      where: { type: "income" },
      _sum: { amountEgp: true },
    }),
    prisma.expense.aggregate({
      where: { type: "project" },
      _sum: { amountEgp: true },
    }),
    prisma.expense.aggregate({
      where: { type: "company" },
      _sum: { amountEgp: true },
    }),
    prisma.payment.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      include: {
        client: { select: { name: true } },
        project: { select: { id: true, name: true } },
      },
    }),
    prisma.expense.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      include: {
        category: { select: { name: true } },
        project: { select: { id: true, name: true } },
      },
    }),
    prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { client: { select: { name: true } } },
    }),
    prisma.client.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
  ]);

  const data = computeDashboard({
    projects,
    clients,
    totalIncomeTransactions: new Prisma.Decimal(incomeAgg._sum.amountEgp ?? 0),
    totalProjectExpenses: new Prisma.Decimal(projectExpAgg._sum.amountEgp ?? 0),
    totalCompanyExpenses: new Prisma.Decimal(companyExpAgg._sum.amountEgp ?? 0),
  });

  const activity = buildActivityFeed({
    payments: recentPayments,
    expenses: recentExpenses,
    projects: recentProjects,
    clients: recentClients,
    limit: 15,
  });

  const dtFmt = new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const isEmpty = projects.length === 0 && clients.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">لوحة التحكم</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          أهلًا، {user.name || user.email}
        </p>
      </div>

      {isEmpty ? (
        <Card>
          <p className="text-sm text-foreground-muted">
            لا توجد بيانات بعد. ابدأ بإضافة{" "}
            <Link href="/clients" className="text-accent hover:underline">
              عميل
            </Link>{" "}
            ثم{" "}
            <Link href="/projects" className="text-accent hover:underline">
              مشروع
            </Link>
            .
          </p>
        </Card>
      ) : (
        <>
          {/* Financial overview */}
          <section>
            <h2 className="mb-3 text-sm font-semibold text-foreground-muted">
              نظرة مالية (بالجنيه المصري)
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                label="إجمالي قيمة المشاريع (بعد الخصم)"
                value={formatEgp(data.financial.totalFinalContractValue)}
              />
              <StatCard
                label="إجمالي المحصّل"
                value={formatEgp(data.financial.totalCollected)}
                tone="success"
              />
              <StatCard
                label="إجمالي المستحق من العملاء"
                value={formatEgp(data.financial.totalOutstanding)}
                tone="warning"
              />
              <StatCard
                label="إجمالي المصروفات (مشاريع + شركة)"
                value={formatEgp(data.financial.totalExpenses)}
                hint={`مشاريع ${formatEgp(data.financial.totalProjectExpenses)} · شركة ${formatEgp(data.financial.totalCompanyExpenses)}`}
                tone="danger"
              />
              <StatCard
                label="صافي التدفق النقدي"
                value={formatEgp(data.financial.netCashFlow)}
                hint="الإيرادات المحصّلة − مصروفات الشركة"
                tone={
                  Number(data.financial.netCashFlow) >= 0 ? "success" : "danger"
                }
              />
              <StatCard
                label="إجمالي الخصومات"
                value={formatEgp(data.financial.totalDiscounts)}
              />
            </div>
          </section>

          {/* Projects overview */}
          <section>
            <h2 className="mb-3 text-sm font-semibold text-foreground-muted">
              المشاريع
            </h2>
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-6">
              <StatCard label="إجمالي المشاريع" value={data.projects.total} />
              <StatCard label="نشطة" value={data.projects.active} />
              <StatCard label="مكتملة" value={data.projects.completed} />
              <StatCard label="متوقفة" value={data.projects.onHold} />
              <StatCard
                label="متأخرة"
                value={data.projects.overdue}
                tone={data.projects.overdue > 0 ? "danger" : "default"}
              />
              <StatCard
                label="تسليمها خلال 7 أيام"
                value={data.projects.dueSoon}
                tone={data.projects.dueSoon > 0 ? "warning" : "default"}
              />
            </div>
          </section>

          {/* Clients overview */}
          <section>
            <h2 className="mb-3 text-sm font-semibold text-foreground-muted">
              العملاء
            </h2>
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              <StatCard label="إجمالي العملاء" value={data.clients.total} />
              <StatCard label="نشطون" value={data.clients.active} />
              <StatCard
                label="لديهم مشاريع نشطة"
                value={data.clients.withActiveProjects}
              />
              <StatCard
                label="عليهم مبالغ مستحقة"
                value={data.clients.withOutstanding}
              />
            </div>
          </section>

          {/* Recent activity */}
          <section>
            <h2 className="mb-3 text-sm font-semibold text-foreground-muted">
              آخر النشاطات
            </h2>
            <Card className="p-0">
              <ul className="divide-y divide-border">
                {activity.length === 0 && (
                  <li className="px-4 py-6 text-center text-sm text-foreground-muted">
                    لا توجد نشاطات بعد.
                  </li>
                )}
                {activity.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <Link href={item.href} className="text-sm hover:text-accent">
                      {item.text}
                    </Link>
                    <span className="text-xs text-foreground-muted whitespace-nowrap">
                      {dtFmt.format(item.at)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
