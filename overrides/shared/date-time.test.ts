import { describe, expect, it } from "vitest";
import { formatTime12Hour, getCalendarDaysBetween, getDateKeyInTimeZone } from "./date-time";

describe("timezone-safe calendar dates", () => {
  it("uses an explicit timezone instead of relying on locale-specific date formatting", () => {
    expect(getDateKeyInTimeZone(new Date("2026-11-27T22:30:00.000Z"))).toBe("2026-11-28");
    expect(getDateKeyInTimeZone(new Date("2026-11-27T19:00:00.000Z"))).toBe("2026-11-27");
  });

  it("counts exam days by calendar date across day, month, and year boundaries", () => {
    expect(getCalendarDaysBetween("2026-11-27", "2026-11-29")).toBe(2);
    expect(getCalendarDaysBetween("2026-11-27", "2026-11-28")).toBe(1);
    expect(getCalendarDaysBetween("2026-12-31", "2027-01-02")).toBe(2);
  });

  it("handles leap days and rejects malformed dates", () => {
    expect(getCalendarDaysBetween("2028-02-28", "2028-03-01")).toBe(2);
    expect(() => getCalendarDaysBetween("2026-02-30", "2026-03-01")).toThrow();
    expect(() => getCalendarDaysBetween("27/11/2026", "2026-11-29")).toThrow();
  });
});

describe("12-hour clock display", () => {
  it("renders midnight, noon, and late evening as 12-hour times", () => {
    expect(formatTime12Hour("00:00", "en-US")).toMatch(/12:00\s?AM/);
    expect(formatTime12Hour("12:00", "en-US")).toMatch(/12:00\s?PM/);
    expect(formatTime12Hour("23:59", "en-US")).toMatch(/11:59\s?PM/);
    expect(formatTime12Hour("13:05", "en-US")).toMatch(/1:05\s?PM/);
  });
});
