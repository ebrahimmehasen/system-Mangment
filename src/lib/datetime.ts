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
