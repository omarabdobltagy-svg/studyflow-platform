import { createHash } from "node:crypto";

function canonicalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).sort().map(key => [key, canonicalize(record[key])]));
  }
  return value;
}

/** Stable, non-reversible identifier for the current student planning inputs. */
export function createDailyPlanSourceFingerprint(source: unknown): string {
  const serialized = JSON.stringify(canonicalize(source));
  return createHash("sha256").update(serialized).digest("hex").slice(0, 32);
}
