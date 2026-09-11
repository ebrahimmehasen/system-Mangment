import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { Card } from "@/components/ui/Card";
import { formatDateTime } from "@/lib/datetime";
import { AnnouncementFormModal } from "./AnnouncementFormModal";
import { DeleteAnnouncementButton } from "./DeleteAnnouncementButton";

export default async function AnnouncementsPage() {
  await requireUser();

  const announcements = await prisma.announcement.findMany({
    orderBy: { createdAt: "desc" },
    include: { creator: { select: { name: true, email: true } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">الإعلانات</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            تظهر لكل المستخدمين (مشرفين وموظفين) كتنبيه، ولو ليها موعد تظهر في التقويم كمان.
          </p>
        </div>
        <AnnouncementFormModal />
      </div>

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-right text-foreground-muted">
                <th className="px-4 py-3 font-medium">العنوان</th>
                <th className="px-4 py-3 font-medium">الموعد</th>
                <th className="px-4 py-3 font-medium">أنشأه</th>
                <th className="px-4 py-3 font-medium">تاريخ النشر</th>
                <th className="px-4 py-3 font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {announcements.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-foreground-muted">
                    لا توجد إعلانات بعد.
                  </td>
                </tr>
              )}
              {announcements.map((a) => (
                <tr key={a.id} className="border-b border-border align-top last:border-0">
                  <td className="px-4 py-3">
                    {a.title}
                    {a.body && <div className="mt-1 text-xs text-foreground-muted">{a.body}</div>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-foreground-muted">
                    {a.meetingAt ? formatDateTime(a.meetingAt) : "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-foreground-muted">
                    {a.creator?.name || a.creator?.email || "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-foreground-muted">
                    {formatDateTime(a.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <DeleteAnnouncementButton announcementId={a.id} />
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
