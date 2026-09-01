import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { formatEgp, formatOriginalWithEgp, sum } from "@/lib/money";
import { ExpenseFormModal } from "@/components/finance/ExpenseFormModal";
import { DeleteExpenseButton } from "@/components/finance/DeleteExpenseButton";

const PAGE_SIZE = 20;

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; page?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const type = sp.type === "project" || sp.type === "company" ? sp.type : undefined;
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.ExpenseWhereInput = type ? { type } : {};

  const [total, expenses, categories, projects, methodRows, allForTotals] =
    await Promise.all([
      prisma.expense.count({ where }),
      prisma.expense.findMany({
        where,
        orderBy: { date: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          category: { select: { name: true } },
          project: { select: { id: true, name: true } },
        },
      }),
      prisma.expenseCategory.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      prisma.project.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      prisma.paymentMethod.findMany({ orderBy: { sortOrder: "asc" }, select: { name: true } }),
      prisma.expense.findMany({ select: { type: true, amountEgp: true } }),
    ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const projectTotal = sum(
    allForTotals.filter((e) => e.type === "project").map((e) => e.amountEgp),
  );
  const companyTotal = sum(
    allForTotals.filter((e) => e.type === "company").map((e) => e.amountEgp),
  );
  const dateFmt = new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium" });

  const tabHref = (t?: string) => {
    const params = new URLSearchParams();
    if (t) params.set("type", t);
    const qs = params.toString();
    return qs ? `/expenses?${qs}` : "/expenses";
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">المصروفات</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            مشاريع {formatEgp(projectTotal)} · شركة {formatEgp(companyTotal)}
          </p>
        </div>
        <ExpenseFormModal
          categories={categories}
          projects={projects}
          methods={methodRows.map((m) => m.name)}
        />
      </div>

      <div className="flex gap-2 text-sm">
        {[
          { label: "الكل", t: undefined },
          { label: "مشاريع", t: "project" },
          { label: "شركة", t: "company" },
        ].map((tab) => (
          <Link
            key={tab.label}
            href={tabHref(tab.t)}
            className={`rounded-md border border-border px-3 py-1.5 ${
              type === tab.t || (!type && !tab.t)
                ? "bg-accent/10 text-accent"
                : "text-foreground-muted hover:bg-surface-2"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-right text-foreground-muted">
                <th className="px-4 py-3 font-medium">التاريخ</th>
                <th className="px-4 py-3 font-medium">النوع</th>
                <th className="px-4 py-3 font-medium">المشروع</th>
                <th className="px-4 py-3 font-medium">التصنيف</th>
                <th className="px-4 py-3 font-medium">المبلغ</th>
                <th className="px-4 py-3 font-medium">الوصف</th>
                <th className="px-4 py-3 font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-foreground-muted">
                    لا توجد مصروفات.
                  </td>
                </tr>
              )}
              {expenses.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-foreground-muted">{dateFmt.format(e.date)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={e.type === "project" ? "accent" : "neutral"}>
                      {e.type === "project" ? "مشروع" : "شركة"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {e.project ? (
                      <Link href={`/projects/${e.project.id}`} className="text-accent hover:underline">
                        {e.project.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">{e.category.name}</td>
                  <td className="px-4 py-3">
                    {formatOriginalWithEgp(e.amountOriginal, e.currency, e.amountEgp)}
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">{e.description || "—"}</td>
                  <td className="px-4 py-3">
                    <DeleteExpenseButton expenseId={e.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Pagination
        page={page}
        totalPages={totalPages}
        makeHref={(p) => {
          const params = new URLSearchParams();
          if (type) params.set("type", type);
          if (p > 1) params.set("page", String(p));
          const qs = params.toString();
          return qs ? `/expenses?${qs}` : "/expenses";
        }}
      />
    </div>
  );
}
