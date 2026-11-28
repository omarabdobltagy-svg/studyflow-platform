import { describe, expect, it } from "vitest";
import { createServerClockAnchor, estimateServerTimeMs } from "./server-clock";

describe("server-authoritative clock", () => {
  it("estimates server time at response receipt from half the round trip", () => {
    const anchor = createServerClockAnchor(1_800_000_000_000, 100, 300);
    expect(anchor.roundTripMs).toBe(200);
    expect(anchor.serverTimeAtReceiptMs).toBe(1_800_000_000_100);
  });
  it("advances with a monotonic timer rather than device wall clock", () => {
    const anchor = createServerClockAnchor(1_800_000_000_000, 100, 300);
    expect(estimateServerTimeMs(anchor, 1_300)).toBe(1_800_000_001_100);
    expect(estimateServerTimeMs(anchor, 50)).toBe(anchor.serverTimeAtReceiptMs);
  });
  it("rejects invalid samples instead of falling back to device time", () => {
    expect(() => createServerClockAnchor(Number.NaN, 100, 300)).toThrow();
    expect(() => createServerClockAnchor(1_800_000_000_000, 300, 100)).toThrow();
  });
});
