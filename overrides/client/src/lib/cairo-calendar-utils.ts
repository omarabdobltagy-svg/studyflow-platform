import { getDateKeyInTimeZone } from "@shared/date-time";

export type CairoCalendarMode = "month" | "week" | "agenda";

function parseDateKey(dateKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) throw new Error("Expected a Cairo calendar date in YYYY-MM-DD format.");
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error("Invalid Cairo calendar date.");
  }
  return date;
}
function formatDateKey(date: Date) {
  return [
    String(date.getUTCFullYear()).padStart(4, "0"),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}
export function getCairoDateKey(value: Date) {
  return getDateKeyInTimeZone(value, "Africa/Cairo");
}
export function cairoDateKeyToDate(dateKey: string) {
  return parseDateKey(dateKey);
}
export function addCairoCalendarDays(dateKey: string, amount: number) {
  if (!Number.isInteger(amount)) throw new Error("Calendar day increments must be integers.");
  const date = parseDateKey(dateKey);
  return formatDateKey(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + amount, 12)));
}
export function buildCairoCalendarDateKeys(cursorDateKey: string, mode: CairoCalendarMode) {
  const cursor = parseDateKey(cursorDateKey);
  let startDateKey = cursorDateKey;
  let length = 14;
  if (mode === "month") {
    const firstDay = formatDateKey(new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1, 12)));
    const weekday = parseDateKey(firstDay).getUTCDay();
    startDateKey = addCairoCalendarDays(firstDay, -((weekday + 1) % 7));
    length = 42;
  } else if (mode === "week") {
    startDateKey = addCairoCalendarDays(cursorDateKey, -((cursor.getUTCDay() + 1) % 7));
    length = 7;
  }
  return Array.from({ length }, (_, index) => addCairoCalendarDays(startDateKey, index));
}
export function shiftCairoCalendarCursor(cursorDateKey: string, mode: CairoCalendarMode, direction: -1 | 1) {
  const cursor = parseDateKey(cursorDateKey);
  if (mode === "month") return formatDateKey(new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + direction, 1, 12)));
  return addCairoCalendarDays(cursorDateKey, direction * (mode === "week" ? 7 : 14));
}
export function groupItemsByCairoDate<T extends { startAt: Date | string }>(items: T[]) {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const value = item.startAt instanceof Date ? item.startAt : new Date(item.startAt);
    if (!Number.isFinite(value.getTime())) continue;
    const key = getCairoDateKey(value);
    (groups[key] ??= []).push(item);
  }
  return groups;
}
