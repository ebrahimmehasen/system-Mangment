import Link from "next/link";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { Card } from "@/components/ui/Card";
import { formatEgp, sum } from "@/lib/money";
import { computeClientFinancialSummary } from "@/lib/services/clients";
import {
  resolveDateRange,
  dateWhere,
  revenueByMonth,
  expensesByCategory,
  projectProfitability,
  sortRows,
} from "@/lib/services/reports";
import { ReportsDateFilter } from "./ReportsDateFilter";

type SP = Record<string, string | undefined>;

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  await requireUser();
  const sp = await searchParams;
  const range = resolveDateRange(sp);
  const dw = dateWhere(range);

  const [incomeTx, expenseRows, projects, clients] = await Promise.all([
    prisma.transaction.findMany({
      where: { type: "income", ...(dw ? { date: dw } : {}) },
      select: { date: true, amountEgp: true, projectId: true },
    }),
    prisma.expense.findMany({
      where: dw ? { date: dw } : {},
      select: {
        date: true,
        amountEgp: true,
        type: true,
        projectId: true,
        category: { select: { name: true } },
      },
    }),
    prisma.project.findMany({
      include: {
        client: { select: { id: true, name: true } },
        payments: { select: { amountEgp: true } },
        expenses: { where: { type: "project" }, select: { amountEgp: true } },
      },
    }),
    prisma.client.findMany({
      include: {
        projects: {
          include: {
            payments: { select: { amountEgp: true } },
            expenses: { where: { type: "project" }, select: { amountEgp: true } },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  // 1. Revenue report
  const revenue = revenueByMonth(incomeTx);
  const revenueTotal = sum(incomeTx.map((t) => t.amountEgp));

  // 2. Expense report
  const projExp = expenseRows.filter((e) => e.type === "project");
  const compExp = expenseRows.filter((e) => e.type === "company");
  const projExpTotal = sum(projExp.map((e) => e.amountEgp));
  const compExpTotal = sum(compExp.map((e) => e.amountEgp));
  const byCategory = expensesByCategory(expenseRows);

  // 3. Profit report (per project, within range)
  const revByProject = new Map<string, Prisma.Decimal>();
  for (const t of incomeTx) {
    if (!t.projectId) continue;
    revByProject.set(
      t.projectId,
      (revByProject.get(t.projectId) ?? new Prisma.Decimal(0)).plus(t.amountEgp),
    );
  }
  const expByProject = new Map<string, Prisma.Decimal>();
  for (const e of projExp) {
    if (!e.projectId) continue;
    expByProject.set(
      e.projectId,
      (expByProject.get(e.projectId) ?? new Prisma.Decimal(0)).plus(e.amountEgp),
    );
  }
  const profitRows = projects
    .map((p) => {
      const rev = revByProject.get(p.id) ?? new Prisma.Decimal(0);
      const exp = expByProject.get(p.id) ?? new Prisma.Decimal(0);
      return {
        id: p.id,
        name: p.name,
        client: p.client.name,
        revenue: rev.toFixed(2),
        expenses: exp.toFixed(2),
        profit: rev.minus(exp).toFixed(2),
      };
    })
    .filter((r) => r.revenue !== "0.00" || r.expenses !== "0.00");
  const companyNet = revenueTotal.minus(projExpTotal).minus(compExpTotal);

  // 4. Outstanding payments (lifetime snapshot)
  const outstanding = projectProfitability(projects)
    .filter((r) => Number(r.remaining) > 0)
    .sort((a, b) =>
      a.clientName === b.clientName
        ? Number(b.remaining) - Number(a.remaining)
        : a.clientName.localeCompare(b.clientName, "ar"),
    );
  const outstandingTotal = sum(outstanding.map((r) => r.remaining));

  // 5. Client financial report (lifetime, sortable)
  let clientRows = clients.map((c) => {
    const s = computeClientFinancialSummary(c.projects);
    return {
      id: c.id,
      name: c.name,
      projectCount: s.projectCount,
      finalValue: s.totalFinalContractValue,
      paid: s.totalPaid,
      discounts: s.totalDiscounts,
      remaining: s.totalRemaining,
      expenses: s.totalProjectExpenses,
      profit: s.totalProfit,
    };
  });
  clientRows = sortRows(
    clientRows,
    sp.csort,
    sp.cdir,
    ["projectCount", "finalValue", "paid", "discounts", "remaining", "expenses", "profit"],
  );

  // 6. Project profitability report (lifetime, sortable + searchable)
  const pq = (sp.pq ?? "").trim().toLowerCase();
  let profitability = projectProfitability(projects);
  if (pq) profitability = profitability.filter((r) => r.name.toLowerCase().includes(pq));
  profitability = sortRows(
    profitability,
    sp.psort,
    sp.pdir,
    ["contractValue", "finalContractValue", "paid", "expenses", "remaining", "profit"],
  );

  // sortable header link helper
  const sortLink = (
    sortKey: "csort" | "psort",
    dirKey: "cdir" | "pdir",
    field: string,
    label: string,
  ) => {
    const active = sp[sortKey] === field;
    const nextDir = active && sp[dirKey] === "desc" ? "asc" : "desc";
    const params = new URLSearchParams(
      Object.entries(sp).filter(([, v]) => v) as [string, string][],
    );
    params.set(sortKey, field);
    params.set(dirKey, nextDir);
    return (
      <Link href={`/reports?${params.toString()}`} className="hover:text-accent">
        {label} {active ? (sp[dirKey] === "asc" ? "▲" : "▼") : ""}
      </Link>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">التقارير</h1>
        <p className="mt-1 text-sm text-foreground-muted">الفترة: {range.label}</p>
      </div>

      <Card>
        <ReportsDateFilter />
      </Card>

      {/* 1. Revenue */}
      <Section title={`تقرير الإيرادات — ${formatEgp(revenueTotal)}`}>
        <SimpleTable
          head={["الشهر", "الإيرادات"]}
          rows={revenue.map((r) => [r.month, formatEgp(r.total)])}
          empty="لا توجد إيرادات في هذه الفترة."
        />
      </Section>

      {/* 2. Expenses */}
      <Section title="تقرير المصروفات">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm text-foreground-muted">حسب النوع</h3>
            <SimpleTable
              head={["النوع", "الإجمالي"]}
              rows={[
                ["مصروفات مشاريع", formatEgp(projExpTotal)],
                ["مصروفات شركة", formatEgp(compExpTotal)],
              ]}
            />
          </div>
          <div>
            <h3 className="mb-2 text-sm text-foreground-muted">حسب التصنيف</h3>
            <SimpleTable
              head={["التصنيف", "الإجمالي"]}
              rows={byCategory.map((c) => [c.category, formatEgp(c.total)])}
              empty="لا توجد مصروفات في هذه الفترة."
            />
          </div>
        </div>
      </Section>

      {/* 3. Profit */}
      <Section title="تقرير الأرباح (خلال الفترة)">
        <SimpleTable
          head={["المشروع", "العميل", "الإيرادات", "المصروفات", "الربح"]}
          rows={profitRows.map((r) => [
            r.name,
            r.client,
            formatEgp(r.revenue),
            formatEgp(r.expenses),
            formatEgp(r.profit),
          ])}
          empty="لا توجد حركة في هذه الفترة."
        />
        <p className="mt-3 text-sm">
          صافي الشركة (الإيرادات − كل المصروفات): {" "}
          <span className={Number(companyNet) >= 0 ? "text-success" : "text-danger"}>
            {formatEgp(companyNet.toFixed(2))}
          </span>
        </p>
      </Section>

      {/* 4. Outstanding */}
      <Section
        title={`تقرير المستحقات — ${formatEgp(outstandingTotal)}`}
        note="لقطة حالية (لا تتأثر بالفلتر الزمني)."
      >
        <SimpleTable
          head={["العميل", "المشروع", "القيمة النهائية", "المدفوع", "المتبقي"]}
          rows={outstanding.map((r) => [
            r.clientName,
            r.name,
            formatEgp(r.finalContractValue),
            formatEgp(r.paid),
            formatEgp(r.remaining),
          ])}
          empty="لا توجد مستحقات."
        />
      </Section>

      {/* 5. Client financial */}
      <Section title="التقرير المالي للعملاء" note="لقطة حالية.">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-right text-foreground-muted">
                <th className="px-3 py-2 font-medium">{sortLink("csort", "cdir", "name", "العميل")}</th>
                <th className="px-3 py-2 font-medium">{sortLink("csort", "cdir", "projectCount", "مشاريع")}</th>
                <th className="px-3 py-2 font-medium">{sortLink("csort", "cdir", "finalValue", "القيمة النهائية")}</th>
                <th className="px-3 py-2 font-medium">{sortLink("csort", "cdir", "paid", "المدفوع")}</th>
                <th className="px-3 py-2 font-medium">{sortLink("csort", "cdir", "remaining", "المتبقي")}</th>
                <th className="px-3 py-2 font-medium">{sortLink("csort", "cdir", "expenses", "المصروفات")}</th>
                <th className="px-3 py-2 font-medium">{sortLink("csort", "cdir", "profit", "الربح")}</th>
              </tr>
            </thead>
            <tbody>
              {clientRows.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-foreground-muted">لا يوجد عملاء.</td></tr>
              )}
              {clientRows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">
                    <Link href={`/clients/${r.id}`} className="text-accent hover:underline">{r.name}</Link>
                  </td>
                  <td className="px-3 py-2 text-foreground-muted">{r.projectCount}</td>
                  <td className="px-3 py-2">{formatEgp(r.finalValue)}</td>
                  <td className="px-3 py-2">{formatEgp(r.paid)}</td>
                  <td className="px-3 py-2">{formatEgp(r.remaining)}</td>
                  <td className="px-3 py-2">{formatEgp(r.expenses)}</td>
                  <td className="px-3 py-2">{formatEgp(r.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* 6. Project profitability */}
      <Section title="تقرير ربحية المشاريع" note="لقطة حالية.">
        <form className="mb-3">
          {Object.entries(sp)
            .filter(([k, v]) => v && k !== "pq")
            .map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
          <input
            name="pq"
            defaultValue={sp.pq ?? ""}
            placeholder="بحث باسم المشروع…"
            className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
        </form>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-right text-foreground-muted">
                <th className="px-3 py-2 font-medium">{sortLink("psort", "pdir", "name", "المشروع")}</th>
                <th className="px-3 py-2 font-medium">العميل</th>
                <th className="px-3 py-2 font-medium">{sortLink("psort", "pdir", "contractValue", "قيمة العقد")}</th>
                <th className="px-3 py-2 font-medium">{sortLink("psort", "pdir", "finalContractValue", "النهائية")}</th>
                <th className="px-3 py-2 font-medium">{sortLink("psort", "pdir", "paid", "المدفوع")}</th>
                <th className="px-3 py-2 font-medium">{sortLink("psort", "pdir", "expenses", "المصروفات")}</th>
                <th className="px-3 py-2 font-medium">{sortLink("psort", "pdir", "remaining", "المتبقي")}</th>
                <th className="px-3 py-2 font-medium">{sortLink("psort", "pdir", "profit", "الربح")}</th>
              </tr>
            </thead>
            <tbody>
              {profitability.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-foreground-muted">لا توجد مشاريع.</td></tr>
              )}
              {profitability.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">
                    <Link href={`/projects/${r.id}`} className="text-accent hover:underline">{r.name}</Link>
                  </td>
                  <td className="px-3 py-2 text-foreground-muted">{r.clientName}</td>
                  <td className="px-3 py-2">{formatEgp(r.contractValue)}</td>
                  <td className="px-3 py-2">{formatEgp(r.finalContractValue)}</td>
                  <td className="px-3 py-2">{formatEgp(r.paid)}</td>
                  <td className="px-3 py-2">{formatEgp(r.expenses)}</td>
                  <td className="px-3 py-2">{formatEgp(r.remaining)}</td>
                  <td className="px-3 py-2">{formatEgp(r.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <h2 className="text-base font-semibold">{title}</h2>
      {note && <p className="mt-1 text-xs text-foreground-muted">{note}</p>}
      <div className="mt-4">{children}</div>
    </Card>
  );
}

function SimpleTable({
  head,
  rows,
  empty,
}: {
  head: string[];
  rows: (string | number)[][];
  empty?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-right text-foreground-muted">
            {head.map((h) => (
              <th key={h} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && empty && (
            <tr>
              <td colSpan={head.length} className="px-3 py-6 text-center text-foreground-muted">
                {empty}
              </td>
            </tr>
          )}
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border last:border-0">
              {r.map((cell, j) => (
                <td key={j} className="px-3 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
