"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/Field";
import { formatDateTime, utcToZonedInput } from "@/lib/datetime";
import { TASK_STATUS_LABELS, type TaskStatus } from "@/lib/services/tasks";
import { updateTaskDetailsAction, type TaskDetail } from "@/server/task-actions";

/** The initial fetch (on the click that opens this) is owned by the caller
 * (TaskCard), which stays effect-free; the edit-and-save form below is
 * plain event-driven local state, not reactive to props, so it's fine to
 * live here. */
export function TaskDetailModal({
  open,
  onClose,
  loading,
  error,
  detail,
  canEdit = false,
  projects = [],
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  error: string | null;
  detail: TaskDetail | null;
  canEdit?: boolean;
  projects?: { id: string; name: string }[];
  onSaved?: () => void;
}) {
  const [saving, startSaving] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!detail) return;
    const formData = new FormData(e.currentTarget);
    setSaveError(null);
    startSaving(async () => {
      const res = await updateTaskDetailsAction(detail.id, formData);
      if (res.error) setSaveError(res.error);
      else onSaved?.();
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="تفاصيل المهمة" className="max-w-2xl">
      {loading && <p className="text-sm text-foreground-muted">جارٍ التحميل…</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
      {detail && (
        <div className="flex flex-col gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold">{detail.title}</h3>
              <Badge tone={detail.status === "done" ? "success" : "neutral"}>
                {TASK_STATUS_LABELS[detail.status as TaskStatus]}
              </Badge>
            </div>
            {detail.description && (
              <p className="mt-1 text-sm text-foreground-muted">{detail.description}</p>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
            <Info label="أُنشئت" value={formatDateTime(new Date(detail.createdAt))} />
            <Info
              label="تاريخ الاستحقاق"
              value={detail.dueDate ? formatDateTime(new Date(detail.dueDate)) : "—"}
            />
            {!canEdit && (
              <Info
                label="تاريخ الإتمام"
                value={detail.completedAt ? formatDateTime(new Date(detail.completedAt)) : "—"}
              />
            )}
            <Info label="أنشأها" value={detail.creator?.name || detail.creator?.email || "—"} />
            {!canEdit && <Info label="المشروع" value={detail.project?.name || "—"} />}
            <Info label="مرات التأجيل" value={String(detail.postponementCount)} />
          </dl>

          <div>
            <p className="mb-1 text-xs text-foreground-muted">معيّن عليها</p>
            <div className="flex flex-wrap gap-1.5">
              {detail.assignees.map((a) => (
                <Badge key={a.id} tone="neutral">
                  {a.name || a.email}
                  {a.role === "employee" && " (موظف)"}
                </Badge>
              ))}
              {detail.assignees.length === 0 && (
                <span className="text-xs text-foreground-muted">مفيش حد معيّن عليها.</span>
              )}
            </div>
          </div>

          {canEdit && (
            <form
              key={`${detail.id}-${detail.project?.id ?? ""}-${detail.completedAt ?? ""}`}
              onSubmit={handleSave}
              className="flex flex-col gap-3 border-t border-border pt-3"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <SelectField id="td-project" name="projectId" label="المشروع" defaultValue={detail.project?.id ?? ""}>
                  <option value="">— بدون —</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </SelectField>
                <TextField
                  id="td-completed"
                  name="completedAt"
                  type="datetime-local"
                  label="تاريخ الإتمام"
                  dir="ltr"
                  defaultValue={detail.completedAt ? utcToZonedInput(new Date(detail.completedAt)) : ""}
                />
              </div>
              {saveError && <p className="text-sm text-danger">{saveError}</p>}
              <div>
                <Button type="submit" variant="secondary" disabled={saving}>
                  {saving ? "جارٍ الحفظ…" : "حفظ"}
                </Button>
              </div>
            </form>
          )}

          <div>
            <p className="mb-2 text-xs text-foreground-muted">السجل</p>
            <ul className="flex max-h-44 flex-col gap-2 overflow-y-auto border-r-2 border-border pr-3">
              {detail.activity.length === 0 && (
                <li className="text-xs text-foreground-muted">مفيش سجل بعد.</li>
              )}
              {detail.activity.map((a) => (
                <li key={a.id} className="text-xs">
                  <span className="font-medium text-foreground">{a.label}</span>
                  <span className="mr-2 text-foreground-muted">{formatDateTime(new Date(a.at))}</span>
                  {isDueDateChange(a.oldValue, a.newValue) && (
                    <div className="mt-0.5 text-foreground-muted">
                      {formatDateTime(new Date((a.oldValue as { dueDate: string }).dueDate))} ←{" "}
                      {formatDateTime(new Date((a.newValue as { dueDate: string }).dueDate))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Modal>
  );
}

function isDueDateChange(oldValue: unknown, newValue: unknown): boolean {
  return (
    !!oldValue &&
    !!newValue &&
    typeof oldValue === "object" &&
    typeof newValue === "object" &&
    "dueDate" in (oldValue as object) &&
    "dueDate" in (newValue as object)
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-foreground-muted">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}
