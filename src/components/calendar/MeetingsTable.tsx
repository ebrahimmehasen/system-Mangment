import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { formatDateTime, utcToZonedInput } from "@/lib/datetime";
import {
  MEETING_TYPE_LABELS,
  MEETING_STATUS_LABELS,
  type MeetingType,
  type MeetingStatus,
} from "@/lib/services/meetings";
import { updateMeetingAction } from "@/server/meeting-actions";
import { MeetingFormModal } from "./MeetingFormModal";
import { MeetingStatusChanger } from "./MeetingStatusChanger";
import { DeleteMeetingButton } from "./DeleteMeetingButton";

export interface MeetingRow {
  id: string;
  title: string;
  description: string | null;
  meetingAt: Date;
  durationMinutes: number | null;
  location: string | null;
  type: string;
  status: string;
  clientId: string | null;
  projectId: string | null;
  client: { id: string; name: string } | null;
  project: { id: string; name: string } | null;
}

const statusTone: Record<MeetingStatus, "neutral" | "success" | "danger"> = {
  scheduled: "neutral",
  done: "success",
  cancelled: "danger",
};

export function MeetingsTable({
  meetings,
  clients,
  projects,
  showContext = true,
  emptyText = "لا توجد اجتماعات.",
}: {
  meetings: MeetingRow[];
  clients: { id: string; name: string }[];
  projects: { id: string; name: string; clientId: string }[];
  showContext?: boolean;
  emptyText?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-right text-foreground-muted">
            <th className="px-4 py-3 font-medium">الموعد</th>
            <th className="px-4 py-3 font-medium">العنوان</th>
            <th className="px-4 py-3 font-medium">النوع</th>
            {showContext && <th className="px-4 py-3 font-medium">مرتبط بـ</th>}
            <th className="px-4 py-3 font-medium">الحالة</th>
            <th className="px-4 py-3 font-medium">إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {meetings.length === 0 && (
            <tr>
              <td
                colSpan={showContext ? 6 : 5}
                className="px-4 py-8 text-center text-foreground-muted"
              >
                {emptyText}
              </td>
            </tr>
          )}
          {meetings.map((m) => (
            <tr key={m.id} className="border-b border-border align-top last:border-0">
              <td className="px-4 py-3 whitespace-nowrap text-foreground-muted">
                {formatDateTime(m.meetingAt)}
                {m.durationMinutes ? ` · ${m.durationMinutes}د` : ""}
              </td>
              <td className="px-4 py-3">
                {m.title}
                {m.location && (
                  <div className="text-xs text-foreground-muted">{m.location}</div>
                )}
              </td>
              <td className="px-4 py-3 text-foreground-muted">
                {MEETING_TYPE_LABELS[m.type as MeetingType] ?? m.type}
              </td>
              {showContext && (
                <td className="px-4 py-3 text-foreground-muted">
                  {m.project ? (
                    <Link href={`/projects/${m.project.id}`} className="text-accent hover:underline">
                      {m.project.name}
                    </Link>
                  ) : m.client ? (
                    <Link href={`/clients/${m.client.id}`} className="text-accent hover:underline">
                      {m.client.name}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
              )}
              <td className="px-4 py-3">
                {m.status === "scheduled" ? (
                  <MeetingStatusChanger meetingId={m.id} current={m.status} />
                ) : (
                  <Badge tone={statusTone[m.status as MeetingStatus] ?? "neutral"}>
                    {MEETING_STATUS_LABELS[m.status as MeetingStatus] ?? m.status}
                  </Badge>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <MeetingFormModal
                    mode="edit"
                    action={updateMeetingAction.bind(null, m.id)}
                    clients={clients}
                    projects={projects}
                    meeting={{
                      title: m.title,
                      description: m.description,
                      meetingAt: utcToZonedInput(m.meetingAt),
                      durationMinutes: m.durationMinutes,
                      location: m.location,
                      type: m.type,
                      status: m.status,
                      clientId: m.clientId,
                      projectId: m.projectId,
                    }}
                    triggerLabel="تعديل"
                    triggerVariant="secondary"
                  />
                  <DeleteMeetingButton meetingId={m.id} compact />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
