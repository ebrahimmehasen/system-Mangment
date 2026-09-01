import { zonedInputToUtc, ymdInTz } from "@/lib/datetime";

/** "2026-09" -> { year, month } (1-indexed month) */
export function parseMonthParam(param: string | undefined): {
  year: number;
  month: number;
} {
  const m = param?.match(/^(\d{4})-(\d{2})$/);
  if (m) return { year: Number(m[1]), month: Number(m[2]) };
  const now = new Date();
  const ymd = ymdInTz(now).split("-");
  return { year: Number(ymd[0]), month: Number(ymd[1]) };
}

export function monthParam(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const total = year * 12 + (month - 1) + delta;
  return { year: Math.floor(total / 12), month: (((total % 12) + 12) % 12) + 1 };
}

/** 42 "YYYY-MM-DD" calendar dates (6 weeks), week starting Saturday (Egypt). */
export function calendarGrid(year: number, month: number): string[] {
  const first = new Date(Date.UTC(year, month - 1, 1, 12));
  const dow = first.getUTCDay(); // 0=Sun..6=Sat
  const offset = (dow - 6 + 7) % 7; // days since the preceding Saturday
  const start = new Date(first);
  start.setUTCDate(first.getUTCDate() - offset);

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

/** UTC instant range [from, to] covering the whole visible grid, in Cairo local time. */
export function gridUtcRange(grid: string[]): { from: Date; to: Date } {
  return {
    from: zonedInputToUtc(`${grid[0]}T00:00`)!,
    to: zonedInputToUtc(`${grid[grid.length - 1]}T23:59`)!,
  };
}

export const WEEKDAY_LABELS = [
  "السبت",
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
];

export type CalEventType = "meeting" | "milestone" | "reminder" | "delivery";

export interface CalEvent {
  id: string;
  type: CalEventType;
  day: string; // YYYY-MM-DD (Cairo)
  time: string; // "HH:mm" or "" for all-day-ish (milestone/reminder date-only)
  title: string;
  href: string;
  tone: "accent" | "warning" | "info" | "neutral";
  done: boolean;
}

const timeFmt = new Intl.DateTimeFormat("ar-EG", {
  timeZone: "Africa/Cairo",
  timeStyle: "short",
});

export function meetingToEvent(m: {
  id: string;
  title: string;
  meetingAt: Date;
  status: string;
  projectId: string | null;
  clientId: string | null;
}): CalEvent {
  return {
    id: `meeting-${m.id}`,
    type: "meeting",
    day: ymdInTz(m.meetingAt),
    time: timeFmt.format(m.meetingAt),
    title: m.title,
    href: m.projectId
      ? `/projects/${m.projectId}`
      : m.clientId
        ? `/clients/${m.clientId}`
        : "/meetings",
    tone: m.status === "cancelled" ? "neutral" : "accent",
    done: m.status !== "scheduled",
  };
}

export function milestoneToEvent(ms: {
  id: string;
  title: string;
  dueDate: Date;
  completedAt: Date | null;
  projectId: string;
}): CalEvent {
  return {
    id: `milestone-${ms.id}`,
    type: "milestone",
    day: ymdInTz(ms.dueDate),
    time: "",
    title: ms.title,
    href: `/projects/${ms.projectId}`,
    tone: "warning",
    done: !!ms.completedAt,
  };
}

export function reminderToEvent(r: {
  id: string;
  title: string;
  remindAt: Date;
  doneAt: Date | null;
}): CalEvent {
  return {
    id: `reminder-${r.id}`,
    type: "reminder",
    day: ymdInTz(r.remindAt),
    time: timeFmt.format(r.remindAt),
    title: r.title,
    href: "/reminders",
    tone: "info",
    done: !!r.doneAt,
  };
}

export function deliveryToEvent(p: {
  id: string;
  name: string;
  expectedDeliveryDate: Date;
  actualDeliveryDate: Date | null;
  status: string;
}): CalEvent {
  return {
    id: `delivery-${p.id}`,
    type: "delivery",
    day: ymdInTz(p.expectedDeliveryDate),
    time: "",
    title: `تسليم: ${p.name}`,
    href: `/projects/${p.id}`,
    tone: "accent",
    done:
      !!p.actualDeliveryDate ||
      ["Completed", "Delivered", "Cancelled"].includes(p.status),
  };
}

export function groupByDay(events: CalEvent[]): Map<string, CalEvent[]> {
  const map = new Map<string, CalEvent[]>();
  for (const e of events) {
    const list = map.get(e.day) ?? [];
    list.push(e);
    map.set(e.day, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.time.localeCompare(b.time));
  }
  return map;
}
