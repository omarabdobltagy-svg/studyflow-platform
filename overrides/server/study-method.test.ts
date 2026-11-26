import { describe, expect, it } from "vitest";
import { buildLessonStudyMethod, formatStudyMethodNotes } from "./study-method";

describe("student-facing lesson study method", () => {
  it("uses a clear first-learning sequence and explains the second reading", () => {
    const method = buildLessonStudyMethod();
    expect(method.stages.map(stage => stage.title)).toEqual([
      "خُد فكرة سريعة عن الدرس قبل الشرح",
      "شاهد شرح المدرس بتركيز",
      "ارجع اقرأ الدرس مرة تانية بعد المحاضرة",
      "اشرح الدرس لنفسك بطريقتك",
      "خد راحة قصيرة قبل التطبيق",
      "راجع واجب المدرس وحل المطلوب",
      "أكمل امتحان المدرس قبل المحاضرة القادمة",
    ]);
    const secondRead = method.stages[2];
    expect(secondRead.instruction).toContain("اقرأه بهدوء");
    expect(secondRead.reason).toContain("المرور على المعلومة مرة واحدة غالبًا مش كفاية");
    expect(method.stages[0].instruction).toContain("مش مطلوب تحفظ أو تفهم كل تفصيلة");
  });

  it("does not invent homework or tests when the teacher has neither", () => {
    const method = buildLessonStudyMethod({
      homeworkPolicy: "no",
      homeworkRequiredBeforeNextLecture: "no",
      preLectureExamRequired: "no",
    });
    expect(method.stages.some(stage => stage.title.includes("واجب"))).toBe(false);
    expect(method.stages.some(stage => stage.title.includes("امتحان"))).toBe(false);
    expect(method.teacherPolicyNote).toContain("لا تشير إلى واجب أو امتحان");
  });

  it("distinguishes an assigned homework from a mandatory pre-lecture requirement", () => {
    const assignedButNotMandatory = buildLessonStudyMethod({
      homeworkPolicy: "yes",
      homeworkRequiredBeforeNextLecture: "no",
      preLectureExamRequired: "no",
    });
    const homework = assignedButNotMandatory.stages.find(stage => stage.title.includes("واجب"));
    expect(homework).toBeDefined();
    expect(homework?.optional).toBe(true);
    expect(homework?.instruction).toContain("بكل أسئلته المطلوبة");
    expect(homework?.instruction).not.toContain("خمسة أسئلة");

    const mandatory = buildLessonStudyMethod({
      homeworkPolicy: "yes",
      homeworkRequiredBeforeNextLecture: "yes",
      preLectureExamRequired: "yes",
    });
    const mandatoryHomework = mandatory.stages.find(stage => stage.title.includes("واجب"));
    const mandatoryExam = mandatory.stages.find(stage => stage.title.includes("امتحان"));
    expect(mandatoryHomework?.optional).toBe(false);
    expect(mandatoryExam?.optional).toBe(false);
  });

  it("keeps unknown teacher requirements conditional instead of assuming them", () => {
    const method = buildLessonStudyMethod({
      homeworkPolicy: "no",
      homeworkRequiredBeforeNextLecture: "unknown",
      preLectureExamRequired: "unknown",
    });
    const homework = method.stages.find(stage => stage.title.includes("واجب"));
    const exam = method.stages.find(stage => stage.title.includes("امتحان"));
    expect(homework?.optional).toBe(true);
    expect(homework?.instruction).toContain("اتأكد هل المدرس نزّل واجبًا");
    expect(exam?.optional).toBe(true);
    expect(method.teacherPolicyNote).toContain("غير ثابت أو لم يتم التحقق منه");
  });

  it("states that full mastery is not required to finish a single lesson task", () => {
    const method = buildLessonStudyMethod({ homeworkPolicy: "no", homeworkRequiredBeforeNextLecture: "no", preLectureExamRequired: "no" });
    expect(method.completionCriteria).toContain("مش مطلوب تكون حافظ 100%");
    expect(method.completionCriteria).toContain("الفكرة الأساسية");
  });

  it("serializes all student instructions and their rationale for the task page", () => {
    const method = buildLessonStudyMethod({ homeworkPolicy: "no", homeworkRequiredBeforeNextLecture: "no", preLectureExamRequired: "no" });
    const notes = formatStudyMethodNotes(method);
    expect(notes).toContain("طريقة المذاكرة:");
    expect(notes).toContain("ليه الخطوة دي؟");
    expect(notes).toContain("متى تعتبر المهمة مكتملة؟");
    expect(notes).toContain("مش مطلوب تكون حافظ 100%");
  });
});
