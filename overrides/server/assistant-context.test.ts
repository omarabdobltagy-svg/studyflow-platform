import { describe, expect, it } from "vitest";
import { buildStandaloneAssistantContext } from "./assistant-context";

describe("standalone curriculum assistant context boundary", () => {
  it("contains only subjects, curriculum and retrieved textbook evidence", () => {
    const context = buildStandaloneAssistantContext({
      subjects: ["اللغة العربية", "الإنجليزية"],
      curriculum: "Unit 3: Echoes of the Past\nLesson 1: Sites of Memory",
      textbookEvidence: "المقتطف المسترجع من الكتاب.",
    });

    expect(context).toContain("اللغة العربية");
    expect(context).toContain("Lesson 1");
    expect(context).toContain("المقتطف المسترجع");
    expect(context).not.toContain("المهام غير المكتملة");
    expect(context).not.toContain("المواعيد القادمة");
    expect(context).not.toContain("قرارات التخطيط");
    expect(context).not.toContain("مواضع المدرسين");
  });

  it("does not invent curriculum or textbook content when sources are absent", () => {
    const context = buildStandaloneAssistantContext({
      subjects: [],
      curriculum: "",
      textbookEvidence: "",
    });

    expect(context).toContain("لم تُحدد مادة بعد");
    expect(context).toContain("لا يتوفر فهرس");
    expect(context).toContain("لم يُسترجع نص مطابق");
    expect(context).not.toContain("الخطة اليومية");
  });

  it("labels uploaded attachments separately from official textbook sources", () => {
    const context = buildStandaloneAssistantContext({
      subjects: ["التاريخ"],
      curriculum: "الدرس الأول",
      textbookEvidence: "",
      attachmentContext: "ملخص أرفقه الطالب.",
    });

    expect(context).toContain("مرفق من الطالب للمناقشة فقط");
    expect(context).toContain("ملخص أرفقه الطالب.");
  });
});
