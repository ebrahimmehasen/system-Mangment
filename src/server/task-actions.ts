"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireUser, requireAdmin } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { parseTaskForm, TASK_STATUSES, type TaskStatus } from "@/lib/services/tasks";
import { actionLabel } from "@/lib/audit-labels";
import { utcToZonedInput, ymdInTz, zonedInputToUtc } from "@/lib/datetime";

export interface TaskActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
  success?: string;
}

function revalidateTaskPaths() {
  revalidatePath("/tasks");
  revalidatePath("/employee/tasks");
  revalidatePath("/calendar");
  revalidatePath("/employee/calendar");
}

/**
 * An admin creates a task and assigns it to anyone (multiple people,
 * admins and/or employees). An employee can only create a task assigned to
 * themself, on a project they're actually on.
 */
export async function createTaskAction(
  _prev: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  const user = await requireUser();
  const { values, errors, parsed } = parseTaskForm(formData);
  if (Object.keys(errors).length > 0) {
    return { fieldErrors: errors, values: values as unknown as Record<string, string> };
  }

  let assigneeIds: string[];
  const projectId: string | null = values.projectId || null;

  if (user.role === "admin") {
    assigneeIds = formData.getAll("assigneeIds").map(String).filter(Boolean);
    if (assigneeIds.length === 0) assigneeIds = [user.id];
  } else {
    const employee = await prisma.employee.findUnique({ where: { userId: user.id } });
    if (!employee) return { error: "الحساب غير مربوط بملف موظف." };
    assigneeIds = [user.id];

    if (projectId) {
      const onProject = await prisma.projectAssignment.findFirst({
        where: { projectId, employeeId: employee.id },
      });
      if (!onProject) return { error: "إنت مش معيّن على المشروع ده." };
    }
  }

  await prisma.$transaction(async (tx) => {
    const task = await tx.task.create({
      data: {
        title: values.title,
        description: values.description || null,
        projectId,
        dueDate: parsed.dueDateUtc,
        priority: parsed.priority,
        createdBy: user.id,
        assignees: { create: assigneeIds.map((userId) => ({ userId })) },
      },
    });
    await writeAuditLog(
      {
        userId: user.id,
        action: "created",
        entity: "task",
        entityId: task.id,
        newValue: { title: task.title, assigneeIds },
      },
      tx,
    );
  });

  revalidateTaskPaths();
  return { success: "تم إنشاء المهمة." };
}

/** Any current assignee, or an admin, can update a task's status. */
export async function updateTaskStatusAction(
  taskId: string,
  status: string,
): Promise<{ error?: string }> {
  const user = await requireUser();
  if (!(TASK_STATUSES as readonly string[]).includes(status)) {
    return { error: "حالة غير صالحة." };
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { assignees: { select: { userId: true } } },
  });
  if (!task) return { error: "المهمة غير موجودة." };

  const isAssignee = task.assignees.some((a) => a.userId === user.id);
  if (user.role !== "admin" && !isAssignee) {
    return { error: "إنت مش معيّن على المهمة دي." };
  }
  if (task.status === status) return {};

  const becameDone = status === "done" && task.status !== "done";
  const reopened = status !== "done" && task.status === "done";

  await prisma.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: taskId },
      data: {
        status: status as TaskStatus,
        completedAt: becameDone ? new Date() : reopened ? null : undefined,
        completedById: becameDone ? user.id : reopened ? null : undefined,
        overdueSince: becameDone ? null : undefined,
      },
    });
    await writeAuditLog(
      {
        userId: user.id,
        action: becameDone ? "completed" : reopened ? "reopened" : "status_changed",
        entity: "task",
        entityId: taskId,
        oldValue: { status: task.status },
        newValue: { status },
      },
      tx,
    );
  });

  revalidateTaskPaths();
  return {};
}

/** Toggle helper for the completion circle: done <-> todo. */
export async function toggleTaskCompleteAction(taskId: string): Promise<{ error?: string }> {
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { status: true } });
  if (!task) return { error: "المهمة غير موجودة." };
  return updateTaskStatusAction(taskId, task.status === "done" ? "todo" : "done");
}

/** Admin-only full edit — title/description/due date/project/assignees. */
export async function updateTaskAction(
  taskId: string,
  _prev: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  const user = await requireAdmin();
  const { values, errors, parsed } = parseTaskForm(formData);
  if (Object.keys(errors).length > 0) {
    return { fieldErrors: errors, values: values as unknown as Record<string, string> };
  }

  const existing = await prisma.task.findUnique({ where: { id: taskId } });
  if (!existing) return { error: "المهمة غير موجودة." };

  let assigneeIds = formData.getAll("assigneeIds").map(String).filter(Boolean);
  if (assigneeIds.length === 0) assigneeIds = [user.id];

  await prisma.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: taskId },
      data: {
        title: values.title,
        description: values.description || null,
        projectId: values.projectId || null,
        dueDate: parsed.dueDateUtc,
        priority: parsed.priority,
        ...(existing.dueDate?.getTime() !== parsed.dueDateUtc?.getTime() ? { overdueSince: null } : {}),
      },
    });
    await tx.taskAssignee.deleteMany({ where: { taskId } });
    await tx.taskAssignee.createMany({
      data: assigneeIds.map((userId) => ({ taskId, userId })),
    });
    await writeAuditLog(
      {
        userId: user.id,
        action: "updated",
        entity: "task",
        entityId: taskId,
        oldValue: { title: existing.title, priority: existing.priority },
        newValue: { title: values.title, assigneeIds, priority: parsed.priority },
      },
      tx,
    );
  });

  revalidateTaskPaths();
  return { success: "تم تحديث المهمة." };
}

export interface TaskDetailsUpdateState {
  error?: string;
  success?: boolean;
}

/**
 * Admin-only, from the details modal: change which project the task belongs
 * to and/or correct its completion date directly. Setting a completion date
 * implies the task is done (status flips to "done" too, so the two fields
 * never disagree); clearing it just removes the timestamp without touching
 * status. Logged to the same audit trail as every other task edit.
 */
export async function updateTaskDetailsAction(
  taskId: string,
  formData: FormData,
): Promise<TaskDetailsUpdateState> {
  const user = await requireAdmin();

  const existing = await prisma.task.findUnique({ where: { id: taskId } });
  if (!existing) return { error: "المهمة غير موجودة." };

  const projectId = String(formData.get("projectId") ?? "").trim() || null;
  const completedAtLocal = String(formData.get("completedAt") ?? "").trim();
  let completedAt: Date | null = null;
  if (completedAtLocal) {
    completedAt = zonedInputToUtc(completedAtLocal);
    if (!completedAt) return { error: "تاريخ إتمام غير صالح." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: taskId },
      data: {
        projectId,
        completedAt,
        status: completedAt ? "done" : existing.status,
        ...(completedAt && !existing.completedById ? { completedById: user.id } : {}),
      },
    });
    await writeAuditLog(
      {
        userId: user.id,
        action: "updated",
        entity: "task",
        entityId: taskId,
        oldValue: { projectId: existing.projectId, completedAt: existing.completedAt?.toISOString() ?? null },
        newValue: { projectId, completedAt: completedAt?.toISOString() ?? null },
      },
      tx,
    );
  });

  revalidateTaskPaths();
  return { success: true };
}

/** Admin can edit any task; a non-admin only one they're assigned to. Returns the task or an error. */
async function loadEditableTask(taskId: string, user: { id: string; role: string }) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { assignees: { select: { userId: true } } },
  });
  if (!task) return { error: "المهمة غير موجودة." } as const;
  if (user.role !== "admin" && !task.assignees.some((a) => a.userId === user.id)) {
    return { error: "إنت مش معيّن على المهمة دي." } as const;
  }
  return { task } as const;
}

/**
 * Drag-and-drop: moves a task to another board column. `ymd` is a Cairo
 * calendar day ("YYYY-MM-DD") or null for "بدون موعد". Keeps the task's
 * existing time of day (noon for a task that had no date).
 */
export async function moveTaskToDayAction(
  taskId: string,
  ymd: string | null,
): Promise<{ error?: string }> {
  const user = await requireUser();
  if (ymd !== null && !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return { error: "تاريخ غير صالح." };

  if (ymd !== null && ymd < ymdInTz(new Date())) return { error: "تقدر تنقل المهمة لليوم أو لأيام جاية بس." };

  const res = await loadEditableTask(taskId, user);
  if ("error" in res) return { error: res.error };
  const { task } = res;

  let dueDate: Date | null = null;
  if (ymd) {
    const time = task.dueDate ? utcToZonedInput(task.dueDate).slice(11, 16) : "12:00";
    dueDate = zonedInputToUtc(`${ymd}T${time}`);
    if (!dueDate) return { error: "تاريخ غير صالح." };
  }
  if ((task.dueDate?.getTime() ?? null) === (dueDate?.getTime() ?? null)) return {};

  await prisma.$transaction(async (tx) => {
    await tx.task.update({ where: { id: taskId }, data: { dueDate, overdueSince: null } });
    await writeAuditLog(
      {
        userId: user.id,
        action: "updated",
        entity: "task",
        entityId: taskId,
        oldValue: { dueDate: task.dueDate?.toISOString() ?? null },
        newValue: { dueDate: dueDate?.toISOString() ?? null },
      },
      tx,
    );
  });

  revalidateTaskPaths();
  return {};
}

/** Admin can delete any task; a non-admin only their own (self-created) task. */
export async function deleteTaskAction(taskId: string): Promise<{ error?: string }> {
  const user = await requireUser();

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return { error: "المهمة غير موجودة." };
  if (user.role !== "admin" && task.createdBy !== user.id) {
    return { error: "تقدر تحذف بس المهام اللي إنت عملتها." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.task.delete({ where: { id: taskId } });
    await writeAuditLog(
      {
        userId: user.id,
        action: "deleted",
        entity: "task",
        entityId: taskId,
        oldValue: { title: task.title },
      },
      tx,
    );
  });

  revalidateTaskPaths();
  return {};
}

/** Swaps `fromUserId` out for `toUserId` on a task's assignee list. */
async function swapAssignee(
  taskId: string,
  fromUserId: string,
  toUserId: string,
): Promise<{ error?: string } | null> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { assignees: { select: { userId: true } } },
  });
  if (!task) return { error: "المهمة غير موجودة." };
  if (!task.assignees.some((a) => a.userId === fromUserId)) {
    return { error: "الشخص ده مش معيّن على المهمة دي." };
  }
  if (fromUserId === toUserId) return { error: "لازم تختار شخص مختلف." };

  await prisma.$transaction(async (tx) => {
    await tx.taskAssignee.deleteMany({ where: { taskId, userId: fromUserId } });
    await tx.taskAssignee.upsert({
      where: { taskId_userId: { taskId, userId: toUserId } },
      update: {},
      create: { taskId, userId: toUserId },
    });
  });

  return null;
}

/**
 * Admin, immediate: hands the admin's OWN share of a task to someone else.
 * An admin can only forward a task they are themself assigned to, and only
 * as themself — never on behalf of another assignee.
 */
export async function adminForwardTaskAction(
  taskId: string,
  toUserId: string,
): Promise<{ error?: string }> {
  const admin = await requireAdmin();

  const err = await swapAssignee(taskId, admin.id, toUserId);
  if (err) return err;

  await writeAuditLog({
    userId: admin.id,
    action: "updated",
    entity: "task",
    entityId: taskId,
    newValue: { forwardedFrom: admin.id, forwardedTo: toUserId, by: "admin" },
  });

  revalidateTaskPaths();
  return {};
}

/** A non-admin assignee requests handing their share of a task to someone else. */
export async function requestForwardTaskAction(
  taskId: string,
  toUserId: string,
): Promise<{ error?: string }> {
  const user = await requireUser();
  if (user.role === "admin") return { error: "الأدمن يقدر يفروورد المهمة مباشرة." };

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { assignees: { select: { userId: true } } },
  });
  if (!task) return { error: "المهمة غير موجودة." };
  if (!task.assignees.some((a) => a.userId === user.id)) {
    return { error: "إنت مش معيّن على المهمة دي." };
  }
  if (toUserId === user.id) return { error: "لازم تختار شخص مختلف." };

  const existingPending = await prisma.taskForwardRequest.findFirst({
    where: { taskId, fromUserId: user.id, status: "pending" },
  });
  if (existingPending) return { error: "عندك طلب فروردة معلّق بالفعل على المهمة دي." };

  await prisma.$transaction(async (tx) => {
    const req = await tx.taskForwardRequest.create({
      data: { taskId, fromUserId: user.id, toUserId },
    });
    await writeAuditLog(
      {
        userId: user.id,
        action: "created",
        entity: "task_forward_request",
        entityId: req.id,
        newValue: { taskId, toUserId },
      },
      tx,
    );
  });

  revalidateTaskPaths();
  return {};
}

/** Admin-only. Approves a forward request — performs the actual swap. */
export async function approveForwardRequestAction(
  requestId: string,
): Promise<{ error?: string }> {
  const admin = await requireAdmin();

  const req = await prisma.taskForwardRequest.findUnique({ where: { id: requestId } });
  if (!req) return { error: "الطلب غير موجود." };
  if (req.status !== "pending") return { error: "تم التعامل مع هذا الطلب بالفعل." };

  const err = await swapAssignee(req.taskId, req.fromUserId, req.toUserId);
  if (err) return err;

  await prisma.$transaction(async (tx) => {
    await tx.taskForwardRequest.update({
      where: { id: requestId },
      data: { status: "approved", reviewedById: admin.id, reviewedAt: new Date() },
    });
    await writeAuditLog(
      {
        userId: admin.id,
        action: "status_changed",
        entity: "task_forward_request",
        entityId: requestId,
        newValue: { status: "approved" },
      },
      tx,
    );
  });

  revalidateTaskPaths();
  return {};
}

export interface TaskDetail {
  id: string;
  title: string;
  description: string | null;
  status: string;
  dueDate: string | null;
  completedAt: string | null;
  postponementCount: number;
  priority: number;
  completedBy: { id: string; name: string | null; email: string } | null;
  createdAt: string;
  project: { id: string; name: string } | null;
  creator: { name: string | null; email: string } | null;
  assignees: { id: string; name: string | null; email: string; role: string }[];
  activity: {
    id: string;
    label: string;
    at: string;
    oldValue: unknown;
    newValue: unknown;
  }[];
}

/** Full task detail + activity history, for the details drawer. Admin sees any; a non-admin only a task they're assigned to. */
export async function getTaskDetailAction(taskId: string): Promise<{ error?: string; task?: TaskDetail }> {
  const user = await requireUser();

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      project: { select: { id: true, name: true } },
      creator: { select: { name: true, email: true } },
      completer: { select: { id: true, name: true, email: true } },
      assignees: { include: { user: { select: { id: true, name: true, email: true, role: true } } } },
    },
  });
  if (!task) return { error: "المهمة غير موجودة." };

  const isAssignee = task.assignees.some((a) => a.userId === user.id);
  if (user.role !== "admin" && !isAssignee) {
    return { error: "مش مسموح تشوف تفاصيل المهمة دي." };
  }

  const logs = await prisma.auditLog.findMany({
    where: { entity: "task", entityId: taskId },
    orderBy: { createdAt: "asc" },
  });

  return {
    task: {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      dueDate: task.dueDate?.toISOString() ?? null,
      completedAt: task.completedAt?.toISOString() ?? null,
      postponementCount: task.postponementCount,
      priority: task.priority,
      completedBy: task.completer,
      createdAt: task.createdAt.toISOString(),
      project: task.project,
      creator: task.creator,
      assignees: task.assignees.map((a) => ({
        id: a.user.id,
        name: a.user.name,
        email: a.user.email,
        role: a.user.role,
      })),
      activity: logs.map((l) => ({
        id: l.id,
        label: actionLabel(l.action),
        at: l.createdAt.toISOString(),
        oldValue: l.oldValue,
        newValue: l.newValue,
      })),
    },
  };
}

/** Admin-only. Rejects a forward request — the task stays exactly as it was. */
export async function rejectForwardRequestAction(
  requestId: string,
  reason: string,
): Promise<{ error?: string }> {
  const admin = await requireAdmin();

  const req = await prisma.taskForwardRequest.findUnique({ where: { id: requestId } });
  if (!req) return { error: "الطلب غير موجود." };
  if (req.status !== "pending") return { error: "تم التعامل مع هذا الطلب بالفعل." };

  await prisma.$transaction(async (tx) => {
    await tx.taskForwardRequest.update({
      where: { id: requestId },
      data: {
        status: "rejected",
        reviewedById: admin.id,
        reviewedAt: new Date(),
        rejectionReason: reason || null,
      },
    });
    await writeAuditLog(
      {
        userId: admin.id,
        action: "status_changed",
        entity: "task_forward_request",
        entityId: requestId,
        newValue: { status: "rejected", reason: reason || null },
      },
      tx,
    );
  });

  revalidateTaskPaths();
  return {};
}
