import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { createClientAction } from "@/server/client-actions";
import { ClientFormModal } from "./ClientFormModal";
import { ClientsToolbar } from "./ClientsToolbar";

const PAGE_SIZE = 10;

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;

  const q = (sp.q ?? "").trim();
  const status = sp.status === "active" || sp.status === "inactive" ? sp.status : undefined;
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.ClientWhereInput = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { companyName: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, clients] = await Promise.all([
    prisma.client.count({ where }),
    prisma.client.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { _count: { select: { projects: true } } },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const dateFmt = new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium" });

  const makeHref = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/clients?${qs}` : "/clients";
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">العملاء</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            {total} عميل
          </p>
        </div>
        <ClientFormModal
          mode="create"
          action={createClientAction}
          triggerLabel="+ عميل جديد"
        />
      </div>

      <ClientsToolbar />

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-right text-foreground-muted">
                <th className="px-4 py-3 font-medium">اسم العميل</th>
                <th className="px-4 py-3 font-medium">الشركة</th>
                <th className="px-4 py-3 font-medium">الهاتف</th>
                <th className="px-4 py-3 font-medium">البريد الإلكتروني</th>
                <th className="px-4 py-3 font-medium">المشاريع</th>
                <th className="px-4 py-3 font-medium">الحالة</th>
                <th className="px-4 py-3 font-medium">أُضيف في</th>
              </tr>
            </thead>
            <tbody>
              {clients.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-foreground-muted"
                  >
                    {q || status
                      ? "لا توجد نتائج مطابقة."
                      : "لا يوجد عملاء بعد. ابدأ بإضافة عميل جديد."}
                  </td>
                </tr>
              )}
              {clients.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-border last:border-0 hover:bg-surface-2/50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/clients/${c.id}`}
                      className="text-accent hover:underline"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">
                    {c.companyName || "—"}
                  </td>
                  <td dir="ltr" className="px-4 py-3 text-right text-foreground-muted">
                    {c.phone || "—"}
                  </td>
                  <td dir="ltr" className="px-4 py-3 text-right text-foreground-muted">
                    {c.email || "—"}
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">
                    {c._count.projects}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={c.status === "active" ? "success" : "neutral"}>
                      {c.status === "active" ? "نشط" : "غير نشط"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">
                    {dateFmt.format(c.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Pagination page={page} totalPages={totalPages} makeHref={makeHref} />
    </div>
  );
}
