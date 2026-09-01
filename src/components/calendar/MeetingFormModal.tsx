"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextField, TextAreaField, SelectField } from "@/components/ui/Field";
import {
  MEETING_TYPES,
  MEETING_STATUSES,
  MEETING_TYPE_LABELS,
  MEETING_STATUS_LABELS,
} from "@/lib/services/meetings";
import type { MeetingActionState } from "@/server/meeting-actions";

export interface MeetingDefaults {
  title?: string;
  description?: string | null;
  meetingAt?: string; // datetime-local
  durationMinutes?: number | null;
  location?: string | null;
  type?: string;
  status?: string;
  clientId?: string | null;
  projectId?: string | null;
}

export function MeetingFormModal({
  mode,
  action,
  clients,
  projects,
  meeting,
  fixedClientId,
  fixedProjectId,
  triggerLabel,
  triggerVariant = "primary",
}: {
  mode: "create" | "edit";
  action: (
    prev: MeetingActionState,
    formData: FormData,
  ) => Promise<MeetingActionState>;
  clients: { id: string; name: string }[];
  projects: { id: string; name: string; clientId: string }[];
  meeting?: MeetingDefaults;
  fixedClientId?: string;
  fixedProjectId?: string;
  triggerLabel: string;
  triggerVariant?: "primary" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<MeetingActionState>({});
  const [pending, startTransition] = useTransition();

  const [clientId, setClientId] = useState(
    fixedClientId ?? meeting?.clientId ?? "",
  );

  const fe = state.fieldErrors ?? {};
  const v = (k: keyof MeetingDefaults) =>
    (state.values?.[k] as string | undefined) ??
    (meeting?.[k] != null ? String(meeting[k]) : "");

  const clientProjects = useMemo(
    () => projects.filter((p) => !clientId || p.clientId === clientId),
    [projects, clientId],
  );

  function formAction(formData: FormData) {
    startTransition(async () => {
      const result = await action(state, formData);
      if (result.ok) {
        setState({});
        setOpen(false);
      } else {
        setState(result);
      }
    });
  }

  return (
    <>
      <Button variant={triggerVariant} onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={mode === "create" ? "اجتماع جديد" : "تعديل الاجتماع"}
      >
        <form
          key={state.fieldErrors ? JSON.stringify(state.values) : "form"}
          action={formAction}
          className="flex flex-col gap-4"
        >
          <TextField
            id="m-title"
            name="title"
            label="العنوان *"
            defaultValue={v("title")}
            error={fe.title}
            required
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="m-at"
              name="meetingAt"
              type="datetime-local"
              label="التاريخ والوقت *"
              dir="ltr"
              defaultValue={v("meetingAt")}
              error={fe.meetingAt}
              required
            />
            <TextField
              id="m-dur"
              name="durationMinutes"
              type="number"
              min={1}
              label="المدة (دقائق)"
              dir="ltr"
              defaultValue={v("durationMinutes")}
              error={fe.durationMinutes}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              id="m-type"
              name="type"
              label="النوع *"
              defaultValue={v("type") || "call"}
            >
              {MEETING_TYPES.map((t) => (
                <option key={t} value={t}>
                  {MEETING_TYPE_LABELS[t]}
                </option>
              ))}
            </SelectField>
            <SelectField
              id="m-status"
              name="status"
              label="الحالة"
              defaultValue={v("status") || "scheduled"}
            >
              {MEETING_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {MEETING_STATUS_LABELS[s]}
                </option>
              ))}
            </SelectField>
          </div>

          <TextField
            id="m-loc"
            name="location"
            label="المكان / الرابط"
            defaultValue={v("location")}
          />

          {fixedProjectId ? (
            <>
              {fixedClientId && (
                <input type="hidden" name="clientId" value={fixedClientId} />
              )}
              <input type="hidden" name="projectId" value={fixedProjectId} />
            </>
          ) : fixedClientId ? (
            <>
              <input type="hidden" name="clientId" value={fixedClientId} />
              <SelectField
                id="m-project"
                name="projectId"
                label="المشروع"
                defaultValue={v("projectId")}
              >
                <option value="">— بدون —</option>
                {projects
                  .filter((p) => p.clientId === fixedClientId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </SelectField>
            </>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                id="m-client"
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
              <SelectField
                id="m-project"
                name="projectId"
                label="المشروع"
                defaultValue={v("projectId")}
              >
                <option value="">— بدون —</option>
                {clientProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </SelectField>
            </div>
          )}

          <TextAreaField
            id="m-desc"
            name="description"
            label="ملاحظات"
            defaultValue={v("description")}
          />

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
