"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export interface AssignmentActionState {
  error?: string;
  success?: string;
}

/**
 * Assign a person to a project. `role` decides whether `personId` is an
 * Employee (role=employee) or a system User / supervisor (role=supervisor).
 */
export async function assignToProjectAction(
  projectId: string,
  _prev: AssignmentActionState,
  formData: FormData,
): Promise<AssignmentActionState> {
  const user = await requireUser();

  const role = String(formData.get("role") ?? "");
  const personId = String(formData.get("personId") ?? "").trim();

  if (role !== "employee" && role !== "supervisor") {
    return { error: "اختر الدور." };
  }
  if (!personId) return { error: "اختر الشخص." };

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!project) return { error: "المشروع غير موجود." };

  let name: string;
  if (role === "employee") {
    const e = await prisma.employee.findUnique({
      where: { id: personId },
      select: { name: true },
    });
    if (!e) return { error: "الموظف غير موجود." };
    name = e.name;
  } else {
    const u = await prisma.user.findUnique({
      where: { id: personId },
      select: { name: true, email: true },
    });
    if (!u) return { error: "المشرف غير موجود." };
    name = u.name || u.email;
  }

  try {
    await prisma.$transaction(async (tx) => {
      const assignment = await tx.projectAssignment.create({
        data: {
          projectId,
          role,
          employeeId: role === "employee" ? personId : null,
          userId: role === "supervisor" ? personId : null,
          createdBy: user.id,
        },
      });
      await writeAuditLog(
        {
          userId: user.id,
          action: "created",
          entity: "project_assignment",
          entityId: assignment.id,
          newValue: { projectId, role, name },
        },
        tx,
      );
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "هذا الشخص معيّن على المشروع بالفعل." };
    }
    throw e;
  }

  revalidatePath(`/projects/${projectId}`);
  return { success: `تمت إضافة ${name} إلى الفريق.` };
}

export async function removeAssignmentAction(
  assignmentId: string,
): Promise<{ error?: string }> {
  const user = await requireUser();

  const assignment = await prisma.projectAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      employee: { select: { name: true } },
      user: { select: { name: true, email: true } },
    },
  });
  if (!assignment) return { error: "التعيين غير موجود." };

  await prisma.$transaction(async (tx) => {
    await tx.projectAssignment.delete({ where: { id: assignmentId } });
    await writeAuditLog(
      {
        userId: user.id,
        action: "deleted",
        entity: "project_assignment",
        entityId: assignmentId,
        oldValue: {
          projectId: assignment.projectId,
          role: assignment.role,
          name:
            assignment.employee?.name ??
            assignment.user?.name ??
            assignment.user?.email ??
            "—",
        },
      },
      tx,
    );
  });

  revalidatePath(`/projects/${assignment.projectId}`);
  return {};
}
