import { describe, expect, it } from "vitest";
import { getRateLimitClientIp } from "./clientIp";

describe("getRateLimitClientIp", () => {
  it("uses Railway's validated public-edge X-Real-IP ahead of Express's proxy peer", () => {
    expect(getRateLimitClientIp({
      headers: { "x-real-ip": "203.0.113.24" },
      ip: "100.64.0.10",
      socket: { remoteAddress: "100.64.0.10" },
    })).toBe("203.0.113.24");
  });

  it("accepts a valid IPv6 client address", () => {
    expect(getRateLimitClientIp({
      headers: { "x-real-ip": "2001:db8::42" },
      ip: "100.64.0.10",
    })).toBe("2001:db8::42");
  });

  it("ignores malformed or chained X-Real-IP values", () => {
    expect(getRateLimitClientIp({
      headers: { "x-real-ip": "203.0.113.24, 198.51.100.2" },
      ip: "198.51.100.8",
    })).toBe("198.51.100.8");
    expect(getRateLimitClientIp({
      headers: { "x-real-ip": "unknown" },
      socket: { remoteAddress: "192.0.2.8" },
    })).toBe("192.0.2.8");
  });

  it("does not trust X-Forwarded-For directly and falls back to the socket peer", () => {
    expect(getRateLimitClientIp({
      headers: { "x-real-ip": undefined },
      ip: undefined,
      socket: { remoteAddress: "198.51.100.18" },
    })).toBe("198.51.100.18");
  });

  it("returns unknown if no validated IP address exists", () => {
    expect(getRateLimitClientIp({
      headers: { "x-real-ip": "not-an-ip" },
      ip: "not-an-ip",
      socket: { remoteAddress: "not-an-ip" },
    })).toBe("unknown");
  });
});
