"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { parseProjectForm } from "@/lib/services/projects";
import { removeFromStorage } from "@/lib/storage";

export interface ProjectActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
}

function snapshot(p: {
  name: string;
  clientId: string;
  description: string | null;
  status: string;
  contractValue: Prisma.Decimal;
  discount: Prisma.Decimal;
  startDate: Date | null;
  expectedDeliveryDate: Date | null;
  notes: string | null;
}) {
  return {
    name: p.name,
    clientId: p.clientId,
    description: p.description,
    status: p.status,
    contractValue: p.contractValue.toString(),
    discount: p.discount.toString(),
    startDate: p.startDate?.toISOString() ?? null,
    expectedDeliveryDate: p.expectedDeliveryDate?.toISOString() ?? null,
    notes: p.notes,
  };
}

async function validStatuses(): Promise<Set<string>> {
  const rows = await prisma.projectStatus.findMany({ select: { name: true } });
  return new Set(rows.map((r) => r.name));
}

export async function createProjectAction(
  _prev: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const user = await requireUser();
  const { values, errors, parsed } = parseProjectForm(formData);

  if (values.clientId) {
    const client = await prisma.client.findUnique({
      where: { id: values.clientId },
      select: { id: true },
    });
    if (!client) errors.clientId = "العميل غير موجود.";
  }
  if (values.status && !(await validStatuses()).has(values.status)) {
    errors.status = "حالة غير صالحة.";
  }

  if (Object.keys(errors).length > 0) {
    return { fieldErrors: errors, values: values as unknown as Record<string, string> };
  }

  const created = await prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        clientId: values.clientId,
        name: values.name,
        description: values.description || null,
        status: values.status,
        contractValue: parsed.contractValue,
        discount: parsed.discount,
        startDate: parsed.startDate,
        expectedDeliveryDate: parsed.expectedDeliveryDate,
        notes: values.notes || null,
        createdBy: user.id,
      },
    });
    await writeAuditLog(
      {
        userId: user.id,
        action: "created",
        entity: "project",
        entityId: project.id,
        newValue: snapshot(project),
      },
      tx,
    );
    return project;
  });

  revalidatePath("/projects");
  revalidatePath(`/clients/${values.clientId}`);
  redirect(`/projects/${created.id}`);
}

export async function updateProjectAction(
  projectId: string,
  _prev: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const user = await requireUser();
  const { values, errors, parsed } = parseProjectForm(formData);

  const existing = await prisma.project.findUnique({ where: { id: projectId } });
  if (!existing) return { error: "المشروع غير موجود." };

  if (values.clientId) {
    const client = await prisma.client.findUnique({
      where: { id: values.clientId },
      select: { id: true },
    });
    if (!client) errors.clientId = "العميل غير موجود.";
  }
  if (values.status && !(await validStatuses()).has(values.status)) {
    errors.status = "حالة غير صالحة.";
  }

  if (Object.keys(errors).length > 0) {
    return { fieldErrors: errors, values: values as unknown as Record<string, string> };
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.project.update({
      where: { id: projectId },
      data: {
        clientId: values.clientId,
        name: values.name,
        description: values.description || null,
        status: values.status,
        contractValue: parsed.contractValue,
        discount: parsed.discount,
        startDate: parsed.startDate,
        expectedDeliveryDate: parsed.expectedDeliveryDate,
        notes: values.notes || null,
      },
    });
    await writeAuditLog(
      {
        userId: user.id,
        action: "updated",
        entity: "project",
        entityId: projectId,
        oldValue: snapshot(existing),
        newValue: snapshot(updated),
      },
      tx,
    );
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/clients/${values.clientId}`);
  redirect(`/projects/${projectId}`);
}

export async function changeProjectStatusAction(
  projectId: string,
  status: string,
): Promise<{ error?: string }> {
  const user = await requireUser();

  if (!(await validStatuses()).has(status)) {
    return { error: "حالة غير صالحة." };
  }

  const existing = await prisma.project.findUnique({
    where: { id: projectId },
    select: { status: true, clientId: true },
  });
  if (!existing) return { error: "المشروع غير موجود." };
  if (existing.status === status) return {};

  await prisma.$transaction(async (tx) => {
    await tx.project.update({ where: { id: projectId }, data: { status } });
    await writeAuditLog(
      {
        userId: user.id,
        action: "status_changed",
        entity: "project",
        entityId: projectId,
        oldValue: { status: existing.status },
        newValue: { status },
      },
      tx,
    );
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/clients/${existing.clientId}`);
  return {};
}

export async function deleteProjectAction(
  projectId: string,
): Promise<{ error?: string }> {
  const user = await requireUser();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      files: { select: { storageKey: true } },
      _count: { select: { payments: true, expenses: true, transactions: true } },
    },
  });
  if (!project) return { error: "المشروع غير موجود." };

  // Don't allow deleting a project that already has financial records —
  // payments, expenses or transactions (DB also enforces this via
  // ON DELETE RESTRICT). Project files cascade and don't block.
  const { payments, expenses, transactions } = project._count;
  if (payments + expenses + transactions > 0) {
    return {
      error: `لا يمكن حذف المشروع لوجود سجلات مالية مرتبطة به (${payments} دفعة، ${expenses} مصروف). عالج السجلات أولًا.`,
    };
  }

  // Remove the project's file objects from Storage before the DB cascade
  // wipes their rows, so nothing is left orphaned in the bucket.
  if (project.files.length > 0) {
    const removed = await removeFromStorage(
      project.files.map((file) => file.storageKey),
    );
    if (removed.error) {
      return {
        error: `تعذّر حذف ملفات المشروع من التخزين: ${removed.error.message}`,
      };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.project.delete({ where: { id: projectId } });
      await writeAuditLog(
        {
          userId: user.id,
          action: "deleted",
          entity: "project",
          entityId: projectId,
          oldValue: snapshot(project),
        },
        tx,
      );
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return { error: "لا يمكن حذف المشروع لوجود سجلات مرتبطة به." };
    }
    throw e;
  }

  revalidatePath("/projects");
  revalidatePath(`/clients/${project.clientId}`);
  redirect("/projects");
}
