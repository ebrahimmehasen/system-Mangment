"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { TASK_STATUSES, TASK_STATUS_LABELS } from "@/lib/services/tasks";
import { updateTaskStatusAction } from "@/server/task-actions";

export function TaskStatusChanger({
  taskId,
  current,
}: {
  taskId: string;
  current: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onChange(status: string) {
    startTransition(async () => {
      await updateTaskStatusAction(taskId, status);
      router.refresh();
    });
  }

  const toneClass =
    current === "done"
      ? "border-success/40 bg-success/10 text-success"
      : current === "in_progress"
        ? "border-accent/40 bg-accent/10 text-accent"
        : "border-border bg-surface-2 text-foreground-muted";

  return (
    <select
      value={current}
      disabled={pending}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded-md border px-2 py-1 text-xs focus:outline-none disabled:opacity-50 ${toneClass}`}
    >
      {TASK_STATUSES.map((s) => (
        <option key={s} value={s}>
          {TASK_STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}
