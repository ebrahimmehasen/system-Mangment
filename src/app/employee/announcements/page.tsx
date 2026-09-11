import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { Card } from "@/components/ui/Card";
import { formatDateTime } from "@/lib/datetime";

export default async function EmployeeAnnouncementsPage() {
  await requireUser();

  const announcements = await prisma.announcement.findMany({
    orderBy: { createdAt: "desc" },
    include: { creator: { select: { name: true, email: true } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">الإعلانات</h1>
        <p className="mt-1 text-sm text-foreground-muted">إعلانات الشركة.</p>
      </div>

      {announcements.length === 0 ? (
        <Card>
          <p className="text-sm text-foreground-muted">لا توجد إعلانات بعد.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {announcements.map((a) => (
            <Card key={a.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold">{a.title}</h2>
                <span className="text-xs text-foreground-muted">
                  {formatDateTime(a.createdAt)} — {a.creator?.name || a.creator?.email || "—"}
                </span>
              </div>
              {a.body && <p className="mt-2 whitespace-pre-wrap text-sm">{a.body}</p>}
              {a.meetingAt && (
                <p className="mt-2 text-sm text-accent">الموعد: {formatDateTime(a.meetingAt)}</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
