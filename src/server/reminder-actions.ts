"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { parseReminderForm } from "@/lib/services/reminders";

export interface ReminderActionState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
}

function snapshot(r: {
  title: string;
  note: string | null;
  remindAt: Date;
  doneAt: Date | null;
  clientId: string | null;
  projectId: string | null;
  meetingId: string | null;
}) {
  return {
    title: r.title,
    note: r.note,
    remindAt: r.remindAt.toISOString(),
    doneAt: r.doneAt?.toISOString() ?? null,
    clientId: r.clientId,
    projectId: r.projectId,
    meetingId: r.meetingId,
  };
}

export async function createReminderAction(
  _prev: ReminderActionState,
  formData: FormData,
): Promise<ReminderActionState> {
  const user = await requireUser();
  const { values, errors, parsed } = parseReminderForm(formData);

  if (Object.keys(errors).length > 0) {
    return { fieldErrors: errors, values: values as unknown as Record<string, string> };
  }

  await prisma.$transaction(async (tx) => {
    const reminder = await tx.reminder.create({
      data: {
        title: values.title,
        note: values.note || null,
        remindAt: parsed.remindAtUtc!,
        clientId: values.clientId || null,
        projectId: values.projectId || null,
        meetingId: values.meetingId || null,
        createdBy: user.id,
      },
    });
    await writeAuditLog(
      {
        userId: user.id,
        action: "created",
        entity: "reminder",
        entityId: reminder.id,
        newValue: snapshot(reminder),
      },
      tx,
    );
  });

  revalidatePath("/reminders");
  revalidatePath("/calendar");
  return { ok: true };
}

export async function toggleReminderDoneAction(
  reminderId: string,
): Promise<{ error?: string }> {
  const user = await requireUser();

  const existing = await prisma.reminder.findUnique({ where: { id: reminderId } });
  if (!existing) return { error: "التذكير غير موجود." };

  const nextDoneAt = existing.doneAt ? null : new Date();

  await prisma.$transaction(async (tx) => {
    await tx.reminder.update({
      where: { id: reminderId },
      data: { doneAt: nextDoneAt },
    });
    await writeAuditLog(
      {
        userId: user.id,
        action: "status_changed",
        entity: "reminder",
        entityId: reminderId,
        oldValue: { doneAt: existing.doneAt?.toISOString() ?? null },
        newValue: { doneAt: nextDoneAt?.toISOString() ?? null },
      },
      tx,
    );
  });

  revalidatePath("/reminders");
  revalidatePath("/calendar");
  return {};
}

export async function snoozeReminderAction(
  reminderId: string,
  hours: number,
): Promise<{ error?: string }> {
  const user = await requireUser();

  if (!Number.isFinite(hours) || hours <= 0 || hours > 24 * 30) {
    return { error: "مدة تأجيل غير صالحة." };
  }

  const existing = await prisma.reminder.findUnique({ where: { id: reminderId } });
  if (!existing) return { error: "التذكير غير موجود." };

  const base = existing.remindAt.getTime() > Date.now() ? existing.remindAt.getTime() : Date.now();
  const nextRemindAt = new Date(base + hours * 60 * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    await tx.reminder.update({
      where: { id: reminderId },
      data: { remindAt: nextRemindAt, doneAt: null },
    });
    await writeAuditLog(
      {
        userId: user.id,
        action: "updated",
        entity: "reminder",
        entityId: reminderId,
        oldValue: { remindAt: existing.remindAt.toISOString() },
        newValue: { remindAt: nextRemindAt.toISOString(), snoozedHours: hours },
      },
      tx,
    );
  });

  revalidatePath("/reminders");
  revalidatePath("/calendar");
  return {};
}

export async function deleteReminderAction(
  reminderId: string,
): Promise<{ error?: string }> {
  const user = await requireUser();

  const existing = await prisma.reminder.findUnique({ where: { id: reminderId } });
  if (!existing) return { error: "التذكير غير موجود." };

  await prisma.$transaction(async (tx) => {
    await tx.reminder.delete({ where: { id: reminderId } });
    await writeAuditLog(
      {
        userId: user.id,
        action: "deleted",
        entity: "reminder",
        entityId: reminderId,
        oldValue: snapshot(existing),
      },
      tx,
    );
  });

  revalidatePath("/reminders");
  revalidatePath("/calendar");
  return {};
}
