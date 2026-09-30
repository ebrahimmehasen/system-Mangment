"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TASK_PRIORITY_MAX } from "@/lib/services/tasks";
import { setTaskPriorityAction } from "@/server/task-actions";

/** Small 0–99 number box: saves on blur/Enter. 0 or blank = no priority; higher = shown first in its column. */
export function TaskPriorityInput({
  taskId,
  priority,
  onSaved,
  className = "",
}: {
  taskId: string;
  priority: number;
  onSaved?: (priority: number) => void;
  className?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(priority > 0 ? String(priority) : "");
  const [saved, setSaved] = useState(priority);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    const normalized = value.trim() === "" ? 0 : Number(value);
    if (normalized === saved) {
      setError(false);
      return;
    }
    startTransition(async () => {
      const res = await setTaskPriorityAction(taskId, normalized);
      if (res.error || res.priority === undefined) {
        setError(true);
        return;
      }
      setError(false);
      setSaved(res.priority);
      setValue(res.priority > 0 ? String(res.priority) : "");
      onSaved?.(res.priority);
      router.refresh();
    });
  }

  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      max={TASK_PRIORITY_MAX}
      value={value}
      placeholder="—"
      title="الأولوية (1–99) — الأعلى يظهر فوق"
      aria-label="الأولوية"
      disabled={pending}
      dir="ltr"
      draggable={false}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      className={`h-6 w-11 shrink-0 rounded-md border bg-surface px-1 text-center text-xs tabular-nums outline-none focus:border-accent ${
        error ? "border-danger" : saved > 0 ? "border-accent/50 text-accent" : "border-border text-foreground-muted"
      } ${className}`}
    />
  );
}
