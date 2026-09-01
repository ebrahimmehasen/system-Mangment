import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { formatDateTime } from "@/lib/datetime";
import { ReminderFormModal } from "@/components/reminders/ReminderFormModal";
import {
  DoneCheckbox,
  SnoozeMenu,
  DeleteReminderButton,
} from "@/components/reminders/ReminderRowActions";

const PAGE_SIZE = 20;

export default async function RemindersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const tab = sp.tab === "overdue" || sp.tab === "done" ? sp.tab : "upcoming";
  const page = Math.max(1, Number(sp.page) || 1);
  const now = new Date();

  const where: Prisma.ReminderWhereInput =
    tab === "done"
      ? { doneAt: { not: null } }
      : tab === "overdue"
        ? { doneAt: null, remindAt: { lt: now } }
        : { doneAt: null, remindAt: { gte: now } };

  const [total, reminders, clients, projects, meetings] = await Promise.all([
    prisma.reminder.count({ where }),
    prisma.reminder.findMany({
      where,
      orderBy: { remindAt: tab === "done" ? "desc" : "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        client: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        meeting: { select: { id: true, title: true } },
      },
    }),
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.project.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, clientId: true },
    }),
    prisma.meeting.findMany({
      where: { status: "scheduled" },
      orderBy: { meetingAt: "asc" },
      select: { id: true, title: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const tabHref = (t: string) => (t === "upcoming" ? "/reminders" : `/reminders?tab=${t}`);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">التذكيرات</h1>
          <p className="mt-1 text-sm text-foreground-muted">{total} تذكير</p>
        </div>
        <ReminderFormModal clients={clients} projects={projects} meetings={meetings} />
      </div>

      <div className="flex gap-2">
        {[
          { key: "upcoming", label: "القادمة" },
          { key: "overdue", label: "المتأخرة" },
          { key: "done", label: "المنتهية" },
        ].map((t) => (
          <Link
            key={t.key}
            href={tabHref(t.key)}
            className={`rounded-md border border-border px-3 py-1.5 text-sm ${
              tab === t.key ? "bg-accent/10 text-accent" : "text-foreground-muted hover:bg-surface-2"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-right text-foreground-muted">
                <th className="px-4 py-3 font-medium"></th>
                <th className="px-4 py-3 font-medium">الموعد</th>
                <th className="px-4 py-3 font-medium">العنوان</th>
                <th className="px-4 py-3 font-medium">مرتبط بـ</th>
                <th className="px-4 py-3 font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {reminders.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-foreground-muted">
                    {tab === "done"
                      ? "لا توجد تذكيرات منتهية."
                      : tab === "overdue"
                        ? "لا توجد تذكيرات متأخرة."
                        : "لا توجد تذكيرات قادمة."}
                  </td>
                </tr>
              )}
              {reminders.map((r) => (
                <tr key={r.id} className="border-b border-border align-top last:border-0">
                  <td className="px-4 py-3">
                    <DoneCheckbox reminderId={r.id} done={!!r.doneAt} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-foreground-muted">
                    {formatDateTime(r.remindAt)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={r.doneAt ? "text-foreground-muted line-through" : ""}>
                      {r.title}
                    </span>
                    {r.note && <div className="text-xs text-foreground-muted">{r.note}</div>}
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">
                    {r.project ? (
                      <Link href={`/projects/${r.project.id}`} className="text-accent hover:underline">
                        {r.project.name}
                      </Link>
                    ) : r.client ? (
                      <Link href={`/clients/${r.client.id}`} className="text-accent hover:underline">
                        {r.client.name}
                      </Link>
                    ) : r.meeting ? (
                      <Badge>{r.meeting.title}</Badge>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {!r.doneAt && <SnoozeMenu reminderId={r.id} />}
                      <DeleteReminderButton reminderId={r.id} />
                    </div>
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
          if (tab !== "upcoming") params.set("tab", tab);
          if (p > 1) params.set("page", String(p));
          const qs = params.toString();
          return qs ? `/reminders?${qs}` : "/reminders";
        }}
      />
    </div>
  );
}
