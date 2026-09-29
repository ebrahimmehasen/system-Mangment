import { zonedInputToUtc } from "@/lib/datetime";

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
