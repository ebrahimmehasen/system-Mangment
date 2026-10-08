export const APP_TZ = "Africa/Cairo";

/**
 * Interpret a wall-clock string ("2026-09-05T14:30", as produced by an
 * <input type="datetime-local">) as a time in `tz` and return the UTC instant.
 */
export function zonedInputToUtc(
  localStr: string,
  tz: string = APP_TZ,
): Date | null {
  const m = localStr?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  // Start by treating the wall time as if it were UTC, then correct by
  // the offset the target zone had at that moment.
  const asUtc = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi));
  const tzMs = new Date(
    asUtc.toLocaleString("en-US", { timeZone: tz }),
  ).getTime();
  const utcMs = new Date(
    asUtc.toLocaleString("en-US", { timeZone: "UTC" }),
  ).getTime();
  return new Date(asUtc.getTime() - (tzMs - utcMs));
}

/** UTC instant -> "YYYY-MM-DDTHH:mm" wall-clock string in `tz` (for input prefill). */
export function utcToZonedInput(date: Date, tz: string = APP_TZ): string {
  const s = date.toLocaleString("sv-SE", { timeZone: tz }); // "2026-09-05 14:30:00"
  return s.slice(0, 16).replace(" ", "T");
}

const dateTimeFmt = new Intl.DateTimeFormat("ar-EG", {
  timeZone: APP_TZ,
  dateStyle: "medium",
  timeStyle: "short",
});
const dateFmt = new Intl.DateTimeFormat("ar-EG", {
  timeZone: APP_TZ,
  dateStyle: "medium",
});
const timeFmt = new Intl.DateTimeFormat("ar-EG", {
  timeZone: APP_TZ,
  timeStyle: "short",
});

export const formatDateTime = (d: Date) => dateTimeFmt.format(d);
export const formatDate = (d: Date) => dateFmt.format(d);
export const formatTime = (d: Date) => timeFmt.format(d);

/** "YYYY-MM-DD" for a date, in the app timezone. */
export function ymdInTz(d: Date, tz: string = APP_TZ): string {
  return d.toLocaleString("sv-SE", { timeZone: tz }).slice(0, 10);
}

const dayLabelFmt = new Intl.DateTimeFormat("ar-EG", {
  timeZone: APP_TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
});

/** "YYYY-MM-DD" -> "الأربعاء 30 سبتمبر" (app timezone-safe: parsed as Cairo noon, not UTC midnight). */
export function formatDayLabel(ymd: string): string {
  return dayLabelFmt.format(new Date(`${ymd}T12:00:00Z`));
}

const shortDayFmt = new Intl.DateTimeFormat("ar-EG", {
  timeZone: APP_TZ,
  day: "numeric",
  month: "long",
});
const weekdayFmt = new Intl.DateTimeFormat("ar-EG", { timeZone: APP_TZ, weekday: "long" });

/** "YYYY-MM-DD" -> "30 سبتمبر". */
export function formatShortDay(ymd: string): string {
  return shortDayFmt.format(new Date(`${ymd}T12:00:00Z`));
}

/** Board column header: "اليوم" / "غداً" / weekday name, plus "day month". */
export function formatColumnHeader(ymd: string, todayYmd: string): { relative: string; date: string } {
  const tomorrowYmd = new Date(`${todayYmd}T12:00:00Z`);
  tomorrowYmd.setUTCDate(tomorrowYmd.getUTCDate() + 1);
  const tomorrow = tomorrowYmd.toISOString().slice(0, 10);

  const d = new Date(`${ymd}T12:00:00Z`);
  const relative = ymd === todayYmd ? "اليوم" : ymd === tomorrow ? "غداً" : weekdayFmt.format(d);
  return { relative, date: shortDayFmt.format(d) };
}
