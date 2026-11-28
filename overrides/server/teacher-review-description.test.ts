import { describe, expect, it } from "vitest";
import { getSIECheckpointProgressBranches } from "@shared/sie-catalog";
import { matchTeacherReviewDescription } from "./teacher-review-description";

describe("teacher review description matching", () => {
  it("matches a substantive YouTube description to a concrete lesson in the requested branch", () => {
    const branches = getSIECheckpointProgressBranches("ENG1_G2_BAC");
    const branch = branches.find(item => item.choices.length > 0);
    expect(branch).toBeDefined();
    const choice = branch!.choices[0];
    const description = [
      "مراجعة تفصيلية لمنهج اللغة الإنجليزية للصف الثاني بكالوريا.",
      "تشمل هذه المراجعة شرح وتثبيت موضوع:",
      choice.title,
      "مع توضيح الأفكار الأساسية والتدريب على تطبيقها في أسئلة المنهج.",
    ].join(" ");

    expect(matchTeacherReviewDescription({
      subjectId: "ENG1_G2_BAC",
      branchId: branch!.branchId,
      title: "مراجعة شاملة",
      description,
    })).toContain(choice.title);
  });

  it("does not treat a generic or short description as evidence", () => {
    const branch = getSIECheckpointProgressBranches("ENG1_G2_BAC").find(item => item.choices.length > 0)!;
    expect(matchTeacherReviewDescription({
      subjectId: "ENG1_G2_BAC",
      branchId: branch.branchId,
      title: "مراجعة نهائية",
      description: "مراجعة شاملة بالتوفيق للجميع.",
    })).toEqual([]);
  });

  it("does not use a lesson match from a different branch as evidence", () => {
    const branches = getSIECheckpointProgressBranches("ENG1_G2_BAC").filter(item => item.choices.length > 0);
    expect(branches.length).toBeGreaterThan(1);
    const source = branches[0];
    const other = branches.find(item => item.branchId !== source.branchId)!;
    const choice = source.choices[0];
    const description = "تتناول المراجعة هذا الموضوع بالتفصيل: " + choice.title
      + ". شرح وتطبيق وربط بمفاهيم الوحدة وحل أمثلة وأسئلة تدريبية من المنهج.";

    expect(matchTeacherReviewDescription({
      subjectId: "ENG1_G2_BAC",
      branchId: other.branchId,
      description,
    })).toEqual([]);
  });
});
