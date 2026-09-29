import { Prisma } from "@prisma/client";
import { sum } from "@/lib/money";

export type AlertSeverity = "danger" | "warning" | "info";

export interface Alert {
  key: string;
  severity: AlertSeverity;
  title: string;
  href: string;
  at: Date; // the date the alert is "about", for sorting
}

const DONE_STATUSES = ["Completed", "Delivered"];
const NOT_ACTIONABLE = [...DONE_STATUSES, "Cancelled"];

const DELIVERY_SOON_DAYS = 3;
const MILESTONE_SOON_DAYS = 2;
const MEETING_SOON_HOURS = 24;
const TASK_SOON_DAYS = 2;

export function computeAlerts(input: {
  now?: Date;
  projects: {
    id: string;
    name: string;
    status: string;
    expectedDeliveryDate: Date | null;
    contractValue: Prisma.Decimal;
    discount: Prisma.Decimal;
    payments: { amountEgp: Prisma.Decimal }[];
  }[];
  meetings: {
    id: string;
    title: string;
    meetingAt: Date;
    status: string;
    projectId: string | null;
    clientId: string | null;
  }[];
  milestones: {
    id: string;
    title: string;
    dueDate: Date | null;
    completedAt: Date | null;
    projectId: string;
    projectName: string;
  }[];
  reminders: {
    id: string;
    title: string;
    remindAt: Date;
    doneAt: Date | null;
  }[];
  announcements?: { id: string; title: string; createdAt: Date }[];
  tasks?: { id: string; title: string; dueDate: Date | null; status: string }[];
}): Alert[] {
  const now = input.now ?? new Date();
  const alerts: Alert[] = [
    ...computeAnnouncementAlerts(input.announcements ?? [], "/announcements"),
    ...computeTaskAlerts(input.tasks ?? [], "/tasks", now),
  ];

  const deliverySoonCutoff = new Date(now.getTime() + DELIVERY_SOON_DAYS * 86400000);
  const milestoneSoonCutoff = new Date(now.getTime() + MILESTONE_SOON_DAYS * 86400000);
  const meetingSoonCutoff = new Date(now.getTime() + MEETING_SOON_HOURS * 3600000);

  for (const p of input.projects) {
    if (p.expectedDeliveryDate && !NOT_ACTIONABLE.includes(p.status)) {
      if (p.expectedDeliveryDate.getTime() < now.getTime()) {
        alerts.push({
          key: `delivery-overdue:${p.id}`,
          severity: "danger",
          title: `تسليم مشروع "${p.name}" متأخر`,
          href: `/projects/${p.id}`,
          at: p.expectedDeliveryDate,
        });
      } else if (p.expectedDeliveryDate.getTime() <= deliverySoonCutoff.getTime()) {
        alerts.push({
          key: `delivery-soon:${p.id}`,
          severity: "warning",
          title: `تسليم مشروع "${p.name}" خلال ${DELIVERY_SOON_DAYS} أيام`,
          href: `/projects/${p.id}`,
          at: p.expectedDeliveryDate,
        });
      }
    }

    if (DONE_STATUSES.includes(p.status)) {
      const final = new Prisma.Decimal(p.contractValue).minus(p.discount);
      const paid = sum(p.payments.map((x) => x.amountEgp));
      const remaining = final.minus(paid);
      if (remaining.greaterThan(0)) {
        alerts.push({
          key: `balance-due:${p.id}`,
          severity: "warning",
          title: `مشروع "${p.name}" مكتمل وعليه مستحقات`,
          href: `/projects/${p.id}`,
          at: now,
        });
      }
    }
  }

  for (const m of input.meetings) {
    if (m.status !== "scheduled") continue;
    if (m.meetingAt.getTime() >= now.getTime() && m.meetingAt.getTime() <= meetingSoonCutoff.getTime()) {
      alerts.push({
        key: `meeting-soon:${m.id}`,
        severity: "info",
        title: `اجتماع "${m.title}" خلال 24 ساعة`,
        href: m.projectId
          ? `/projects/${m.projectId}`
          : m.clientId
            ? `/clients/${m.clientId}`
            : "/meetings",
        at: m.meetingAt,
      });
    }
  }

  for (const ms of input.milestones) {
    if (ms.completedAt || !ms.dueDate) continue;
    if (ms.dueDate.getTime() < now.getTime()) {
      alerts.push({
        key: `milestone-overdue:${ms.id}`,
        severity: "danger",
        title: `مرحلة "${ms.title}" (${ms.projectName}) متأخرة`,
        href: `/projects/${ms.projectId}`,
        at: ms.dueDate,
      });
    } else if (ms.dueDate.getTime() <= milestoneSoonCutoff.getTime()) {
      alerts.push({
        key: `milestone-soon:${ms.id}`,
        severity: "warning",
        title: `مرحلة "${ms.title}" (${ms.projectName}) مستحقة خلال ${MILESTONE_SOON_DAYS} يومين`,
        href: `/projects/${ms.projectId}`,
        at: ms.dueDate,
      });
    }
  }

  for (const r of input.reminders) {
    if (r.doneAt) continue;
    if (r.remindAt.getTime() <= now.getTime()) {
      alerts.push({
        key: `reminder-due:${r.id}`,
        severity: "info",
        title: `تذكير: ${r.title}`,
        href: "/reminders",
        at: r.remindAt,
      });
    }
  }

  return alerts.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/**
 * Announcement alerts, standalone from computeAlerts() — used both inside it
 * (for the admin bell, href "/announcements") and on its own for the
 * employee bell (href "/employee/announcements"). Kept separate so an
 * employee's bell never has to go through the project/meeting/milestone/
 * reminder computation above, which isn't scoped to "theirs only".
 */
/**
 * Task due-soon/overdue alerts, standalone like computeAnnouncementAlerts —
 * folded into computeAlerts() for the admin bell (href "/tasks", company-
 * wide) and used on its own, pre-scoped to "assigned to me", for the
 * employee bell.
 */
export function computeTaskAlerts(
  tasks: { id: string; title: string; dueDate: Date | null; status: string }[],
  href: string,
  now: Date = new Date(),
): Alert[] {
  const soonCutoff = new Date(now.getTime() + TASK_SOON_DAYS * 86400000);
  const alerts: Alert[] = [];
  for (const t of tasks) {
    if (t.status === "done" || !t.dueDate) continue;
    if (t.dueDate.getTime() < now.getTime()) {
      alerts.push({
        key: `task-overdue:${t.id}`,
        severity: "danger",
        title: `مهمة "${t.title}" متأخرة`,
        href,
        at: t.dueDate,
      });
    } else if (t.dueDate.getTime() <= soonCutoff.getTime()) {
      alerts.push({
        key: `task-soon:${t.id}`,
        severity: "warning",
        title: `مهمة "${t.title}" مستحقة خلال ${TASK_SOON_DAYS} يومين`,
        href,
        at: t.dueDate,
      });
    }
  }
  return alerts;
}

export function computeAnnouncementAlerts(
  announcements: { id: string; title: string; createdAt: Date }[],
  href: string,
): Alert[] {
  return announcements
    .map((a) => ({
      key: `announcement:${a.id}`,
      severity: "info" as AlertSeverity,
      title: `إعلان: ${a.title}`,
      href,
      at: a.createdAt,
    }))
    .sort((a, b) => b.at.getTime() - a.at.getTime());
}
