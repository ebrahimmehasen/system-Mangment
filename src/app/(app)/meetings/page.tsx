import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { Card } from "@/components/ui/Card";
import { Pagination } from "@/components/ui/Pagination";
import { MeetingsTable } from "@/components/calendar/MeetingsTable";
import { MeetingFormModal } from "@/components/calendar/MeetingFormModal";
import { createMeetingAction } from "@/server/meeting-actions";
import { MEETING_STATUS_LABELS } from "@/lib/services/meetings";

const PAGE_SIZE = 20;

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; when?: string; page?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const status =
    sp.status === "scheduled" || sp.status === "done" || sp.status === "cancelled"
      ? sp.status
      : undefined;
  const when = sp.when === "past" ? "past" : "upcoming";
  const now = new Date();

  // When a status is selected, show every meeting with that status
  // regardless of date; otherwise split by upcoming vs past.
  const where: Prisma.MeetingWhereInput = status
    ? { status }
    : { meetingAt: when === "past" ? { lt: now } : { gte: now } };

  const orderDir = status || when === "past" ? "desc" : "asc";
  const [total, meetings, clients, projects] = await Promise.all([
    prisma.meeting.count({ where }),
    prisma.meeting.findMany({
      where,
      orderBy: { meetingAt: orderDir },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        client: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    }),
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.project.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, clientId: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const tab = (key: string, label: string, params: Record<string, string>) => {
    const qs = new URLSearchParams(params).toString();
    const active = params.status
      ? params.status === status
      : !status && (params.when ?? "upcoming") === when;
    return (
      <Link
        key={key}
        href={`/meetings${qs ? `?${qs}` : ""}`}
        className={`rounded-md border border-border px-3 py-1.5 text-sm ${
          active ? "bg-accent/10 text-accent" : "text-foreground-muted hover:bg-surface-2"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">الاجتماعات</h1>
          <p className="mt-1 text-sm text-foreground-muted">{total} اجتماع</p>
        </div>
        <MeetingFormModal
          mode="create"
          action={createMeetingAction}
          clients={clients}
          projects={projects}
          triggerLabel="+ اجتماع جديد"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {tab("up", "القادمة", { when: "upcoming" })}
        {tab("past", "السابقة", { when: "past" })}
        {tab("sched", MEETING_STATUS_LABELS.scheduled, { status: "scheduled" })}
        {tab("done", MEETING_STATUS_LABELS.done, { status: "done" })}
        {tab("canc", MEETING_STATUS_LABELS.cancelled, { status: "cancelled" })}
      </div>

      <Card className="p-0">
        <MeetingsTable
          meetings={meetings}
          clients={clients}
          projects={projects}
          emptyText={when === "past" ? "لا توجد اجتماعات سابقة." : "لا توجد اجتماعات قادمة."}
        />
      </Card>

      <Pagination
        page={page}
        totalPages={totalPages}
        makeHref={(p) => {
          const params = new URLSearchParams();
          if (status) params.set("status", status);
          else if (when === "past") params.set("when", "past");
          if (p > 1) params.set("page", String(p));
          const qs = params.toString();
          return qs ? `/meetings?${qs}` : "/meetings";
        }}
      />
    </div>
  );
}
