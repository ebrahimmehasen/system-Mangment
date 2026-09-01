import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { resolveDateRange, dateWhere, expensesByCategory } from "@/lib/services/reports";

export interface MonthlyPoint {
  month: string; // "2026-01"
  revenue: number;
  expense: number;
  profit: number;
}

export interface ChartData {
  monthly: MonthlyPoint[];
  expenseByCategory: { name: string; value: number }[];
  expenseByType: { name: string; value: number }[];
  rangeLabel: string;
  hasAny: boolean;
}

function lastNMonthKeys(n: number): string[] {
  const keys: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    keys.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

const monthKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/**
 * Trend charts always cover the last 12 months (a trend needs history);
 * the expense-breakdown charts respect the report's date filter.
 */
export async function getChartData(sp: {
  range?: string;
  from?: string;
  to?: string;
}): Promise<ChartData> {
  const range = resolveDateRange(sp);
  const dw = dateWhere(range);

  const months = lastNMonthKeys(12);
  const trendStart = new Date();
  trendStart.setMonth(trendStart.getMonth() - 11, 1);
  trendStart.setHours(0, 0, 0, 0);

  const [income12, expense12, expensesInRange] = await Promise.all([
    prisma.transaction.findMany({
      where: { type: "income", date: { gte: trendStart } },
      select: { date: true, amountEgp: true },
    }),
    prisma.transaction.findMany({
      where: { type: "expense", date: { gte: trendStart } },
      select: { date: true, amountEgp: true },
    }),
    prisma.expense.findMany({
      where: dw ? { date: dw } : {},
      select: { amountEgp: true, type: true, category: { select: { name: true } } },
    }),
  ]);

  const revByMonth = new Map<string, Prisma.Decimal>();
  for (const t of income12) {
    const k = monthKey(t.date);
    revByMonth.set(k, (revByMonth.get(k) ?? new Prisma.Decimal(0)).plus(t.amountEgp));
  }
  const expByMonth = new Map<string, Prisma.Decimal>();
  for (const t of expense12) {
    const k = monthKey(t.date);
    expByMonth.set(k, (expByMonth.get(k) ?? new Prisma.Decimal(0)).plus(t.amountEgp));
  }

  const monthly: MonthlyPoint[] = months.map((m) => {
    const revenue = (revByMonth.get(m) ?? new Prisma.Decimal(0)).toNumber();
    const expense = (expByMonth.get(m) ?? new Prisma.Decimal(0)).toNumber();
    return { month: m, revenue, expense, profit: revenue - expense };
  });

  const expenseByCategory = expensesByCategory(expensesInRange).map((c) => ({
    name: c.category,
    value: Number(c.total),
  }));

  const projTotal = expensesInRange
    .filter((e) => e.type === "project")
    .reduce((a, e) => a.plus(e.amountEgp), new Prisma.Decimal(0))
    .toNumber();
  const compTotal = expensesInRange
    .filter((e) => e.type === "company")
    .reduce((a, e) => a.plus(e.amountEgp), new Prisma.Decimal(0))
    .toNumber();
  const expenseByType = [
    { name: "مشاريع", value: projTotal },
    { name: "شركة", value: compTotal },
  ].filter((x) => x.value > 0);

  const hasAny =
    monthly.some((m) => m.revenue || m.expense) ||
    expenseByCategory.length > 0;

  return { monthly, expenseByCategory, expenseByType, rangeLabel: range.label, hasAny };
}
