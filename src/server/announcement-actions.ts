"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { parseAnnouncementForm } from "@/lib/services/announcements";

export interface AnnouncementActionState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
}

export async function createAnnouncementAction(
  _prev: AnnouncementActionState,
  formData: FormData,
): Promise<AnnouncementActionState> {
  const user = await requireAdmin();
  const { values, errors, parsed } = parseAnnouncementForm(formData);

  if (Object.keys(errors).length > 0) {
    return { fieldErrors: errors, values: values as unknown as Record<string, string> };
  }

  await prisma.$transaction(async (tx) => {
    const created = await tx.announcement.create({
      data: {
        title: values.title,
        body: values.body || null,
        meetingAt: parsed.meetingAtUtc,
        createdBy: user.id,
      },
    });
    await writeAuditLog(
      {
        userId: user.id,
        action: "created",
        entity: "announcement",
        entityId: created.id,
        newValue: { title: created.title, meetingAt: created.meetingAt?.toISOString() ?? null },
      },
      tx,
    );
    return created;
  });

  revalidatePath("/announcements");
  revalidatePath("/employee/announcements");
  revalidatePath("/calendar");
  return { ok: true, values: {} };
}

export async function deleteAnnouncementAction(
  announcementId: string,
): Promise<{ error?: string }> {
  const user = await requireAdmin();

  const existing = await prisma.announcement.findUnique({ where: { id: announcementId } });
  if (!existing) return { error: "الإعلان غير موجود." };

  await prisma.$transaction(async (tx) => {
    await tx.announcement.delete({ where: { id: announcementId } });
    await writeAuditLog(
      {
        userId: user.id,
        action: "deleted",
        entity: "announcement",
        entityId: announcementId,
        oldValue: { title: existing.title },
      },
      tx,
    );
  });

  revalidatePath("/announcements");
  revalidatePath("/employee/announcements");
  revalidatePath("/calendar");
  return {};
}
