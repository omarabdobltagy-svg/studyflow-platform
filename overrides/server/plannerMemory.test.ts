import { describe, expect, it } from "vitest";
import { buildPlannerMemorySnapshot } from "./plannerMemory";

describe("structured planner memory", () => {
  it("preserves provenance and confidence for independently tracked frontiers", () => {
    const snapshot = buildPlannerMemorySnapshot({
      profile: {
        educationSystem: "baccalaureate",
        gradeYear: "G2",
        track: "science",
        subjectIds: ["ARB_G2_BAC"],
        selection: {
          learningCourseProgress: {
            ARB_G2_BAC: {
              branches: {
                ARB_NAHW: {
                  lastCompletedLessonId: "ARB_U2_N1",
                  studentFrontierConfirmedAt: "2026-11-25T10:00:00.000Z",
                  teacherTeachingFrontierId: "ARB_U3_N1",
                },
              },
            },
          },
          teacherSchedules: {
            ARB_G2_BAC: [{ dayOfWeek: 6, startTime: "10:00" }],
          },
        },
      },
    });

    expect(snapshot.curriculumEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "student_frontier",
        value: "ARB_U2_N1",
        provenance: expect.objectContaining({ source: "student_profile.learningCourseProgress", confidence: "high" }),
      }),
      expect.objectContaining({
        kind: "teacher_frontier",
        value: "ARB_U3_N1",
        provenance: expect.objectContaining({ confidence: "low" }),
      }),
    ]));
    expect(snapshot.teacherSchedule).toHaveLength(1);
  });

  it("keeps task completion separate from curriculum completion", () => {
    const snapshot = buildPlannerMemorySnapshot({
      profile: { educationSystem: "baccalaureate", gradeYear: "G2", track: "science", subjectIds: ["ARB_G2_BAC"], selection: {} },
      tasks: [
        { id: 3, title: "حل واجب", status: "done", estimatedMinutes: 20 },
        { id: 4, title: "مشاهدة المحاضرة", status: "todo", estimatedMinutes: 60 },
      ],
    });
    expect(snapshot.completedTasks).toHaveLength(1);
    expect(snapshot.openTasks).toHaveLength(1);
    expect(snapshot.curriculumEvidence).toHaveLength(0);
  });

  it("does not create curriculum evidence for an unknown frontier", () => {
    const snapshot = buildPlannerMemorySnapshot({
      profile: {
        subjectIds: ["ARB_G2_BAC"],
        selection: { learningCourseProgress: { ARB_G2_BAC: { branches: { ARB_NAHW: { lastCompletedLessonId: "__UNKNOWN__" } } } } },
      },
    });
    expect(snapshot.curriculumEvidence).toHaveLength(0);
  });

  it("keeps active recurring study routines and today's completion state as separate evidence", () => {
    const snapshot = buildPlannerMemorySnapshot({
      profile: { subjectIds: [], selection: {} },
      routines: [{
        id: 8,
        name: "جلسة الصباح",
        period: "morning",
        isActive: true,
        updatedAt: "2026-11-25T08:00:00.000Z",
        items: [
          { id: 1, title: "مراجعة الملاحظات", durationMinutes: 15, isActive: true, completedToday: true },
          { id: 2, title: "قراءة الدرس", durationMinutes: 30, isActive: false, completedToday: false },
        ],
      }],
    });
    expect(snapshot.routines).toHaveLength(1);
    expect(snapshot.routines[0]).toMatchObject({
      kind: "study_routine",
      entityId: "8",
      value: {
        name: "جلسة الصباح",
        items: [{ title: "مراجعة الملاحظات", completedToday: true }],
      },
      provenance: { source: "routines", confidence: "high" },
    });
    expect(snapshot.sourceCoverage.routineRecords).toBe(1);
  });

  it("does not treat not-started markers as completed curriculum frontiers", () => {
    const snapshot = buildPlannerMemorySnapshot({
      profile: {
        subjectIds: ["ARB_G2_BAC"],
        selection: {
          learningCourseProgress: {
            ARB_G2_BAC: {
              branches: {
                ARB_NAHW: { lastCompletedLessonId: "__NOT_STARTED__" },
              },
            },
          },
        },
      },
    });
    expect(snapshot.curriculumEvidence).toHaveLength(0);
  });
});
