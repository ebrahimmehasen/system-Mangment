import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { formatEgp } from "@/lib/money";
import { computeProjectFinancials } from "@/lib/services/projects";
import { createProjectAction } from "@/server/project-actions";
import { ProjectFormModal } from "./ProjectFormModal";
import { ProjectsToolbar } from "./ProjectsToolbar";

const PAGE_SIZE = 10;

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    client?: string;
    page?: string;
  }>;
}) {
  await requireUser();
  const sp = await searchParams;

  const q = (sp.q ?? "").trim();
  const status = (sp.status ?? "").trim() || undefined;
  const clientId = (sp.client ?? "").trim() || undefined;
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.ProjectWhereInput = {
    ...(status ? { status } : {}),
    ...(clientId ? { clientId } : {}),
    ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
  };

  const [total, projects, clients, statusRows] = await Promise.all([
    prisma.project.count({ where }),
    prisma.project.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        client: { select: { id: true, name: true } },
        payments: { select: { amountEgp: true } },
        expenses: { where: { type: "project" }, select: { amountEgp: true } },
      },
    }),
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.projectStatus.findMany({ orderBy: { sortOrder: "asc" }, select: { name: true } }),
  ]);

  const statuses = statusRows.map((s) => s.name);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const dateFmt = new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium" });

  const makeHref = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (clientId) params.set("client", clientId);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/projects?${qs}` : "/projects";
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">المشاريع</h1>
          <p className="mt-1 text-sm text-foreground-muted">{total} مشروع</p>
        </div>
        {clients.length === 0 ? (
          <p className="text-sm text-foreground-muted">
            أضف عميلًا أولًا لإنشاء مشروع.
          </p>
        ) : (
          <ProjectFormModal
            mode="create"
            action={createProjectAction}
            clients={clients}
            statuses={statuses}
            triggerLabel="+ مشروع جديد"
          />
        )}
      </div>

      <ProjectsToolbar clients={clients} statuses={statuses} />

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-right text-foreground-muted">
                <th className="px-4 py-3 font-medium">اسم المشروع</th>
                <th className="px-4 py-3 font-medium">العميل</th>
                <th className="px-4 py-3 font-medium">الحالة</th>
                <th className="px-4 py-3 font-medium">البداية</th>
                <th className="px-4 py-3 font-medium">التسليم المتوقع</th>
                <th className="px-4 py-3 font-medium">القيمة النهائية</th>
                <th className="px-4 py-3 font-medium">المتبقي</th>
                <th className="px-4 py-3 font-medium">الربح</th>
              </tr>
            </thead>
            <tbody>
              {projects.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-foreground-muted">
                    {q || status || clientId
                      ? "لا توجد نتائج مطابقة."
                      : "لا توجد مشاريع بعد."}
                  </td>
                </tr>
              )}
              {projects.map((p) => {
                const f = computeProjectFinancials(p);
                return (
                  <tr
                    key={p.id}
                    className="border-b border-border last:border-0 hover:bg-surface-2/50"
                  >
                    <td className="px-4 py-3">
                      <Link href={`/projects/${p.id}`} className="text-accent hover:underline">
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-foreground-muted">
                      <Link href={`/clients/${p.client.id}`} className="hover:underline">
                        {p.client.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Badge>{p.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-foreground-muted">
                      {p.startDate ? dateFmt.format(p.startDate) : "—"}
                    </td>
                    <td className="px-4 py-3 text-foreground-muted">
                      {p.expectedDeliveryDate ? dateFmt.format(p.expectedDeliveryDate) : "—"}
                    </td>
                    <td className="px-4 py-3">{formatEgp(f.finalContractValue)}</td>
                    <td className="px-4 py-3">{formatEgp(f.remaining)}</td>
                    <td className="px-4 py-3">{formatEgp(f.profit)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Pagination page={page} totalPages={totalPages} makeHref={makeHref} />
    </div>
  );
}
