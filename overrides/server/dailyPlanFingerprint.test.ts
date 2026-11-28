import { describe, expect, it } from "vitest";
import {
  createDailyPlanSourceFingerprint,
  createPlannerRelevantSelection,
} from "./dailyPlanFingerprint";

const fingerprintForSelection = (selection: unknown) =>
  createDailyPlanSourceFingerprint({
    startDate: "2026-11-28",
    dailyMinutes: 120,
    profile: createPlannerRelevantSelection(selection),
  });

describe("daily plan source fingerprint", () => {
  it("is stable when object key ordering changes", () => {
    expect(createDailyPlanSourceFingerprint({ profile: { a: 1, b: 2 }, minutes: 120 }))
      .toBe(createDailyPlanSourceFingerprint({ minutes: 120, profile: { b: 2, a: 1 } }));
  });

  it("changes when a study input changes", () => {
    const before = createDailyPlanSourceFingerprint({ frontier: "ARB_U1_N1", tasks: [{ id: 1, status: "todo" }] });
    const after = createDailyPlanSourceFingerprint({ frontier: "ARB_U1_N2", tasks: [{ id: 1, status: "todo" }] });
    expect(after).not.toBe(before);
  });

  it("changes when a task is completed or edited", () => {
    const todo = createDailyPlanSourceFingerprint({ tasks: [{ id: 1, title: "النحو", status: "todo" }] });
    const done = createDailyPlanSourceFingerprint({ tasks: [{ id: 1, title: "النحو", status: "done" }] });
    const renamed = createDailyPlanSourceFingerprint({ tasks: [{ id: 1, title: "البلاغة", status: "todo" }] });
    expect(done).not.toBe(todo);
    expect(renamed).not.toBe(todo);
  });

  it("ignores ordinary public uploads, scan timestamps, channel resolution and assistant chat memory", () => {
    const before = fingerprintForSelection({
      teacherSchedules: { ARB_G2_BAC: [{ dayOfWeek: 0, startTime: "10:00" }] },
      assistantMemory: "المعلومة السابقة",
      assistantMemoryUpdatedAt: "2026-11-27T08:00:00.000Z",
      teacherPublicScanState: { teacher1: "2026-11-27T08:00:00.000Z" },
      teacherYoutubeChannels: { teacher1: "UC1234567890123456789012" },
      teacherPublicUpdates: [{
        externalId: "youtube:ordinary-video",
        teacherId: "teacher1",
        teacherName: "مدرس",
        sourceType: "youtube",
        title: "فيديو جديد",
        description: "محتوى عام",
        url: "https://youtube.com/watch?v=ordinary",
        publishedAt: "2026-11-27T08:00:00.000Z",
        observedAt: "2026-11-27T08:01:00.000Z",
        announcementType: "new_content",
        confidence: "medium",
      }],
    });
    const after = fingerprintForSelection({
      teacherSchedules: { ARB_G2_BAC: [{ startTime: "10:00", dayOfWeek: 0 }] },
      assistantMemory: "معلومة جديدة من محادثة لا تغير بيانات المنهج",
      assistantMemoryUpdatedAt: "2026-11-28T08:00:00.000Z",
      teacherPublicScanState: { teacher1: "2026-11-28T08:00:00.000Z" },
      teacherYoutubeChannels: { teacher1: "UC1234567890123456789012" },
      teacherPublicUpdates: [{
        externalId: "youtube:ordinary-video",
        teacherId: "teacher1",
        teacherName: "مدرس",
        sourceType: "youtube",
        title: "فيديو جديد — وصف محدث",
        description: "محتوى عام محدث",
        url: "https://youtube.com/watch?v=ordinary",
        publishedAt: "2026-11-27T08:00:00.000Z",
        observedAt: "2026-11-28T08:01:00.000Z",
        announcementType: "new_content",
        confidence: "medium",
      }],
    });
    expect(after).toBe(before);
  });

  it("changes when an explicit high-confidence class schedule update is received", () => {
    const before = fingerprintForSelection({ teacherPublicUpdates: [] });
    const after = fingerprintForSelection({
      teacherPublicUpdates: [{
        externalId: "facebook:class-change-1",
        teacherId: "teacher1",
        publishedAt: "2026-11-28T08:00:00.000Z",
        announcementType: "schedule_changed",
        confidence: "high",
        affectedDate: "2026-11-29",
        title: "تغيير موعد المحاضرة",
        description: "تم نقل المحاضرة إلى يوم الأحد",
        url: "https://example.com/update",
      }],
    });
    expect(after).not.toBe(before);
  });

  it("changes when a teacher video has completed topic or instruction analysis", () => {
    const before = fingerprintForSelection({
      teacherPublicUpdates: [{
        externalId: "youtube:review-1",
        teacherId: "teacher1",
        publishedAt: "2026-11-28T08:00:00.000Z",
        announcementType: "new_content",
        confidence: "medium",
        contentAnalysis: { status: "processing" },
      }],
    });
    const after = fingerprintForSelection({
      teacherPublicUpdates: [{
        externalId: "youtube:review-1",
        teacherId: "teacher1",
        publishedAt: "2026-11-28T08:00:00.000Z",
        announcementType: "new_content",
        confidence: "medium",
        contentAnalysis: {
          status: "complete",
          summaryAr: "مراجعة على الوحدة الأولى",
          topics: [{ titleAr: "الدرس الأول", confidence: "high", startSeconds: 120, endSeconds: 420 }],
          teacherInstructions: [{ instructionAr: "حل الواجب قبل المحاضرة القادمة", explicit: true, kind: "homework", confidence: "high" }],
        },
      }],
    });
    expect(after).not.toBe(before);
  });

  it("does not invalidate a plan for incomplete, failed or retrying video analysis", () => {
    const base = { teacherPublicUpdates: [{ externalId: "youtube:review-2", teacherId: "teacher1", publishedAt: "2026-11-28T08:00:00.000Z" }] };
    const before = fingerprintForSelection({ ...base, teacherPublicUpdates: [{ ...base.teacherPublicUpdates[0], contentAnalysis: { status: "failed", error: "temporary" } }] });
    const after = fingerprintForSelection({ ...base, teacherPublicUpdates: [{ ...base.teacherPublicUpdates[0], contentAnalysis: { status: "retry_wait", retryCount: 2, nextRetryAt: "2026-11-28T10:00:00.000Z" } }] });
    expect(after).toBe(before);
  });


  it("ignores official scan timestamps, low-confidence notices and generic headlines", () => {
    const before = fingerprintForSelection({
      officialEducationScanState: { lastAttemptAt: "2026-11-27T08:00:00.000Z" },
      officialEducationUpdates: [],
    });
    const after = fingerprintForSelection({
      officialEducationScanState: { lastAttemptAt: "2026-11-28T08:00:00.000Z" },
      officialEducationUpdates: [{
        externalId: "moe:general",
        sourceId: "moe_main",
        sourceLabel: "وزارة التربية والتعليم",
        sourceHost: "moe.gov.eg",
        title: "خبر عام",
        excerpt: "تحديثات عامة",
        url: "https://moe.gov.eg/ar/news/general",
        publishedAt: "2026-11-28T07:00:00.000Z",
        observedAt: "2026-11-28T08:00:00.000Z",
        impactType: "general",
        confidence: "low",
        affectedSubjects: [],
      }],
    });
    expect(after).toBe(before);
  });

  it("changes only when a recent high-confidence official Baccalaureate planning update is recorded", () => {
    const before = fingerprintForSelection({ officialEducationUpdates: [] });
    const after = fingerprintForSelection({
      officialEducationUpdates: [{
        externalId: "moe_main:https://moe.gov.eg/ar/news/bac-exams",
        sourceId: "moe_main",
        sourceLabel: "وزارة التربية والتعليم",
        sourceHost: "moe.gov.eg",
        title: "جدول امتحانات البكالوريا المصرية",
        excerpt: "إعلان رسمي عن جدول امتحانات الصف الثاني بكالوريا",
        url: "https://moe.gov.eg/ar/news/bac-exams",
        publishedAt: "2026-11-27T09:00:00.000Z",
        observedAt: "2026-11-28T09:00:00.000Z",
        impactType: "exam_schedule",
        confidence: "high",
        affectedSubjects: ["اللغة العربية"],
      }],
    });
    expect(after).not.toBe(before);
  });

  it("still changes when teacher schedules change", () => {
    const before = fingerprintForSelection({ teacherSchedules: { ARB_G2_BAC: [{ dayOfWeek: 0, startTime: "10:00" }] } });
    const after = fingerprintForSelection({ teacherSchedules: { ARB_G2_BAC: [{ dayOfWeek: 0, startTime: "12:00" }] } });
    expect(after).not.toBe(before);
  });
});
