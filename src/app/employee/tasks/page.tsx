import { after } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ymdInTz, zonedInputToUtc } from "@/lib/datetime";
import { bucketizeTasks, shiftYmd } from "@/lib/services/tasks";
import { getAssignableUsers } from "@/lib/services/assignees";
import { rolloverOverdueTasks } from "@/lib/services/task-rollover";
import { TaskCard } from "@/components/tasks/TaskCard";
import { TaskBoard } from "@/components/tasks/TaskBoard";
import { TaskDateNav } from "@/components/tasks/TaskDateNav";
import { RequestForwardButton } from "@/components/tasks/RequestForwardButton";
import { DeleteTaskButton } from "@/components/tasks/DeleteTaskButton";
import { EmployeeTaskFormModal } from "./EmployeeTaskFormModal";

const WINDOW_DAYS = 14;
const OVERDUE_LOOKBACK_DAYS = 60;

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

export default async function EmployeeTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const me = await requireUser();
  const sp = await searchParams;
  const employee = await prisma.employee.findUniqueOrThrow({ where: { userId: me.id } });

  after(() => rolloverOverdueTasks());

  const today = ymdInTz(new Date());
  const from = sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : today;
  const rangeEnd = shiftYmd(from, WINDOW_DAYS - 1);
  const lookbackStart = shiftYmd(from, -OVERDUE_LOOKBACK_DAYS);

  const [tasks, myProjects, assignees, myForwardRequests] = await Promise.all([
    prisma.task.findMany({
      where: {
        assignees: { some: { userId: me.id } },
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
  const { overdue, noDate, days } = bucketizeTasks(tasks, today, from, rangeEnd, true);

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
            <RequestForwardButton taskId={t.id} candidates={candidates} />
            {t.createdBy === me.id && <DeleteTaskButton taskId={t.id} title={t.title} />}
          </>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">مهامي القادمة</h1>
          <p className="mt-1 text-sm text-foreground-muted">{tasks.length} مهمة في النطاق الحالي</p>
        </div>
        <EmployeeTaskFormModal projects={projectOptions} />
      </div>

      <Card>
        <TaskDateNav basePath="/employee/tasks" from={from} />
      </Card>

      <TaskBoard overdue={overdue} noDate={noDate} days={days} todayYmd={today} renderTask={renderTask} />

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
