export type SafeDatabaseErrorSummary = {
  errorName: string;
  errorCode?: string;
  errorNumber?: number;
  sqlState?: string;
};

function safeToken(value: unknown, pattern: RegExp, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || !pattern.test(normalized)) return undefined;
  return normalized;
}

/**
 * Creates a log-safe database error summary.
 * Never returns message, stack, SQL text, bound parameters, user IDs or cause objects.
 */
export function summarizeDatabaseError(error: unknown): SafeDatabaseErrorSummary {
  const outer = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const cause = outer.cause && typeof outer.cause === "object"
    ? outer.cause as Record<string, unknown>
    : {};
  const errorName = safeToken(outer.name, /^[A-Za-z][A-Za-z0-9_.-]{0,47}$/, 48) ?? "UnknownError";
  const errorCode = safeToken(outer.code ?? cause.code, /^[A-Z0-9_-]{1,48}$/i, 48);
  const rawNumber = outer.errno ?? cause.errno;
  const errorNumber = typeof rawNumber === "number" && Number.isInteger(rawNumber)
    && rawNumber >= 0 && rawNumber <= 2_147_483_647
    ? rawNumber
    : undefined;
  const sqlState = safeToken(
    outer.sqlState ?? outer.sqlstate ?? cause.sqlState ?? cause.sqlstate,
    /^[A-Z0-9]{5}$/i,
    5,
  );
  return {
    errorName,
    ...(errorCode ? { errorCode } : {}),
    ...(errorNumber !== undefined ? { errorNumber } : {}),
    ...(sqlState ? { sqlState } : {}),
  };
}
