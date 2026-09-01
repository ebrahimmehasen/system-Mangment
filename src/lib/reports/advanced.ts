import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { sum, formatEgp, formatCurrency } from "@/lib/money";
import { resolveDateRange, dateWhere, type DateRange } from "@/lib/services/reports";
import type { ReportTable } from "./tables";

const D0 = () => new Prisma.Decimal(0);
const DAY_MS = 86_400_000;
const monthKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

// ─────────────────────────── Types ───────────────────────────

export interface AdvancedParams {
  range?: string;
  from?: string;
  to?: string;
}

export interface AgingBucket {
  key: "b0" | "b30" | "b60" | "b90";
  label: string;
  total: string;
  count: number;
}

export interface AgingRow {
  projectId: string;
  projectName: string;
  clientName: string;
  remaining: string;
  referenceLabel: string;
  ageDays: number;
  bucket: AgingBucket["key"];
}

export interface AgingReport {
  rows: AgingRow[];
  buckets: AgingBucket[];
  total: string;
}

export interface CurrencyRow {
  currency: string;
  receivedOriginal: string;
  receivedEgp: string;
  spentOriginal: string;
  spentEgp: string;
  netEgp: string;
}

export interface CurrencyReport {
  rows: CurrencyRow[];
  hasForeign: boolean;
}

export interface PeriodMetrics {
  label: string;
  revenue: string;
  expense: string;
  net: string;
}

export interface PeriodDelta {
  revenue: number | null;
  expense: number | null;
  net: number | null;
}

export interface PeriodComparison {
  current: PeriodMetrics;
  previous: PeriodMetrics;
  yearAgo: PeriodMetrics;
  mom: PeriodDelta;
  yoy: PeriodDelta;
}

export interface CashFlowRow {
  month: string;
  inflow: string;
  outflow: string;
  net: string;
  balance: string;
}

export interface CashFlowStatement {
  opening: string;
  rows: CashFlowRow[];
  totalIn: string;
  totalOut: string;
  totalNet: string;
  closing: string;
}

export interface AdvancedFinancials {
  range: DateRange;
  aging: AgingReport;
  currency: CurrencyReport;
  comparison: PeriodComparison;
  cashflow: CashFlowStatement;
}

// ─────────────────────────── Helpers ───────────────────────────

function ageInDays(ref: Date): number {
  const now = new Date();
  const a = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const b = Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate());
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

function bucketOf(days: number): AgingBucket["key"] {
  if (days <= 30) return "b0";
  if (days <= 60) return "b30";
  if (days <= 90) return "b60";
  return "b90";
}

const BUCKET_LABELS: Record<AgingBucket["key"], string> = {
  b0: "٠ – ٣٠ يومًا",
  b30: "٣١ – ٦٠ يومًا",
  b60: "٦١ – ٩٠ يومًا",
  b90: "أكثر من ٩٠ يومًا",
};

/** Percent change of `cur` vs `base`; null when there is no baseline. */
function pctChange(cur: Prisma.Decimal, base: Prisma.Decimal): number | null {
  if (base.isZero()) return null;
  return cur.minus(base).div(base.abs()).times(100).toNumber();
}

// ─────────────────────────── Main ───────────────────────────

/**
 * The four advanced financial reports (نقطة 3.3):
 *  - receivables aging (snapshot, ignores the date filter)
 *  - currency breakdown (respects the date filter)
 *  - period comparison (fixed month windows, ignores the filter)
 *  - cash-flow statement (last 12 months, ignores the filter)
 */
export async function getAdvancedFinancials(
  sp: AdvancedParams,
): Promise<AdvancedFinancials> {
  const range = resolveDateRange(sp);
  const dw = dateWhere(range);

  const now = new Date();
  const curStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const yearAgoStart = new Date(now.getFullYear() - 1, now.getMonth(), 1);
  const curEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  const yearAgoEnd = new Date(now.getFullYear() - 1, now.getMonth() + 1, 0, 23, 59, 59, 999);
  const cfStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const [projects, currencyTx, spanTx, openingGroups] = await Promise.all([
    prisma.project.findMany({
      select: {
        id: true,
        name: true,
        contractValue: true,
        discount: true,
        startDate: true,
        expectedDeliveryDate: true,
        actualDeliveryDate: true,
        createdAt: true,
        client: { select: { name: true } },
        payments: { select: { amountEgp: true } },
      },
    }),
    prisma.transaction.findMany({
      where: { type: { in: ["income", "expense"] }, ...(dw ? { date: dw } : {}) },
      select: { type: true, amountEgp: true, amountOriginal: true, currency: true },
    }),
    prisma.transaction.findMany({
      where: { type: { in: ["income", "expense"] }, date: { gte: yearAgoStart } },
      select: { type: true, date: true, amountEgp: true },
    }),
    prisma.transaction.groupBy({
      by: ["type"],
      where: { type: { in: ["income", "expense"] }, date: { lt: cfStart } },
      _sum: { amountEgp: true },
    }),
  ]);

  return {
    range,
    aging: buildAging(projects),
    currency: buildCurrency(currencyTx),
    comparison: buildComparison(spanTx, {
      curStart,
      curEnd,
      prevStart,
      prevEnd,
      yearAgoStart,
      yearAgoEnd,
    }),
    cashflow: buildCashFlow(spanTx, openingGroups, cfStart),
  };
}

// ─────────────────────────── Builders ───────────────────────────

type AgingProject = {
  id: string;
  name: string;
  contractValue: Prisma.Decimal;
  discount: Prisma.Decimal;
  startDate: Date | null;
  expectedDeliveryDate: Date | null;
  actualDeliveryDate: Date | null;
  createdAt: Date;
  client: { name: string };
  payments: { amountEgp: Prisma.Decimal }[];
};

function buildAging(projects: AgingProject[]): AgingReport {
  const rows: AgingRow[] = [];
  for (const p of projects) {
    const final = new Prisma.Decimal(p.contractValue).minus(p.discount);
    const paid = sum(p.payments.map((x) => x.amountEgp));
    const remaining = final.minus(paid);
    if (remaining.lte(0)) continue;

    const ref =
      p.actualDeliveryDate ??
      p.expectedDeliveryDate ??
      p.startDate ??
      p.createdAt;
    const refLabel = p.actualDeliveryDate
      ? "تاريخ التسليم الفعلي"
      : p.expectedDeliveryDate
        ? "تاريخ التسليم المتوقع"
        : p.startDate
          ? "تاريخ البدء"
          : "تاريخ الإنشاء";
    const days = ageInDays(ref);
    const bucket = bucketOf(days);

    rows.push({
      projectId: p.id,
      projectName: p.name,
      clientName: p.client.name,
      remaining: remaining.toFixed(2),
      referenceLabel: refLabel,
      ageDays: days,
      bucket,
    });
  }

  rows.sort((a, b) => b.ageDays - a.ageDays);

  const keys: AgingBucket["key"][] = ["b0", "b30", "b60", "b90"];
  const buckets: AgingBucket[] = keys.map((key) => {
    const inBucket = rows.filter((r) => r.bucket === key);
    return {
      key,
      label: BUCKET_LABELS[key],
      total: sum(inBucket.map((r) => r.remaining)).toFixed(2),
      count: inBucket.length,
    };
  });

  return {
    rows,
    buckets,
    total: sum(rows.map((r) => r.remaining)).toFixed(2),
  };
}

function buildCurrency(
  tx: {
    type: string;
    amountEgp: Prisma.Decimal;
    amountOriginal: Prisma.Decimal;
    currency: string;
  }[],
): CurrencyReport {
  const order = ["EGP", "USD", "SAR"];
  const seen = new Map<
    string,
    {
      receivedOriginal: Prisma.Decimal;
      receivedEgp: Prisma.Decimal;
      spentOriginal: Prisma.Decimal;
      spentEgp: Prisma.Decimal;
    }
  >();
  const get = (c: string) => {
    let e = seen.get(c);
    if (!e) {
      e = { receivedOriginal: D0(), receivedEgp: D0(), spentOriginal: D0(), spentEgp: D0() };
      seen.set(c, e);
    }
    return e;
  };

  for (const t of tx) {
    const e = get(t.currency);
    if (t.type === "income") {
      e.receivedOriginal = e.receivedOriginal.plus(t.amountOriginal);
      e.receivedEgp = e.receivedEgp.plus(t.amountEgp);
    } else {
      e.spentOriginal = e.spentOriginal.plus(t.amountOriginal);
      e.spentEgp = e.spentEgp.plus(t.amountEgp);
    }
  }

  const rows: CurrencyRow[] = [...seen.entries()]
    .sort((a, b) => {
      const ia = order.indexOf(a[0]);
      const ib = order.indexOf(b[0]);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    })
    .map(([currency, e]) => ({
      currency,
      receivedOriginal: e.receivedOriginal.toFixed(2),
      receivedEgp: e.receivedEgp.toFixed(2),
      spentOriginal: e.spentOriginal.toFixed(2),
      spentEgp: e.spentEgp.toFixed(2),
      netEgp: e.receivedEgp.minus(e.spentEgp).toFixed(2),
    }));

  return { rows, hasForeign: rows.some((r) => r.currency !== "EGP") };
}

type TxLite = { type: string; date: Date; amountEgp: Prisma.Decimal };

function windowSum(
  tx: TxLite[],
  from: Date,
  to: Date,
  type: "income" | "expense",
): Prisma.Decimal {
  return tx.reduce(
    (acc, t) =>
      t.type === type && t.date >= from && t.date <= to
        ? acc.plus(t.amountEgp)
        : acc,
    D0(),
  );
}

function buildComparison(
  tx: TxLite[],
  w: {
    curStart: Date;
    curEnd: Date;
    prevStart: Date;
    prevEnd: Date;
    yearAgoStart: Date;
    yearAgoEnd: Date;
  },
): PeriodComparison {
  interface M {
    label: string;
    revenue: string;
    expense: string;
    net: string;
    _rev: Prisma.Decimal;
    _exp: Prisma.Decimal;
    _net: Prisma.Decimal;
  }
  const metrics = (label: string, from: Date, to: Date): M => {
    const rev = windowSum(tx, from, to, "income");
    const exp = windowSum(tx, from, to, "expense");
    const net = rev.minus(exp);
    return {
      label,
      revenue: rev.toFixed(2),
      expense: exp.toFixed(2),
      net: net.toFixed(2),
      _rev: rev,
      _exp: exp,
      _net: net,
    };
  };

  const monthName = new Intl.DateTimeFormat("ar-EG", { month: "long", year: "numeric" });
  const current = metrics(monthName.format(w.curStart), w.curStart, w.curEnd);
  const previous = metrics(monthName.format(w.prevStart), w.prevStart, w.prevEnd);
  const yearAgo = metrics(monthName.format(w.yearAgoStart), w.yearAgoStart, w.yearAgoEnd);

  const strip = (m: M): PeriodMetrics => ({
    label: m.label,
    revenue: m.revenue,
    expense: m.expense,
    net: m.net,
  });

  return {
    current: strip(current),
    previous: strip(previous),
    yearAgo: strip(yearAgo),
    mom: {
      revenue: pctChange(current._rev, previous._rev),
      expense: pctChange(current._exp, previous._exp),
      net: pctChange(current._net, previous._net),
    },
    yoy: {
      revenue: pctChange(current._rev, yearAgo._rev),
      expense: pctChange(current._exp, yearAgo._exp),
      net: pctChange(current._net, yearAgo._net),
    },
  };
}

function buildCashFlow(
  tx: TxLite[],
  openingGroups: { type: string; _sum: { amountEgp: Prisma.Decimal | null } }[],
  cfStart: Date,
): CashFlowStatement {
  const openIn =
    openingGroups.find((g) => g.type === "income")?._sum.amountEgp ?? D0();
  const openOut =
    openingGroups.find((g) => g.type === "expense")?._sum.amountEgp ?? D0();
  const opening = new Prisma.Decimal(openIn).minus(openOut);

  const months: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(cfStart.getFullYear(), cfStart.getMonth() + i, 1);
    months.push(monthKey(d));
  }

  const inByMonth = new Map<string, Prisma.Decimal>();
  const outByMonth = new Map<string, Prisma.Decimal>();
  for (const t of tx) {
    if (t.date < cfStart) continue;
    const k = monthKey(t.date);
    const map = t.type === "income" ? inByMonth : outByMonth;
    map.set(k, (map.get(k) ?? D0()).plus(t.amountEgp));
  }

  let balance = opening;
  let totalIn = D0();
  let totalOut = D0();
  const rows: CashFlowRow[] = months.map((m) => {
    const inflow = inByMonth.get(m) ?? D0();
    const outflow = outByMonth.get(m) ?? D0();
    const net = inflow.minus(outflow);
    balance = balance.plus(net);
    totalIn = totalIn.plus(inflow);
    totalOut = totalOut.plus(outflow);
    return {
      month: m,
      inflow: inflow.toFixed(2),
      outflow: outflow.toFixed(2),
      net: net.toFixed(2),
      balance: balance.toFixed(2),
    };
  });

  return {
    opening: opening.toFixed(2),
    rows,
    totalIn: totalIn.toFixed(2),
    totalOut: totalOut.toFixed(2),
    totalNet: totalIn.minus(totalOut).toFixed(2),
    closing: balance.toFixed(2),
  };
}

// ─────────────────────────── Export tables ───────────────────────────

const pctText = (v: number | null): string =>
  v === null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;

const shortMonth = (m: string) => m.slice(2).replace("-", "/");

/** The advanced financial reports as flat, exportable tables. */
export function advancedToTables(d: AdvancedFinancials): ReportTable[] {
  const c = d.currency;
  return [
    {
      key: "aging",
      title: "أعمار الديون (المستحقات)",
      columns: ["الفئة", "عدد المشاريع", "الإجمالي (ج.م)"],
      rows: [
        ...d.aging.buckets.map((b) => [b.label, b.count, formatEgp(b.total)]),
        ["الإجمالي", d.aging.rows.length, formatEgp(d.aging.total)],
      ],
    },
    {
      key: "aging-detail",
      title: "أعمار الديون — تفصيل المشاريع",
      columns: ["المشروع", "العميل", "المتبقي (ج.م)", "عمر الدين (يوم)", "الفئة", "أساس الاحتساب"],
      rows: d.aging.rows.map((r) => [
        r.projectName,
        r.clientName,
        formatEgp(r.remaining),
        r.ageDays,
        BUCKET_LABELS[r.bucket],
        r.referenceLabel,
      ]),
    },
    {
      key: "currency",
      title: "تقرير العملات",
      columns: [
        "العملة",
        "محصّل (بالعملة)",
        "محصّل (ج.م)",
        "منصرف (بالعملة)",
        "منصرف (ج.م)",
        "الصافي (ج.م)",
      ],
      rows: c.rows.map((r) => [
        r.currency,
        formatCurrency(r.receivedOriginal, r.currency),
        formatEgp(r.receivedEgp),
        formatCurrency(r.spentOriginal, r.currency),
        formatEgp(r.spentEgp),
        formatEgp(r.netEgp),
      ]),
    },
    {
      key: "period-comparison",
      title: "مقارنة الفترات",
      columns: [
        "البند",
        d.comparison.current.label,
        d.comparison.previous.label,
        d.comparison.yearAgo.label,
        "التغير عن الشهر السابق",
        "التغير عن العام السابق",
      ],
      rows: [
        [
          "الإيرادات",
          formatEgp(d.comparison.current.revenue),
          formatEgp(d.comparison.previous.revenue),
          formatEgp(d.comparison.yearAgo.revenue),
          pctText(d.comparison.mom.revenue),
          pctText(d.comparison.yoy.revenue),
        ],
        [
          "المصروفات",
          formatEgp(d.comparison.current.expense),
          formatEgp(d.comparison.previous.expense),
          formatEgp(d.comparison.yearAgo.expense),
          pctText(d.comparison.mom.expense),
          pctText(d.comparison.yoy.expense),
        ],
        [
          "الصافي",
          formatEgp(d.comparison.current.net),
          formatEgp(d.comparison.previous.net),
          formatEgp(d.comparison.yearAgo.net),
          pctText(d.comparison.mom.net),
          pctText(d.comparison.yoy.net),
        ],
      ],
    },
    {
      key: "cashflow",
      title: "بيان التدفق النقدي (آخر ١٢ شهرًا)",
      columns: ["الشهر", "داخل (ج.م)", "خارج (ج.م)", "الصافي (ج.م)", "الرصيد التراكمي (ج.م)"],
      rows: [
        ["رصيد افتتاحي", "", "", "", formatEgp(d.cashflow.opening)],
        ...d.cashflow.rows.map((r) => [
          shortMonth(r.month),
          formatEgp(r.inflow),
          formatEgp(r.outflow),
          formatEgp(r.net),
          formatEgp(r.balance),
        ]),
        [
          "الإجمالي",
          formatEgp(d.cashflow.totalIn),
          formatEgp(d.cashflow.totalOut),
          formatEgp(d.cashflow.totalNet),
          formatEgp(d.cashflow.closing),
        ],
      ],
    },
  ];
}
