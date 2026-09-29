"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireUser, requireAdmin } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { parseTaskForm, TASK_STATUSES, type TaskStatus } from "@/lib/services/tasks";

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

  await prisma.$transaction(async (tx) => {
    await tx.task.update({ where: { id: taskId }, data: { status: status as TaskStatus } });
    await writeAuditLog(
      {
        userId: user.id,
        action: "status_changed",
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
        oldValue: { title: existing.title },
        newValue: { title: values.title, assigneeIds },
      },
      tx,
    );
  });

  revalidateTaskPaths();
  return { success: "تم تحديث المهمة." };
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

/** Admin-only, immediate: removes fromUserId as assignee, adds toUserId. */
export async function adminForwardTaskAction(
  taskId: string,
  fromUserId: string,
  toUserId: string,
): Promise<{ error?: string }> {
  const admin = await requireAdmin();

  const err = await swapAssignee(taskId, fromUserId, toUserId);
  if (err) return err;

  await writeAuditLog({
    userId: admin.id,
    action: "updated",
    entity: "task",
    entityId: taskId,
    newValue: { forwardedFrom: fromUserId, forwardedTo: toUserId, by: "admin" },
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
