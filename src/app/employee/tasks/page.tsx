import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/datetime";
import { getAssignableUsers } from "@/lib/services/assignees";
import { TaskStatusChanger } from "@/components/tasks/TaskStatusChanger";
import { DeleteTaskButton } from "@/components/tasks/DeleteTaskButton";
import { RequestForwardButton } from "@/components/tasks/RequestForwardButton";
import { EmployeeTaskFormModal } from "./EmployeeTaskFormModal";

const FORWARD_STATUS_LABELS: Record<string, string> = {
  pending: "قيد المراجعة",
  approved: "تمت الموافقة",
  rejected: "مرفوض",
};
const FORWARD_STATUS_TONE: Record<string, "neutral" | "success" | "danger"> = {
  pending: "neutral",
  approved: "success",
  rejected: "danger",
};

export default async function EmployeeTasksPage() {
  const me = await requireUser();
  const employee = await prisma.employee.findUniqueOrThrow({ where: { userId: me.id } });

  const [tasks, myProjects, assignees, myForwardRequests] = await Promise.all([
    prisma.task.findMany({
      where: { assignees: { some: { userId: me.id } } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      include: {
        project: { select: { id: true, name: true } },
        creator: { select: { name: true, email: true } },
        assignees: { include: { user: { select: { id: true, name: true, email: true, role: true } } } },
      },
    }),
    prisma.projectAssignment.findMany({
      where: { employeeId: employee.id },
      include: { project: { select: { id: true, name: true } } },
    }),
    getAssignableUsers(),
    prisma.taskForwardRequest.findMany({
      where: { fromUserId: me.id },
      orderBy: { createdAt: "desc" },
      include: { task: { select: { title: true } }, toUser: { select: { name: true, email: true } } },
    }),
  ]);

  const candidates = assignees.filter((a) => a.id !== me.id);
  const projectOptions = myProjects.map((a) => a.project);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">مهامي</h1>
          <p className="mt-1 text-sm text-foreground-muted">{tasks.length} مهمة معيّنة عليك.</p>
        </div>
        <EmployeeTaskFormModal projects={projectOptions} />
      </div>

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
                  {t.project && <>المشروع: {t.project.name} — </>}
                  أنشأها: {t.creator?.name || t.creator?.email || "—"}
                </p>
                {t.assignees.length > 1 && (
                  <p className="mt-1 text-xs text-foreground-muted">
                    معاك: {t.assignees.filter((a) => a.userId !== me.id).map((a) => a.user.name || a.user.email).join("، ")}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <TaskStatusChanger taskId={t.id} current={t.status} />
                <RequestForwardButton taskId={t.id} candidates={candidates} />
                {t.createdBy === me.id && <DeleteTaskButton taskId={t.id} title={t.title} />}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {myForwardRequests.length > 0 && (
        <Card className="p-0">
          <div className="border-b border-border p-4">
            <h2 className="text-base font-semibold">طلبات الفروردة اللي بعتها</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-right text-foreground-muted">
                  <th className="px-4 py-3 font-medium">المهمة</th>
                  <th className="px-4 py-3 font-medium">لمين</th>
                  <th className="px-4 py-3 font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {myForwardRequests.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">{r.task.title}</td>
                    <td className="px-4 py-3 text-foreground-muted">
                      {r.toUser.name || r.toUser.email}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={FORWARD_STATUS_TONE[r.status]}>
                        {FORWARD_STATUS_LABELS[r.status]}
                      </Badge>
                      {r.status === "rejected" && r.rejectionReason && (
                        <p className="mt-1 text-xs text-foreground-muted">{r.rejectionReason}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
