import { describe, expect, it } from "vitest";
import {
  hashStudentPassword,
  isValidStudentUsername,
  normalizeStudentUsername,
  verifyStudentPassword,
} from "./local-auth";

describe("local student authentication helpers", () => {
  it("normalizes usernames for case-insensitive uniqueness", () => {
    expect(normalizeStudentUsername("  Omar.Student  ")).toBe("omar.student");
  });

  it("accepts only the supported username format", () => {
    expect(isValidStudentUsername("omar_2026")).toBe(true);
    expect(isValidStudentUsername("om")).toBe(false);
    expect(isValidStudentUsername("omar name")).toBe(false);
    expect(isValidStudentUsername("omar@site")).toBe(false);
  });

  it("verifies a salted password hash without storing the original password", async () => {
    const password = "correct-horse-24";
    const hash = await hashStudentPassword(password);
    expect(hash).not.toContain(password);
    expect(await verifyStudentPassword(password, hash)).toBe(true);
    expect(await verifyStudentPassword("different-password", hash)).toBe(false);
  });

  it("rejects malformed or unsupported hashes", async () => {
    expect(await verifyStudentPassword("anything", "plain-text-password")).toBe(false);
    expect(await verifyStudentPassword("anything", "scrypt$bad$hash")).toBe(false);
  });
});
