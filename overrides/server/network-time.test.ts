import { describe, expect, it } from "vitest";
import { reconcileNetworkTimeReadings } from "./network-time";

describe("internet time synchronization", () => {
  it("reconciles provider samples at one monotonic instant", () => {
    const result = reconcileNetworkTimeReadings([
      { provider: "google", timeAtReceiptMs: 1_000_000, monotonicAtReceiptMs: 100, roundTripMs: 80 },
      { provider: "cloudflare", timeAtReceiptMs: 1_000_050, monotonicAtReceiptMs: 150, roundTripMs: 100 },
    ], 250);
    expect(result?.utcAtSyncMs).toBe(1_000_150);
    expect(result?.providers).toEqual(["google", "cloudflare"]);
  });

  it("rejects conflicting providers rather than choosing an unsafe clock", () => {
    const result = reconcileNetworkTimeReadings([
      { provider: "google", timeAtReceiptMs: 1_000_000, monotonicAtReceiptMs: 100, roundTripMs: 80 },
      { provider: "cloudflare", timeAtReceiptMs: 1_050_000, monotonicAtReceiptMs: 100, roundTripMs: 100 },
    ], 200);
    expect(result).toBeNull();
  });

  it("returns no internet sample when every provider is unavailable", () => {
    expect(reconcileNetworkTimeReadings([], 200)).toBeNull();
  });
});
