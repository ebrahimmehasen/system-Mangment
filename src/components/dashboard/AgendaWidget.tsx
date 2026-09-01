import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatTime, formatDate, ymdInTz, zonedInputToUtc } from "@/lib/datetime";

export async function AgendaWidget() {
  const now = new Date();
  const today = ymdInTz(now);
  const dayStart = zonedInputToUtc(`${today}T00:00`)!;
  const dayEnd = zonedInputToUtc(`${today}T23:59`)!;
  const in7Days = new Date(now.getTime() + 7 * 86400000);

  const [meetings, milestones, reminders] = await Promise.all([
    prisma.meeting.findMany({
      where: {
        status: "scheduled",
        meetingAt: { gte: dayStart, lte: dayEnd },
      },
      orderBy: { meetingAt: "asc" },
      select: {
        id: true,
        title: true,
        meetingAt: true,
        projectId: true,
        clientId: true,
      },
    }),
    prisma.projectMilestone.findMany({
      where: {
        completedAt: null,
        dueDate: { gte: dayStart, lte: in7Days },
      },
      orderBy: { dueDate: "asc" },
      take: 8,
      select: {
        id: true,
        title: true,
        dueDate: true,
        projectId: true,
        project: { select: { name: true } },
      },
    }),
    prisma.reminder.findMany({
      where: { doneAt: null, remindAt: { lte: dayEnd } },
      orderBy: { remindAt: "asc" },
      take: 8,
      select: { id: true, title: true, remindAt: true },
    }),
  ]);

  const empty =
    meetings.length === 0 && milestones.length === 0 && reminders.length === 0;

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-foreground-muted">الأجندة</h2>
      <Card>
        {empty ? (
          <p className="text-sm text-foreground-muted">
            لا توجد اجتماعات اليوم ولا مراحل قادمة ولا تذكيرات نشطة.
          </p>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <h3 className="mb-2 text-xs font-semibold text-foreground-muted">
                اجتماعات اليوم ({meetings.length})
              </h3>
              {meetings.length === 0 ? (
                <p className="text-xs text-foreground-muted">لا شيء اليوم.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {meetings.map((m) => (
                    <li key={m.id} className="text-sm">
                      <Link
                        href={
                          m.projectId
                            ? `/projects/${m.projectId}`
                            : m.clientId
                              ? `/clients/${m.clientId}`
                              : "/meetings"
                        }
                        className="hover:text-accent"
                      >
                        {m.title}
                      </Link>
                      <span className="mr-2 text-xs text-foreground-muted">
                        {formatTime(m.meetingAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold text-foreground-muted">
                مراحل قادمة (7 أيام)
              </h3>
              {milestones.length === 0 ? (
                <p className="text-xs text-foreground-muted">لا شيء قريبًا.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {milestones.map((ms) => (
                    <li key={ms.id} className="text-sm">
                      <Link
                        href={`/projects/${ms.projectId}`}
                        className="hover:text-accent"
                      >
                        {ms.title}
                      </Link>
                      <span className="mr-2 text-xs text-foreground-muted">
                        {ms.project.name} · {ms.dueDate ? formatDate(ms.dueDate) : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold text-foreground-muted">
                تذكيرات نشطة
              </h3>
              {reminders.length === 0 ? (
                <p className="text-xs text-foreground-muted">لا شيء الآن.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {reminders.map((r) => {
                    const overdue = r.remindAt.getTime() < now.getTime();
                    return (
                      <li key={r.id} className="flex items-center gap-2 text-sm">
                        <Link href="/reminders" className="hover:text-accent">
                          {r.title}
                        </Link>
                        {overdue && <Badge tone="danger">متأخر</Badge>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </Card>
    </section>
  );
}
