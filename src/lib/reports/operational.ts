import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { sum, formatEgp } from "@/lib/money";
import { ymdInTz } from "@/lib/datetime";
import { resolveDateRange, dateWhere, type DateRange } from "@/lib/services/reports";
import { actionLabel } from "@/lib/audit-labels";
import { MEETING_STATUS_LABELS, MEETING_TYPE_LABELS } from "@/lib/services/meetings";
import type { ReportTable } from "./tables";

const D0 = () => new Prisma.Decimal(0);

export interface OperationalParams {
  range?: string;
  from?: string;
  to?: string;
}

// ─────────────────── Project status ───────────────────

export interface StatusRow {
  status: string;
  count: number;
  finalValue: string;
  paid: string;
  remaining: string;
}

export interface ProjectStatusReport {
  rows: StatusRow[];
  total: { count: number; finalValue: string; paid: string; remaining: string };
  health: {
    overdueByDelivery: number;
    withOverdueMilestones: number;
    milestonesDone: number;
    milestonesTotal: number;
  };
}

// ─────────────────── Meetings ───────────────────

export interface MeetingBreakdownRow {
  name: string;
  scheduled: number;
  done: number;
  cancelled: number;
  total: number;
}

export interface MeetingsReport {
  byStatus: { scheduled: number; done: number; cancelled: number; total: number };
  byType: { call: number; onsite: number; online: number };
  byClient: MeetingBreakdownRow[];
  byProject: MeetingBreakdownRow[];
}

// ─────────────────── Milestone completion ───────────────────

export interface MilestoneProjectRow {
  projectName: string;
  clientName: string;
  completed: number;
  onTime: number;
  late: number;
  openOverdue: number;
}

export interface MilestoneReport {
  totals: {
    completed: number;
    onTime: number;
    late: number;
    openOverdue: number;
    onTimeRate: number | null;
  };
  rows: MilestoneProjectRow[];
}

// ─────────────────── User activity ───────────────────

export interface UserActivityRow {
  userName: string;
  total: number;
  created: number;
  updated: number;
  deleted: number;
  statusChanged: number;
  other: number;
}

export interface UserActivityReport {
  rows: UserActivityRow[];
  total: number;
}

export interface OperationalReports {
  range: DateRange;
  projectStatus: ProjectStatusReport;
  meetings: MeetingsReport;
  milestones: MilestoneReport;
  userActivity: UserActivityReport;
}

// ─────────────────────────── Main ───────────────────────────

/**
 * The four operational reports (نقطة 3.4):
 *  - project status (snapshot: count + value per status, timeline health)
 *  - meetings (respects the date filter, on meeting time)
 *  - milestone completion (completions within the filter + open-overdue snapshot)
 *  - user activity (respects the date filter, from audit_logs)
 */
export async function getOperationalReports(
  sp: OperationalParams,
): Promise<OperationalReports> {
  const range = resolveDateRange(sp);
  const dw = dateWhere(range);

  const [projects, milestones, meetings, activityGroups, users] = await Promise.all([
    prisma.project.findMany({
      select: {
        id: true,
        status: true,
        contractValue: true,
        discount: true,
        expectedDeliveryDate: true,
        actualDeliveryDate: true,
        payments: { select: { amountEgp: true } },
      },
    }),
    prisma.projectMilestone.findMany({
      select: {
        dueDate: true,
        completedAt: true,
        projectId: true,
        project: { select: { name: true, client: { select: { name: true } } } },
      },
    }),
    prisma.meeting.findMany({
      where: dw ? { meetingAt: dw } : {},
      select: {
        status: true,
        type: true,
        client: { select: { name: true } },
        project: { select: { name: true } },
      },
    }),
    prisma.auditLog.groupBy({
      by: ["userId", "action"],
      where: dw ? { createdAt: dw } : {},
      _count: { _all: true },
    }),
    prisma.user.findMany({ select: { id: true, name: true, email: true } }),
  ]);

  return {
    range,
    projectStatus: buildProjectStatus(projects, milestones),
    meetings: buildMeetings(meetings),
    milestones: buildMilestones(milestones, dw),
    userActivity: buildUserActivity(activityGroups, users),
  };
}

// ─────────────────────────── Builders ───────────────────────────

type StatusProject = {
  id: string;
  status: string;
  contractValue: Prisma.Decimal;
  discount: Prisma.Decimal;
  expectedDeliveryDate: Date | null;
  actualDeliveryDate: Date | null;
  payments: { amountEgp: Prisma.Decimal }[];
};

type MilestoneLite = {
  dueDate: Date | null;
  completedAt: Date | null;
  projectId: string;
  project: { name: string; client: { name: string } };
};

const DONE_STATUSES = new Set(["Completed", "Delivered"]);

function buildProjectStatus(
  projects: StatusProject[],
  milestones: MilestoneLite[],
): ProjectStatusReport {
  const now = new Date();

  const byStatus = new Map<
    string,
    { count: number; final: Prisma.Decimal; paid: Prisma.Decimal }
  >();
  for (const p of projects) {
    const final = new Prisma.Decimal(p.contractValue).minus(p.discount);
    const paid = sum(p.payments.map((x) => x.amountEgp));
    const e = byStatus.get(p.status) ?? { count: 0, final: D0(), paid: D0() };
    e.count += 1;
    e.final = e.final.plus(final);
    e.paid = e.paid.plus(paid);
    byStatus.set(p.status, e);
  }

  const rows: StatusRow[] = [...byStatus.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([status, e]) => ({
      status,
      count: e.count,
      finalValue: e.final.toFixed(2),
      paid: e.paid.toFixed(2),
      remaining: e.final.minus(e.paid).toFixed(2),
    }));

  const totalFinal = sum(rows.map((r) => r.finalValue));
  const totalPaid = sum(rows.map((r) => r.paid));

  const overdueByDelivery = projects.filter(
    (p) =>
      !DONE_STATUSES.has(p.status) &&
      p.status !== "Cancelled" &&
      p.expectedDeliveryDate != null &&
      p.expectedDeliveryDate.getTime() < now.getTime(),
  ).length;

  const overdueMsProjects = new Set<string>();
  let milestonesDone = 0;
  for (const m of milestones) {
    if (m.completedAt) milestonesDone += 1;
    else if (m.dueDate && m.dueDate.getTime() < now.getTime()) {
      overdueMsProjects.add(m.projectId);
    }
  }

  return {
    rows,
    total: {
      count: projects.length,
      finalValue: totalFinal.toFixed(2),
      paid: totalPaid.toFixed(2),
      remaining: totalFinal.minus(totalPaid).toFixed(2),
    },
    health: {
      overdueByDelivery,
      withOverdueMilestones: overdueMsProjects.size,
      milestonesDone,
      milestonesTotal: milestones.length,
    },
  };
}

function buildMeetings(
  meetings: {
    status: string;
    type: string;
    client: { name: string } | null;
    project: { name: string } | null;
  }[],
): MeetingsReport {
  const byStatus = { scheduled: 0, done: 0, cancelled: 0, total: 0 };
  const byType = { call: 0, onsite: 0, online: 0 };
  const clientMap = new Map<string, MeetingBreakdownRow>();
  const projectMap = new Map<string, MeetingBreakdownRow>();

  const bump = (map: Map<string, MeetingBreakdownRow>, name: string, status: string) => {
    const row =
      map.get(name) ?? { name, scheduled: 0, done: 0, cancelled: 0, total: 0 };
    if (status === "scheduled") row.scheduled += 1;
    else if (status === "done") row.done += 1;
    else if (status === "cancelled") row.cancelled += 1;
    row.total += 1;
    map.set(name, row);
  };

  for (const m of meetings) {
    if (m.status === "scheduled") byStatus.scheduled += 1;
    else if (m.status === "done") byStatus.done += 1;
    else if (m.status === "cancelled") byStatus.cancelled += 1;
    byStatus.total += 1;

    if (m.type === "call") byType.call += 1;
    else if (m.type === "onsite") byType.onsite += 1;
    else if (m.type === "online") byType.online += 1;

    bump(clientMap, m.client?.name ?? "— بدون عميل —", m.status);
    bump(projectMap, m.project?.name ?? "— بدون مشروع —", m.status);
  }

  const byCount = (a: MeetingBreakdownRow, b: MeetingBreakdownRow) => b.total - a.total;

  return {
    byStatus,
    byType,
    byClient: [...clientMap.values()].sort(byCount),
    byProject: [...projectMap.values()].sort(byCount),
  };
}

function buildMilestones(
  milestones: MilestoneLite[],
  dw: Prisma.DateTimeFilter | undefined,
): MilestoneReport {
  const now = new Date();
  const from = dw?.gte instanceof Date ? dw.gte : null;
  const to = dw?.lte instanceof Date ? dw.lte : null;
  const inWindow = (d: Date) =>
    (!from || d.getTime() >= from.getTime()) && (!to || d.getTime() <= to.getTime());

  const rows = new Map<string, MilestoneProjectRow>();
  const rowFor = (m: MilestoneLite) => {
    const key = m.project.name;
    const r =
      rows.get(key) ??
      {
        projectName: m.project.name,
        clientName: m.project.client.name,
        completed: 0,
        onTime: 0,
        late: 0,
        openOverdue: 0,
      };
    rows.set(key, r);
    return r;
  };

  let completed = 0;
  let onTime = 0;
  let late = 0;
  let openOverdue = 0;

  for (const m of milestones) {
    if (m.completedAt && inWindow(m.completedAt)) {
      const r = rowFor(m);
      r.completed += 1;
      completed += 1;
      const isLate =
        m.dueDate != null && ymdInTz(m.completedAt) > ymdInTz(m.dueDate);
      if (isLate) {
        r.late += 1;
        late += 1;
      } else {
        r.onTime += 1;
        onTime += 1;
      }
    } else if (
      !m.completedAt &&
      m.dueDate != null &&
      m.dueDate.getTime() < now.getTime()
    ) {
      rowFor(m).openOverdue += 1;
      openOverdue += 1;
    }
  }

  return {
    totals: {
      completed,
      onTime,
      late,
      openOverdue,
      onTimeRate: completed === 0 ? null : Math.round((onTime / completed) * 100),
    },
    rows: [...rows.values()].sort(
      (a, b) => b.completed - a.completed || b.openOverdue - a.openOverdue,
    ),
  };
}

function buildUserActivity(
  groups: { userId: string | null; action: string; _count: { _all: number } }[],
  users: { id: string; name: string | null; email: string }[],
): UserActivityReport {
  const nameById = new Map(users.map((u) => [u.id, u.name || u.email]));

  const rows = new Map<string, UserActivityRow>();
  let total = 0;

  for (const g of groups) {
    const key = g.userId ?? "—";
    const name = g.userId ? (nameById.get(g.userId) ?? "مستخدم محذوف") : "— النظام —";
    const r =
      rows.get(key) ??
      {
        userName: name,
        total: 0,
        created: 0,
        updated: 0,
        deleted: 0,
        statusChanged: 0,
        other: 0,
      };
    const n = g._count._all;
    r.total += n;
    total += n;
    if (g.action === "created" || g.action.endsWith("_created")) r.created += n;
    else if (g.action === "updated") r.updated += n;
    else if (g.action === "deleted" || g.action.endsWith("_deleted")) r.deleted += n;
    else if (g.action === "status_changed") r.statusChanged += n;
    else r.other += n;
    rows.set(key, r);
  }

  return {
    rows: [...rows.values()].sort((a, b) => b.total - a.total),
    total,
  };
}

// ─────────────────────────── Export tables ───────────────────────────

const pct = (v: number | null) => (v === null ? "—" : `${v}%`);

/** The operational reports as flat, exportable tables. */
export function operationalToTables(d: OperationalReports): ReportTable[] {
  const ps = d.projectStatus;
  const mt = d.meetings;
  const ms = d.milestones;
  const ua = d.userActivity;

  return [
    {
      key: "project-status",
      title: "تقرير حالة المشاريع",
      columns: ["الحالة", "العدد", "القيمة النهائية", "المدفوع", "المتبقي"],
      rows: [
        ...ps.rows.map((r) => [
          r.status,
          r.count,
          formatEgp(r.finalValue),
          formatEgp(r.paid),
          formatEgp(r.remaining),
        ]),
        [
          "الإجمالي",
          ps.total.count,
          formatEgp(ps.total.finalValue),
          formatEgp(ps.total.paid),
          formatEgp(ps.total.remaining),
        ],
        [`مشاريع متأخرة عن موعد التسليم: ${ps.health.overdueByDelivery}`, "", "", "", ""],
        [
          `مشاريع بها مراحل متأخرة: ${ps.health.withOverdueMilestones}`,
          "",
          "",
          "",
          "",
        ],
        [
          `المراحل المنجزة: ${ps.health.milestonesDone} / ${ps.health.milestonesTotal}`,
          "",
          "",
          "",
          "",
        ],
      ],
    },
    {
      key: "meetings",
      title: "تقرير الاجتماعات",
      columns: ["الفئة", "القيمة"],
      rows: [
        [MEETING_STATUS_LABELS.scheduled, mt.byStatus.scheduled],
        [MEETING_STATUS_LABELS.done, mt.byStatus.done],
        [MEETING_STATUS_LABELS.cancelled, mt.byStatus.cancelled],
        ["الإجمالي", mt.byStatus.total],
        [MEETING_TYPE_LABELS.call, mt.byType.call],
        [MEETING_TYPE_LABELS.onsite, mt.byType.onsite],
        [MEETING_TYPE_LABELS.online, mt.byType.online],
      ],
    },
    {
      key: "meetings-by-client",
      title: "الاجتماعات حسب العميل",
      columns: ["العميل", "مجدول", "تم", "ملغي", "الإجمالي"],
      rows: mt.byClient.map((r) => [r.name, r.scheduled, r.done, r.cancelled, r.total]),
    },
    {
      key: "meetings-by-project",
      title: "الاجتماعات حسب المشروع",
      columns: ["المشروع", "مجدول", "تم", "ملغي", "الإجمالي"],
      rows: mt.byProject.map((r) => [r.name, r.scheduled, r.done, r.cancelled, r.total]),
    },
    {
      key: "milestone-completion",
      title: "تقرير إنجاز المراحل",
      columns: ["المشروع", "العميل", "منجزة", "في الموعد", "متأخرة", "مفتوحة ومتأخرة"],
      rows: [
        ...ms.rows.map((r) => [
          r.projectName,
          r.clientName,
          r.completed,
          r.onTime,
          r.late,
          r.openOverdue,
        ]),
        [
          "الإجمالي",
          "",
          ms.totals.completed,
          ms.totals.onTime,
          ms.totals.late,
          ms.totals.openOverdue,
        ],
        [`نسبة الإنجاز في الموعد: ${pct(ms.totals.onTimeRate)}`, "", "", "", "", ""],
      ],
    },
    {
      key: "user-activity",
      title: "تقرير نشاط المستخدمين",
      columns: [
        "المستخدم",
        "الإجمالي",
        actionLabel("created"),
        actionLabel("updated"),
        actionLabel("deleted"),
        actionLabel("status_changed"),
        "أخرى",
      ],
      rows: [
        ...ua.rows.map((r) => [
          r.userName,
          r.total,
          r.created,
          r.updated,
          r.deleted,
          r.statusChanged,
          r.other,
        ]),
        ["الإجمالي", ua.total, "", "", "", "", ""],
      ],
    },
  ];
}
