import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { Card } from "@/components/ui/Card";
import { ymdInTz, formatDayLabel, zonedInputToUtc } from "@/lib/datetime";
import { bucketizeTasks, shiftYmd } from "@/lib/services/tasks";
import { getAssignableUsers } from "@/lib/services/assignees";
import { rolloverOverdueTasks } from "@/lib/services/task-rollover";
import { createTaskAction, updateTaskAction } from "@/server/task-actions";
import { TaskCard } from "@/components/tasks/TaskCard";
import { TaskDateNav } from "@/components/tasks/TaskDateNav";
import { DeleteTaskButton } from "@/components/tasks/DeleteTaskButton";
import { TaskFormModal } from "./TaskFormModal";
import { ForwardAssigneeButton } from "./ForwardAssigneeButton";
import { ForwardRequestReviewRow } from "./ForwardRequestReviewRow";

const WINDOW_DAYS = 14;
const OVERDUE_LOOKBACK_DAYS = 60;

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; status?: string; from?: string; project?: string; user?: string }>;
}) {
  const me = await requireUser();
  const sp = await searchParams;

  // Server-side idempotent rollover — cheap no-op once caught up (see
  // src/lib/services/task-rollover.ts). Runs on every load, same as cron.
  await rolloverOverdueTasks();

  const tab = sp.tab === "mine" ? "mine" : "all";
  const status = sp.status === "pending" || sp.status === "done" ? sp.status : "all";
  const today = ymdInTz(new Date());
  const from = sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : today;
  const rangeEnd = shiftYmd(from, WINDOW_DAYS - 1);
  const lookbackStart = shiftYmd(from, -OVERDUE_LOOKBACK_DAYS);

  const [tasks, pendingRequests, projects, assignees] = await Promise.all([
    prisma.task.findMany({
      where: {
        ...(tab === "mine" ? { assignees: { some: { userId: me.id } } } : {}),
        ...(status === "pending" ? { status: { not: "done" } } : status === "done" ? { status: "done" } : {}),
        ...(sp.project ? { projectId: sp.project } : {}),
        ...(sp.user ? { assignees: { some: { userId: sp.user } } } : {}),
        OR: [
          { dueDate: null },
          {
            dueDate: {
              gte: zonedInputToUtc(`${lookbackStart}T00:00`)!,
              lte: zonedInputToUtc(`${rangeEnd}T23:59`)!,
            },
          },
        ],
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      include: {
        project: { select: { id: true, name: true } },
        creator: { select: { name: true, email: true } },
        assignees: { include: { user: { select: { id: true, name: true, email: true, role: true } } } },
      },
    }),
    prisma.taskForwardRequest.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
      include: {
        task: { select: { title: true } },
        fromUser: { select: { name: true, email: true } },
        toUser: { select: { name: true, email: true } },
      },
    }),
    prisma.project.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    getAssignableUsers(),
  ]);

  const { overdue, noDate, days } = bucketizeTasks(tasks, today, from, rangeEnd);

  const filterHref = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { tab, status, from, project: sp.project, user: sp.user, ...patch };
    if (merged.tab && merged.tab !== "all") params.set("tab", merged.tab);
    if (merged.status && merged.status !== "all") params.set("status", merged.status);
    if (merged.from && merged.from !== today) params.set("from", merged.from);
    if (merged.project) params.set("project", merged.project);
    if (merged.user) params.set("user", merged.user);
    const qs = params.toString();
    return qs ? `/tasks?${qs}` : "/tasks";
  };

  function renderTask(t: (typeof tasks)[number]) {
    return (
      <TaskCard
        key={t.id}
        task={{
          id: t.id,
          title: t.title,
          description: t.description,
          dueDate: t.dueDate,
          status: t.status,
          postponementCount: t.postponementCount,
          project: t.project,
          assignees: t.assignees.map((a) => a.user),
        }}
        actions={
          <>
            <TaskFormModal
              mode="edit"
              action={updateTaskAction.bind(null, t.id)}
              projects={projects}
              assignees={assignees}
              task={{
                title: t.title,
                description: t.description,
                projectId: t.projectId,
                dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 16) : "",
                assigneeIds: t.assignees.map((a) => a.userId),
              }}
              triggerLabel="تعديل"
              triggerVariant="secondary"
            />
            {t.assignees.map((a) => (
              <ForwardAssigneeButton
                key={a.id}
                taskId={t.id}
                fromUserId={a.userId}
                fromLabel={a.user.name || a.user.email}
                candidates={assignees}
              />
            ))}
            <DeleteTaskButton taskId={t.id} title={t.title} />
          </>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">المهام</h1>
          <p className="mt-1 text-sm text-foreground-muted">{tasks.length} مهمة في النطاق الحالي</p>
        </div>
        <TaskFormModal
          mode="create"
          action={createTaskAction}
          projects={projects}
          assignees={assignees}
          triggerLabel="+ مهمة جديدة"
        />
      </div>

      <Card>
        <div className="flex flex-col gap-3">
          <TaskDateNav basePath="/tasks" from={from} />
          <div className="flex flex-wrap gap-2">
            {[
              { key: "all", label: "الكل" },
              { key: "mine", label: "مهامي" },
            ].map((t) => (
              <Link
                key={t.key}
                href={filterHref({ tab: t.key })}
                className={`rounded-md border border-border px-3 py-1.5 text-sm ${
                  tab === t.key ? "bg-accent/10 text-accent" : "text-foreground-muted hover:bg-surface-2"
                }`}
              >
                {t.label}
              </Link>
            ))}
            <span className="mx-1 self-center text-border">|</span>
            {[
              { key: "all", label: "كل الحالات" },
              { key: "pending", label: "غير مكتملة" },
              { key: "done", label: "مكتملة" },
            ].map((s) => (
              <Link
                key={s.key}
                href={filterHref({ status: s.key })}
                className={`rounded-md border border-border px-3 py-1.5 text-sm ${
                  status === s.key ? "bg-accent/10 text-accent" : "text-foreground-muted hover:bg-surface-2"
                }`}
              >
                {s.label}
              </Link>
            ))}
          </div>
        </div>
      </Card>

      {pendingRequests.length > 0 && (
        <Card>
          <h2 className="mb-3 text-base font-semibold">
            طلبات فروردة معلّقة ({pendingRequests.length})
          </h2>
          <div className="flex flex-col gap-3">
            {pendingRequests.map((r) => (
              <ForwardRequestReviewRow key={r.id} request={r} />
            ))}
          </div>
        </Card>
      )}

      {overdue.length > 0 && (
        <Card>
          <h2 className="mb-3 text-base font-semibold text-danger">متأخرة ({overdue.length})</h2>
          <div className="flex flex-col gap-2">{overdue.map(renderTask)}</div>
        </Card>
      )}

      {noDate.length > 0 && (
        <Card>
          <h2 className="mb-3 text-base font-semibold">بدون موعد ({noDate.length})</h2>
          <div className="flex flex-col gap-2">{noDate.map(renderTask)}</div>
        </Card>
      )}

      {days.length === 0 && overdue.length === 0 && noDate.length === 0 && (
        <Card>
          <p className="text-center text-sm text-foreground-muted">لا توجد مهام في النطاق الحالي.</p>
        </Card>
      )}

      {days.map((day) => (
        <div key={day.ymd}>
          <div className="mb-2 flex items-baseline gap-2">
            <h2 className="text-base font-semibold">{formatDayLabel(day.ymd)}</h2>
            <span className="text-xs text-foreground-muted">{day.tasks.length} مهمة</span>
          </div>
          <div className="flex flex-col gap-2">{day.tasks.map(renderTask)}</div>
        </div>
      ))}
    </div>
  );
}
