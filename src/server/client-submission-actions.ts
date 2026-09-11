"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireUser, requireAdmin } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { parseClientForm } from "@/lib/services/clients";

export interface ClientSubmissionActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
  success?: string;
}

/** An employee proposes a new (real) client — not a target-client/lead. */
export async function createClientSubmissionAction(
  _prev: ClientSubmissionActionState,
  formData: FormData,
): Promise<ClientSubmissionActionState> {
  const user = await requireUser();
  const employee = await prisma.employee.findUnique({ where: { userId: user.id } });
  if (!employee) return { error: "الحساب غير مربوط بملف موظف." };

  const { values, errors } = parseClientForm(formData);
  if (Object.keys(errors).length > 0) {
    return { fieldErrors: errors, values: values as unknown as Record<string, string> };
  }

  await prisma.$transaction(async (tx) => {
    const submission = await tx.clientSubmission.create({
      data: {
        name: values.name,
        companyName: values.companyName || null,
        phone: values.phone || null,
        email: values.email || null,
        address: values.address || null,
        notes: values.notes || null,
        submittedById: employee.id,
      },
    });
    await writeAuditLog(
      {
        userId: user.id,
        action: "created",
        entity: "client_submission",
        entityId: submission.id,
        newValue: { name: submission.name },
      },
      tx,
    );
  });

  revalidatePath("/employee/clients");
  revalidatePath("/clients");
  return { success: "تم إرسال طلب العميل الجديد — في انتظار موافقة الأدمن." };
}

/** Admin-only. Approves a submission: creates the real Client from it. */
export async function approveClientSubmissionAction(
  submissionId: string,
): Promise<{ error?: string }> {
  const admin = await requireAdmin();

  const submission = await prisma.clientSubmission.findUnique({ where: { id: submissionId } });
  if (!submission) return { error: "الطلب غير موجود." };
  if (submission.status !== "pending") return { error: "تم التعامل مع هذا الطلب بالفعل." };

  await prisma.$transaction(async (tx) => {
    const client = await tx.client.create({
      data: {
        name: submission.name,
        companyName: submission.companyName,
        phone: submission.phone,
        email: submission.email,
        address: submission.address,
        notes: submission.notes,
        status: "active",
        createdBy: admin.id,
      },
    });
    await tx.clientSubmission.update({
      where: { id: submissionId },
      data: {
        status: "approved",
        reviewedById: admin.id,
        reviewedAt: new Date(),
        resultingClientId: client.id,
      },
    });
    await writeAuditLog(
      {
        userId: admin.id,
        action: "created",
        entity: "client",
        entityId: client.id,
        newValue: { name: client.name, fromSubmission: submissionId },
      },
      tx,
    );
    await writeAuditLog(
      {
        userId: admin.id,
        action: "status_changed",
        entity: "client_submission",
        entityId: submissionId,
        newValue: { status: "approved", resultingClientId: client.id },
      },
      tx,
    );
  });

  revalidatePath("/clients");
  revalidatePath("/employee/clients");
  return {};
}

/** Admin-only. Rejects a submission — no Client is ever created. */
export async function rejectClientSubmissionAction(
  submissionId: string,
  reason: string,
): Promise<{ error?: string }> {
  const admin = await requireAdmin();

  const submission = await prisma.clientSubmission.findUnique({ where: { id: submissionId } });
  if (!submission) return { error: "الطلب غير موجود." };
  if (submission.status !== "pending") return { error: "تم التعامل مع هذا الطلب بالفعل." };

  await prisma.$transaction(async (tx) => {
    await tx.clientSubmission.update({
      where: { id: submissionId },
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
        entity: "client_submission",
        entityId: submissionId,
        newValue: { status: "rejected", reason: reason || null },
      },
      tx,
    );
  });

  revalidatePath("/clients");
  revalidatePath("/employee/clients");
  return {};
}
