import type { ReactNode } from "react";
import { TaskDayColumn } from "./TaskDayColumn";

export interface BoardTask {
  id: string;
  dueDate: Date | null;
}

export function TaskBoard<T extends BoardTask>({
  overdue,
  noDate,
  days,
  todayYmd,
  renderTask,
}: {
  overdue: T[];
  noDate: T[];
  days: { ymd: string; tasks: T[] }[];
  todayYmd: string;
  renderTask: (task: T) => ReactNode;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {overdue.length > 0 && (
        <TaskDayColumn
          ymd={todayYmd}
          todayYmd={todayYmd}
          titleOverride="متأخرة"
          count={overdue.length}
          showQuickAdd={false}
          tone="danger"
        >
          {overdue.map(renderTask)}
        </TaskDayColumn>
      )}
      <TaskDayColumn ymd={todayYmd} todayYmd={todayYmd} titleOverride="بدون موعد" count={noDate.length}>
        {noDate.map(renderTask)}
      </TaskDayColumn>
      {days.map((day) => (
        <TaskDayColumn
          key={day.ymd}
          ymd={day.ymd}
          todayYmd={todayYmd}
          count={day.tasks.length}
          quickAddDueDate={`${day.ymd}T12:00`}
        >
          {day.tasks.map(renderTask)}
        </TaskDayColumn>
      ))}
    </div>
  );
}
