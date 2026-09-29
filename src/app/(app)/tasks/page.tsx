import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/datetime";
import { getAssignableUsers } from "@/lib/services/assignees";
import { createTaskAction, updateTaskAction } from "@/server/task-actions";
import { TaskStatusChanger } from "@/components/tasks/TaskStatusChanger";
import { DeleteTaskButton } from "@/components/tasks/DeleteTaskButton";
import { TaskFormModal } from "./TaskFormModal";
import { ForwardAssigneeButton } from "./ForwardAssigneeButton";
import { ForwardRequestReviewRow } from "./ForwardRequestReviewRow";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const me = await requireUser();
  const sp = await searchParams;
  const tab = sp.tab === "mine" ? "mine" : "all";

  const [tasks, pendingRequests, projects, assignees] = await Promise.all([
    prisma.task.findMany({
      where: tab === "mine" ? { assignees: { some: { userId: me.id } } } : {},
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

  const tabHref = (t: string) => (t === "all" ? "/tasks" : "/tasks?tab=mine");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">المهام</h1>
          <p className="mt-1 text-sm text-foreground-muted">{tasks.length} مهمة</p>
        </div>
        <TaskFormModal
          mode="create"
          action={createTaskAction}
          projects={projects}
          assignees={assignees}
          triggerLabel="+ مهمة جديدة"
        />
      </div>

      <div className="flex gap-2">
        {[
          { key: "all", label: "الكل" },
          { key: "mine", label: "مهامي" },
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

      <div className="flex flex-col gap-3">
        {tasks.length === 0 && (
          <Card>
            <p className="text-center text-sm text-foreground-muted">لا توجد مهام.</p>
          </Card>
        )}
        {tasks.map((t) => (
          <Card key={t.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium">{t.title}</h3>
                  {t.dueDate && (
                    <Badge tone={t.status !== "done" && t.dueDate < new Date() ? "danger" : "neutral"}>
                      {formatDateTime(t.dueDate)}
                    </Badge>
                  )}
                </div>
                {t.description && (
                  <p className="mt-1 text-sm text-foreground-muted">{t.description}</p>
                )}
                <p className="mt-1 text-xs text-foreground-muted">
                  {t.project && (
                    <>
                      المشروع:{" "}
                      <Link href={`/projects/${t.project.id}`} className="text-accent hover:underline">
                        {t.project.name}
                      </Link>
                      {" — "}
                    </>
                  )}
                  أنشأها: {t.creator?.name || t.creator?.email || "—"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <TaskStatusChanger taskId={t.id} current={t.status} />
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
                <DeleteTaskButton taskId={t.id} title={t.title} />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
              {t.assignees.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-2 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs"
                >
                  <span>
                    {a.user.name || a.user.email}
                    {a.user.role === "employee" && " (موظف)"}
                  </span>
                  <ForwardAssigneeButton
                    taskId={t.id}
                    fromUserId={a.userId}
                    fromLabel={a.user.name || a.user.email}
                    candidates={assignees}
                  />
                </div>
              ))}
              {t.assignees.length === 0 && (
                <span className="text-xs text-foreground-muted">مفيش حد معيّن عليها.</span>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
