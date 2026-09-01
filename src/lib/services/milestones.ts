export interface MilestoneFormValues {
  title: string;
  description: string;
  dueDate: string; // yyyy-mm-dd or ""
}

export function parseMilestoneForm(formData: FormData): {
  values: MilestoneFormValues;
  errors: Record<string, string>;
  parsed: { dueDate: Date | null };
} {
  const values: MilestoneFormValues = {
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    dueDate: String(formData.get("dueDate") ?? "").trim(),
  };

  const errors: Record<string, string> = {};
  if (!values.title) errors.title = "عنوان المرحلة مطلوب.";
  else if (values.title.length > 200) errors.title = "العنوان طويل جدًا.";

  let dueDate: Date | null = null;
  if (values.dueDate) {
    dueDate = new Date(values.dueDate);
    if (Number.isNaN(dueDate.getTime())) {
      errors.dueDate = "أدخل تاريخًا صحيحًا.";
      dueDate = null;
    }
  }

  return { values, errors, parsed: { dueDate } };
}

export interface MilestoneRow {
  id: string;
  title: string;
  description: string | null;
  dueDate: Date | null;
  completedAt: Date | null;
  sortOrder: number;
}

export function milestoneProgress(milestones: { completedAt: Date | null }[]): {
  done: number;
  total: number;
  percent: number;
} {
  const total = milestones.length;
  const done = milestones.filter((m) => m.completedAt).length;
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export function isOverdue(m: { dueDate: Date | null; completedAt: Date | null }, now = new Date()): boolean {
  return !!m.dueDate && !m.completedAt && m.dueDate.getTime() < now.getTime();
}
