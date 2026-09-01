import "server-only";

import { prisma } from "@/lib/db/prisma";
import { computeAlerts, type Alert } from "@/lib/services/alerts";

/** Live-computed alerts for `userId`, minus the ones they've dismissed. */
export async function getActiveAlerts(userId: string): Promise<Alert[]> {
  const [projects, meetings, milestoneRows, reminders, dismissals] = await Promise.all([
    prisma.project.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        expectedDeliveryDate: true,
        contractValue: true,
        discount: true,
        payments: { select: { amountEgp: true } },
      },
    }),
    prisma.meeting.findMany({
      where: { status: "scheduled" },
      select: {
        id: true,
        title: true,
        meetingAt: true,
        status: true,
        projectId: true,
        clientId: true,
      },
    }),
    prisma.projectMilestone.findMany({
      where: { completedAt: null },
      select: {
        id: true,
        title: true,
        dueDate: true,
        completedAt: true,
        projectId: true,
        project: { select: { name: true } },
      },
    }),
    prisma.reminder.findMany({
      where: { doneAt: null },
      select: { id: true, title: true, remindAt: true, doneAt: true },
    }),
    prisma.alertDismissal.findMany({
      where: { userId },
      select: { alertKey: true },
    }),
  ]);

  const milestones = milestoneRows.map((m) => ({
    id: m.id,
    title: m.title,
    dueDate: m.dueDate,
    completedAt: m.completedAt,
    projectId: m.projectId,
    projectName: m.project.name,
  }));

  const alerts = computeAlerts({ projects, meetings, milestones, reminders });
  const dismissed = new Set(dismissals.map((d) => d.alertKey));
  return alerts.filter((a) => !dismissed.has(a.key));
}
