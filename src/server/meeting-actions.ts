"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import {
  parseMeetingForm,
  MEETING_STATUSES,
  type MeetingStatus,
} from "@/lib/services/meetings";

export interface MeetingActionState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
}

function snapshot(m: {
  title: string;
  description: string | null;
  meetingAt: Date;
  durationMinutes: number | null;
  location: string | null;
  type: string;
  status: string;
  clientId: string | null;
  projectId: string | null;
}) {
  return {
    title: m.title,
    description: m.description,
    meetingAt: m.meetingAt.toISOString(),
    durationMinutes: m.durationMinutes,
    location: m.location,
    type: m.type,
    status: m.status,
    clientId: m.clientId,
    projectId: m.projectId,
  };
}

async function resolveLinks(
  clientId: string,
  projectId: string,
): Promise<{ clientId: string | null; projectId: string | null; error?: string }> {
  let c: string | null = clientId || null;
  const p: string | null = projectId || null;

  if (p) {
    const project = await prisma.project.findUnique({
      where: { id: p },
      select: { id: true, clientId: true },
    });
    if (!project) return { clientId: c, projectId: null, error: "المشروع غير موجود." };
    // a project meeting always belongs to that project's client
    if (c && c !== project.clientId) {
      return { clientId: c, projectId: p, error: "المشروع لا يخص هذا العميل." };
    }
    c = project.clientId;
  } else if (c) {
    const client = await prisma.client.findUnique({
      where: { id: c },
      select: { id: true },
    });
    if (!client) return { clientId: null, projectId: p, error: "العميل غير موجود." };
  }

  return { clientId: c, projectId: p };
}

export async function createMeetingAction(
  _prev: MeetingActionState,
  formData: FormData,
): Promise<MeetingActionState> {
  const user = await requireUser();
  const { values, errors, parsed } = parseMeetingForm(formData);

  if (Object.keys(errors).length > 0) {
    return { fieldErrors: errors, values: values as unknown as Record<string, string> };
  }

  const links = await resolveLinks(values.clientId, values.projectId);
  if (links.error) return { error: links.error };

  const created = await prisma.$transaction(async (tx) => {
    const meeting = await tx.meeting.create({
      data: {
        title: values.title,
        description: values.description || null,
        meetingAt: parsed.meetingAtUtc!,
        durationMinutes: parsed.durationMinutes,
        location: values.location || null,
        type: parsed.type,
        status: parsed.status,
        clientId: links.clientId,
        projectId: links.projectId,
        createdBy: user.id,
      },
    });
    await writeAuditLog(
      {
        userId: user.id,
        action: "created",
        entity: "meeting",
        entityId: meeting.id,
        newValue: snapshot(meeting),
      },
      tx,
    );
    return meeting;
  });

  revalidatePath("/meetings");
  revalidatePath("/calendar");
  if (created.projectId) revalidatePath(`/projects/${created.projectId}`);
  if (created.clientId) revalidatePath(`/clients/${created.clientId}`);
  return { ok: true };
}

export async function updateMeetingAction(
  meetingId: string,
  _prev: MeetingActionState,
  formData: FormData,
): Promise<MeetingActionState> {
  const user = await requireUser();
  const { values, errors, parsed } = parseMeetingForm(formData);

  const existing = await prisma.meeting.findUnique({ where: { id: meetingId } });
  if (!existing) return { error: "الاجتماع غير موجود." };

  if (Object.keys(errors).length > 0) {
    return { fieldErrors: errors, values: values as unknown as Record<string, string> };
  }

  const links = await resolveLinks(values.clientId, values.projectId);
  if (links.error) return { error: links.error };

  await prisma.$transaction(async (tx) => {
    const updated = await tx.meeting.update({
      where: { id: meetingId },
      data: {
        title: values.title,
        description: values.description || null,
        meetingAt: parsed.meetingAtUtc!,
        durationMinutes: parsed.durationMinutes,
        location: values.location || null,
        type: parsed.type,
        status: parsed.status,
        clientId: links.clientId,
        projectId: links.projectId,
      },
    });
    await writeAuditLog(
      {
        userId: user.id,
        action: "updated",
        entity: "meeting",
        entityId: meetingId,
        oldValue: snapshot(existing),
        newValue: snapshot(updated),
      },
      tx,
    );
  });

  revalidatePath("/meetings");
  revalidatePath("/calendar");
  if (links.projectId) revalidatePath(`/projects/${links.projectId}`);
  if (existing.projectId) revalidatePath(`/projects/${existing.projectId}`);
  if (links.clientId) revalidatePath(`/clients/${links.clientId}`);
  return { ok: true };
}

export async function changeMeetingStatusAction(
  meetingId: string,
  status: string,
): Promise<{ error?: string }> {
  const user = await requireUser();
  if (!(MEETING_STATUSES as readonly string[]).includes(status)) {
    return { error: "حالة غير صالحة." };
  }
  const existing = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: { status: true, projectId: true, clientId: true },
  });
  if (!existing) return { error: "الاجتماع غير موجود." };
  if (existing.status === status) return {};

  await prisma.$transaction(async (tx) => {
    await tx.meeting.update({
      where: { id: meetingId },
      data: { status: status as MeetingStatus },
    });
    await writeAuditLog(
      {
        userId: user.id,
        action: "status_changed",
        entity: "meeting",
        entityId: meetingId,
        oldValue: { status: existing.status },
        newValue: { status },
      },
      tx,
    );
  });

  revalidatePath("/meetings");
  revalidatePath("/calendar");
  if (existing.projectId) revalidatePath(`/projects/${existing.projectId}`);
  if (existing.clientId) revalidatePath(`/clients/${existing.clientId}`);
  return {};
}

export async function deleteMeetingAction(
  meetingId: string,
): Promise<{ error?: string }> {
  const user = await requireUser();

  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
  if (!meeting) return { error: "الاجتماع غير موجود." };

  await prisma.$transaction(async (tx) => {
    await tx.meeting.delete({ where: { id: meetingId } });
    await writeAuditLog(
      {
        userId: user.id,
        action: "deleted",
        entity: "meeting",
        entityId: meetingId,
        oldValue: snapshot(meeting),
      },
      tx,
    );
  });

  revalidatePath("/meetings");
  revalidatePath("/calendar");
  if (meeting.projectId) revalidatePath(`/projects/${meeting.projectId}`);
  if (meeting.clientId) revalidatePath(`/clients/${meeting.clientId}`);
  return {};
}
