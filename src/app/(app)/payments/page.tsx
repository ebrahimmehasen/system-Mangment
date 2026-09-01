import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { Card } from "@/components/ui/Card";
import { Pagination } from "@/components/ui/Pagination";
import { formatEgp, formatOriginalWithEgp } from "@/lib/money";
import { sum } from "@/lib/money";
import { PaymentFormModal } from "@/components/finance/PaymentFormModal";

const PAGE_SIZE = 20;

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  const [total, payments, clients, projects, methodRows, allForTotal] =
    await Promise.all([
      prisma.payment.count(),
      prisma.payment.findMany({
        orderBy: { date: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          client: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } },
        },
      }),
      prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      prisma.project.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, clientId: true },
      }),
      prisma.paymentMethod.findMany({ orderBy: { sortOrder: "asc" }, select: { name: true } }),
      prisma.payment.findMany({ select: { amountEgp: true } }),
    ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const grandTotal = sum(allForTotal.map((p) => p.amountEgp));
  const dateFmt = new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium" });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">المدفوعات</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            {total} دفعة — إجمالي {formatEgp(grandTotal)}
          </p>
        </div>
        {projects.length > 0 && (
          <PaymentFormModal
            clients={clients}
            projects={projects}
            methods={methodRows.map((m) => m.name)}
          />
        )}
      </div>

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-right text-foreground-muted">
                <th className="px-4 py-3 font-medium">التاريخ</th>
                <th className="px-4 py-3 font-medium">العميل</th>
                <th className="px-4 py-3 font-medium">المشروع</th>
                <th className="px-4 py-3 font-medium">المبلغ</th>
                <th className="px-4 py-3 font-medium">الطريقة</th>
                <th className="px-4 py-3 font-medium">رقم مرجعي</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-foreground-muted">
                    لا توجد مدفوعات بعد.
                  </td>
                </tr>
              )}
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-foreground-muted">{dateFmt.format(p.date)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/clients/${p.client.id}`} className="text-accent hover:underline">
                      {p.client.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/projects/${p.project.id}`} className="text-accent hover:underline">
                      {p.project.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {formatOriginalWithEgp(p.amountOriginal, p.currency, p.amountEgp)}
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">{p.method || "—"}</td>
                  <td className="px-4 py-3 text-foreground-muted">{p.referenceNumber || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Pagination
        page={page}
        totalPages={totalPages}
        makeHref={(p) => (p > 1 ? `/payments?page=${p}` : "/payments")}
      />
    </div>
  );
}
