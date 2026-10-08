import { zonedInputToUtc, ymdInTz } from "@/lib/datetime";

export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "قيد الانتظار",
  in_progress: "جارية",
  done: "تمت",
};

export interface TaskFormValues {
  title: string;
  description: string;
  projectId: string;
  dueDate: string; // datetime-local (Cairo wall clock), optional
}

export function parseTaskForm(formData: FormData): {
  values: TaskFormValues;
  errors: Record<string, string>;
  parsed: { dueDateUtc: Date | null };
} {
  const values: TaskFormValues = {
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    projectId: String(formData.get("projectId") ?? "").trim(),
    dueDate: String(formData.get("dueDate") ?? "").trim(),
  };

  const errors: Record<string, string> = {};
  if (!values.title) errors.title = "عنوان المهمة مطلوب.";
  else if (values.title.length > 200) errors.title = "العنوان طويل جدًا.";

  let dueDateUtc: Date | null = null;
  if (values.dueDate) {
    dueDateUtc = zonedInputToUtc(values.dueDate);
    if (!dueDateUtc) errors.dueDate = "أدخل تاريخًا ووقتًا صحيحين.";
  }

  return { values, errors, parsed: { dueDateUtc } };
}

/** "YYYY-MM-DD" -> "YYYY-MM-DD" + n days, plain calendar-day math (no TZ conversion needed on a date-only string). */
export function shiftYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

export const TASK_PRIORITY_MAX = 99;

/** Parses a priority input: blank/0 -> 0 (none), 1..99 -> itself, anything else -> null (invalid). */
export function parseTaskPriority(raw: unknown): number | null {
  const str = String(raw ?? "").trim();
  if (str === "") return 0;
  if (!/^\d{1,2}$/.test(str)) return null;
  const n = Number(str);
  return n >= 0 && n <= TASK_PRIORITY_MAX ? n : null;
}

export interface TaskBucketInput {
  id: string;
  dueDate: Date | null;
  status: string;
  priority: number;
}

/** Board order inside one column: open before done, then higher priority first, then earlier due time. */
function compareTasks(a: TaskBucketInput, b: TaskBucketInput): number {
  if ((a.status === "done") !== (b.status === "done")) return a.status === "done" ? 1 : -1;
  if (a.priority !== b.priority) return b.priority - a.priority;
  return (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0);
}

/**
 * Groups tasks (already fetched for the relevant window) into: overdue
 * (safety net — should be empty right after a rollover), no-due-date, and
 * one bucket per Cairo calendar day in [rangeStartYmd, rangeEndYmd]. Empty
 * days are omitted (Todoist-Upcoming style — only days with tasks show).
 * Within a day, pending tasks come before done ones.
 */
export function bucketizeTasks<T extends TaskBucketInput>(
  tasks: T[],
  todayYmd: string,
  rangeStartYmd: string,
  rangeEndYmd: string,
  /** Board mode: keep every day in range as its own column, even with 0 tasks
   * (a Todoist-style board needs an empty column to still show "+ add"). The
   * flowing-list mode (default) omits empty days instead. */
  includeEmptyDays = false,
): { overdue: T[]; noDate: T[]; days: { ymd: string; tasks: T[] }[] } {
  const overdue: T[] = [];
  const noDate: T[] = [];
  const byDay = new Map<string, T[]>();

  for (const t of tasks) {
    if (!t.dueDate) {
      noDate.push(t);
      continue;
    }
    const ymd = ymdInTz(t.dueDate);
    if (ymd < todayYmd && t.status !== "done") {
      overdue.push(t);
      continue;
    }
    if (ymd < rangeStartYmd || ymd > rangeEndYmd) continue; // outside the visible window
    const list = byDay.get(ymd) ?? [];
    list.push(t);
    byDay.set(ymd, list);
  }

  const sortDayTasks = (list: T[]) => [...list].sort(compareTasks);

  const days: { ymd: string; tasks: T[] }[] = [];
  let cursor = rangeStartYmd;
  while (cursor <= rangeEndYmd) {
    const list = byDay.get(cursor);
    if (includeEmptyDays) days.push({ ymd: cursor, tasks: list ? sortDayTasks(list) : [] });
    else if (list && list.length > 0) days.push({ ymd: cursor, tasks: sortDayTasks(list) });
    cursor = shiftYmd(cursor, 1);
  }

  return { overdue: sortDayTasks(overdue), noDate: sortDayTasks(noDate), days };
}

/** Visual "lightness" step for a postponed task's card, capped. */
export function postponementOpacityClass(count: number): string {
  if (count <= 0) return "";
  if (count === 1) return "opacity-90";
  if (count === 2) return "opacity-75";
  return "opacity-60";
}

export interface TaskStatsInput {
  id: string;
  status: string;
  dueDate: Date | null;
  completedAt: Date | null;
  postponementCount: number;
  assignees: { userId: string; name: string | null; email: string }[];
}

export interface TaskDashboardStats {
  myActive: number;
  teamActive: number;
  completedToday: number;
  postponed: number;
  overdue: number;
  team: { userId: string; label: string; activeCount: number }[];
}

/** Dashboard "Task Statistics" + "Team Task Overview" — DB-driven, no hardcoding (spec #15-17). */
export function computeTaskDashboardStats(
  tasks: TaskStatsInput[],
  meId: string,
  todayYmd: string,
): TaskDashboardStats {
  let myActive = 0;
  let teamActive = 0;
  let completedToday = 0;
  let postponed = 0;
  let overdue = 0;
  const teamCounts = new Map<string, { label: string; activeCount: number }>();

  for (const t of tasks) {
    const isDone = t.status === "done";
    const isMine = t.assignees.some((a) => a.userId === meId);

    if (!isDone) {
      teamActive++;
      if (isMine) myActive++;
      if (t.postponementCount > 0) postponed++;
      if (t.dueDate && ymdInTz(t.dueDate) < todayYmd) overdue++;
      for (const a of t.assignees) {
        const entry = teamCounts.get(a.userId) ?? { label: a.name || a.email, activeCount: 0 };
        entry.activeCount++;
        teamCounts.set(a.userId, entry);
      }
    }
    if (isDone && t.completedAt && ymdInTz(t.completedAt) === todayYmd) completedToday++;
  }

  const team = [...teamCounts.entries()]
    .map(([userId, v]) => ({ userId, label: v.label, activeCount: v.activeCount }))
    .sort((a, b) => b.activeCount - a.activeCount);

  return { myActive, teamActive, completedToday, postponed, overdue, team };
}
