import { describe, expect, it } from "vitest";
import {
  addCairoCalendarDays, buildCairoCalendarDateKeys, cairoDateKeyToDate,
  getCairoDateKey, groupItemsByCairoDate, shiftCairoCalendarCursor,
} from "./cairo-calendar-utils";

describe("Cairo calendar date handling", () => {
  it("uses Cairo date keys independently of the device timezone", () => {
    expect(getCairoDateKey(new Date("2026-11-28T22:30:00.000Z"))).toBe("2026-11-29");
    expect(cairoDateKeyToDate("2026-11-29").toISOString()).toBe("2026-11-29T12:00:00.000Z");
  });
  it("adds calendar days over month and year boundaries", () => {
    expect(addCairoCalendarDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addCairoCalendarDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addCairoCalendarDays("2028-03-01", -1)).toBe("2028-02-29");
  });
  it("builds Saturday-first month, week, and agenda ranges", () => {
    const month = buildCairoCalendarDateKeys("2026-11-28", "month");
    expect(month).toHaveLength(42);
    expect(month[0]).toBe("2026-10-31");
    expect(month[28]).toBe("2026-11-28");
    expect(buildCairoCalendarDateKeys("2026-11-29", "week")).toEqual([
      "2026-11-28", "2026-11-29", "2026-11-30", "2026-12-01",
      "2026-12-02", "2026-12-03", "2026-12-04",
    ]);
    expect(buildCairoCalendarDateKeys("2026-11-28", "agenda")).toHaveLength(14);
  });
  it("shifts cursor using calendar days, not elapsed milliseconds", () => {
    expect(shiftCairoCalendarCursor("2026-11-29", "week", 1)).toBe("2026-12-06");
    expect(shiftCairoCalendarCursor("2026-11-29", "month", -1)).toBe("2026-10-01");
  });
  it("groups events by Cairo date", () => {
    const grouped = groupItemsByCairoDate([
      { id: "late", startAt: "2026-11-29T22:30:00.000Z" },
      { id: "early", startAt: "2026-11-29T10:00:00.000Z" },
    ]);
    expect(grouped["2026-11-30"].map(item => item.id)).toEqual(["late"]);
    expect(grouped["2026-11-29"].map(item => item.id)).toEqual(["early"]);
  });
});
