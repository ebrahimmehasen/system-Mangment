import { Prisma } from "@prisma/client";
import { sum, toDecimal } from "@/lib/money";

const DAYS_SOON = 7;
const ACTIVE_STATUS = "In Progress";
const DONE_STATUSES = ["Completed", "Delivered"];

export interface ProjectForDashboard {
  id: string;
  clientId: string;
  status: string;
  contractValue: Prisma.Decimal;
  discount: Prisma.Decimal;
  expectedDeliveryDate: Date | null;
  payments: { amountEgp: Prisma.Decimal }[];
}

export interface DashboardData {
  financial: {
    totalFinalContractValue: string;
    totalCollected: string;
    totalIncomeTransactions: string;
    totalExpenses: string; // project + company
    totalProjectExpenses: string;
    totalCompanyExpenses: string;
    netCashFlow: string; // نقطة 0: income transactions - company expenses
    totalOutstanding: string; // sum of positive remaining
    totalDiscounts: string;
  };
  projects: {
    total: number;
    active: number;
    completed: number;
    onHold: number;
    overdue: number;
    dueSoon: number;
  };
  clients: {
    total: number;
    active: number;
    withActiveProjects: number;
    withOutstanding: number;
  };
}

export function computeDashboard(input: {
  projects: ProjectForDashboard[];
  clients: { id: string; status: string }[];
  totalIncomeTransactions: Prisma.Decimal;
  totalProjectExpenses: Prisma.Decimal;
  totalCompanyExpenses: Prisma.Decimal;
  now?: Date;
}): DashboardData {
  const now = input.now ?? new Date();
  const soonCutoff = new Date(now);
  soonCutoff.setDate(soonCutoff.getDate() + DAYS_SOON);

  const totalFinal = sum(
    input.projects.map((p) => toDecimal(p.contractValue).minus(p.discount)),
  );
  const totalDiscounts = sum(input.projects.map((p) => p.discount));
  const totalCollected = sum(
    input.projects.flatMap((p) => p.payments.map((x) => x.amountEgp)),
  );

  let outstanding = new Prisma.Decimal(0);
  const clientsWithOutstanding = new Set<string>();
  const clientsWithActiveProjects = new Set<string>();
  let overdue = 0;
  let dueSoon = 0;

  for (const p of input.projects) {
    const final = toDecimal(p.contractValue).minus(p.discount);
    const paid = sum(p.payments.map((x) => x.amountEgp));
    const remaining = final.minus(paid);
    if (remaining.greaterThan(0)) {
      outstanding = outstanding.plus(remaining);
      clientsWithOutstanding.add(p.clientId);
    }
    if (p.status === ACTIVE_STATUS) clientsWithActiveProjects.add(p.clientId);

    const notDone = !DONE_STATUSES.includes(p.status) && p.status !== "Cancelled";
    if (p.expectedDeliveryDate && notDone) {
      if (p.expectedDeliveryDate.getTime() < now.getTime()) overdue++;
      else if (p.expectedDeliveryDate.getTime() <= soonCutoff.getTime()) dueSoon++;
    }
  }

  const totalExpenses = input.totalProjectExpenses.plus(input.totalCompanyExpenses);

  return {
    financial: {
      totalFinalContractValue: totalFinal.toFixed(2),
      totalCollected: totalCollected.toFixed(2),
      totalIncomeTransactions: input.totalIncomeTransactions.toFixed(2),
      totalExpenses: totalExpenses.toFixed(2),
      totalProjectExpenses: input.totalProjectExpenses.toFixed(2),
      totalCompanyExpenses: input.totalCompanyExpenses.toFixed(2),
      netCashFlow: input.totalIncomeTransactions
        .minus(input.totalCompanyExpenses)
        .toFixed(2),
      totalOutstanding: outstanding.toFixed(2),
      totalDiscounts: totalDiscounts.toFixed(2),
    },
    projects: {
      total: input.projects.length,
      active: input.projects.filter((p) => p.status === ACTIVE_STATUS).length,
      completed: input.projects.filter((p) => p.status === "Completed").length,
      onHold: input.projects.filter((p) => p.status === "On Hold").length,
      overdue,
      dueSoon,
    },
    clients: {
      total: input.clients.length,
      active: input.clients.filter((c) => c.status === "active").length,
      withActiveProjects: clientsWithActiveProjects.size,
      withOutstanding: clientsWithOutstanding.size,
    },
  };
}
