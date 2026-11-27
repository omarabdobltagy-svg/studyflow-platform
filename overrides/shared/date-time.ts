export const DEFAULT_STUDY_TIME_ZONE = "Africa/Cairo";

function parseDateKey(value: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("Expected a calendar date in YYYY-MM-DD format.");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, date);
  const parsed = new Date(timestamp);
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== date) {
    throw new Error("Invalid calendar date.");
  }
  return timestamp;
}

/** Returns a stable YYYY-MM-DD calendar key for a timezone, independent of locale formatting. */
export function getDateKeyInTimeZone(
  value: Date = new Date(),
  timeZone = DEFAULT_STUDY_TIME_ZONE,
): string {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new Error("A valid Date is required.");
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? "";
  const year = part("year");
  const month = part("month").padStart(2, "0");
  const day = part("day").padStart(2, "0");
  if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month) || !/^\d{2}$/.test(day)) {
    throw new Error("Could not resolve the calendar date for the requested timezone.");
  }
  return year + "-" + month + "-" + day;
}

/** Difference between two calendar dates; positive means endDate is later. */
export function getCalendarDaysBetween(startDate: string, endDate: string): number {
  return Math.round((parseDateKey(endDate) - parseDateKey(startDate)) / 86_400_000);
}

/** Formats stored HH:mm clock values without converting their wall-clock timezone. */
export function formatTime12Hour(
  value: string | Date,
  locale = "ar-EG",
  timeZone = DEFAULT_STUDY_TIME_ZONE,
): string {
  let date: Date;
  let zone = timeZone;
  if (typeof value === "string") {
    const match = /^(\d{2}):([0-5]\d)$/.exec(value);
    if (match) {
      const hour = Number(match[1]);
      const minute = Number(match[2]);
      if (hour > 23) return value;
      date = new Date(Date.UTC(2000, 0, 1, hour, minute));
      zone = "UTC";
    } else {
      date = new Date(value);
    }
  } else {
    date = value;
  }
  if (!Number.isFinite(date.getTime())) return typeof value === "string" ? value : "";
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: zone,
  }).format(date);
}
