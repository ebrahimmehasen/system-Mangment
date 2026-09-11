import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import {
  targetClientListWhere,
  TARGET_CLIENT_STATUS_LABELS,
} from "@/lib/services/target-clients";
import { createTargetClientAction } from "@/server/target-client-actions";
import { TargetClientFormModal } from "./TargetClientFormModal";
import { TargetClientsToolbar } from "./TargetClientsToolbar";

const PAGE_SIZE = 10;

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger" | "accent"> = {
  available: "success",
  claimed: "accent",
  won: "success",
  lost: "danger",
  inactive: "neutral",
};

export default async function TargetClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;

  const q = (sp.q ?? "").trim();
  const status = sp.status && sp.status in TARGET_CLIENT_STATUS_LABELS ? sp.status : undefined;
  const page = Math.max(1, Number(sp.page) || 1);

  const where = targetClientListWhere(q, status);

  const [total, targetClients] = await Promise.all([
    prisma.targetClient.count({ where }),
    prisma.targetClient.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { claimedBy: { select: { name: true } } },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const makeHref = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/target-clients?${qs}` : "/target-clients";
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">العملاء المستهدفون</h1>
          <p className="mt-1 text-sm text-foreground-muted">{total} عميل مستهدف</p>
        </div>
        <TargetClientFormModal
          mode="create"
          action={createTargetClientAction}
          triggerLabel="+ عميل مستهدف جديد"
        />
      </div>

      <TargetClientsToolbar />

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-right text-foreground-muted">
                <th className="px-4 py-3 font-medium">اسم الشركة</th>
                <th className="px-4 py-3 font-medium">حجم الشركة</th>
                <th className="px-4 py-3 font-medium">شغال عليه</th>
                <th className="px-4 py-3 font-medium">الحالة</th>
                <th className="px-4 py-3 font-medium">ظاهر للموظفين</th>
              </tr>
            </thead>
            <tbody>
              {targetClients.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-foreground-muted">
                    {q || status
                      ? "لا توجد نتائج مطابقة."
                      : "لا يوجد عملاء مستهدفون بعد. ابدأ بإضافة عميل جديد."}
                  </td>
                </tr>
              )}
              {targetClients.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-border last:border-0 hover:bg-surface-2/50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/target-clients/${t.id}`}
                      className="text-accent hover:underline"
                    >
                      {t.companyName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">{t.companySize || "—"}</td>
                  <td className="px-4 py-3 text-foreground-muted">
                    {t.claimedBy?.name || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[t.status]}>
                      {TARGET_CLIENT_STATUS_LABELS[t.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {t.hidden ? (
                      <Badge tone="neutral">مخفي</Badge>
                    ) : (
                      <Badge tone="success">ظاهر</Badge>
                    )}
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
