"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { serverEnv } from "@/lib/env";
import {
  TARGET_CLIENT_REPORTS_BUCKET,
  buildTargetClientReportKey,
  removeFromStorage,
  uploadToStorage,
  validateCvFile,
} from "@/lib/storage";
import {
  parseTargetClientForm,
  toTargetClientData,
  type TargetClientFormValues,
} from "@/lib/services/target-clients";

export interface TargetClientActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
}

function backWithErrors(
  errors: Partial<Record<keyof TargetClientFormValues, string>>,
  values: TargetClientFormValues,
): TargetClientActionState {
  return {
    fieldErrors: errors as Record<string, string>,
    values: values as unknown as Record<string, string>,
  };
}

function snapshot(t: { companyName: string; website: string | null; companySize: string | null; status: string }) {
  return {
    companyName: t.companyName,
    website: t.website,
    companySize: t.companySize,
    status: t.status,
  };
}

export async function createTargetClientAction(
  _prev: TargetClientActionState,
  formData: FormData,
): Promise<TargetClientActionState> {
  const user = await requireUser();
  const { values, errors, parsed } = parseTargetClientForm(formData);
  if (Object.keys(errors).length > 0) return backWithErrors(errors, values);

  let targetClient;
  try {
    targetClient = await prisma.$transaction(async (tx) => {
      const created = await tx.targetClient.create({
        data: { ...toTargetClientData(values, parsed), createdBy: user.id },
      });
      await writeAuditLog(
        {
          userId: user.id,
          action: "created",
          entity: "target_client",
          entityId: created.id,
          newValue: snapshot(created),
        },
        tx,
      );
      return created;
    });
  } catch (e) {
    return {
      error: `تعذّر حفظ العميل المستهدف: ${e instanceof Error ? e.message : "خطأ غير معروف"}`,
    };
  }

  revalidatePath("/target-clients");
  redirect(`/target-clients/${targetClient.id}`);
}

export async function updateTargetClientAction(
  targetClientId: string,
  _prev: TargetClientActionState,
  formData: FormData,
): Promise<TargetClientActionState> {
  const user = await requireUser();
  const { values, errors, parsed } = parseTargetClientForm(formData);
  if (Object.keys(errors).length > 0) return backWithErrors(errors, values);

  const existing = await prisma.targetClient.findUnique({ where: { id: targetClientId } });
  if (!existing) return { error: "العميل المستهدف غير موجود." };

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.targetClient.update({
        where: { id: targetClientId },
        data: toTargetClientData(values, parsed),
      });
      await writeAuditLog(
        {
          userId: user.id,
          action: "updated",
          entity: "target_client",
          entityId: targetClientId,
          oldValue: snapshot(existing),
          newValue: snapshot(updated),
        },
        tx,
      );
    });
  } catch (e) {
    return {
      error: `تعذّر تحديث العميل المستهدف: ${e instanceof Error ? e.message : "خطأ غير معروف"}`,
    };
  }

  revalidatePath("/target-clients");
  revalidatePath(`/target-clients/${targetClientId}`);
  redirect(`/target-clients/${targetClientId}`);
}

export async function deleteTargetClientAction(
  targetClientId: string,
): Promise<{ error?: string }> {
  const user = await requireUser();

  const existing = await prisma.targetClient.findUnique({ where: { id: targetClientId } });
  if (!existing) return { error: "العميل المستهدف غير موجود." };

  await prisma.$transaction(async (tx) => {
    await tx.targetClient.delete({ where: { id: targetClientId } });
    await writeAuditLog(
      {
        userId: user.id,
        action: "deleted",
        entity: "target_client",
        entityId: targetClientId,
        oldValue: snapshot(existing),
      },
      tx,
    );
  });

  revalidatePath("/target-clients");
  redirect("/target-clients");
}

/** Admin-only. Hides/unhides a lead from the employee pool without changing its status. */
export async function setTargetClientHiddenAction(
  targetClientId: string,
  hidden: boolean,
): Promise<{ error?: string }> {
  const user = await requireUser();

  const existing = await prisma.targetClient.findUnique({ where: { id: targetClientId } });
  if (!existing) return { error: "العميل المستهدف غير موجود." };
  if (existing.hidden === hidden) return {};

  await prisma.$transaction(async (tx) => {
    await tx.targetClient.update({ where: { id: targetClientId }, data: { hidden } });
    await writeAuditLog(
      {
        userId: user.id,
        action: "updated",
        entity: "target_client",
        entityId: targetClientId,
        oldValue: { hidden: existing.hidden },
        newValue: { hidden },
      },
      tx,
    );
  });

  revalidatePath(`/target-clients/${targetClientId}`);
  revalidatePath("/target-clients");
  return {};
}

/** Admin-only. Deactivates a lead (out of the pool entirely, kept for history). */
export async function setTargetClientInactiveAction(
  targetClientId: string,
): Promise<{ error?: string }> {
  const user = await requireUser();

  const existing = await prisma.targetClient.findUnique({ where: { id: targetClientId } });
  if (!existing) return { error: "العميل المستهدف غير موجود." };
  if (existing.status === "inactive") return {};

  await prisma.$transaction(async (tx) => {
    await tx.targetClient.update({
      where: { id: targetClientId },
      data: { status: "inactive", closedAt: new Date() },
    });
    await writeAuditLog(
      {
        userId: user.id,
        action: "status_changed",
        entity: "target_client",
        entityId: targetClientId,
        oldValue: { status: existing.status },
        newValue: { status: "inactive" },
      },
      tx,
    );
  });

  revalidatePath(`/target-clients/${targetClientId}`);
  revalidatePath("/target-clients");
  return {};
}

/**
 * Admin-only. The ONLY way a claimed/won/lost lead re-enters the available
 * pool (decision, 2026-09-11): a lost deal does NOT auto-return — it stays
 * claimed and visibly marked lost until an admin explicitly frees it here.
 */
export async function unassignTargetClientAction(
  targetClientId: string,
): Promise<{ error?: string }> {
  const user = await requireUser();

  const existing = await prisma.targetClient.findUnique({ where: { id: targetClientId } });
  if (!existing) return { error: "العميل المستهدف غير موجود." };
  if (!existing.claimedById && existing.status === "available") return {};

  await prisma.$transaction(async (tx) => {
    await tx.targetClient.update({
      where: { id: targetClientId },
      data: { claimedById: null, claimedAt: null, closedAt: null, status: "available" },
    });
    await writeAuditLog(
      {
        userId: user.id,
        action: "updated",
        entity: "target_client",
        entityId: targetClientId,
        oldValue: { claimedById: existing.claimedById, status: existing.status },
        newValue: { claimedById: null, status: "available" },
      },
      tx,
    );
  });

  revalidatePath(`/target-clients/${targetClientId}`);
  revalidatePath("/target-clients");
  return {};
}

// ────────────────────── Employee-facing actions (used by the portal, Phase 5.6) ──────────────────────
// Built now so the data model + rules are exercised end-to-end (verified via
// script), even though no employee-portal UI calls them yet.

/** An employee claims an available lead to work it. */
export async function claimTargetClientAction(
  targetClientId: string,
): Promise<{ error?: string }> {
  const user = await requireUser();

  const employee = await prisma.employee.findUnique({ where: { userId: user.id } });
  if (!employee) return { error: "الحساب غير مربوط بملف موظف." };

  const target = await prisma.targetClient.findUnique({ where: { id: targetClientId } });
  if (!target) return { error: "العميل المستهدف غير موجود." };
  if (target.hidden) return { error: "هذا العميل غير متاح." };
  if (target.status !== "available") return { error: "هذا العميل مش متاح حاليًا." };

  await prisma.$transaction(async (tx) => {
    await tx.targetClient.update({
      where: { id: targetClientId },
      data: { claimedById: employee.id, claimedAt: new Date(), status: "claimed" },
    });
    await writeAuditLog(
      {
        userId: user.id,
        action: "updated",
        entity: "target_client",
        entityId: targetClientId,
        newValue: { claimedById: employee.id, status: "claimed" },
      },
      tx,
    );
  });

  revalidatePath(`/target-clients/${targetClientId}`);
  return {};
}

/**
 * An employee marks the outcome of a lead they claimed. A "lost" result does
 * NOT free the lead back to the pool — see unassignTargetClientAction.
 */
export async function markTargetClientResultAction(
  targetClientId: string,
  result: "won" | "lost",
): Promise<{ error?: string }> {
  const user = await requireUser();

  const employee = await prisma.employee.findUnique({ where: { userId: user.id } });
  if (!employee) return { error: "الحساب غير مربوط بملف موظف." };

  const target = await prisma.targetClient.findUnique({ where: { id: targetClientId } });
  if (!target) return { error: "العميل المستهدف غير موجود." };
  if (target.claimedById !== employee.id) return { error: "هذا العميل مش شغال عليه إنت." };
  if (target.status !== "claimed") return { error: "العميل ده متقفلش عليه شغل حاليًا." };

  await prisma.$transaction(async (tx) => {
    await tx.targetClient.update({
      where: { id: targetClientId },
      data: { status: result, closedAt: new Date() },
    });
    await writeAuditLog(
      {
        userId: user.id,
        action: "status_changed",
        entity: "target_client",
        entityId: targetClientId,
        oldValue: { status: "claimed" },
        newValue: { status: result },
      },
      tx,
    );
  });

  revalidatePath(`/target-clients/${targetClientId}`);
  return {};
}

// ─────────────────────── Activity timeline (notes / reports) ───────────────────────

export interface ActivityActionState {
  error?: string;
}

/**
 * Adds a note or a report (optional file attachment) to a lead's timeline.
 * Any admin may post on any lead; an employee may only post on a lead they
 * currently have claimed.
 */
export async function addTargetClientActivityAction(
  targetClientId: string,
  _prev: ActivityActionState,
  formData: FormData,
): Promise<ActivityActionState> {
  const user = await requireUser();

  const target = await prisma.targetClient.findUnique({ where: { id: targetClientId } });
  if (!target) return { error: "العميل المستهدف غير موجود." };

  let employeeId: string | null = null;
  if (user.role === "employee") {
    const employee = await prisma.employee.findUnique({ where: { userId: user.id } });
    if (!employee || target.claimedById !== employee.id) {
      return { error: "تقدر تضيف نشاط بس على عميل شغال عليه إنت." };
    }
    employeeId = employee.id;
  }

  const kind = formData.get("kind") === "report" ? "report" : "note";
  const body = String(formData.get("body") ?? "").trim();
  const file = formData.get("file");

  let fileKey: string | null = null;
  let fileName: string | null = null;
  if (file instanceof File && file.size > 0) {
    const buffer = await file.arrayBuffer();
    const head = new Uint8Array(buffer.slice(0, 8));
    const check = validateCvFile(file.name, file.type, file.size, head, serverEnv.maxProjectFileSize);
    if (!check.ok) return { error: check.error! };

    fileKey = buildTargetClientReportKey(targetClientId, file.name);
    const upload = await uploadToStorage(fileKey, buffer, file.type, TARGET_CLIENT_REPORTS_BUCKET);
    if (upload.error) return { error: `تعذّر رفع الملف: ${upload.error.message}` };
    fileName = file.name;
  }

  if (!body && !fileKey) return { error: "اكتب ملاحظة أو ارفع ملفًا." };

  await prisma.$transaction(async (tx) => {
    await tx.targetClientActivity.create({
      data: {
        targetClientId,
        employeeId,
        kind,
        body: body || null,
        fileStorageKey: fileKey,
        fileName,
      },
    });
    await writeAuditLog(
      {
        userId: user.id,
        action: "created",
        entity: "target_client_activity",
        entityId: targetClientId,
        newValue: { kind, hasFile: !!fileKey },
      },
      tx,
    );
  }).catch(async (e) => {
    if (fileKey) await removeFromStorage(fileKey, TARGET_CLIENT_REPORTS_BUCKET).catch(() => {});
    throw e;
  });

  revalidatePath(`/target-clients/${targetClientId}`);
  return {};
}

/** Admin-only. */
export async function deleteTargetClientActivityAction(
  activityId: string,
): Promise<{ error?: string }> {
  const user = await requireUser();

  const activity = await prisma.targetClientActivity.findUnique({ where: { id: activityId } });
  if (!activity) return { error: "النشاط غير موجود." };

  await prisma.$transaction(async (tx) => {
    await tx.targetClientActivity.delete({ where: { id: activityId } });
    await writeAuditLog(
      {
        userId: user.id,
        action: "deleted",
        entity: "target_client_activity",
        entityId: activity.targetClientId,
        oldValue: { kind: activity.kind, fileName: activity.fileName },
      },
      tx,
    );
  });

  if (activity.fileStorageKey) {
    await removeFromStorage(activity.fileStorageKey, TARGET_CLIENT_REPORTS_BUCKET).catch(() => {});
  }

  revalidatePath(`/target-clients/${activity.targetClientId}`);
  return {};
}
