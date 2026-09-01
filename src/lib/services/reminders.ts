import { zonedInputToUtc } from "@/lib/datetime";

export interface ReminderFormValues {
  title: string;
  note: string;
  remindAt: string; // datetime-local (Cairo wall clock)
  clientId: string;
  projectId: string;
  meetingId: string;
}

export function parseReminderForm(formData: FormData): {
  values: ReminderFormValues;
  errors: Record<string, string>;
  parsed: { remindAtUtc: Date | null };
} {
  const values: ReminderFormValues = {
    title: String(formData.get("title") ?? "").trim(),
    note: String(formData.get("note") ?? "").trim(),
    remindAt: String(formData.get("remindAt") ?? "").trim(),
    clientId: String(formData.get("clientId") ?? "").trim(),
    projectId: String(formData.get("projectId") ?? "").trim(),
    meetingId: String(formData.get("meetingId") ?? "").trim(),
  };

  const errors: Record<string, string> = {};
  if (!values.title) errors.title = "عنوان التذكير مطلوب.";
  else if (values.title.length > 200) errors.title = "العنوان طويل جدًا.";

  const remindAtUtc = zonedInputToUtc(values.remindAt);
  if (!remindAtUtc) errors.remindAt = "أدخل تاريخًا ووقتًا صحيحين.";

  return { values, errors, parsed: { remindAtUtc } };
}

export const SNOOZE_OPTIONS = [
  { hours: 1, label: "ساعة" },
  { hours: 24, label: "يوم" },
  { hours: 24 * 3, label: "3 أيام" },
  { hours: 24 * 7, label: "أسبوع" },
];
