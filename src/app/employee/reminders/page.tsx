import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { Card } from "@/components/ui/Card";
import { formatDateTime } from "@/lib/datetime";
import { ReminderFormModal } from "@/components/reminders/ReminderFormModal";
import {
  DoneCheckbox,
  SnoozeMenu,
  DeleteReminderButton,
} from "@/components/reminders/ReminderRowActions";

export default async function EmployeeRemindersPage() {
  const user = await requireUser();

  const [reminders, meetings] = await Promise.all([
    prisma.reminder.findMany({
      where: { OR: [{ createdBy: user.id }, { assignedToUserId: user.id }] },
      orderBy: { remindAt: "asc" },
    }),
    prisma.meeting.findMany({
      where: {
        status: "scheduled",
        OR: [{ createdBy: user.id }, { assignedToUserId: user.id }],
      },
      orderBy: { meetingAt: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">التقويم والتذكيرات</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            بتشوف بس اللي خاص بيك — تذكيراتك واجتماعاتك.
          </p>
        </div>
        <ReminderFormModal clients={[]} projects={[]} meetings={[]} triggerLabel="+ تذكير جديد" />
      </div>

      <Card className="p-0">
        <div className="border-b border-border p-4">
          <h2 className="text-base font-semibold">اجتماعاتي ({meetings.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-right text-foreground-muted">
                <th className="px-4 py-3 font-medium">الموعد</th>
                <th className="px-4 py-3 font-medium">العنوان</th>
                <th className="px-4 py-3 font-medium">المكان</th>
              </tr>
            </thead>
            <tbody>
              {meetings.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-foreground-muted">
                    لا توجد اجتماعات مجدولة ليك.
                  </td>
                </tr>
              )}
              {meetings.map((m) => (
                <tr key={m.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 whitespace-nowrap text-foreground-muted">
                    {formatDateTime(m.meetingAt)}
                  </td>
                  <td className="px-4 py-3">{m.title}</td>
                  <td className="px-4 py-3 text-foreground-muted">{m.location || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-0">
        <div className="border-b border-border p-4">
          <h2 className="text-base font-semibold">تذكيراتي ({reminders.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-right text-foreground-muted">
                <th className="px-4 py-3 font-medium"></th>
                <th className="px-4 py-3 font-medium">الموعد</th>
                <th className="px-4 py-3 font-medium">العنوان</th>
                <th className="px-4 py-3 font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {reminders.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-foreground-muted">
                    لا توجد تذكيرات بعد.
                  </td>
                </tr>
              )}
              {reminders.map((r) => (
                <tr key={r.id} className="border-b border-border align-top last:border-0">
                  <td className="px-4 py-3">
                    <DoneCheckbox reminderId={r.id} done={!!r.doneAt} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-foreground-muted">
                    {formatDateTime(r.remindAt)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={r.doneAt ? "text-foreground-muted line-through" : ""}>
                      {r.title}
                    </span>
                    {r.note && <div className="text-xs text-foreground-muted">{r.note}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {!r.doneAt && <SnoozeMenu reminderId={r.id} />}
                      <DeleteReminderButton reminderId={r.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
