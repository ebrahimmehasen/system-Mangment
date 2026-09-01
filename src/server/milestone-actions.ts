"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { parseMilestoneForm } from "@/lib/services/milestones";

export interface MilestoneActionState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
}

function snapshot(m: {
  title: string;
  description: string | null;
  dueDate: Date | null;
  completedAt: Date | null;
  sortOrder: number;
}) {
  return {
    title: m.title,
    description: m.description,
    dueDate: m.dueDate?.toISOString() ?? null,
    completedAt: m.completedAt?.toISOString() ?? null,
    sortOrder: m.sortOrder,
  };
}

export async function createMilestoneAction(
  projectId: string,
  _prev: MilestoneActionState,
  formData: FormData,
): Promise<MilestoneActionState> {
  const user = await requireUser();
  const { values, errors, parsed } = parseMilestoneForm(formData);

  if (Object.keys(errors).length > 0) {
    return { fieldErrors: errors, values: values as unknown as Record<string, string> };
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!project) return { error: "المشروع غير موجود." };

  const last = await prisma.projectMilestone.findFirst({
    where: { projectId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await prisma.$transaction(async (tx) => {
    const milestone = await tx.projectMilestone.create({
      data: {
        projectId,
        title: values.title,
        description: values.description || null,
        dueDate: parsed.dueDate,
        sortOrder: (last?.sortOrder ?? -1) + 1,
        createdBy: user.id,
      },
    });
    await writeAuditLog(
      {
        userId: user.id,
        action: "created",
        entity: "milestone",
        entityId: milestone.id,
        newValue: snapshot(milestone),
      },
      tx,
    );
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/calendar");
  return { ok: true };
}

export async function updateMilestoneAction(
  milestoneId: string,
  _prev: MilestoneActionState,
  formData: FormData,
): Promise<MilestoneActionState> {
  const user = await requireUser();
  const { values, errors, parsed } = parseMilestoneForm(formData);

  const existing = await prisma.projectMilestone.findUnique({
    where: { id: milestoneId },
  });
  if (!existing) return { error: "المرحلة غير موجودة." };

  if (Object.keys(errors).length > 0) {
    return { fieldErrors: errors, values: values as unknown as Record<string, string> };
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.projectMilestone.update({
      where: { id: milestoneId },
      data: {
        title: values.title,
        description: values.description || null,
        dueDate: parsed.dueDate,
      },
    });
    await writeAuditLog(
      {
        userId: user.id,
        action: "updated",
        entity: "milestone",
        entityId: milestoneId,
        oldValue: snapshot(existing),
        newValue: snapshot(updated),
      },
      tx,
    );
  });

  revalidatePath(`/projects/${existing.projectId}`);
  revalidatePath("/calendar");
  return { ok: true };
}

export async function toggleMilestoneCompleteAction(
  milestoneId: string,
): Promise<{ error?: string }> {
  const user = await requireUser();

  const existing = await prisma.projectMilestone.findUnique({
    where: { id: milestoneId },
  });
  if (!existing) return { error: "المرحلة غير موجودة." };

  const nextCompletedAt = existing.completedAt ? null : new Date();

  await prisma.$transaction(async (tx) => {
    await tx.projectMilestone.update({
      where: { id: milestoneId },
      data: { completedAt: nextCompletedAt },
    });
    await writeAuditLog(
      {
        userId: user.id,
        action: "status_changed",
        entity: "milestone",
        entityId: milestoneId,
        oldValue: { completedAt: existing.completedAt?.toISOString() ?? null },
        newValue: { completedAt: nextCompletedAt?.toISOString() ?? null },
      },
      tx,
    );
  });

  revalidatePath(`/projects/${existing.projectId}`);
  revalidatePath("/calendar");
  return {};
}

export async function deleteMilestoneAction(
  milestoneId: string,
): Promise<{ error?: string }> {
  const user = await requireUser();

  const existing = await prisma.projectMilestone.findUnique({
    where: { id: milestoneId },
  });
  if (!existing) return { error: "المرحلة غير موجودة." };

  await prisma.$transaction(async (tx) => {
    await tx.projectMilestone.delete({ where: { id: milestoneId } });
    await writeAuditLog(
      {
        userId: user.id,
        action: "deleted",
        entity: "milestone",
        entityId: milestoneId,
        oldValue: snapshot(existing),
      },
      tx,
    );
  });

  revalidatePath(`/projects/${existing.projectId}`);
  revalidatePath("/calendar");
  return {};
}

/**
 * Move a milestone up/down by swapping sort_order with its neighbour.
 * Simple and safe for the small lists a project realistically has.
 */
export async function moveMilestoneAction(
  milestoneId: string,
  direction: "up" | "down",
): Promise<{ error?: string }> {
  await requireUser();

  const current = await prisma.projectMilestone.findUnique({
    where: { id: milestoneId },
  });
  if (!current) return { error: "المرحلة غير موجودة." };

  const neighbour = await prisma.projectMilestone.findFirst({
    where: {
      projectId: current.projectId,
      sortOrder: direction === "up" ? { lt: current.sortOrder } : { gt: current.sortOrder },
    },
    orderBy: { sortOrder: direction === "up" ? "desc" : "asc" },
  });
  if (!neighbour) return {};

  await prisma.$transaction(async (tx) => {
    await tx.projectMilestone.update({
      where: { id: current.id },
      data: { sortOrder: neighbour.sortOrder },
    });
    await tx.projectMilestone.update({
      where: { id: neighbour.id },
      data: { sortOrder: current.sortOrder },
    });
  });

  revalidatePath(`/projects/${current.projectId}`);
  return {};
}
