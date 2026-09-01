"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextField, TextAreaField, SelectField } from "@/components/ui/Field";
import { createReminderAction, type ReminderActionState } from "@/server/reminder-actions";

export function ReminderFormModal({
  clients,
  projects,
  meetings,
  fixedClientId,
  fixedProjectId,
  fixedMeetingId,
  triggerLabel = "+ تذكير جديد",
  triggerVariant = "primary",
}: {
  clients: { id: string; name: string }[];
  projects: { id: string; name: string; clientId: string }[];
  meetings: { id: string; title: string }[];
  fixedClientId?: string;
  fixedProjectId?: string;
  fixedMeetingId?: string;
  triggerLabel?: string;
  triggerVariant?: "primary" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ReminderActionState>({});
  const [pending, startTransition] = useTransition();
  const [clientId, setClientId] = useState(fixedClientId ?? "");

  const fe = state.fieldErrors ?? {};
  const v = (k: string) => state.values?.[k] ?? "";

  const clientProjects = useMemo(
    () => projects.filter((p) => !clientId || p.clientId === clientId),
    [projects, clientId],
  );

  function formAction(formData: FormData) {
    startTransition(async () => {
      const result = await createReminderAction(state, formData);
      if (result.ok) {
        setState({});
        setOpen(false);
      } else {
        setState(result);
      }
    });
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <Button variant={triggerVariant} onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="تذكير جديد">
        <form
          key={state.fieldErrors ? JSON.stringify(state.values) : "form"}
          action={formAction}
          className="flex flex-col gap-4"
        >
          <TextField
            id="r-title"
            name="title"
            label="العنوان *"
            defaultValue={v("title")}
            error={fe.title}
            required
          />
          <TextField
            id="r-at"
            name="remindAt"
            type="datetime-local"
            label="موعد التذكير *"
            dir="ltr"
            defaultValue={v("remindAt") || `${today}T09:00`}
            error={fe.remindAt}
            required
          />

          {fixedMeetingId ? (
            <input type="hidden" name="meetingId" value={fixedMeetingId} />
          ) : (
            meetings.length > 0 && (
              <SelectField
                id="r-meeting"
                name="meetingId"
                label="اجتماع مرتبط"
                defaultValue={v("meetingId")}
              >
                <option value="">— بدون —</option>
                {meetings.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </SelectField>
            )
          )}

          {fixedClientId || fixedProjectId ? (
            <>
              {fixedClientId && <input type="hidden" name="clientId" value={fixedClientId} />}
              {fixedProjectId && <input type="hidden" name="projectId" value={fixedProjectId} />}
            </>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                id="r-client"
                name="clientId"
                label="العميل"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              >
                <option value="">— بدون —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </SelectField>
              <SelectField id="r-project" name="projectId" label="المشروع" defaultValue={v("projectId")}>
                <option value="">— بدون —</option>
                {clientProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </SelectField>
            </div>
          )}

          <TextAreaField id="r-note" name="note" label="ملاحظات" defaultValue={v("note")} />

          {state.error && (
            <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
              {state.error}
            </p>
          )}

          <div className="mt-2 flex justify-start gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "جارٍ الحفظ…" : "حفظ"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
