"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { formatTime } from "@/lib/datetime";
import { postponementOpacityClass } from "@/lib/services/tasks";
import { getTaskDetailAction, type TaskDetail } from "@/server/task-actions";
import { TaskCompletionCircle } from "./TaskCompletionCircle";
import { TaskDetailModal } from "./TaskDetailModal";

export interface TaskCardData {
  id: string;
  title: string;
  description: string | null;
  dueDate: Date | null;
  status: string;
  postponementCount: number;
  project: { id: string; name: string } | null;
  assignees: { id: string; name: string | null; email: string; role: string }[];
}

export function TaskCard({ task, actions }: { task: TaskCardData; actions?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const done = task.status === "done";

  function openDetail() {
    setOpen(true);
    setDetail(null);
    setError(null);
    startTransition(async () => {
      const res = await getTaskDetailAction(task.id);
      if (res.error) setError(res.error);
      else if (res.task) setDetail(res.task);
    });
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={openDetail}
        onKeyDown={(e) => e.key === "Enter" && openDetail()}
        className={`flex cursor-pointer items-start gap-3 rounded-md border border-border bg-surface-2 p-3 transition-colors hover:bg-surface ${postponementOpacityClass(task.postponementCount)} ${done ? "bg-surface" : ""}`}
      >
        <div onClick={(e) => e.stopPropagation()}>
          <TaskCompletionCircle taskId={task.id} done={done} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-sm ${done ? "text-foreground-muted line-through" : "text-foreground"}`}>
              {task.title}
            </span>
            {task.dueDate && (
              <span className="text-xs text-foreground-muted">{formatTime(task.dueDate)}</span>
            )}
            {task.postponementCount > 0 && (
              <Badge tone="warning">تم التأجيل {task.postponementCount} مرة</Badge>
            )}
          </div>
          {task.description && (
            <p className="mt-0.5 truncate text-xs text-foreground-muted">{task.description}</p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-foreground-muted">
            {task.project && <span>{task.project.name}</span>}
            {task.assignees.length > 0 && (
              <span>
                {task.assignees.map((a) => a.name || a.email).join("، ")}
              </span>
            )}
          </div>
        </div>

        {actions && (
          <div onClick={(e) => e.stopPropagation()} className="flex shrink-0 items-center gap-2">
            {actions}
          </div>
        )}
      </div>

      <TaskDetailModal
        open={open}
        onClose={() => setOpen(false)}
        loading={pending}
        error={error}
        detail={detail}
      />
    </>
  );
}
