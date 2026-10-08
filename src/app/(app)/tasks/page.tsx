import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { Card } from "@/components/ui/Card";
import { utcToZonedInput, ymdInTz, zonedInputToUtc } from "@/lib/datetime";
import { bucketizeTasks, lateSinceYmd, shiftYmd, taskAccess } from "@/lib/services/tasks";
import { getAssignableUsers } from "@/lib/services/assignees";
import { createTaskAction, updateTaskAction } from "@/server/task-actions";
import { TaskCard } from "@/components/tasks/TaskCard";
import { TaskBoard } from "@/components/tasks/TaskBoard";
import { TaskDateNav } from "@/components/tasks/TaskDateNav";
import { TaskFilters } from "@/components/tasks/TaskFilters";
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

  const tab = sp.tab === "mine" ? "mine" : "all";
  const status = sp.status === "pending" || sp.status === "done" ? sp.status : "all";
  const today = ymdInTz(new Date());
  const from = sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : today;
  const rangeEnd = shiftYmd(from, WINDOW_DAYS - 1);
  const lookbackStart = shiftYmd(from, -OVERDUE_LOOKBACK_DAYS);

  const [tasks, pendingRequests, projects, assignees] = await Promise.all([
    prisma.task.findMany({
      where: {
        ...(status === "pending" ? { status: { not: "done" } } : status === "done" ? { status: "done" } : {}),
        ...(sp.project ? { projectId: sp.project } : {}),
        AND: [
          ...(tab === "mine" ? [{ assignees: { some: { userId: me.id } } }] : []),
          ...(sp.user ? [{ assignees: { some: { userId: sp.user } } }] : []),
        ],
        OR: [
          { dueDate: null },
          {
            dueDate: {
              gte: zonedInputToUtc(`${lookbackStart}T00:00`)!,
              lte: zonedInputToUtc(`${rangeEnd}T23:59`)!,
            },
          },
          // Tasks finished late are shown on the day they were finished.
          {
            completedAt: {
              gte: zonedInputToUtc(`${from}T00:00`)!,
              lte: zonedInputToUtc(`${rangeEnd}T23:59`)!,
            },
          },
        ],
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      include: {
        project: { select: { id: true, name: true } },
        creator: { select: { name: true, email: true } },
        completer: { select: { id: true, name: true, email: true } },
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

  const { overdue, noDate, days } = bucketizeTasks(tasks, today, from, rangeEnd, true);

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
    const access = taskAccess(t, me.id);
    return (
      <TaskCard
        key={t.id}
        currentUserId={me.id}
        task={{
          id: t.id,
          title: t.title,
          description: t.description,
          dueDate: t.dueDate,
          status: t.status,
          postponementCount: t.postponementCount,
          priority: t.priority,
          completedBy: t.completer,
          lateSince: lateSinceYmd(t, today),
          project: t.project,
          assignees: t.assignees.map((a) => a.user),
        }}
        canEditDetails={access.canManage}
        canComplete={access.isAssignee}
        canMove={access.canManage}
        projects={projects}
        actions={
          <>
            {access.canManage && (
            <TaskFormModal
              mode="edit"
              action={updateTaskAction.bind(null, t.id)}
              projects={projects}
              assignees={assignees}
              task={{
                title: t.title,
                description: t.description,
                projectId: t.projectId,
                dueDate: t.dueDate ? utcToZonedInput(t.dueDate) : "",
                priority: t.priority,
                assigneeIds: t.assignees.map((a) => a.userId),
              }}
              triggerLabel="تعديل"
              triggerVariant="secondary"
            />
            )}
            {access.isAssignee && (
              <ForwardAssigneeButton taskId={t.id} candidates={assignees.filter((a) => a.id !== me.id)} />
            )}
            {(access.isCreator || (t.createdBy === null && access.isAssignee)) && (
              <DeleteTaskButton taskId={t.id} title={t.title} />
            )}
          </>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">المهام القادمة</h1>
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
          <TaskFilters basePath="/tasks" projects={projects} people={assignees} />
          <div className="flex flex-wrap gap-2">
            {[
              { key: "all", label: "الكل" },
              { key: "mine", label: "مهامي" },
            ].map((t) => (
              <Link
                key={t.key}
                href={filterHref({ tab: t.key })}
                prefetch={false}
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
                prefetch={false}
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

      <TaskBoard overdue={overdue} noDate={noDate} days={days} todayYmd={today} renderTask={renderTask} />
    </div>
  );
}
