import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { actionLabel, entityLabel } from "@/lib/audit-labels";
import { AuditLogsToolbar } from "./AuditLogsToolbar";

const PAGE_SIZE = 25;

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{
    action?: string;
    entity?: string;
    user?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  const createdAt: Prisma.DateTimeFilter = {};
  if (sp.from) createdAt.gte = new Date(`${sp.from}T00:00:00`);
  if (sp.to) createdAt.lte = new Date(`${sp.to}T23:59:59.999`);

  const where: Prisma.AuditLogWhereInput = {
    ...(sp.action ? { action: sp.action } : {}),
    ...(sp.entity ? { entity: sp.entity } : {}),
    ...(sp.user ? { userId: sp.user } : {}),
    ...(sp.from || sp.to ? { createdAt } : {}),
  };

  const [total, logs, users] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const dtFmt = new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const makeHref = (p: number) => {
    const params = new URLSearchParams();
    for (const k of ["action", "entity", "user", "from", "to"] as const) {
      if (sp[k]) params.set(k, sp[k]!);
    }
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/audit-logs?${qs}` : "/audit-logs";
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">سجل التدقيق</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          {total} عملية مسجّلة — لا يمكن حذف أي سجل.
        </p>
      </div>

      <AuditLogsToolbar users={users} />

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-right text-foreground-muted">
                <th className="px-4 py-3 font-medium">التاريخ والوقت</th>
                <th className="px-4 py-3 font-medium">المستخدم</th>
                <th className="px-4 py-3 font-medium">العملية</th>
                <th className="px-4 py-3 font-medium">النوع</th>
                <th className="px-4 py-3 font-medium">المعرّف</th>
                <th className="px-4 py-3 font-medium">التفاصيل</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-foreground-muted">
                    لا توجد سجلات مطابقة.
                  </td>
                </tr>
              )}
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-border align-top last:border-0">
                  <td className="px-4 py-3 text-foreground-muted whitespace-nowrap">
                    {dtFmt.format(log.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    {log.user?.name || log.user?.email || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      tone={
                        log.action.includes("deleted")
                          ? "danger"
                          : log.action === "created" || log.action.endsWith("_created")
                            ? "success"
                            : "neutral"
                      }
                    >
                      {actionLabel(log.action)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">
                    {entityLabel(log.entity)}
                  </td>
                  <td dir="ltr" className="px-4 py-3 text-right font-mono text-xs text-foreground-muted">
                    {log.entityId ? log.entityId.slice(0, 8) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {log.oldValue || log.newValue ? (
                      <details className="max-w-md">
                        <summary className="cursor-pointer text-accent">عرض</summary>
                        <div className="mt-2 space-y-2 text-xs">
                          {log.oldValue != null && (
                            <div>
                              <div className="text-foreground-muted">قبل:</div>
                              <pre dir="ltr" className="overflow-x-auto rounded bg-surface-2 p-2 text-right">
                                {JSON.stringify(log.oldValue, null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.newValue != null && (
                            <div>
                              <div className="text-foreground-muted">بعد:</div>
                              <pre dir="ltr" className="overflow-x-auto rounded bg-surface-2 p-2 text-right">
                                {JSON.stringify(log.newValue, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </details>
                    ) : (
                      <span className="text-foreground-muted">—</span>
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
