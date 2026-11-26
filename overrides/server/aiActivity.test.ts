import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearAIActivityForTests,
  completeAIActivity,
  failAIActivity,
  getAIActivitySnapshot,
  startAIActivity,
  updateAIActivity,
} from "./aiActivity";

describe("shared AI activity progress", () => {
  afterEach(() => {
    clearAIActivityForTests();
    vi.useRealTimers();
  });

  it("publishes real stage changes in order and completes the active stage", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-26T10:00:00.000Z"));
    const id = startAIActivity(21, {
      kind: "daily_plan",
      title: "إعادة ترتيب خطة اليوم",
      stage: "قراءة التغييرات",
      detail: "يراجع موضع الطالب وموضع المدرس.",
    });

    vi.advanceTimersByTime(1_000);
    updateAIActivity(21, id, "فحص المنهج", "يقارن مواضع التقدم بفهرس الدروس.");
    vi.advanceTimersByTime(1_000);
    updateAIActivity(21, id, "تحليل الخطة", "يرتب المهام وفق الوقت والأولوية.");

    const snapshot = getAIActivitySnapshot(21);
    expect(snapshot.active).toHaveLength(1);
    expect(snapshot.active[0]).toMatchObject({
      id,
      kind: "daily_plan",
      status: "running",
      stage: "تحليل الخطة",
    });
    expect(snapshot.active[0].events.map(event => event.status)).toEqual(["complete", "complete", "active"]);

    completeAIActivity(21, id, "تم تحديث الخطة ومزامنتها مع المهام.");
    const completed = getAIActivitySnapshot(21);
    expect(completed.active).toHaveLength(0);
    expect(completed.recent[0]).toMatchObject({
      id,
      status: "complete",
      detail: "تم تحديث الخطة ومزامنتها مع المهام.",
    });
    expect(completed.recent[0].events.at(-1)?.stage).toBe("اكتملت العملية");
  });

  it("isolates each student's activity and exposes failures without leaking other users' state", () => {
    const id = startAIActivity(21, {
      kind: "assistant",
      title: "المساعد الدراسي",
      stage: "استرجاع المنهج",
      detail: "يبحث في الفهرس المتاح.",
    });
    failAIActivity(21, id, "تعذّر الاتصال بمزود الذكاء الاصطناعي.");

    expect(getAIActivitySnapshot(21).recent[0]).toMatchObject({
      id,
      status: "failed",
      error: "تعذّر الاتصال بمزود الذكاء الاصطناعي.",
    });
    expect(getAIActivitySnapshot(22)).toEqual({ active: [], recent: [] });
  });

  it("expires completed activity records after their short display window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-26T10:00:00.000Z"));
    const id = startAIActivity(21, {
      kind: "planner",
      title: "إنشاء مسودة خطة",
      stage: "تحليل الملف",
      detail: "يجمع بيانات الخطة.",
    });
    completeAIActivity(21, id, "اكتملت المسودة.");

    vi.advanceTimersByTime(46_000);
    expect(getAIActivitySnapshot(21)).toEqual({ active: [], recent: [] });
  });
});
