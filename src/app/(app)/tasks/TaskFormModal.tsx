"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextField, TextAreaField, SelectField } from "@/components/ui/Field";
import { type TaskActionState } from "@/server/task-actions";

export interface TaskDefaults {
  title?: string;
  description?: string | null;
  projectId?: string | null;
  dueDate?: string; // datetime-local
  assigneeIds?: string[];
}

export function TaskFormModal({
  mode,
  action,
  projects,
  assignees,
  task,
  triggerLabel,
  triggerVariant = "primary",
}: {
  mode: "create" | "edit";
  action: (prev: TaskActionState, formData: FormData) => Promise<TaskActionState>;
  projects: { id: string; name: string }[];
  assignees: { id: string; label: string }[];
  task?: TaskDefaults;
  triggerLabel: string;
  triggerVariant?: "primary" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<TaskActionState>({});
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set(task?.assigneeIds ?? []));

  function formAction(formData: FormData) {
    startTransition(async () => {
      const result = await action(state, formData);
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

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const fe = state.fieldErrors ?? {};
  const v = (k: keyof TaskDefaults) =>
    (state.values?.[k as string] as string | undefined) ??
    (task?.[k] != null ? String(task[k]) : "");

  return (
    <>
      <Button variant={triggerVariant} onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>

      <Modal
        open={open}
        onClose={close}
        title={mode === "create" ? "مهمة جديدة" : "تعديل المهمة"}
        className="max-w-xl"
      >
        <form
          key={state.fieldErrors ? JSON.stringify(state.values) : "form"}
          action={formAction}
          className="flex flex-col gap-4"
        >
          <TextField
            id="task-title"
            name="title"
            label="العنوان *"
            defaultValue={v("title")}
            error={fe.title}
            required
          />
          <TextAreaField
            id="task-desc"
            name="description"
            label="الوصف"
            defaultValue={v("description")}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              id="task-project"
              name="projectId"
              label="المشروع (اختياري)"
              defaultValue={v("projectId")}
            >
              <option value="">— بدون —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </SelectField>
            <TextField
              id="task-due"
              name="dueDate"
              type="datetime-local"
              label="تاريخ الاستحقاق"
              dir="ltr"
              defaultValue={v("dueDate")}
              error={fe.dueDate}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-foreground-muted">معيّن عليها</label>
            <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-md border border-border p-2">
              {assignees.map((a) => (
                <label
                  key={a.id}
                  className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-surface-2"
                >
                  <input
                    type="checkbox"
                    name="assigneeIds"
                    value={a.id}
                    checked={selected.has(a.id)}
                    onChange={() => toggle(a.id)}
                    className="accent-accent"
                  />
                  {a.label}
                </label>
              ))}
            </div>
          </div>

          {state.error && (
            <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
              {state.error}
            </p>
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
