import "server-only";

import { prisma } from "@/lib/db/prisma";
import { computeAlerts, computeAnnouncementAlerts, type Alert } from "@/lib/services/alerts";

/** Live-computed alerts for `userId`, minus the ones they've dismissed. */
export async function getActiveAlerts(userId: string): Promise<Alert[]> {
  const [projects, meetings, milestoneRows, reminders, announcements, dismissals] = await Promise.all([
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
    prisma.announcement.findMany({
      select: { id: true, title: true, createdAt: true },
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

  const alerts = computeAlerts({ projects, meetings, milestones, reminders, announcements });
  const dismissed = new Set(dismissals.map((d) => d.alertKey));
  return alerts.filter((a) => !dismissed.has(a.key));
}

/**
 * Announcement-only alerts for the employee portal bell — deliberately not
 * the full computeAlerts() above, which pulls every project/meeting/
 * milestone/reminder company-wide with no per-user scoping (fine for
 * admins, who see everything; not fine for an employee).
 */
export async function getEmployeeAnnouncementAlerts(userId: string): Promise<Alert[]> {
  const [announcements, dismissals] = await Promise.all([
    prisma.announcement.findMany({ select: { id: true, title: true, createdAt: true } }),
    prisma.alertDismissal.findMany({ where: { userId }, select: { alertKey: true } }),
  ]);
  const alerts = computeAnnouncementAlerts(announcements, "/employee/announcements");
  const dismissed = new Set(dismissals.map((d) => d.alertKey));
  return alerts.filter((a) => !dismissed.has(a.key));
}
