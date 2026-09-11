import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ymdInTz } from "@/lib/datetime";
import {
  parseMonthParam,
  monthParam,
  calendarGrid,
  gridUtcRange,
  meetingToEvent,
  reminderToEvent,
  announcementToEvent,
  groupByDay,
  WEEKDAY_LABELS,
  type CalEvent,
} from "@/lib/services/calendar";
import { EmployeeCalendarNav } from "./EmployeeCalendarNav";

const toneClasses: Record<CalEvent["tone"], string> = {
  accent: "bg-accent/15 text-accent",
  warning: "bg-warning/15 text-warning",
  info: "bg-info/15 text-info",
  neutral: "bg-surface-2 text-foreground-muted",
  success: "bg-success/15 text-success",
};

const TYPE_LABELS: Record<CalEvent["type"], string> = {
  meeting: "اجتماع",
  milestone: "مرحلة",
  reminder: "تذكير",
  delivery: "تسليم",
  announcement: "إعلان",
};

export default async function EmployeeCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; day?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const { year, month } = parseMonthParam(sp.month);
  const grid = calendarGrid(year, month);
  const { from, to } = gridUtcRange(grid);

  const [meetings, reminders, announcements] = await Promise.all([
    prisma.meeting.findMany({
      where: {
        meetingAt: { gte: from, lte: to },
        OR: [{ createdBy: user.id }, { assignedToUserId: user.id }],
      },
      select: {
        id: true,
        title: true,
        meetingAt: true,
        status: true,
        projectId: true,
        clientId: true,
      },
    }),
    prisma.reminder.findMany({
      where: {
        remindAt: { gte: from, lte: to },
        OR: [{ createdBy: user.id }, { assignedToUserId: user.id }],
      },
      select: { id: true, title: true, remindAt: true, doneAt: true },
    }),
    prisma.announcement.findMany({
      where: { meetingAt: { gte: from, lte: to } },
      select: { id: true, title: true, meetingAt: true },
    }),
  ]);

  const events: CalEvent[] = [
    ...meetings.map(meetingToEvent).map((e) => ({ ...e, href: "/employee/reminders" })),
    ...reminders.map(reminderToEvent).map((e) => ({ ...e, href: "/employee/reminders" })),
    ...announcements
      .filter((a) => a.meetingAt)
      .map((a) =>
        announcementToEvent({ ...a, meetingAt: a.meetingAt! }),
      )
      .map((e) => ({ ...e, href: "/employee/announcements" })),
  ];
  const byDay = groupByDay(events);

  const today = ymdInTz(new Date());
  const monthLabel = new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "long",
    timeZone: "Africa/Cairo",
  }).format(new Date(Date.UTC(year, month - 1, 15)));

  const selectedDay = sp.day && grid.includes(sp.day) ? sp.day : null;
  const dayHref = (d: string) => {
    const params = new URLSearchParams();
    params.set("month", monthParam(year, month));
    if (d !== selectedDay) params.set("day", d);
    return `/employee/calendar?${params.toString()}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">التقويم</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          {monthLabel} — اجتماعاتك وتذكيراتك وإعلانات الشركة بس.
        </p>
      </div>

      <Card>
        <EmployeeCalendarNav year={year} month={month} />
      </Card>

      <Card className="p-0">
        <div className="grid grid-cols-7 border-b border-border text-center text-xs text-foreground-muted">
          {WEEKDAY_LABELS.map((w) => (
            <div key={w} className="px-1 py-2">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {grid.map((d) => {
            const inMonth = Number(d.slice(5, 7)) === month;
            const isToday = d === today;
            const isSelected = d === selectedDay;
            const dayEvents = byDay.get(d) ?? [];
            const shown = dayEvents.slice(0, 3);
            const extra = dayEvents.length - shown.length;

            return (
              <Link
                key={d}
                href={dayHref(d)}
                className={`flex min-h-20 flex-col gap-1 border-b border-l border-border p-1.5 text-right sm:min-h-24 ${
                  inMonth ? "" : "opacity-40"
                } ${isSelected ? "bg-accent/5" : "hover:bg-surface-2/50"}`}
              >
                <span
                  className={`self-end text-xs ${
                    isToday
                      ? "flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-foreground"
                      : "text-foreground-muted"
                  }`}
                >
                  {Number(d.slice(8, 10))}
                </span>
                <div className="flex flex-col gap-0.5">
                  {shown.map((e) => (
                    <span
                      key={e.id}
                      className={`truncate rounded px-1 py-0.5 text-[10px] ${toneClasses[e.tone]} ${e.done ? "line-through opacity-60" : ""}`}
                    >
                      {e.time && `${e.time} `}
                      {e.title}
                    </span>
                  ))}
                  {extra > 0 && (
                    <span className="text-[10px] text-foreground-muted">+{extra}</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </Card>

      {selectedDay && (
        <Card>
          <h2 className="mb-3 text-base font-semibold">
            أحداث يوم{" "}
            {new Intl.DateTimeFormat("ar-EG", {
              dateStyle: "full",
              timeZone: "Africa/Cairo",
            }).format(new Date(`${selectedDay}T12:00:00Z`))}
          </h2>
          {(byDay.get(selectedDay) ?? []).length === 0 ? (
            <p className="text-sm text-foreground-muted">لا توجد أحداث في هذا اليوم.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {(byDay.get(selectedDay) ?? []).map((e) => (
                <li key={e.id}>
                  <Link
                    href={e.href}
                    className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm hover:bg-surface-2"
                  >
                    <span className={e.done ? "text-foreground-muted line-through" : ""}>
                      {e.title}
                    </span>
                    <span className="flex items-center gap-2 text-xs text-foreground-muted">
                      {e.time}
                      <Badge tone="neutral">{TYPE_LABELS[e.type]}</Badge>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
