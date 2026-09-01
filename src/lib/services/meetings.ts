import { zonedInputToUtc } from "@/lib/datetime";

export const MEETING_TYPES = ["call", "onsite", "online"] as const;
export const MEETING_STATUSES = ["scheduled", "done", "cancelled"] as const;
export type MeetingType = (typeof MEETING_TYPES)[number];
export type MeetingStatus = (typeof MEETING_STATUSES)[number];

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  call: "مكالمة",
  onsite: "حضوري",
  online: "أونلاين",
};
export const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {
  scheduled: "مجدول",
  done: "تم",
  cancelled: "ملغي",
};

export interface MeetingFormValues {
  title: string;
  description: string;
  meetingAt: string; // datetime-local wall clock (Cairo)
  durationMinutes: string;
  location: string;
  type: string;
  status: string;
  clientId: string;
  projectId: string;
}

export interface MeetingParsed {
  meetingAtUtc: Date | null;
  durationMinutes: number | null;
  type: MeetingType;
  status: MeetingStatus;
}

export function parseMeetingForm(formData: FormData): {
  values: MeetingFormValues;
  errors: Record<string, string>;
  parsed: MeetingParsed;
} {
  const values: MeetingFormValues = {
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    meetingAt: String(formData.get("meetingAt") ?? "").trim(),
    durationMinutes: String(formData.get("durationMinutes") ?? "").trim(),
    location: String(formData.get("location") ?? "").trim(),
    type: String(formData.get("type") ?? "call").trim(),
    status: String(formData.get("status") ?? "scheduled").trim(),
    clientId: String(formData.get("clientId") ?? "").trim(),
    projectId: String(formData.get("projectId") ?? "").trim(),
  };

  const errors: Record<string, string> = {};

  if (!values.title) errors.title = "عنوان الاجتماع مطلوب.";
  else if (values.title.length > 200) errors.title = "العنوان طويل جدًا.";

  const meetingAtUtc = zonedInputToUtc(values.meetingAt);
  if (!meetingAtUtc) errors.meetingAt = "أدخل تاريخًا ووقتًا صحيحين.";

  let durationMinutes: number | null = null;
  if (values.durationMinutes) {
    const n = Number(values.durationMinutes);
    if (!Number.isInteger(n) || n <= 0 || n > 24 * 60) {
      errors.durationMinutes = "المدة يجب أن تكون رقمًا موجبًا بالدقائق.";
    } else {
      durationMinutes = n;
    }
  }

  const type = (MEETING_TYPES as readonly string[]).includes(values.type)
    ? (values.type as MeetingType)
    : "call";
  const status = (MEETING_STATUSES as readonly string[]).includes(values.status)
    ? (values.status as MeetingStatus)
    : "scheduled";
  if (!(MEETING_TYPES as readonly string[]).includes(values.type)) {
    errors.type = "نوع غير صالح.";
  }
  if (!(MEETING_STATUSES as readonly string[]).includes(values.status)) {
    errors.status = "حالة غير صالحة.";
  }

  return {
    values,
    errors,
    parsed: { meetingAtUtc, durationMinutes, type, status },
  };
}
