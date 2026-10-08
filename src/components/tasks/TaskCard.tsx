"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { postponementOpacityClass } from "@/lib/services/tasks";
import { getTaskDetailAction, toggleTaskCompleteAction, type TaskDetail } from "@/server/task-actions";
import { TaskCompletionCircle } from "./TaskCompletionCircle";
import { TaskDetailModal } from "./TaskDetailModal";
import { TaskPriorityBadge } from "./TaskPriorityBadge";

/** dataTransfer type used by drag-and-drop between board columns. */
export const TASK_DRAG_TYPE = "application/x-task-id";

export interface TaskCardData {
  id: string;
  title: string;
  description: string | null;
  dueDate: Date | null;
  status: string;
  postponementCount: number;
  priority: number;
  completedBy: { id: string; name: string | null; email: string } | null;
  project: { id: string; name: string } | null;
  assignees: { id: string; name: string | null; email: string; role: string }[];
}

export function TaskCard({
  task,
  actions,
  canEditDetails = false,
  projects = [],
}: {
  task: TaskCardData;
  actions?: ReactNode;
  /** Admin-only: lets the details modal edit project/completion date. */
  canEditDetails?: boolean;
  projects?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detailPending, startDetailTransition] = useTransition();

  // Optimistic completion toggle: flips instantly, server call + refresh
  // happen in the background so the board never sits on a full reload for
  // this. Reverts on a server error.
  const [toggling, startToggleTransition] = useTransition();
  const [doneOverride, setDoneOverride] = useState<boolean | null>(null);
  const done = doneOverride ?? task.status === "done";
  const [dragging, setDragging] = useState(false);

  function fetchDetail() {
    setError(null);
    startDetailTransition(async () => {
      const res = await getTaskDetailAction(task.id);
      if (res.error) setError(res.error);
      else if (res.task) setDetail(res.task);
    });
  }

  function openDetail() {
    setOpen(true);
    setDetail(null);
    fetchDetail();
  }

  function toggleDone(e: React.MouseEvent) {
    e.stopPropagation();
    const next = !done;
    setDoneOverride(next);
    startToggleTransition(async () => {
      const res = await toggleTaskCompleteAction(task.id);
      if (res?.error) setDoneOverride(!next);
      router.refresh();
    });
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={openDetail}
        onKeyDown={(e) => e.key === "Enter" && openDetail()}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(TASK_DRAG_TYPE, task.id);
          e.dataTransfer.effectAllowed = "move";
          setDragging(true);
        }}
        onDragEnd={() => setDragging(false)}
        className={`${dragging ? "opacity-40" : ""} flex cursor-grab active:cursor-grabbing flex-col gap-1.5 rounded-lg border border-border bg-surface-2 p-2.5 transition-colors hover:border-accent/40 hover:bg-surface ${postponementOpacityClass(task.postponementCount)} ${done ? "bg-surface" : ""}`}
      >
        <div className="flex items-start gap-2">
          <div className="mt-0.5">
            <TaskCompletionCircle done={done} onClick={toggleDone} disabled={toggling} />
          </div>
          <span className={`min-w-0 flex-1 text-sm ${done ? "text-foreground-muted line-through" : "text-foreground"}`}>
            {task.title}
          </span>
          <TaskPriorityBadge priority={task.priority} />
        </div>

        {task.description && (
          <p className="truncate pr-7 text-xs text-foreground-muted">{task.description}</p>
        )}

        {done && task.completedBy && (
          <p className="pr-7 text-xs text-success">
            ✓ أتمّها: {task.completedBy.name || task.completedBy.email}
          </p>
        )}

        {(task.project || task.assignees.length > 0 || task.postponementCount > 0) && (
          <div className="flex flex-wrap items-center gap-1.5 pr-7 text-xs text-foreground-muted">
            {task.project && (
              <span className="text-accent">#{task.project.name}</span>
            )}
            {task.assignees.map((a) => (
              <span
                key={a.id}
                className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 ${
                  done && task.completedBy?.id === a.id ? "bg-success/15 text-success" : "bg-surface"
                }`}
              >
                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent/20 text-[9px] text-accent">
                  {(a.name || a.email).charAt(0)}
                </span>
                {a.name || a.email}
                {done && task.completedBy?.id === a.id && " ✓"}
              </span>
            ))}
            {task.postponementCount > 0 && (
              <Badge tone="warning">مؤجلة {task.postponementCount} مرة</Badge>
            )}
          </div>
        )}

        {actions && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex flex-wrap items-center gap-2 border-t border-border pt-1.5 pr-7"
          >
            {actions}
          </div>
        )}
      </div>

      <TaskDetailModal
        open={open}
        onClose={() => setOpen(false)}
        loading={detailPending}
        error={error}
        detail={detail}
        canEdit={canEditDetails}
        projects={projects}
        onSaved={() => {
          fetchDetail();
          router.refresh();
        }}
      />
    </>
  );
}
