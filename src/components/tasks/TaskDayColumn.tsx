import type { ReactNode } from "react";
import { formatColumnHeader } from "@/lib/datetime";
import { QuickAddTask } from "./QuickAddTask";

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
}) {
  const header = titleOverride
    ? { relative: titleOverride, date: subtitleOverride ?? "" }
    : formatColumnHeader(ymd, todayYmd);

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-lg border border-border bg-surface">
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
      <div className="flex flex-1 flex-col gap-2 p-2">
        {children}
        {showQuickAdd && <QuickAddTask dueDateLocal={quickAddDueDate} />}
      </div>
    </div>
  );
}
