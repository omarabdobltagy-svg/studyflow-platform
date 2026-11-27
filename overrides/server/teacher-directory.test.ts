import { describe, expect, it } from "vitest";
import { normalizeTeacherDirectoryName } from "./db";

describe("shared teacher directory identity", () => {
  it("normalizes Arabic hamza, alef maqsura and tashkeel before deduplication", () => {
    expect(normalizeTeacherDirectoryName("أ/ مُحَمَّد صَلَاح")).toBe("ا محمد صلاح");
    expect(normalizeTeacherDirectoryName("محمود رضوان")).toBe("محمود رضوان");
    expect(normalizeTeacherDirectoryName("أحمد  إبراهيم")).toBe("احمد ابراهيم");
  });

  it("normalizes punctuation and repeated whitespace consistently", () => {
    expect(normalizeTeacherDirectoryName("  Mr.   Ahmed   Ibrahim! ")).toBe("mr ahmed ibrahim");
  });

  it("returns an empty key for input without letters or numbers", () => {
    expect(normalizeTeacherDirectoryName(" — / ... ")).toBe("");
  });
});
