import { describe, expect, it } from "vitest";
import { DAILY_PLAN_REFRESH_MS, isDailyPlanStale } from "./planLifecycle";

describe("daily plan lifecycle", () => {
  const now = Date.UTC(2026, 10, 24, 10, 0, 0);

  it("keeps a plan fresh before 24 hours", () => {
    expect(isDailyPlanStale(now - DAILY_PLAN_REFRESH_MS + 1, now)).toBe(false);
  });

  it("refreshes a plan at or after 24 hours", () => {
    expect(isDailyPlanStale(now - DAILY_PLAN_REFRESH_MS, now)).toBe(true);
    expect(isDailyPlanStale(now - DAILY_PLAN_REFRESH_MS - 1, now)).toBe(true);
  });

  it("treats missing, invalid, or future timestamps as stale", () => {
    expect(isDailyPlanStale(null, now)).toBe(true);
    expect(isDailyPlanStale("not-a-date", now)).toBe(true);
    expect(isDailyPlanStale(now + 1, now)).toBe(true);
  });
});
