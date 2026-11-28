import { describe, expect, it } from "vitest";
import {
  classifyOfficialEducationUpdate,
  isHighConfidenceOfficialPlanningSignal,
  parseOfficialEducationPage,
  scanOfficialEducationSources,
} from "./official-education-monitor";

const source = {
  sourceId: "moe_test",
  label: "وزارة التربية والتعليم",
  url: "https://moe.gov.eg/ar/",
};
const scope = {
  educationSystem: "baccalaureate",
  gradeYear: "الصف الثاني الثانوي – دفعة 2027",
  subjects: ["اللغة العربية", "الإنجليزية", "التاريخ"],
};

describe("official education source monitor", () => {
  it("extracts only same-host HTTPS links and classifies a dated Baccalaureate exam update", () => {
    const html = [
      "<article>",
      '<time datetime="2026-11-20T09:00:00Z"></time>',
      '<a href="/ar/news/exam-schedule">جدول امتحانات البكالوريا المصرية للصف الثاني</a>',
      "<p>جدول امتحانات البكالوريا المصرية للصف الثاني من الوزارة.</p>",
      "</article>",
      '<a href="https://facebook.com/external">جدول امتحانات البكالوريا</a>',
      '<a href="javascript:alert(1)">جدول امتحانات البكالوريا</a>',
    ].join("");
    const updates = parseOfficialEducationPage(html, source, scope, new Date("2026-11-28T00:00:00Z"));
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      sourceId: "moe_test",
      sourceHost: "moe.gov.eg",
      impactType: "exam_schedule",
      confidence: "high",
      publishedAt: "2026-11-20T09:00:00.000Z",
    });
    expect(isHighConfidenceOfficialPlanningSignal(updates[0])).toBe(true);
  });

  it("does not promote undated or general headlines to automatic planning signals", () => {
    const undated = classifyOfficialEducationUpdate(
      "جدول امتحانات البكالوريا المصرية",
      "إعلان عن جدول الامتحانات.",
      source,
      scope,
      null,
      "2026-11-28T00:00:00.000Z",
    );
    expect(undated.confidence).toBe("medium");
    expect(isHighConfidenceOfficialPlanningSignal(undated)).toBe(false);

    const general = classifyOfficialEducationUpdate(
      "أخبار وزارة التربية والتعليم",
      "تحديثات عامة للمدارس.",
      source,
      scope,
      "2026-11-27T00:00:00.000Z",
      "2026-11-28T00:00:00.000Z",
    );
    expect(general.impactType).toBe("general");
    expect(general.confidence).toBe("low");
  });

  it("does not fetch official portals for a different grade year", async () => {
    let calls = 0;
    const result = await scanOfficialEducationSources(
      { educationSystem: "baccalaureate", gradeYear: "الصف الأول الثانوي", subjects: [] },
      new Date("2026-11-28T00:00:00Z"),
      async () => {
        calls += 1;
        throw new Error("must not fetch");
      },
    );
    expect(calls).toBe(0);
    expect(result.updates).toEqual([]);
  });

  it("does not fetch Ministry portals for other education systems", async () => {
    let calls = 0;
    const result = await scanOfficialEducationSources(
      { educationSystem: "general_secondary", gradeYear: "الصف الثاني", subjects: [] },
      new Date("2026-11-28T00:00:00Z"),
      async () => {
        calls += 1;
        throw new Error("must not fetch");
      },
    );
    expect(calls).toBe(0);
    expect(result.updates).toEqual([]);
  });
});
