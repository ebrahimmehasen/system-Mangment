import { Prisma } from "@prisma/client";
import { sum, toDecimal } from "@/lib/money";

// ─────────────────────── Date range ───────────────────────

export type RangePreset =
  | "all"
  | "today"
  | "week"
  | "month"
  | "last_month"
  | "year"
  | "custom";

export interface DateRange {
  preset: RangePreset;
  from: Date | null;
  to: Date | null;
  label: string;
}

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const endOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

/** Resolve the ?range / ?from / ?to search params into a concrete window. */
export function resolveDateRange(sp: {
  range?: string;
  from?: string;
  to?: string;
}): DateRange {
  const now = new Date();
  const preset = (sp.range ?? "all") as RangePreset;

  switch (preset) {
    case "today":
      return { preset, from: startOfDay(now), to: endOfDay(now), label: "اليوم" };
    case "week": {
      const from = startOfDay(now);
      // Egypt week starts Saturday (getDay: Sat=6)
      const diff = (from.getDay() - 6 + 7) % 7;
      from.setDate(from.getDate() - diff);
      return { preset, from, to: endOfDay(now), label: "هذا الأسبوع" };
    }
    case "month":
      return {
        preset,
        from: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: endOfDay(now),
        label: "هذا الشهر",
      };
    case "last_month": {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0);
      return { preset, from: startOfDay(from), to: endOfDay(to), label: "الشهر الماضي" };
    }
    case "year":
      return {
        preset,
        from: startOfDay(new Date(now.getFullYear(), 0, 1)),
        to: endOfDay(now),
        label: "هذا العام",
      };
    case "custom": {
      const from = sp.from ? startOfDay(new Date(sp.from)) : null;
      const to = sp.to ? endOfDay(new Date(sp.to)) : null;
      const label =
        from && to
          ? `${sp.from} إلى ${sp.to}`
          : from
            ? `من ${sp.from}`
            : to
              ? `حتى ${sp.to}`
              : "مخصّص";
      return { preset, from, to, label };
    }
    default:
      return { preset: "all", from: null, to: null, label: "كل الفترات" };
  }
}

export function dateWhere(range: DateRange): Prisma.DateTimeFilter | undefined {
  if (!range.from && !range.to) return undefined;
  const f: Prisma.DateTimeFilter = {};
  if (range.from) f.gte = range.from;
  if (range.to) f.lte = range.to;
  return f;
}

// ─────────────────────── Computations ───────────────────────

export function revenueByMonth(
  rows: { date: Date; amountEgp: Prisma.Decimal }[],
): { month: string; total: string }[] {
  const map = new Map<string, Prisma.Decimal>();
  for (const r of rows) {
    const key = `${r.date.getFullYear()}-${String(r.date.getMonth() + 1).padStart(2, "0")}`;
    map.set(key, (map.get(key) ?? new Prisma.Decimal(0)).plus(r.amountEgp));
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([month, total]) => ({ month, total: total.toFixed(2) }));
}

export function expensesByCategory(
  rows: { category: { name: string }; amountEgp: Prisma.Decimal }[],
): { category: string; total: string }[] {
  const map = new Map<string, Prisma.Decimal>();
  for (const r of rows) {
    map.set(
      r.category.name,
      (map.get(r.category.name) ?? new Prisma.Decimal(0)).plus(r.amountEgp),
    );
  }
  return [...map.entries()]
    .sort((a, b) => b[1].minus(a[1]).toNumber())
    .map(([category, total]) => ({ category, total: total.toFixed(2) }));
}

export interface ProjectProfitRow {
  id: string;
  name: string;
  clientName: string;
  contractValue: string;
  discount: string;
  finalContractValue: string;
  paid: string;
  expenses: string;
  remaining: string;
  profit: string;
}

export function projectProfitability(
  projects: {
    id: string;
    name: string;
    client: { name: string };
    contractValue: Prisma.Decimal;
    discount: Prisma.Decimal;
    payments: { amountEgp: Prisma.Decimal }[];
    expenses: { amountEgp: Prisma.Decimal }[];
  }[],
): ProjectProfitRow[] {
  return projects.map((p) => {
    const final = toDecimal(p.contractValue).minus(p.discount);
    const paid = sum(p.payments.map((x) => x.amountEgp));
    const exp = sum(p.expenses.map((x) => x.amountEgp));
    return {
      id: p.id,
      name: p.name,
      clientName: p.client.name,
      contractValue: toDecimal(p.contractValue).toFixed(2),
      discount: toDecimal(p.discount).toFixed(2),
      finalContractValue: final.toFixed(2),
      paid: paid.toFixed(2),
      expenses: exp.toFixed(2),
      remaining: final.minus(paid).toFixed(2),
      profit: final.minus(exp).toFixed(2),
    };
  });
}

export function sortRows<T>(
  rows: T[],
  sort: string | undefined,
  dir: string | undefined,
  numericKeys: string[],
): T[] {
  if (!sort) return rows;
  const factor = dir === "asc" ? 1 : -1;
  const numeric = numericKeys.includes(sort);
  return [...rows].sort((a, b) => {
    const av = (a as Record<string, unknown>)[sort];
    const bv = (b as Record<string, unknown>)[sort];
    if (numeric) return (Number(av) - Number(bv)) * factor;
    return String(av).localeCompare(String(bv), "ar") * factor;
  });
}
