import type { ReactNode } from "react";
import { BoardScroller } from "./BoardScroller";
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
    <BoardScroller>
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
      <TaskDayColumn ymd={todayYmd} todayYmd={todayYmd} titleOverride="بدون موعد"
        count={noDate.length}
        dropYmd={null}
      >
        {noDate.map(renderTask)}
      </TaskDayColumn>
      {days.map((day) => (
        <TaskDayColumn
          key={day.ymd}
          ymd={day.ymd}
          todayYmd={todayYmd}
          count={day.tasks.length}
          quickAddDueDate={`${day.ymd}T12:00`}
          dropYmd={day.ymd >= todayYmd ? day.ymd : undefined}
        >
          {day.tasks.map(renderTask)}
        </TaskDayColumn>
      ))}
    </BoardScroller>
  );
}
