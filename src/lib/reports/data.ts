import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { sum } from "@/lib/money";
import { computeClientFinancialSummary } from "@/lib/services/clients";
import {
  resolveDateRange,
  dateWhere,
  revenueByMonth,
  expensesByCategory,
  projectProfitability,
  sortRows,
  type DateRange,
} from "@/lib/services/reports";

export interface ReportsParams {
  range?: string;
  from?: string;
  to?: string;
  csort?: string;
  cdir?: string;
  psort?: string;
  pdir?: string;
  pq?: string;
}

export interface ClientFinancialRow {
  id: string;
  name: string;
  projectCount: number;
  finalValue: string;
  paid: string;
  discounts: string;
  remaining: string;
  expenses: string;
  profit: string;
}

export interface ProfitRow {
  id: string;
  name: string;
  client: string;
  revenue: string;
  expenses: string;
  profit: string;
}

export interface OutstandingRow {
  clientName: string;
  name: string;
  finalContractValue: string;
  paid: string;
  remaining: string;
}

export interface ReportsData {
  range: DateRange;
  revenue: { month: string; total: string }[];
  revenueTotal: string;
  projectExpenseTotal: string;
  companyExpenseTotal: string;
  expenseByCategory: { category: string; total: string }[];
  profitRows: ProfitRow[];
  companyNet: string;
  outstanding: OutstandingRow[];
  outstandingTotal: string;
  clientRows: ClientFinancialRow[];
  profitability: ReturnType<typeof projectProfitability>;
}

/**
 * Single source of truth for the /reports data. Used by the reports page
 * and by the export endpoint so they can never drift apart.
 */
export async function getReportsData(sp: ReportsParams): Promise<ReportsData> {
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

  const revenue = revenueByMonth(incomeTx);
  const revenueTotal = sum(incomeTx.map((t) => t.amountEgp));

  const projExp = expenseRows.filter((e) => e.type === "project");
  const compExp = expenseRows.filter((e) => e.type === "company");
  const projectExpenseTotal = sum(projExp.map((e) => e.amountEgp));
  const companyExpenseTotal = sum(compExp.map((e) => e.amountEgp));
  const expenseByCategory = expensesByCategory(expenseRows);

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
  const profitRows: ProfitRow[] = projects
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

  const companyNet = revenueTotal
    .minus(projectExpenseTotal)
    .minus(companyExpenseTotal)
    .toFixed(2);

  const outstanding: OutstandingRow[] = projectProfitability(projects)
    .filter((r) => Number(r.remaining) > 0)
    .sort((a, b) =>
      a.clientName === b.clientName
        ? Number(b.remaining) - Number(a.remaining)
        : a.clientName.localeCompare(b.clientName, "ar"),
    )
    .map((r) => ({
      clientName: r.clientName,
      name: r.name,
      finalContractValue: r.finalContractValue,
      paid: r.paid,
      remaining: r.remaining,
    }));
  const outstandingTotal = sum(outstanding.map((r) => r.remaining));

  let clientRows: ClientFinancialRow[] = clients.map((c) => {
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
  clientRows = sortRows(clientRows, sp.csort, sp.cdir, [
    "projectCount",
    "finalValue",
    "paid",
    "discounts",
    "remaining",
    "expenses",
    "profit",
  ]);

  const pq = (sp.pq ?? "").trim().toLowerCase();
  let profitability = projectProfitability(projects);
  if (pq) profitability = profitability.filter((r) => r.name.toLowerCase().includes(pq));
  profitability = sortRows(profitability, sp.psort, sp.pdir, [
    "contractValue",
    "finalContractValue",
    "paid",
    "expenses",
    "remaining",
    "profit",
  ]);

  return {
    range,
    revenue,
    revenueTotal: revenueTotal.toFixed(2),
    projectExpenseTotal: projectExpenseTotal.toFixed(2),
    companyExpenseTotal: companyExpenseTotal.toFixed(2),
    expenseByCategory,
    profitRows,
    companyNet,
    outstanding,
    outstandingTotal: outstandingTotal.toFixed(2),
    clientRows,
    profitability,
  };
}
