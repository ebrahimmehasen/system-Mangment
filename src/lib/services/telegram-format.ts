import { formatColumnHeader, formatDayLabel, formatShortDay, formatTime, ymdInTz } from "@/lib/datetime";

/** Plain data + string builders for the Telegram bot (HTML parse mode). No I/O, so they are unit-testable. */

export interface BotMeeting {
  title: string;
  meetingAt: Date;
  location: string | null;
}
export interface BotReminder {
  title: string;
  remindAt: Date;
}
export interface BotTask {
  title: string;
  priority: number;
  dueDate: Date | null;
  /** "YYYY-MM-DD" it was originally due, when late and still open. */
  lateSince: string | null;
}

const MAX_ITEMS = 10;

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function cap(lines: string[]): string[] {
  if (lines.length <= MAX_ITEMS) return lines;
  return [...lines.slice(0, MAX_ITEMS), `… و ${lines.length - MAX_ITEMS} أخرى`];
}

function whenLabel(d: Date, todayYmd: string): string {
  const ymd = ymdInTz(d);
  const day = ymd === todayYmd ? "" : `${formatColumnHeader(ymd, todayYmd).relative} `;
  return `${day}${formatTime(d)}`;
}

const meetingLine = (m: BotMeeting, today: string) =>
  `• <b>${whenLabel(m.meetingAt, today)}</b> — ${escapeHtml(m.title)}${m.location ? ` (${escapeHtml(m.location)})` : ""}`;

const reminderLine = (r: BotReminder, today: string) => {
  const late = ymdInTz(r.remindAt) < today;
  return `• <b>${late ? `متأخر من ${formatShortDay(ymdInTz(r.remindAt))}` : whenLabel(r.remindAt, today)}</b> — ${escapeHtml(r.title)}`;
};

const taskLine = (t: BotTask) => {
  const tags = [
    t.priority > 0 ? `أولوية ${t.priority}` : null,
    t.lateSince ? `متأخرة من ${formatShortDay(t.lateSince)}` : null,
  ].filter(Boolean);
  return `• ${escapeHtml(t.title)}${tags.length ? ` <i>(${tags.join(" · ")})</i>` : ""}`;
};

function section(title: string, lines: string[]): string {
  return lines.length === 0 ? "" : `\n<b>${title} (${lines.length})</b>\n${cap(lines).join("\n")}\n`;
}

export function formatMeetings(items: BotMeeting[], today: string): string {
  if (items.length === 0) return "مفيش مواعيد قادمة خلال الأسبوع الجاي.";
  return `<b>المواعيد القادمة</b>\n${cap(items.map((m) => meetingLine(m, today))).join("\n")}`;
}

export function formatReminders(items: BotReminder[], today: string): string {
  if (items.length === 0) return "مفيش تذكيرات مفتوحة.";
  return `<b>تذكيراتك المفتوحة</b>\n${cap(items.map((r) => reminderLine(r, today))).join("\n")}`;
}

export function formatTasks(items: BotTask[]): string {
  if (items.length === 0) return "مفيش مهام مفتوحة قريبة.";
  return `<b>مهامك المفتوحة</b>\n${cap(items.map(taskLine)).join("\n")}`;
}

/** The morning message and the /today answer. Returns "" when there is nothing to report. */
export function formatDigest(input: {
  name: string | null;
  todayYmd: string;
  meetings: BotMeeting[];
  reminders: BotReminder[];
  tasks: BotTask[];
}): string {
  const { meetings, reminders, tasks, todayYmd } = input;
  if (meetings.length + reminders.length + tasks.length === 0) return "";
  const hello = input.name ? `صباح الخير يا ${escapeHtml(input.name)}` : "صباح الخير";
  return (
    `<b>${hello}</b>\n${formatDayLabel(input.todayYmd)}\n` +
    section("الاجتماعات", meetings.map((m) => meetingLine(m, todayYmd))) +
    section("التذكيرات", reminders.map((r) => reminderLine(r, todayYmd))) +
    section("المهام", tasks.map(taskLine))
  ).trim();
}

export type BotCommand = "start" | "help" | "today" | "meetings" | "reminders" | "tasks" | "unlink" | "unknown";

const COMMAND_WORDS: Record<string, BotCommand> = {
  start: "start",
  help: "help",
  مساعدة: "help",
  today: "today",
  اليوم: "today",
  meetings: "meetings",
  مواعيد: "meetings",
  المواعيد: "meetings",
  الاجتماعات: "meetings",
  reminders: "reminders",
  تذكيرات: "reminders",
  التذكيرات: "reminders",
  tasks: "tasks",
  مهام: "tasks",
  المهام: "tasks",
  unlink: "unlink",
  فصل: "unlink",
};

/** "/start@MyBot ABC123" -> { command: "start", arg: "ABC123" }. A leading slash is optional (so Arabic words work). */
export function parseBotCommand(text: string): { command: BotCommand; arg: string } {
  const [first = "", ...rest] = text.trim().split(/\s+/);
  const word = first.replace(/^\//, "").replace(/@.*$/, "").toLowerCase();
  return { command: COMMAND_WORDS[word] ?? "unknown", arg: rest.join(" ") };
}
