import { describe, expect, it } from "vitest";
import { FixedWindowRateLimiter } from "./authRateLimit";

describe("FixedWindowRateLimiter", () => {
  it("blocks after the configured failures and resets at the window boundary", () => {
    const limiter = new FixedWindowRateLimiter(3, 100);
    limiter.record("ip", 0);
    limiter.record("ip", 10);
    limiter.record("ip", 20);
    expect(limiter.isLimited("ip", 99)).toBe(true);
    expect(limiter.isLimited("ip", 100)).toBe(false);
  });

  it("consumes registration attempts even when the account is successfully created", () => {
    const limiter = new FixedWindowRateLimiter(2, 900);
    expect(limiter.consume("ip", 10)).toBe(true);
    expect(limiter.consume("ip", 11)).toBe(true);
    expect(limiter.consume("ip", 12)).toBe(false);
  });

  it("resets only the successful login's failed-attempt counter", () => {
    const limiter = new FixedWindowRateLimiter(2, 900);
    limiter.record("ip", 10);
    limiter.record("ip", 11);
    expect(limiter.isLimited("ip", 12)).toBe(true);
    limiter.reset("ip");
    expect(limiter.isLimited("ip", 12)).toBe(false);
  });

  it("bounds its key map", () => {
    const limiter = new FixedWindowRateLimiter(2, 900, 2);
    limiter.record("a", 1);
    limiter.record("b", 2);
    limiter.record("c", 3);
    expect(limiter.isLimited("c", 4)).toBe(false);
    expect(limiter.isLimited("a", 4)).toBe(false);
  });
});
