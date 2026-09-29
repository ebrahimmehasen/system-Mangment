"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextField, TextAreaField, SelectField } from "@/components/ui/Field";
import { createTaskAction, type TaskActionState } from "@/server/task-actions";

export function EmployeeTaskFormModal({
  projects,
}: {
  projects: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<TaskActionState>({});
  const [pending, startTransition] = useTransition();

  function formAction(formData: FormData) {
    startTransition(async () => {
      const result = await createTaskAction(state, formData);
      if (result.success) {
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
      <Button onClick={() => setOpen(true)}>+ مهمة جديدة</Button>

      <Modal open={open} onClose={close} title="مهمة جديدة (شخصية)">
        <form
          key={state.fieldErrors ? JSON.stringify(state.values) : "form"}
          action={formAction}
          className="flex flex-col gap-4"
        >
          <TextField
            id="etask-title"
            name="title"
            label="العنوان *"
            defaultValue={v("title")}
            error={fe.title}
            required
          />
          <TextAreaField id="etask-desc" name="description" label="الوصف" defaultValue={v("description")} />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField id="etask-project" name="projectId" label="المشروع (اختياري)" defaultValue={v("projectId")}>
              <option value="">— بدون —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </SelectField>
            <TextField
              id="etask-due"
              name="dueDate"
              type="datetime-local"
              label="تاريخ الاستحقاق"
              dir="ltr"
              defaultValue={v("dueDate")}
              error={fe.dueDate}
            />
          </div>

          {state.error && (
            <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>
          )}

          <div className="mt-2 flex justify-start gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "جارٍ الحفظ…" : "حفظ"}
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
