export const DAILY_PLAN_REFRESH_MS = 24 * 60 * 60 * 1_000;

/**
 * Refresh a student's saved daily plan once it is at least 24 hours old.
 * Invalid or future timestamps are treated as stale rather than trusted.
 */
export function isDailyPlanStale(createdAt: Date | string | number | null | undefined, now = Date.now()): boolean {
  if (createdAt == null) return true;
  const timestamp = createdAt instanceof Date
    ? createdAt.getTime()
    : typeof createdAt === "number"
      ? createdAt
      : Date.parse(createdAt);
  if (!Number.isFinite(timestamp) || timestamp > now) return true;
  return now - timestamp >= DAILY_PLAN_REFRESH_MS;
}
