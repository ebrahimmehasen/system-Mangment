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
}): Alert[] {
  const now = input.now ?? new Date();
  const alerts: Alert[] = [];

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
