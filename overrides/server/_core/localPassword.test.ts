import { describe, expect, it } from "vitest";
import { scryptSync } from "node:crypto";
import { hashLocalPassword, verifyLocalPassword } from "./localPassword";

describe("local account passwords", () => {
  it("creates salted scrypt hashes that verify only against the original password", () => {
    const hash = hashLocalPassword("StudyFlow-Secure-2026!");
    expect(hash).toMatch(/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
    expect(verifyLocalPassword("StudyFlow-Secure-2026!", hash)).toBe(true);
    expect(verifyLocalPassword("different-password", hash)).toBe(false);
  });

  it("continues to verify the first preview build's separator-less hashes", () => {
    const salt = "0123456789abcdef0123456789abcdef";
    const derived = scryptSync("StudyFlow-QA-Password!", salt, 64).toString("hex");
    expect(verifyLocalPassword("StudyFlow-QA-Password!", `scrypt${salt}${derived}`)).toBe(true);
    expect(verifyLocalPassword("wrong-password", `scrypt${salt}${derived}`)).toBe(false);
  });

  it("rejects malformed or unsupported password hash formats", () => {
    expect(verifyLocalPassword("anything", "scrypt$short$hash")).toBe(false);
    expect(verifyLocalPassword("anything", null)).toBe(false);
  });
});
