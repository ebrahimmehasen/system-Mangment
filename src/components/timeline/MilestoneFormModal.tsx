"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextField, TextAreaField } from "@/components/ui/Field";
import type { MilestoneActionState } from "@/server/milestone-actions";

export interface MilestoneDefaults {
  title?: string;
  description?: string | null;
  dueDate?: string; // yyyy-mm-dd
}

export function MilestoneFormModal({
  mode,
  action,
  milestone,
  triggerLabel,
  triggerVariant = "primary",
}: {
  mode: "create" | "edit";
  action: (
    prev: MilestoneActionState,
    formData: FormData,
  ) => Promise<MilestoneActionState>;
  milestone?: MilestoneDefaults;
  triggerLabel: string;
  triggerVariant?: "primary" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<MilestoneActionState>({});
  const [pending, startTransition] = useTransition();

  const fe = state.fieldErrors ?? {};
  const v = (k: keyof MilestoneDefaults) =>
    (state.values?.[k] as string | undefined) ?? (milestone?.[k] ?? "");

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
        title={mode === "create" ? "مرحلة جديدة" : "تعديل المرحلة"}
      >
        <form
          key={state.fieldErrors ? JSON.stringify(state.values) : "form"}
          action={formAction}
          className="flex flex-col gap-4"
        >
          <TextField
            id="ms-title"
            name="title"
            label="العنوان *"
            defaultValue={v("title")}
            error={fe.title}
            required
          />
          <TextField
            id="ms-due"
            name="dueDate"
            type="date"
            label="تاريخ الاستحقاق"
            dir="ltr"
            defaultValue={v("dueDate")}
            error={fe.dueDate}
          />
          <TextAreaField
            id="ms-desc"
            name="description"
            label="الوصف"
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
