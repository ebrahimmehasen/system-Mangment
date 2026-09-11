"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextField, TextAreaField } from "@/components/ui/Field";
import {
  createAnnouncementAction,
  type AnnouncementActionState,
} from "@/server/announcement-actions";

export function AnnouncementFormModal() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<AnnouncementActionState>({});
  const [pending, startTransition] = useTransition();

  function formAction(formData: FormData) {
    startTransition(async () => {
      const result = await createAnnouncementAction(state, formData);
      if (result.ok) {
        setState({});
        setOpen(false);
      } else {
        setState(result);
      }
    });
  }

  function close() {
    setOpen(false);
    setState({});
  }

  const fe = state.fieldErrors ?? {};
  const v = (k: string) => state.values?.[k] ?? "";

  return (
    <>
      <Button onClick={() => setOpen(true)}>+ إعلان جديد</Button>

      <Modal open={open} onClose={close} title="إعلان جديد">
        <form
          key={state.fieldErrors ? JSON.stringify(state.values) : "form"}
          action={formAction}
          className="flex flex-col gap-4"
        >
          <TextField
            id="a-title"
            name="title"
            label="العنوان *"
            defaultValue={v("title")}
            error={fe.title}
            required
          />
          <TextAreaField id="a-body" name="body" label="النص" defaultValue={v("body")} />
          <TextField
            id="a-meeting"
            name="meetingAt"
            type="datetime-local"
            label="موعد (اختياري — يظهر كحدث في التقويم للجميع)"
            dir="ltr"
            defaultValue={v("meetingAt")}
            error={fe.meetingAt}
          />

          {state.error && (
            <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
              {state.error}
            </p>
          )}

          <div className="mt-2 flex justify-start gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "جارٍ النشر…" : "نشر الإعلان"}
            </Button>
            <Button type="button" variant="ghost" onClick={close}>
              إلغاء
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
