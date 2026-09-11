import { zonedInputToUtc } from "@/lib/datetime";

export interface AnnouncementFormValues {
  title: string;
  body: string;
  meetingAt: string; // datetime-local (Cairo wall clock), optional
}

export function parseAnnouncementForm(formData: FormData): {
  values: AnnouncementFormValues;
  errors: Record<string, string>;
  parsed: { meetingAtUtc: Date | null };
} {
  const values: AnnouncementFormValues = {
    title: String(formData.get("title") ?? "").trim(),
    body: String(formData.get("body") ?? "").trim(),
    meetingAt: String(formData.get("meetingAt") ?? "").trim(),
  };

  const errors: Record<string, string> = {};
  if (!values.title) errors.title = "عنوان الإعلان مطلوب.";
  else if (values.title.length > 200) errors.title = "العنوان طويل جدًا.";

  let meetingAtUtc: Date | null = null;
  if (values.meetingAt) {
    meetingAtUtc = zonedInputToUtc(values.meetingAt);
    if (!meetingAtUtc) errors.meetingAt = "أدخل تاريخًا ووقتًا صحيحين.";
  }

  return { values, errors, parsed: { meetingAtUtc } };
}
