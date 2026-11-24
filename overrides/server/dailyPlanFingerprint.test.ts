import { describe, expect, it } from "vitest";
import { createDailyPlanSourceFingerprint } from "./dailyPlanFingerprint";

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
});
