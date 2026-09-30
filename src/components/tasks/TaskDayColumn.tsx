"use client";

import { useState, useTransition, type DragEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { formatColumnHeader } from "@/lib/datetime";
import { moveTaskToDayAction } from "@/server/task-actions";
import { QuickAddTask } from "./QuickAddTask";
import { TASK_DRAG_TYPE } from "./TaskCard";

export function TaskDayColumn({
  ymd,
  todayYmd,
  titleOverride,
  subtitleOverride,
  count,
  children,
  showQuickAdd = true,
  quickAddDueDate,
  tone,
  dropYmd,
}: {
  ymd: string;
  todayYmd: string;
  /** Skip the ymd-derived "اليوم/غداً + date" header for special columns (متأخرة/بدون موعد). */
  titleOverride?: string;
  subtitleOverride?: string;
  count: number;
  children: ReactNode;
  /** false hides quick-add entirely (the "متأخرة" column — rollover handles those). */
  showQuickAdd?: boolean;
  /** "YYYY-MM-DDTHH:mm" for the quick-add hidden dueDate field; omit for the "بدون موعد" column. */
  quickAddDueDate?: string;
  tone?: "danger";
  /** Makes the column a drag-and-drop target: a dropped card gets this due day
   * ("YYYY-MM-DD"), or no due date for null. Omit for a non-droppable column. */
  dropYmd?: string | null;
}) {
  const router = useRouter();
  const [over, setOver] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [moving, startMove] = useTransition();
  const droppable = dropYmd !== undefined;

  function onDragOver(e: DragEvent) {
    if (!droppable || !e.dataTransfer.types.includes(TASK_DRAG_TYPE)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOver(true);
  }

  function onDrop(e: DragEvent) {
    setOver(false);
    const taskId = e.dataTransfer.getData(TASK_DRAG_TYPE);
    if (!droppable || !taskId) return;
    e.preventDefault();
    setMoveError(null);
    startMove(async () => {
      const res = await moveTaskToDayAction(taskId, dropYmd ?? null);
      if (res.error) setMoveError(res.error);
      router.refresh();
    });
  }

  const header = titleOverride
    ? { relative: titleOverride, date: subtitleOverride ?? "" }
    : formatColumnHeader(ymd, todayYmd);

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={onDrop}
      className={`flex w-72 shrink-0 flex-col rounded-lg border bg-surface transition-colors ${
        over ? "border-accent bg-accent/5" : "border-border"
      } ${moving ? "opacity-70" : ""}`}
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <div>
          <p className={`text-sm font-semibold ${tone === "danger" ? "text-danger" : ""}`}>
            {header.relative}
          </p>
          {header.date && <p className="text-xs text-foreground-muted">{header.date}</p>}
        </div>
        {count > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-surface-2 px-1.5 text-xs text-foreground-muted">
            {count}
          </span>
        )}
      </div>
      <div className="flex min-h-24 flex-1 flex-col gap-2 p-2">
        {moveError && <p className="text-xs text-danger">{moveError}</p>}
        {children}
        {showQuickAdd && <QuickAddTask dueDateLocal={quickAddDueDate} />}
      </div>
    </div>
  );
}
