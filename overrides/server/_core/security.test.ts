import { describe, expect, it } from "vitest";
import { getSecurityHeaders, isAllowedSameOrigin } from "./security";

describe("same-origin request guard", () => {
  it("accepts the exact host and scheme sent through the reverse proxy", () => {
    expect(isAllowedSameOrigin("https://studyflow.example", "studyflow.example", "https")).toBe(true);
  });

  it("rejects foreign origins, scheme downgrade, malformed origins and missing host context", () => {
    expect(isAllowedSameOrigin("https://evil.example", "studyflow.example", "https")).toBe(false);
    expect(isAllowedSameOrigin("http://studyflow.example", "studyflow.example", "https")).toBe(false);
    expect(isAllowedSameOrigin("not-a-url", "studyflow.example", "https")).toBe(false);
    expect(isAllowedSameOrigin("https://studyflow.example", "", "https")).toBe(false);
  });

  it("allows an absent Origin for non-browser integrations", () => {
    expect(isAllowedSameOrigin(undefined, "internal.service", "http")).toBe(true);
  });

  it("adds baseline browser security headers and HSTS only on HTTPS", () => {
    const httpHeaders = getSecurityHeaders(false);
    const httpsHeaders = getSecurityHeaders(true);
    expect(httpHeaders["X-Content-Type-Options"]).toBe("nosniff");
    expect(httpHeaders["X-Frame-Options"]).toBe("DENY");
    expect(httpHeaders["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(httpHeaders["Strict-Transport-Security"]).toBeUndefined();
    expect(httpsHeaders["Strict-Transport-Security"]).toContain("max-age=31536000");
  });
});
