import type { Prisma } from "@prisma/client";
import { formatOriginalWithEgp } from "@/lib/money";

export interface ActivityItem {
  id: string;
  at: Date;
  text: string;
  href: string;
}

type PaymentRow = {
  id: string;
  date: Date;
  createdAt: Date;
  amountOriginal: Prisma.Decimal;
  currency: string;
  amountEgp: Prisma.Decimal;
  client: { name: string };
  project: { id: string; name: string };
};
type ExpenseRow = {
  id: string;
  createdAt: Date;
  type: string;
  amountOriginal: Prisma.Decimal;
  currency: string;
  amountEgp: Prisma.Decimal;
  category: { name: string };
  project: { id: string; name: string } | null;
};
type ProjectRow = { id: string; name: string; createdAt: Date; client: { name: string } };
type ClientRow = { id: string; name: string; createdAt: Date };

/** Merge recent records into readable Arabic activity lines, newest first. */
export function buildActivityFeed(input: {
  payments: PaymentRow[];
  expenses: ExpenseRow[];
  projects: ProjectRow[];
  clients: ClientRow[];
  limit?: number;
}): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const p of input.payments) {
    items.push({
      id: `pay-${p.id}`,
      at: p.createdAt,
      text: `تم استلام ${formatOriginalWithEgp(p.amountOriginal, p.currency, p.amountEgp)} من العميل ${p.client.name} لمشروع ${p.project.name}`,
      href: `/projects/${p.project.id}`,
    });
  }
  for (const e of input.expenses) {
    const where = e.project ? `لمشروع ${e.project.name}` : "مصروف شركة";
    items.push({
      id: `exp-${e.id}`,
      at: e.createdAt,
      text: `تم تسجيل مصروف ${formatOriginalWithEgp(e.amountOriginal, e.currency, e.amountEgp)} (${e.category.name}) ${where}`,
      href: e.project ? `/projects/${e.project.id}` : "/expenses",
    });
  }
  for (const pr of input.projects) {
    items.push({
      id: `prj-${pr.id}`,
      at: pr.createdAt,
      text: `تم إنشاء مشروع "${pr.name}" للعميل ${pr.client.name}`,
      href: `/projects/${pr.id}`,
    });
  }
  for (const c of input.clients) {
    items.push({
      id: `cli-${c.id}`,
      at: c.createdAt,
      text: `تمت إضافة العميل "${c.name}"`,
      href: `/clients/${c.id}`,
    });
  }

  return items
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, input.limit ?? 12);
}
