import DashboardLayout from "@/components/DashboardLayout";
import PlanExportActions from "@/components/PlanExportActions";
import QueryErrorNotice from "@/components/QueryErrorNotice";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { getNextOpenPlanStep } from "@/lib/plan-actions";
import { ENGLISH_CURRICULUM_LABELS, displayBranchTitle, displayCurriculumTitle } from "@/lib/curriculum-display";
import {
  getSIECheckpointProgressBranches,
  getSIEStudentVisibleBranches,
  getSIESubject,
  getSIETeacher,
  matchSIECheckpointTask,
} from "@shared/sie-catalog";
import {
  getEffectiveStudentLessonState,
  isStudentLessonState,
  type StudentLessonState,
} from "@shared/sie-lesson-state";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  BrainCircuit,
  CalendarClock,
  CheckCircle2,
  MessageCircle,
  Send,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type PlannerTeacherSession = {
  key: string;
  teacherName: string;
  subjectName: string;
  dateLabel: string;
  time: string;
  sortDate: string;
};

function getPlannerTeacherSessions(profile?: {
  subjectIds?: string[];
  teacherSelections?: Record<string, string>;
  selection?: unknown;
} | null): PlannerTeacherSession[] {
  if (!profile?.subjectIds?.length) return [];
  const selection = (profile.selection ?? {}) as Record<string, any>;
  const schedules = (selection.teacherSchedules ?? {}) as Record<string, Array<{ dayOfWeek: number; startTime: string }>>;
  const teacherChoices = (selection.teacherChoices ?? profile.teacherSelections ?? {}) as Record<string, string>;
  const customTeacherNames = (selection.customTeacherNames ?? {}) as Record<string, string>;
  const now = new Date();
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Cairo", weekday: "short" }).format(now);
  const weekdayIndex: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const todayIndex = weekdayIndex[weekday] ?? 0;
  const currentTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(now);
  const base = new Date(today + "T12:00:00.000Z");
  const sessions: PlannerTeacherSession[] = [];

  for (const subjectId of profile.subjectIds) {
    const slots = schedules[subjectId];
    if (!Array.isArray(slots)) continue;
    const subjectName = getSIESubject(subjectId)?.nameAr ?? subjectId;
    const teacherId = teacherChoices[subjectId] ?? profile.teacherSelections?.[subjectId] ?? "";
    const teacherName = getSIETeacher(teacherId)?.nameAr || customTeacherNames[subjectId] || "مدرس المادة";
    for (const slot of slots) {
      if (!Number.isInteger(slot.dayOfWeek) || slot.dayOfWeek < 0 || slot.dayOfWeek > 6
        || !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(slot.startTime)) continue;
      let offset = (slot.dayOfWeek - todayIndex + 7) % 7;
      if (offset === 0 && slot.startTime <= currentTime) offset = 7;
      const date = new Date(base);
      date.setUTCDate(date.getUTCDate() + offset);
      const sortDate = date.toISOString().slice(0, 10);
      sessions.push({
        key: subjectId + "-" + slot.dayOfWeek + "-" + slot.startTime + "-" + sortDate,
        teacherName,
        subjectName,
        dateLabel: new Intl.DateTimeFormat("ar-EG", {
          timeZone: "Africa/Cairo", weekday: "long", day: "numeric", month: "long",
        }).format(date),
        time: slot.startTime,
        sortDate,
      });
    }
  }
  return sessions.sort((a, b) => a.sortDate.localeCompare(b.sortDate) || a.time.localeCompare(b.time)).slice(0, 8);
}

type PlanningMode = "smart" | "backlog" | "teacher_sync";
type StudyPace = "relaxed" | "balanced" | "intensive";
const PACE_DAILY_CAPACITY: Record<StudyPace, number> = {
  relaxed: 60,
  balanced: 120,
  intensive: 180,
};
type GenerationProgress = {
  status: "running" | "complete" | "failed";
  currentStage: "profile" | "curriculum" | "model" | "validation" | "saving" | "complete";
  completedStages: Array<"profile" | "curriculum" | "model" | "validation" | "saving" | "complete">;
  detail: string;
  updatedAt: number;
  error?: string;
};
type PlanStep = {
  day: string;
  title: string;
  detail: string;
  studyMethod?: { stages: Array<{ title: string; instruction: string; reason: string; optional?: boolean }>; completionCriteria: string; teacherPolicyNote?: string };
  minutes: number;
  category: string;
  phaseId?: "backlog" | "teacher_sync" | "steady" | "review_later";
  priority?: "critical" | "high" | "medium" | "low";
  priorityScore?: number;
  priorityReason?: string;
  priorityEvidenceConfidence?: "low" | "medium" | "high";
  curriculumNodeIds?: string[];
  existingTask?: { id: number; title: string; status: "todo" | "done"; confidence: "exact" | "strong"; dueAt?: string | null };
  resourceRecommendation?: { title: string; url: string; teacherName?: string; reason: string };
  difficulty?: "easy" | "medium" | "hard" | "unknown";
  lessonSize?: "small" | "medium" | "large" | "unknown";
  difficultyBasis?: "student_report" | "curriculum_profile" | "unknown";
  difficultyConfidence?: "low" | "medium" | "high";
  printedPageRange?: [number, number];
  sourcePages?: number[];
  scheduleState?: "scheduled" | "deferred";
  dayIndex?: number | null;
  dateOffsetDays?: number | null;
  scheduleNote?: string;
  sourceTitle?: string;
  sourceStepIndex?: number;
  segmentIndex?: number;
  segmentCount?: number;
  plannerTaskId?: number;
  plannerTaskStatus?: "todo" | "done";
};
type PlanQuality = {
  score: number;
  status: "ready" | "partial" | "blocked";
  blockers: string[];
  warnings: string[];
  stats: {
    availableStudyDays: number;
    studyDaysUsed: number;
    scheduledMinutes: number;
    deferredMinutes: number;
    deferredSteps: number;
    maxDailyLoadMinutes: number;
    maxSessionMinutes: number;
  };
};
type ExecutionStrategyPhase = { id: "backlog" | "teacher_sync" | "steady" | "review_later"; title: string; purpose: string; actions: string[]; completionCriteria: string };
type PlanView = {
  title: string;
  summary: string;
  executionStrategy?: { objective: string; rationale: string; phases?: ExecutionStrategyPhase[] };
  durationLabel: string;
  steps: PlanStep[];
  habits: { title: string; cue: string }[];
  quality?: PlanQuality;
  memorySnapshot?: Record<string, any>;
  // Export component compatibility only; deliberately blank so no AI self-test is created.
  reviewQuestion: string;
  taskSync?: { parentGoalId?: number; stageCount: number; taskCount: number; routineId?: number | null };
};

type PlannerAssistantPatch = {
  title?: string;
  summary?: string;
  updates: Array<{
    index: number;
    changes: Partial<Pick<PlanStep, "title" | "detail" | "category" | "priority" | "phaseId">>;
  }>;
  removeIndexes: number[];
  order?: number[];
};

function applyPlannerAssistantPatch(plan: PlanView, patch: PlannerAssistantPatch): PlanView {
  const removed = new Set(patch.removeIndexes);
  const updatedSteps = plan.steps.map((step, index) => {
    const update = patch.updates.find(item => item.index === index);
    return update ? { ...step, ...update.changes } : step;
  });
  const remaining = plan.steps.map((_, index) => index).filter(index => !removed.has(index));
  const order = patch.order ?? remaining;
  return {
    ...plan,
    ...(patch.title ? { title: patch.title } : {}),
    ...(patch.summary ? { summary: patch.summary } : {}),
    steps: order.map(index => updatedSteps[index]).filter((step): step is PlanStep => Boolean(step)),
    quality: undefined,
  };
}
const DAILY_SNAPSHOT_PREFIX = "SIE_DAILY_PLAN_V4:";
const DAILY_PLAN_PREFIX = "SIE_DAILY_PLAN_V5:";
const DAILY_PLAN_DRAFT_PREFIX = "SIE_DAILY_PLAN_DRAFT_V1:";
const ANNUAL_PLAN_PREFIX = "SIE_ANNUAL_PLAN_V1:";
const STUDY_PLAN_PREFIX = "SIE_STUDY_PLAN_V2:";
const todayCairo = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
const initialPrompt = "كوّن لي خطة مذاكرة عملية موزعة على جميع المواد المحددة في ملفي الدراسي، وليس مادة واحدة فقط. استخدم المهام الحالية وآخر موضع مكتمل وجدول حصص المدرسين، ووازن بين إنهاء المتراكم والاستعداد للمحاضرات الجديدة. اجعل عناوين المهام وشرحها بالعربية الواضحة. لا تنشئ اختبارات أو أسئلة أو واجبات من عندك.";
const planningModeOptions: Array<{ value: PlanningMode; title: string; description: string; marker: string }> = [
  { value: "smart", title: "الخطة الذكية", description: "تخلّص المتراكم، وفي نفس الوقت تجهّزك لشرح المدرس القادم.", marker: "الموصى بها" },
  { value: "backlog", title: "المتراكم أولًا", description: "ركّز على المهام المفتوحة والفجوات المؤكدة قبل إضافة الجديد.", marker: "تركيز" },
  { value: "teacher_sync", title: "مواكبة المدرس", description: "حضّر للموضوع القادم قبل موعد الحصة وحافظ على متابعة الجديد.", marker: "استمرارية" },
];

function isEnglishOnlyText(value: string | null | undefined): boolean {
  const text = String(value ?? "").trim();
  return /[A-Za-z]{3,}/.test(text) && !/[\u0600-\u06FF]/.test(text);
}

function displayArabicText(value: string | null | undefined, fallback: string): string {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  if (isEnglishOnlyText(text)) return fallback;
  let localized = text;
  for (const [english, arabic] of Object.entries(ENGLISH_CURRICULUM_LABELS)) {
    localized = localized.replaceAll(english, arabic);
  }
  return localized
    .replace(/\bUnit\s+(\d+)\s*:/gi, "الوحدة $1:")
    .replace(/\bLesson\s+(\d+)\b/gi, "الدرس $1");
}

function getPlanStepCurriculum(step: PlanStep, subjectIds: string[]) {
  const nodeIds = new Set(step.curriculumNodeIds ?? []);
  for (const subjectId of subjectIds) {
    const branch = getSIECheckpointProgressBranches(subjectId).find(item =>
      item.choices.some(choice => nodeIds.has(choice.nodeId))
    );
    if (!branch) continue;
    const choice = branch.choices.find(item => nodeIds.has(item.nodeId));
    if (!choice) continue;
    return {
      subjectId,
      subject: getSIESubject(subjectId)?.nameAr ?? "مادة دراسية",
      branch: displayBranchTitle(branch.branchTitle),
      lesson: displayCurriculumTitle(choice.title),
      unitNumber: choice.unitNumber,
      unitTitle: choice.unitTitle,
      lessonNumber: choice.lessonNumber,
      lessonType: choice.lessonType,
    };
  }
  const match = matchSIECheckpointTask(subjectIds, [step.title, step.detail, step.category].join(" "));
  if (match) {
    const choice = getSIECheckpointProgressBranches(match.subjectId)
      .flatMap(branch => branch.choices)
      .find(item => item.nodeId === match.nodeId);
    return {
      subjectId: match.subjectId,
      subject: getSIESubject(match.subjectId)?.nameAr ?? "مادة دراسية",
      branch: displayBranchTitle(match.branchTitle),
      lesson: displayCurriculumTitle(match.title),
      unitNumber: choice?.unitNumber,
      unitTitle: choice?.unitTitle,
      lessonNumber: choice?.lessonNumber,
      lessonType: choice?.lessonType,
    };
  }
  return null;
}

function displayPlanStepTitle(step: PlanStep, subjectIds: string[]): string {
  const curriculum = getPlanStepCurriculum(step, subjectIds);
  if (curriculum?.subjectId === "ENG1_G2_BAC" && curriculum.lessonNumber) {
    const unitLabel = curriculum.unitNumber
      ? "الوحدة " + curriculum.unitNumber.toLocaleString("ar-EG")
        + (curriculum.unitTitle ? " — " + curriculum.unitTitle : "")
      : curriculum.unitTitle || "القصة المقررة";
    const lessonKind = curriculum.lessonType === "story" ? "Chapter" : "Lesson";
    const officialSequence = String(curriculum.lessonNumber);
    const unitSequenceMatch = officialSequence.match(/^\\d+\\.(\\d+)$/);
    const lessonLabel = unitSequenceMatch && curriculum.unitNumber
      ? lessonKind + " " + unitSequenceMatch[1] + " (" + officialSequence + ")"
      : lessonKind + " " + officialSequence;
    const segment = step.segmentIndex && step.segmentCount && step.segmentCount > 1
      ? " — الجزء " + step.segmentIndex.toLocaleString("ar-EG") + " من " + step.segmentCount.toLocaleString("ar-EG")
      : "";
    return [unitLabel, lessonLabel, curriculum.lesson]
      .filter(Boolean).join(" · ") + segment;
  }

  const hasLatinText = /[A-Za-z]{3,}/.test(String(step.title ?? ""));
  if (curriculum && hasLatinText) {
    const segment = step.segmentIndex && step.segmentCount && step.segmentCount > 1
      ? " — الجزء " + step.segmentIndex.toLocaleString("ar-EG") + " من " + step.segmentCount.toLocaleString("ar-EG")
      : "";
    return [curriculum.subject, curriculum.branch === "الدروس" ? "" : curriculum.branch, curriculum.lesson]
      .filter(Boolean).join(" · ") + segment;
  }
  const fallback = curriculum
    ? [curriculum.subject, curriculum.branch === "الدروس" ? "" : curriculum.branch, curriculum.lesson]
        .filter(Boolean).join(" · ")
    : "مهمة دراسية";
  return displayArabicText(displayCurriculumTitle(step.title), fallback);
}

function displayPlanStepCategory(step: PlanStep, subjectIds: string[]): string {
  const curriculum = getPlanStepCurriculum(step, subjectIds);
  if (curriculum) return [curriculum.subject, curriculum.branch === "الدروس" ? "" : curriculum.branch].filter(Boolean).join(" · ");
  return displayArabicText(step.category, step.existingTask ? "التزامات مسجلة" : "دراسة");
}

function displayPlanStepDetail(step: PlanStep, subjectIds: string[]): string {
  const fallback = step.existingTask
    ? "نفّذ التكليف المسجل كما هو، ثم حدّث حالة المهمة في قائمتك."
    : getPlanStepCurriculum(step, subjectIds)
      ? "ابدأ من مصدر المادة للدرس المحدد، وتابع شرح المدرس عند توفره، ثم سجّل تقدمك بعد المذاكرة."
      : "راجع المطلوب في المهمة، ونفّذه من المصدر المسجل، ثم حدّث حالتها.";
  return displayArabicText(step.detail, fallback);
}

function parseSavedPlan(record: { planJson: string }): PlanView | null {
  try {
    const saved = JSON.parse(record.planJson) as Partial<PlanView>;
    if (!saved || typeof saved.title !== "string" || !Array.isArray(saved.steps) || saved.steps.length === 0) return null;
    return {
      title: saved.title,
      summary: typeof saved.summary === "string" ? saved.summary : "خطة دراسية مبنية على ملفك وتقدمك.",
      executionStrategy: saved.executionStrategy as PlanView["executionStrategy"],
      durationLabel: "مهام مرنة",
      steps: saved.steps.map((raw: any, index) => ({
        day: "",
        title: typeof raw.title === "string" ? raw.title : "مهمة دراسية",
        detail: typeof raw.detail === "string" ? raw.detail : "نفّذ المهمة ثم سجّل تقدمك.",
        minutes: 0,
        category: typeof raw.category === "string" ? raw.category : "دراسة",
        ...raw,
      })),
      habits: Array.isArray(saved.habits) ? saved.habits : [],
      quality: saved.quality,
      memorySnapshot: saved.memorySnapshot,
      reviewQuestion: "",
    };
  } catch {
    return null;
  }
}

export default function Planner() {
  const utils = trpc.useUtils();
  const [plan, setPlan] = useState<PlanView | null>(null);
  const planningMode: PlanningMode = "smart";
  const [selectedPace, setSelectedPace] = useState<StudyPace>("balanced");
  const dailyMinutes = PACE_DAILY_CAPACITY[selectedPace];
  const [approved, setApproved] = useState(false);
  const [loadedSavedDraft, setLoadedSavedDraft] = useState(false);
  const historyInitialized = useRef(false);
  const initialDailyGenerationStarted = useRef(false);
  const plannerPreferencesInitialized = useRef(false);
  // Open the execution map first; the overview remains one tap away.
  const [plannerTab, setPlannerTab] = useState<"overview" | "schedule" | "curriculum" | "tasks" | "history">("schedule");

  const history = trpc.plans.list.useQuery();
  const profile = trpc.studentProfile.get.useQuery(undefined, {
    retry: 1,
    refetchOnWindowFocus: true,
  });
  const upcomingTeacherSessions = useMemo(
    () => getPlannerTeacherSessions(profile.data),
    [profile.data?.selection, profile.data?.subjectIds, profile.data?.teacherSelections],
  );
  const learning = trpc.learning.get.useQuery(undefined, { staleTime: 15_000 });
  const tasksQuery = trpc.tasks.list.useQuery(undefined, { staleTime: 15_000 });
  const activeDailyPlan = trpc.plans.currentDaily.useQuery(undefined, {
    enabled: !profile.isLoading && !profile.isError && Boolean(profile.data?.subjectIds?.length),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    refetchInterval: query => query.state.data?.plan ? 15_000 : query.state.data?.needsRefresh ? 30_000 : false,
  });

  const progressPreview = useMemo(() => {
    const subjects = profile.data?.subjectIds ?? [];
    const gaps = (learning.data as any)?.gapByBranch ?? {};
    return subjects.flatMap(subjectId =>
      getSIEStudentVisibleBranches(subjectId).map(branch => {
        const gap = gaps[subjectId]?.[branch.branchId];
        const nextIndex = gap?.studentPosition;
        const next = typeof nextIndex === "number" ? branch.choices[nextIndex] : null;
        return {
          key: subjectId + "::" + branch.branchId,
          subjectId,
          branchId: branch.branchId,
          subject: getSIESubject(subjectId)?.nameAr ?? subjectId,
          branch: displayBranchTitle(branch.branchTitle),
          lastCompleted: gap?.studentFrontierTitle ? displayCurriculumTitle(gap.studentFrontierTitle) : (nextIndex === 0 ? "لم يبدأ بعد" : "غير محدد"),
          next: next?.title ? displayCurriculumTitle(next.title) : (gap?.studentPosition === branch.choices.length ? "اكتمل الفرع" : "غير محدد"),
          completedCount: typeof nextIndex === "number" ? Math.max(0, Math.min(nextIndex, branch.choices.length)) : null,
          totalCount: branch.choices.length,
          gapCount: gap?.gapCount ?? null,
          reference: gap?.referenceFrontierTitle ? displayCurriculumTitle(gap.referenceFrontierTitle) : "غير مسجل",
        };
      })
    );
  }, [profile.data?.subjectIds, learning.data]);

  const mappedOpenTasks = useMemo(() => {
    const subjects = profile.data?.subjectIds ?? [];
    return (tasksQuery.data ?? [])
      .filter((task: any) => task.status !== "done")
      .map((task: any) => ({
        task,
        match: matchSIECheckpointTask(subjects, [task.title, task.notes || ""].join(" ")),
      }));
  }, [tasksQuery.data, profile.data?.subjectIds]);
  const progressivePath = useMemo(() => {
    type PathLesson = {
      key: string;
      subject: string;
      branch: string;
      lesson: string;
      state: StudentLessonState;
    };
    const selection = (profile.data?.selection ?? {}) as Record<string, any>;
    const courseProgress = (selection.learningCourseProgress ?? {}) as Record<string, any>;
    const subjectLessonProgress = (selection.subjectLessonProgress ?? {}) as Record<string, any>;
    const sq3rProgress = (selection.sq3rProgress ?? {}) as Record<string, any>;
    const gaps = (learning.data as any)?.gapByBranch ?? {};
    const unseen: PathLesson[] = [];
    const deferred: PathLesson[] = [];
    let unknownBranches = 0;
    let unknownLessons = 0;

    for (const subjectId of profile.data?.subjectIds ?? []) {
      const subjectRecord = courseProgress[subjectId] ?? {};
      const branchRecords = (subjectRecord.branches ?? {}) as Record<string, Record<string, any>>;
      const lessonRecords = {
        ...(subjectLessonProgress[subjectId] ?? {}),
        ...(sq3rProgress[subjectId] ?? {}),
      };
      const subjectLabel = getSIESubject(subjectId)?.nameAr ?? subjectId;

      for (const branch of getSIEStudentVisibleBranches(subjectId)) {
        let savedBranch = branchRecords[branch.branchId] ?? {};
        if (subjectId === "ARB_G2_BAC" && branch.branchId === "ARB_READING" && !Object.keys(savedBranch).length) {
          savedBranch = Object.values(branchRecords).find(record =>
            branch.choices.some(choice => [
              record.lastCompletedLessonId,
              record.teacherTeachingFrontierId,
              record.schoolClassFrontierId,
            ].includes(choice.nodeId))
          ) ?? {};
        }
        const savedLessonStates = (savedBranch.lessonStates ?? {}) as Record<string, { state?: StudentLessonState }>;
        const modelVersion = Number(savedBranch.lessonStateModelVersion ?? 0);
        const gap = gaps[subjectId]?.[branch.branchId];
        const studentPosition = typeof gap?.studentPosition === "number" ? gap.studentPosition : null;
        const referencePosition = typeof gap?.referencePosition === "number" ? gap.referencePosition : null;
        const studentFrontierId = gap?.studentFrontierId ?? "__UNKNOWN__";
        let branchHasUnknownState = false;

        for (const [index, choice] of branch.choices.entries()) {
          const saved = savedLessonStates[choice.nodeId];
          const hasExplicitState = isStudentLessonState(saved?.state);
          let state: StudentLessonState = getEffectiveStudentLessonState({
            choices: branch.choices,
            nodeId: choice.nodeId,
            studentFrontierId,
            lessonStateModelVersion: modelVersion,
            saved,
          });
          if (!hasExplicitState) {
            // A lesson is accumulated only inside the instructor's covered range.
            // Future syllabus checkpoints are not backlog just because the student
            // frontier has not reached them yet.
            if (referencePosition === null || index >= referencePosition || studentPosition === null) {
              state = "not_recorded";
            } else {
              state = index < studentPosition ? "watched_only" : "not_watched";
            }
          }

          const lessonRecord = lessonRecords[choice.nodeId];
          const completedBySq3r = Array.isArray(lessonRecord?.completedSteps)
            && new Set(lessonRecord.completedSteps).size === 5;
          if (completedBySq3r) state = "studied";
          if (state === "studied") continue;
          if (state === "not_recorded") {
            if (referencePosition !== null && index < referencePosition) {
              unknownLessons += 1;
              branchHasUnknownState = true;
            }
            continue;
          }
          const item: PathLesson = {
            key: subjectId + "::" + branch.branchId + "::" + choice.nodeId,
            subject: subjectLabel,
            branch: displayBranchTitle(branch.branchTitle) === "الدروس" ? "" : displayBranchTitle(branch.branchTitle),
            lesson: displayCurriculumTitle(choice.title),
            state,
          };
          if (state === "not_watched") unseen.push(item);
          else if (state === "watched_only" || state === "needs_review") deferred.push(item);
        }

        if (branchHasUnknownState && branch.choices.length > 0) unknownBranches += 1;
      }
    }

    return { unseen, deferred, unknownBranches, unknownLessons };
  }, [profile.data?.selection, profile.data?.subjectIds, learning.data]);
  const isPreflightReady = !profile.isLoading && !learning.isLoading && !tasksQuery.isLoading
    && !profile.isError && !learning.isError && !tasksQuery.isError;

  const savedPlans = useMemo(() => (history.data || [])
    .flatMap(record => {
      const saved = parseSavedPlan(record);
      const prompt = String(record.prompt || "");
      const isLegacyAnnualPlan = prompt.startsWith(ANNUAL_PLAN_PREFIX)
        || saved?.title.includes("الخطة السنوية")
        || saved?.title.includes("الخطة القديمة");
      const isDailyPlanRecord = prompt.startsWith(DAILY_SNAPSHOT_PREFIX)
        || prompt.startsWith(DAILY_PLAN_PREFIX);
      const isUncommittedAutoDraft = prompt.startsWith(DAILY_PLAN_DRAFT_PREFIX);
      const isLegacyManualPlan = prompt.startsWith(STUDY_PLAN_PREFIX);
      if (!saved || isLegacyAnnualPlan || isDailyPlanRecord || isUncommittedAutoDraft || isLegacyManualPlan) return [];
      return [{ id: record.id, createdAt: record.createdAt, plan: saved }];
    })
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()), [history.data]);

  useEffect(() => {
    if (profile.isLoading || profile.isError || plannerPreferencesInitialized.current || !profile.data) return;
    const selection = (profile.data.selection ?? {}) as Record<string, any>;
    const conditions = (selection.studyConditions ?? {}) as Record<string, unknown>;
    const configuredMinutes = Number(conditions.dailyMinutes);
    if (Number.isFinite(configuredMinutes) && configuredMinutes > 0) {
      setSelectedPace(configuredMinutes <= 60 ? "relaxed" : configuredMinutes <= 150 ? "balanced" : "intensive");
    }
    plannerPreferencesInitialized.current = true;
  }, [profile.data, profile.isLoading, profile.isError]);

  const ensureDaily = trpc.plans.ensureDaily.useMutation({
    onSuccess: async result => {
      setPlan({
        ...result.plan,
        habits: Array.isArray(result.plan.habits) ? result.plan.habits : [],
        steps: Array.isArray(result.plan.steps) ? result.plan.steps : [],
        reviewQuestion: "",
        taskSync: {
          stageCount: result.taskCount,
          taskCount: result.taskCount,
        },
      });
      setApproved(true);
      setLoadedSavedDraft(false);
      setPlannerTab("schedule");
      await Promise.all([
        utils.plans.currentDaily.invalidate(),
        utils.tasks.list.invalidate(),
        utils.goals.list.invalidate(),
        utils.dashboard.summary.invalidate(),
        utils.plans.list.invalidate(),
      ]);
      toast.success(result.generated
        ? "تم تحديث خطة واحدة ومزامنة المهام مع مواعيدها."
        : "الخطة الحالية متوافقة مع بياناتك؛ لم يتم إنشاء نسخة جديدة.");
    },
    onError: error => toast.error("تعذّر تحديث الخطة: " + error.message),
  });

  const generationProgress = trpc.plans.generationProgress.useQuery(undefined, {
    enabled: ensureDaily.isPending,
    refetchInterval: ensureDaily.isPending ? 750 : false,
    refetchOnWindowFocus: false,
  });

  const aiActivity = trpc.ai.activity.useQuery(undefined, {
    enabled: Boolean(profile.data?.subjectIds?.length),
    refetchInterval: query => {
      const active = query.state.data?.active ?? [];
      const monitorIsRunning = active.some(item => item.kind === "daily_plan" || item.kind === "teacher_monitor");
      return activeDailyPlan.isLoading || ensureDaily.isPending || monitorIsRunning ? 1_200 : false;
    },
    refetchOnWindowFocus: false,
  });
  const aiCapabilities = trpc.ai.capabilities.useQuery(undefined, {
    enabled: Boolean(profile.data?.subjectIds?.length),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const visibleAIActivities = (aiActivity.data?.active ?? [])
    .filter(item => item.kind === "daily_plan" || item.kind === "teacher_monitor");

  const approvePlan = trpc.plans.approve.useMutation({
    onSuccess: async result => {
      setApproved(true);
      setPlan(current => {
        if (!current) return current;
        const authoritative = "plan" in result && result.plan
          ? { ...(result.plan as unknown as PlanView), reviewQuestion: "" }
          : current;
        return {
          ...authoritative,
          taskSync: {
            parentGoalId: result.parentGoalId,
            stageCount: result.taskCount,
            taskCount: result.taskCount,
            routineId: result.routineId ?? null,
          },
        };
      });
      await Promise.all([
        utils.plans.currentDaily.invalidate(),
        utils.tasks.list.invalidate(),
        utils.goals.list.invalidate(),
        utils.dashboard.summary.invalidate(),
        utils.plans.list.invalidate(),
      ]);
      toast.success(`تم اعتماد خطة المذاكرة وربط ${result.taskCount} خطوة بالمهام.`);
    },
    onError: error => toast.error("تعذّر اعتماد الخطة: " + error.message),
  });

  const deleteSavedPlan = trpc.plans.delete.useMutation({
    onSuccess: async () => {
      await utils.plans.list.invalidate();
      toast.success("تم حذف الخطة من السجل.");
    },
    onError: error => toast.error("تعذّر حذف الخطة: " + error.message),
  });

  const deleteAllPlans = trpc.plans.deleteAll.useMutation({
    onSuccess: async result => {
      setPlan(null);
      setApproved(false);
      setLoadedSavedDraft(false);
      historyInitialized.current = true;
      await Promise.all([
        utils.plans.list.invalidate(),
        utils.plans.currentDaily.invalidate(),
        utils.tasks.list.invalidate(),
        utils.goals.list.invalidate(),
        utils.dashboard.summary.invalidate(),
      ]);
      toast.success(`تم حذف ${result.deletedPlans} خطة و${result.deletedTasks} مهمة مولّدة من الخطط.`);
    },
    onError: error => toast.error("تعذّر مسح الخطط: " + error.message),
  });

  const runGeneration = () => {
    ensureDaily.mutate({
      dailyMinutes,
      forceRebuild: true,
    });
  };

  useEffect(() => {
    const waitingForActivePlan = Boolean(profile.data?.subjectIds?.length) && activeDailyPlan.isLoading;
    if (profile.isLoading || profile.isError || history.isLoading || history.isError || waitingForActivePlan || historyInitialized.current) return;
    historyInitialized.current = true;

    // The current active plan is not a deletable history draft. Load it from the
    // read-only daily snapshot; otherwise fall back to the latest saved draft.
    const active = activeDailyPlan.data?.plan
      ? parseSavedPlan({ planJson: JSON.stringify(activeDailyPlan.data.plan) })
      : null;
    if (active) {
      setPlan(active);
      setApproved(true);
      setLoadedSavedDraft(false);
      return;
    }

    if (savedPlans.length > 0) {
      setPlan(savedPlans[0].plan);
      setApproved(false);
      setLoadedSavedDraft(true);
    }
  }, [
    history.isLoading,
    history.isError,
    savedPlans,
    profile.data?.subjectIds,
    profile.isLoading,
    profile.isError,
    activeDailyPlan.isLoading,
    activeDailyPlan.isError,
    activeDailyPlan.data?.plan,
  ]);

  useEffect(() => {
    // Preserve autonomous first-plan setup without making the currentDaily GET
    // endpoint perform writes. Trigger one idempotent mutation after all read
    // queries and saved-plan history have settled.
    if (initialDailyGenerationStarted.current || ensureDaily.isPending || !historyInitialized.current) return;
    if (profile.isLoading || profile.isError || !profile.data?.subjectIds?.length) return;
    if (history.isLoading || history.isError) return;
    if (activeDailyPlan.isLoading || activeDailyPlan.isError || !activeDailyPlan.data) return;
    if (activeDailyPlan.data.plan || activeDailyPlan.data.generatedAt || savedPlans.length > 0 || plan) return;

    initialDailyGenerationStarted.current = true;
    ensureDaily.mutate({ dailyMinutes, forceRebuild: false });
  }, [
    profile.data?.subjectIds,
    profile.isLoading,
    profile.isError,
    history.isLoading,
    history.isError,
    savedPlans.length,
    activeDailyPlan.data,
    activeDailyPlan.isLoading,
    activeDailyPlan.isError,
    plan,
    dailyMinutes,
    ensureDaily.isPending,
  ]);

  useEffect(() => {
    // Reflect successful background replans only while the page still displays
    // an untouched active plan. Manual edits and opened drafts are never replaced.
    if (!historyInitialized.current || !approved || loadedSavedDraft || !activeDailyPlan.data?.plan) return;
    const refreshed = parseSavedPlan({ planJson: JSON.stringify(activeDailyPlan.data.plan) });
    if (refreshed) setPlan(refreshed);
  }, [activeDailyPlan.data?.plan, approved, loadedSavedDraft]);

  const updatePlan = (next: PlanView) => {
    // Any manual edit invalidates the previous quality report. The server will
    // recalculate the schedule and quality before creating tasks.
    setPlan({ ...next, quality: undefined });
    setApproved(false);
  };

  const updateStep = (index: number, patch: Partial<PlanStep>) => {
    if (!plan) return;
    updatePlan({ ...plan, steps: plan.steps.map((step, stepIndex) => stepIndex === index ? { ...step, ...patch } : step) });
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    if (!plan) return;
    const destination = index + direction;
    if (destination < 0 || destination >= plan.steps.length) return;
    const steps = [...plan.steps];
    [steps[index], steps[destination]] = [steps[destination], steps[index]];
    updatePlan({ ...plan, steps });
  };

  const removeStep = (index: number) => {
    if (!plan || plan.steps.length <= 1) return;
    updatePlan({ ...plan, steps: plan.steps.filter((_, stepIndex) => stepIndex !== index) });
  };

  const addStep = () => {
    if (!plan) return;
    updatePlan({
      ...plan,
      steps: [...plan.steps, {
        day: "موعد غير محدد",
        title: "مهمة جديدة",
        detail: "اكتب ما الذي تريد إنجازه في هذه المهمة.",
        minutes: 0,
        dateOffsetDays: Math.max(0, ...plan.steps.map(step => step.dateOffsetDays ?? 0)) + 1,
        dayIndex: plan.steps.length + 1,
        category: "دراسة",
        priority: "medium",
        difficulty: "unknown",
        lessonSize: "unknown",
        difficultyBasis: "unknown",
        difficultyConfidence: "low",
        curriculumNodeIds: [],
      }],
    });
  };

  const approveCurrentPlan = (nextPlan?: PlanView) => {
    const planToApprove = nextPlan ?? plan;
    if (!planToApprove || approvePlan.isPending) return;
    approvePlan.mutate({
      plan: {
        title: planToApprove.title,
        summary: planToApprove.summary,
        steps: planToApprove.steps.map((step, index) => ({
          ...step,
          day: step.day || `اليوم ${index + 1}`,
        })),
      },
      schedule: { startDate: todayCairo, dailyMinutes, daysPerWeek: 6, horizonDays: 7, mode: "topic" },
    });
  };

  const handleDeleteAll = () => {
    const confirmed = window.confirm(
      "سيتم حذف كل خطط الذكاء الاصطناعي المحفوظة، مع المهام ومراحل الأهداف التي أنشأتها هذه الخطط فقط. لن تُحذف المهام اليدوية أو تقدمك في المنهج أو ملفك الدراسي. هل تؤكد؟",
    );
    if (confirmed) deleteAllPlans.mutate();
  };



  const planStepCount = plan?.steps.length ?? 0;
  const completedPlanCount = plan?.steps.filter(step => step.plannerTaskStatus === "done" || step.existingTask?.status === "done").length ?? 0;
  const planProgress = planStepCount ? Math.round((completedPlanCount / planStepCount) * 100) : 0;
  const nextPlanStep = getNextOpenPlanStep(plan?.steps);
  const taskRows = tasksQuery.data ?? [];
  const openTaskRows = taskRows.filter(task => task.status !== "done");
  const overdueTaskRows = openTaskRows.filter(task => task.dueAt && new Date(task.dueAt).getTime() < Date.now());
  const todayTaskRows = openTaskRows.filter(task => task.dueAt && new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date(task.dueAt)) === todayCairo);
  const planSubjectCount = plan
    ? new Set(plan.steps.map(step => getPlanStepCurriculum(step, profile.data?.subjectIds ?? [])?.subjectId).filter(Boolean)).size
    : 0;
  const planNeedsRefresh = Boolean(activeDailyPlan.data?.needsRefresh);

  return (
    <DashboardLayout title="خطة المذاكرة" description="مساحة واحدة لفهم أولوياتك، وتنظيم جلساتك، ومتابعة ما أنجزته.">
      <div className="sf-study-plan-v2">
        {history.isError && <QueryErrorNotice onRetry={() => void history.refetch()} label="تعذّر تحميل خططك المحفوظة." />}
        {profile.isError && <QueryErrorNotice onRetry={() => void profile.refetch()} label="تعذّر تحميل ملفك الدراسي. أعد المحاولة قبل إنشاء الخطة." />}

        <header className="sf-sp-hero" data-scroll-reveal>
          <div className="sf-sp-hero-copy">
            <div className="sf-sp-hero-meta">
              <span className="sf-sp-kicker">مساحة التخطيط الدراسي</span>
              <span className={"sf-sp-status " + (approved ? "is-active" : plan ? "is-draft" : "is-empty")}>
                {approved ? "خطة معتمدة" : plan ? "مسودة للمراجعة" : "لم تُنشأ خطة بعد"}
              </span>
              {planNeedsRefresh && approved && <span className="sf-sp-update-note">توجد بيانات جديدة تحتاج إلى إعادة ترتيب</span>}
            </div>
            <h1>خطة واضحة. خطوة وراء خطوة.</h1>
            <p>StudyFlow يربط المنهج وتقدمك الفعلي والمهام المسجلة وجدول المدرس، ثم يرتب لك الخطوة التالية. لا نعتبر الدرس مكتملًا لمجرد ظهوره في الخطة.</p>
            <div className="sf-sp-context">
              {profile.data?.track && <span>{profile.data.track}</span>}
              <span>{(profile.data?.subjectIds?.length ?? 0).toLocaleString("ar-EG")} مواد دراسية</span>
              <span>الذكاء الاصطناعي يرتّب الأولويات تلقائيًا</span>
            </div>
          </div>
          <div className="sf-sp-hero-progress">
            <div className="sf-sp-ring" style={{ background: "conic-gradient(var(--primary) " + planProgress + "%, color-mix(in srgb, var(--border) 88%, transparent) 0)" }}>
              <div className="sf-sp-ring-center">
                <strong>{plan ? planProgress.toLocaleString("ar-EG") + "%" : "—"}</strong>
                <span>إنجاز الخطة</span>
              </div>
            </div>
            <p>{plan ? completedPlanCount.toLocaleString("ar-EG") + " من " + planStepCount.toLocaleString("ar-EG") + " مهمة مكتملة" : "ستظهر نسبة التنفيذ بعد إنشاء الخطة واعتمادها."}</p>
          </div>
        </header>

        <section className="sf-sp-metrics" data-scroll-reveal aria-label="ملخص بيانات المذاكرة">
          <article className="sf-sp-metric"><span>المهام المفتوحة</span><strong>{tasksQuery.isLoading ? "…" : openTaskRows.length.toLocaleString("ar-EG")}</strong><small>من قائمة مهامك الفعلية</small></article>
          <article className="sf-sp-metric"><span>مهام مستحقة اليوم</span><strong>{tasksQuery.isLoading ? "…" : todayTaskRows.length.toLocaleString("ar-EG")}</strong><small>وفق المواعيد المسجلة</small></article>
          <article className="sf-sp-metric"><span>مهام تجاوزت موعدها</span><strong>{tasksQuery.isLoading ? "…" : overdueTaskRows.length.toLocaleString("ar-EG")}</strong><small>تحتاج إلى إعادة ترتيب</small></article>
          <article className="sf-sp-metric"><span>المواد الممثلة في الخطة</span><strong>{plan ? planSubjectCount.toLocaleString("ar-EG") : "—"}</strong><small>{plan ? "من المواد المحددة في ملفك" : "تظهر بعد بناء الخطة"}</small></article>
        </section>

        <nav className="sf-sp-tabs" role="tablist" aria-label="أقسام خطة المذاكرة">
          {([
            ["overview", "الملخص", Sparkles],
            ["schedule", "التوزيع", CalendarClock],
            ["curriculum", "المسار", BrainCircuit],
            ["tasks", "المهام", CheckCircle2],
            ["history", "السجل", RefreshCw],
          ] as const).map(([key, label, Icon]) => (
            <button key={key} type="button" role="tab" aria-selected={plannerTab === key} className="sf-sp-tab" onClick={() => setPlannerTab(key)}>
              <Icon className="size-4" /><span>{label}</span>
            </button>
          ))}
        </nav>

        {plannerTab === "overview" && (
          <div className="sf-sp-panel sf-sp-overview-panel">
            <section className="sf-sp-overview-grid" data-scroll-reveal>
              <article className="sf-sp-focus-card">
                <div className="sf-sp-section-heading">
                  <div><span className="sf-sp-eyebrow">الخطوة التالية</span><h2>{nextPlanStep ? "ابدأ من هنا" : plan ? "أنهيت كل خطوات الخطة" : "ابدأ ببناء خطتك"}</h2></div>
                  <span className="sf-sp-focus-mark">{plan ? (approved ? "خطة فعّالة" : "تحتاج مراجعتك") : "خطوة البداية"}</span>
                </div>
                {nextPlanStep ? (
                  <>
                    <div className="sf-sp-focus-title">{displayPlanStepTitle(nextPlanStep, profile.data?.subjectIds ?? [])}</div>
                    <p className="sf-sp-focus-detail">{displayPlanStepDetail(nextPlanStep, profile.data?.subjectIds ?? [])}</p>
                    <div className="sf-sp-step-meta">
                      {nextPlanStep.category && <span>{displayPlanStepCategory(nextPlanStep, profile.data?.subjectIds ?? [])}</span>}
                      {nextPlanStep.priority && <span>{({critical:"عاجلة",high:"أولوية عالية",medium:"متوسطة",low:"مرنة"} as Record<string,string>)[nextPlanStep.priority] || "أولوية عادية"}</span>}
                    </div>
                    <div className="sf-sp-focus-actions">
                      <Button type="button" onClick={() => setPlannerTab("schedule")}><ArrowUpRight className="size-4" />افتح تفاصيل المهمة</Button>
                    </div>
                  </>
                ) : plan ? (
                  <p className="sf-sp-focus-detail">تم تسجيل اكتمال جميع مهام الخطة الحالية. راجع تقدمك في المنهج أو أنشئ خطة محدثة عند تغيّر بياناتك.</p>
                ) : (
                  <p className="sf-sp-focus-detail">سيبدأ المحرك من ملفك الدراسي والمواد المختارة وآخر موضع مؤكد في كل فرع، ثم يوازن بين المتراكم وشرح المدرس والمراجعة.</p>
                )}
              </article>

              <aside className="sf-sp-builder-card">
                <div className="sf-sp-section-heading">
                  <div>
                    <span className="sf-sp-eyebrow">المخطط الذكي</span>
                    <h2>{plan ? "الذكاء الاصطناعي يدير أولوياتك" : "دع StudyFlow يرتّب أولوياتك"}</h2>
                  </div>
                </div>
                <p>يحلّل تقدمك في كل درس، ومواعيد المدرسين، والمهام المفتوحة، ثم يختار ما يجب أن تبدأ به وحجم الحمل المناسب تلقائيًا. لا تحتاج إلى اختيار خطة مرنة أو متوازنة أو مكثفة.</p>
                <div className="sf-sp-pace-evidence">
                  <strong>قاعدة ترتيب الأولويات</strong>
                  <p>أولًا: الدروس التي لم تشاهد شرحها. بعد استكمال الدروس الجديدة: الدروس التي شاهدت شرحها ولم تذاكرها، ثم الدروس التي تحتاج مراجعة.</p>
                </div>
                <Button type="button" className="sf-sp-build-button" disabled={!isPreflightReady || ensureDaily.isPending || !profile.data?.subjectIds?.length} onClick={runGeneration}>
                  {ensureDaily.isPending
                    ? <><Loader2 className="size-4 animate-spin" /> جارٍ تحليل الأولويات</>
                    : <>{plan ? <RefreshCw className="size-4" /> : <Sparkles className="size-4" />}{plan ? "إعادة تحليل الأولويات" : "إنشاء خطة المذاكرة"}</>}
                </Button>
                <small>عند تغيّر تقدمك أو مهامك، يعيد StudyFlow ترتيب الخطة ويحافظ على المهام المكتملة دون تكرار.</small>
              </aside>
            </section>

            {ensureDaily.isPending && <PlanLoading progress={generationProgress.data ?? null} />}

            {profile.data?.subjectIds?.length && aiCapabilities.data && (
              <section className="app-card flex flex-wrap items-start gap-3 rounded-2xl p-4" aria-live="polite">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Sparkles className="size-4" /></span>
                <div className="min-w-0 flex-1">
                  <strong className="text-sm">الرصد التلقائي للمدرسين</strong>
                  <p className="mt-1 text-xs leading-6 text-muted-foreground">
                    {aiCapabilities.data.youtubeMonitoring
                      ? "البحث عن قنوات المدرسين المختارين وفحص الفيديوهات العامة مفعّل."
                      : "البحث التلقائي عن قنوات YouTube يحتاج إعداد YOUTUBE_API_KEY على خدمة Preview."}
                    {" "}
                    {aiCapabilities.data.teacherVideoAnalysis
                      ? "تحليل الفيديو إلى موضوعات فعلية مفعّل."
                      : "تحليل محتوى الفيديو غير مفعّل: أضف GEMINI_API_KEY إلى متغيرات خدمة StudyFlow Preview في Railway. لا تضع المفتاح في المحادثة أو في واجهة الطالب."}
                  </p>
                </div>
              </section>
            )}

            {visibleAIActivities.length > 0 && (
              <section className="app-card rounded-2xl p-4 sm:p-5" role="status" aria-live="polite">
                <div className="mb-3 flex items-center gap-2">
                  <Sparkles className="size-4 animate-pulse text-primary" />
                  <strong className="text-sm">ماذا يفعل StudyFlow الآن؟</strong>
                  <span className="mr-auto text-[10px] text-primary">يعمل تلقائيًا</span>
                </div>
                <div className="space-y-3">
                  {visibleAIActivities.map(activity => (
                    <article key={activity.id} className="rounded-xl border border-border/70 bg-muted/10 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-sm">{activity.title}</strong>
                        <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] text-primary">{activity.stage}</span>
                      </div>
                      <p className="mt-1 text-xs leading-6 text-muted-foreground">{activity.detail}</p>
                      {activity.events.length > 1 && (
                        <ol className="mt-2 space-y-1 border-r border-border pr-3">
                          {activity.events.slice(-3).map(event => (
                            <li key={event.updatedAt} className="text-[11px] leading-5 text-muted-foreground">
                              <span className="font-semibold text-foreground">{event.stage}:</span> {event.detail}
                            </li>
                          ))}
                        </ol>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            )}

            {!profile.isLoading && profile.data && profile.data.subjectIds.length === 0 && (
              <section className="sf-sp-empty" data-scroll-reveal>
                <h2>ملفك الدراسي يحتاج إلى استكمال</h2>
                <p>اختر الصف والمواد والمدرسين من ملفك الدراسي حتى نستطيع إنشاء خطة مرتبطة بمنهجك بدل اقتراح مهام عامة.</p>
                <a href="/settings/academic"><ArrowUpRight className="size-4" />افتح الملف الدراسي</a>
              </section>
            )}

            <section className="sf-sp-snapshot" data-scroll-reveal>
              <div className="sf-sp-section-heading">
                <div><span className="sf-sp-eyebrow">صورة المنهج</span><h2>أين وصلت في المواد؟</h2></div>
                <button type="button" className="sf-sp-text-action" onClick={() => setPlannerTab("curriculum")}>عرض كل الفروع <ArrowUpRight className="size-4" /></button>
              </div>
              {profile.isLoading || learning.isLoading ? (
                <div className="sf-sp-skeletons"><span /><span /><span /></div>
              ) : progressPreview.length ? (
                <div className="sf-sp-snapshot-grid">
                  {progressPreview.slice(0,4).map(item => (
                    <article key={item.key} className="sf-sp-branch-card">
                      <div className="sf-sp-branch-heading"><span>{item.subject}</span><small>{item.branch}</small></div>
                      <strong>{item.next}</strong>
                      <p>آخر موضع مكتمل: {item.lastCompleted}</p>
                      <div className="sf-sp-branch-foot"><span>{item.gapCount === null ? "الفجوة غير محسوبة" : item.gapCount.toLocaleString("ar-EG") + " درس متأخر عن المرجع"}</span><span>{item.completedCount === null ? "التقدم غير محدد" : Math.round(item.completedCount / Math.max(1,item.totalCount) * 100).toLocaleString("ar-EG") + "%"}</span></div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="sf-sp-empty-inline">لا توجد فروع منهج متاحة للمواد المحددة في ملفك بعد.</div>
              )}
            </section>

          </div>
        )}

        {plannerTab === "schedule" && (
          <div className="sf-sp-panel" data-scroll-reveal>
            {planNeedsRefresh && approved ? (
              <section className="sf-sp-empty" role="status" aria-live="polite">
                <h2>الخريطة السابقة لم تعد مطابقة لبياناتك</h2>
                <p>بنحدّث ترتيب الدروس وفق موضع المدرس وحالة كل درس. لن نعرض الخريطة القديمة كأنها الأولوية الحالية.</p>
                {ensureDaily.isPending ? (
                  <PlanLoading progress={generationProgress.data ?? null} />
                ) : (
                  <Button type="button" onClick={runGeneration}>إعادة بناء خريطة المذاكرة الآن</Button>
                )}
              </section>
            ) : ensureDaily.isPending ? (
              <PlanLoading progress={generationProgress.data ?? null} />
            ) : activeDailyPlan.isLoading || history.isLoading ? (
              <section className="sf-sp-empty" role="status" aria-live="polite">
                <h2>بنحمّل خريطة خطتك</h2>
                <p>نقرأ آخر نسخة محفوظة ونربط خطواتها بالمواد والفروع وحالة التنفيذ.</p>
                <div className="sf-sp-skeletons"><span /><span /><span /></div>
              </section>
            ) : plan ? (
              <PlanCard plan={plan} subjectIds={profile.data?.subjectIds ?? []} teacherSessions={upcomingTeacherSessions} title={approved ? "الخطة المعتمدة" : loadedSavedDraft ? "مسودة محفوظة" : "مقترح للمراجعة"} studentName={profile.data?.studentName} editable={!approved} onChange={updatePlan} onApprove={approveCurrentPlan} onAddStep={addStep} onRemoveStep={removeStep} onMoveStep={moveStep} approving={approvePlan.isPending} approved={approved} />
            ) : (
              <section className="sf-sp-empty">
                <h2>لم تُنشأ خريطة مذاكرة بعد</h2>
                <p>افتح الملخص لإنشاء خطة من بيانات تقدمك الفعلية، ثم ستظهر الخريطة هنا مباشرة.</p>
                <Button type="button" onClick={() => setPlannerTab("overview")}>إنشاء خطة المذاكرة</Button>
              </section>
            )}
          </div>
        )}

        {plannerTab === "curriculum" && (
          <div className="sf-sp-panel sf-sp-curriculum-panel">
            <section className="sf-sp-section-card" data-scroll-reveal>
              <div className="sf-sp-section-heading">
                <div>
                  <span className="sf-sp-eyebrow">المسار التدريجي</span>
                  <h2>كل الدروس حسب أولويتها</h2>
                </div>
                <a href="/learning-map" className="sf-sp-text-action">تحديث موضعك <ArrowUpRight className="size-4" /></a>
              </div>
              <p className="sf-sp-muted-intro">القائمة تعرض كل درس حالته معروفة، لا عينة من أول الخطة فقط. الجدول اليومي يختار منها ما يناسب وقتك.</p>

              <div className="sf-sp-board-metrics">
                <article><span>شرح لم يُشاهد</span><strong>{progressivePath.unseen.length.toLocaleString("ar-EG")}</strong></article>
                <article><span>مذاكرة أو مراجعة مؤجلة</span><strong>{progressivePath.deferred.length.toLocaleString("ar-EG")}</strong></article>
                <article><span>دروس داخل النطاق حالتها غير مسجلة</span><strong>{progressivePath.unknownLessons.toLocaleString("ar-EG")}</strong></article>
              </div>

              {progressivePath.unknownLessons > 0 && (
                <div className="sf-sp-empty-inline" role="status">
                  هناك {progressivePath.unknownLessons.toLocaleString("ar-EG")} درس داخل نطاق شرح المدرس لم تُسجّل حالته في {progressivePath.unknownBranches.toLocaleString("ar-EG")} فروع. حدّد موضعك حتى نميّز الدروس المتراكمة من الدروس التي لم يشرحها المدرس بعد.
                </div>
              )}

              {profile.isLoading || learning.isLoading ? (
                <div className="sf-sp-skeletons"><span /><span /><span /></div>
              ) : (
                <>
                  <section className="sf-sp-curriculum-group">
                    <div className="sf-sp-section-heading">
                      <div><span className="sf-sp-eyebrow">الأولوية الأولى</span><h3>دروس لم تشاهد شرحها</h3></div>
                      <span className="sf-sp-count">{progressivePath.unseen.length.toLocaleString("ar-EG")}</span>
                    </div>
                    {progressivePath.unseen.length ? (
                      <div className="sf-sp-task-list">
                        {progressivePath.unseen.map(item => (
                          <article key={item.key} className="sf-sp-task-row">
                            <span className="sf-sp-task-check" aria-hidden="true" />
                            <div className="min-w-0 flex-1">
                              <strong>{item.subject} · {item.lesson}</strong>
                              <small className="block mt-1">{item.branch ? item.branch + " · " : ""}شرح غير مشاهد</small>
                            </div>
                            <span className="sf-sp-task-meta">ابدأ الآن</span>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="sf-sp-empty-inline">لا توجد دروس مؤكدة ضمن هذه المرحلة.</div>
                    )}
                  </section>

                  <section className="sf-sp-curriculum-group">
                    <div className="sf-sp-section-heading">
                      <div><span className="sf-sp-eyebrow">الأولوية التالية</span><h3>بعد إنهاء الدروس الجديدة</h3></div>
                      <span className="sf-sp-count">{progressivePath.deferred.length.toLocaleString("ar-EG")}</span>
                    </div>
                    {progressivePath.deferred.length ? (
                      <div className="sf-sp-task-list">
                        {progressivePath.deferred.map(item => (
                          <article key={item.key} className="sf-sp-task-row">
                            <span className="sf-sp-task-check" aria-hidden="true" />
                            <div className="min-w-0 flex-1">
                              <strong>{item.subject} · {item.lesson}</strong>
                              <small className="block mt-1">{item.branch ? item.branch + " · " : ""}{item.state === "watched_only" ? "شاهدت الشرح ولم تسجل المذاكرة" : "درس يحتاج مراجعة"}</small>
                            </div>
                            <span className="sf-sp-task-meta">مؤجل</span>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="sf-sp-empty-inline">لا توجد مذاكرة بعد الشرح أو مراجعة مؤجلة مسجلة.</div>
                    )}
                  </section>

                  {progressivePath.unseen.length === 0
                    && progressivePath.deferred.length === 0
                    && progressivePath.unknownBranches === 0 && (
                      <div className="sf-sp-empty-inline">لا يوجد تراكم مؤكد حاليًا. يتحدث المسار تلقائيًا عند تسجيل تقدمك في الدروس.</div>
                    )}
                </>
              )}
            </section>
          </div>
        )}

        {plannerTab === "tasks" && (
          <div className="sf-sp-panel">
            <section className="sf-sp-section-card" data-scroll-reveal>
              <div className="sf-sp-section-heading"><div><span className="sf-sp-eyebrow">قائمة العمل الفعلية</span><h2>مهام مفتوحة تؤثر على ترتيب المذاكرة</h2></div><a href="/tasks" className="sf-sp-text-action">إدارة كل المهام <ArrowUpRight className="size-4" /></a></div>
              {tasksQuery.isLoading ? <div className="sf-sp-skeletons"><span /><span /><span /></div> : mappedOpenTasks.length ? (
                <div className="sf-sp-task-list">
                  {mappedOpenTasks.map(({task,match}) => (
                    <article key={task.id} className="sf-sp-task-row">
                      <span className="sf-sp-task-check" aria-hidden="true" />
                      <div className="min-w-0 flex-1"><strong>{match ? (getSIESubject(match.subjectId)?.nameAr ?? "مادة دراسية") + " · " + displayBranchTitle(match.branchTitle) + " · " + displayCurriculumTitle(match.title) : displayArabicText(task.title, "مهمة مسجلة")}</strong><small className="block mt-1">{match ? (getSIESubject(match.subjectId)?.nameAr ?? "مادة دراسية") : displayArabicText(task.category, "مهمة عامة")}</small>{task.notes && <details className="mt-2"><summary className="cursor-pointer text-xs text-primary">عرض التفاصيل</summary><p className="mt-2 text-sm leading-6 text-muted-foreground">{displayArabicText(task.notes, "التفاصيل محفوظة في التكليف الأصلي.")}</p></details>}</div>
                      <div className="sf-sp-task-meta"><span>{task.priority === "high" ? "أولوية عالية" : task.priority === "low" ? "مرنة" : "متوسطة"}</span><small>{task.dueAt ? new Intl.DateTimeFormat("ar-EG",{timeZone:"Africa/Cairo",day:"numeric",month:"short"}).format(new Date(task.dueAt)) : "بلا موعد"}</small></div>
                    </article>
                  ))}
                </div>
              ) : <div className="sf-sp-empty-inline">لا توجد مهام مفتوحة مرتبطة بموادك حاليًا.</div>}
            </section>
          </div>
        )}

        {plannerTab === "history" && (
          <div className="sf-sp-panel">
            <section className="sf-sp-section-card" data-scroll-reveal>
              <div className="sf-sp-section-heading"><div><span className="sf-sp-eyebrow">النسخ المحفوظة</span><h2>سجل خططك السابقة</h2></div><span className="sf-sp-count">{savedPlans.length.toLocaleString("ar-EG")} خطة</span></div>
              {savedPlans.length ? (
                <div className="sf-sp-history-list">
                  {savedPlans.map(item => (
                    <article key={item.id} className="sf-sp-history-row">
                      <button type="button" onClick={() => {setPlan(item.plan);setApproved(false);setLoadedSavedDraft(true);setPlannerTab("schedule");}}>
                        <strong>{item.plan.title}</strong><span>{item.plan.summary}</span><small>{new Intl.DateTimeFormat("ar-EG",{day:"numeric",month:"long",year:"numeric"}).format(new Date(item.createdAt))}</small>
                      </button>
                      <Button type="button" variant="ghost" size="sm" disabled={deleteSavedPlan.isPending} onClick={() => {if(window.confirm("حذف هذه الخطة من السجل؟")) deleteSavedPlan.mutate({id:item.id});}}><Trash2 className="size-3.5" />حذف</Button>
                    </article>
                  ))}
                </div>
              ) : <div className="sf-sp-empty-inline">لا توجد مسودات محفوظة حتى الآن.</div>}
              {savedPlans.length > 0 && <div className="sf-sp-history-footer"><Button type="button" variant="ghost" className="text-destructive" onClick={handleDeleteAll} disabled={deleteAllPlans.isPending}>{deleteAllPlans.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} مسح كل الخطط المولّدة</Button></div>}
            </section>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}


function PlanLoading({ progress }: { progress: GenerationProgress | null }) {
  const stages: Array<{ id: GenerationProgress["currentStage"]; title: string; detail: string }> = [
    { id: "profile", title: "مراجعة ملفك وتقدمك", detail: "قراءة المواد المختارة وآخر موضع مؤكد لكل فرع وما أنجزته بالفعل." },
    { id: "curriculum", title: "مطابقة خريطة المنهج", detail: "ربط المهام بالدروس والوحدات، واستبعاد الخطوات التي لم تعد مؤهلة." },
    { id: "model", title: "اتخاذ قرارات التوزيع", detail: "موازنة المتراكم مع الدروس القادمة ومواعيد المدرسين وأولوياتك." },
    { id: "validation", title: "فحص الخطة وقواعدها", detail: "مراجعة عدم تكرار المهام، وعدم إعادة درس مكتمل أو اختراع واجب ومحتوى." },
    { id: "saving", title: "حفظ الخطة وربط المهام", detail: "تحديث شجرة المهام مع الحفاظ على العمل المنجز والالتزامات الحقيقية." },
  ];
  const completedCount = stages.filter(stage => progress?.completedStages.includes(stage.id)).length;
  const currentIndex = stages.findIndex(stage => stage.id === progress?.currentStage);
  const updatedLabel = progress?.updatedAt
    ? new Intl.DateTimeFormat("ar-EG", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(progress.updatedAt))
    : null;
  return (
    <section className="sf-plan-loading" role="status" aria-live="polite" aria-label="مراحل بناء خطة المذاكرة">
      <header className="sf-plan-loading-heading">
        <span className="sf-plan-loading-mark"><Sparkles className="size-5" /></span>
        <div>
          <p>محرك التخطيط الذكي</p>
          <h3>بنكوّن خطة مبنية على بياناتك</h3>
          <span>{progress?.detail || "نراجع ملفك الدراسي والمهام وتقدم المنهج قبل ترتيب الأولويات."}</span>
        </div>
        <Loader2 className="sf-plan-loading-spinner size-5" />
      </header>
      <div className="sf-plan-loading-summary">
        <strong>{completedCount.toLocaleString("ar-EG")} من {stages.length.toLocaleString("ar-EG")} مراحل مكتملة</strong>
        {updatedLabel && <span>آخر تحديث {updatedLabel}</span>}
      </div>
      <ol className="sf-plan-loading-stages">
        {stages.map((stage, index) => {
          const done = progress?.completedStages.includes(stage.id) ?? false;
          const current = progress?.status === "running" && progress.currentStage === stage.id;
          const pending = !done && !current;
          return (
            <li key={stage.id} className={current ? "is-current" : done ? "is-done" : "is-pending"}>
              <span className="sf-plan-loading-index">
                {done ? <CheckCircle2 className="size-4" /> : current ? <Loader2 className="size-4 animate-spin" /> : (index + 1).toLocaleString("ar-EG")}
              </span>
              <div className="sf-plan-loading-stage-copy">
                <strong>{stage.title}</strong>
                <p>{stage.detail}</p>
              </div>
              <span className="sf-plan-loading-state">{done ? "اكتملت" : current ? "جارٍ الآن" : "في الانتظار"}</span>
            </li>
          );
        })}
      </ol>
      <footer className="sf-plan-loading-footer">
        {currentIndex >= 0
          ? "المرحلة الحالية: " + stages[currentIndex].title
          : "يبدأ التنفيذ بعد اكتمال قراءة بيانات الخطة."}
      </footer>
    </section>
  );
}

function PlanCard({ plan, subjectIds, teacherSessions, title, studentName, editable, onChange, onApprove, onAddStep, onRemoveStep, onMoveStep, approving, approved }: {
  plan: PlanView; subjectIds: string[]; teacherSessions: PlannerTeacherSession[]; title: string; studentName?: string; editable: boolean;
  onChange: (next: PlanView) => void; onApprove: (nextPlan?: PlanView) => void; onAddStep: () => void;
  onRemoveStep: (index: number) => void; onMoveStep: (index: number, direction: -1 | 1) => void;
  approving: boolean; approved: boolean;
}) {
  const [editing, setEditing] = useState<{ index: number; title: string; detail: string } | null>(null);
  const [filter, setFilter] = useState<"all" | "open" | "done">("all");
  const [viewMode, setViewMode] = useState<"map" | "list">("map");
  const [selectedMapStepIndex, setSelectedMapStepIndex] = useState<number | null>(() => {
    const firstOpen = plan.steps.findIndex(step =>
      step.plannerTaskStatus !== "done" && step.existingTask?.status !== "done"
    );
    return firstOpen >= 0 ? firstOpen : plan.steps.length > 0 ? 0 : null;
  });
  const completedCount = plan.steps.filter(step => step.plannerTaskStatus === "done" || step.existingTask?.status === "done").length;
    const subjectCount = new Set(plan.steps.map(step => getPlanStepCurriculum(step, subjectIds)?.subjectId).filter(Boolean)).size;
  const confirmedTaskCount = plan.steps.filter(step => Boolean(step.existingTask)).length;
  const coveredCurriculumCount = new Set(plan.steps.flatMap(step => step.curriculumNodeIds ?? [])).size;
  const backlogCoverageMatch = /المتراكم الفعلي:\s*(\d+)\s*نقطة مؤكدة؛ أُدرج\s*(\d+)/.exec(plan.summary);
  const backlogExpectedCount = backlogCoverageMatch ? Number(backlogCoverageMatch[1]) : null;
  const backlogIncludedCount = backlogCoverageMatch ? Number(backlogCoverageMatch[2]) : null;
  const backlogCoverageLabel = backlogExpectedCount === null || backlogIncludedCount === null
    ? "غير متاح"
    : backlogIncludedCount.toLocaleString("ar-EG") + " / " + backlogExpectedCount.toLocaleString("ar-EG");
  const plannedReviewCount = new Set(plan.steps.flatMap(step => {
    const resource = step.resourceRecommendation;
    return resource && /مراجعة|review|revision/i.test(resource.reason || "") && resource.url
      ? [resource.url.split("#")[0]]
      : [];
  })).size;
  const phaseLabels: Record<string,string> = {
    backlog: "التزامات مفتوحة",
    teacher_sync: "شرح قبل الحصة",
    steady: "شرح غير مشاهد",
    review_later: "بعد الدروس الجديدة",
    deferred: "مؤجل",
  };
  const phaseOrder = ["teacher_sync", "steady", "backlog", "review_later", "deferred"];
  const grouped = new Map<string, Array<{step: PlanStep; index: number}>>();
  plan.steps.forEach((step,index) => {
    const key = step.scheduleState === "deferred"
      ? "deferred"
      : step.phaseId ?? (step.existingTask ? "backlog" : "steady");
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push({step,index});
  });
  const orderedGroups = phaseOrder
    .filter(key => grouped.has(key))
    .map(key => [key, grouped.get(key)!] as const);
  const visibleGroups = orderedGroups.map(([key,items]) => ({
    key,
    title: phaseLabels[key] ?? "مهام دراسية",
    items: items.filter(({step}) => filter === "all" || (filter === "done"
      ? step.plannerTaskStatus === "done" || step.existingTask?.status === "done"
      : step.plannerTaskStatus !== "done" && step.existingTask?.status !== "done")),
  })).filter(group => group.items.length > 0);

  const mapLaneMap = new Map<string, {
    key: string;
    title: string;
    subjectId?: string;
    branch?: string;
    items: Array<{ step: PlanStep; index: number; curriculum: ReturnType<typeof getPlanStepCurriculum> }>;
  }>();
  plan.steps.forEach((step, index) => {
    const isDone = step.plannerTaskStatus === "done" || step.existingTask?.status === "done";
    if (filter === "done" && !isDone) return;
    if (filter === "open" && isDone) return;
    const curriculum = getPlanStepCurriculum(step, subjectIds);
    const laneKey = curriculum
      ? curriculum.subjectId + "::" + (curriculum.branch || "الدروس")
      : "__GENERAL_TASKS__";
    const title = curriculum
      ? curriculum.subject + (curriculum.branch ? " · " + curriculum.branch : "")
      : "التزامات ومهام أخرى";
    if (!mapLaneMap.has(laneKey)) {
      mapLaneMap.set(laneKey, {
        key: laneKey,
        title,
        subjectId: curriculum?.subjectId,
        branch: curriculum?.branch,
        items: [],
      });
    }
    mapLaneMap.get(laneKey)!.items.push({ step, index, curriculum });
  });
  // Preserve the exact execution order from the planner. Sorting branches by
  // their display names would make the visual route contradict the plan sequence.
  const mapLanes = [...mapLaneMap.values()];
  const selectedMapStep = selectedMapStepIndex === null
    ? null
    : plan.steps[selectedMapStepIndex] ?? null;
  const firstOpenMapStep = getNextOpenPlanStep(plan.steps);
  const currentStepIndex = firstOpenMapStep ? plan.steps.indexOf(firstOpenMapStep) : -1;
  const selectedMapCurriculum = selectedMapStep
    ? getPlanStepCurriculum(selectedMapStep, subjectIds)
    : null;
  const selectedMapNodeId = selectedMapStep?.curriculumNodeIds?.[0];
  const selectedMapBranchId = selectedMapCurriculum && selectedMapNodeId
    ? getSIECheckpointProgressBranches(selectedMapCurriculum.subjectId)
        .find(branch => branch.choices.some(choice => choice.nodeId === selectedMapNodeId))?.branchId
    : undefined;
  const saveEdit = () => {
    if (!editing) return;
    onChange({
      ...plan,
      steps: plan.steps.map((step,index) => index === editing.index
        ? { ...step, title: editing.title.trim() || step.title, detail: editing.detail.trim() || step.detail }
        : step),
    });
    setEditing(null);
  };
  const formatDate = (value?: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat("ar-EG", { timeZone: "Africa/Cairo", day: "numeric", month: "short" }).format(date);
  };
  const priorityLabel: Record<string,string> = {critical:"عاجلة",high:"أولوية عالية",medium:"متوسطة",low:"مرنة"};
  const difficultyLabel: Record<string,string> = {easy:"خفيف",medium:"متوسط",hard:"يحتاج تركيزًا",unknown:"غير محدد"};
  const phaseLabel: Record<string,string> = {backlog:"التزام مفتوح",teacher_sync:"شرح غير مشاهد",steady:"درس جديد",review_later:"مراجعة مؤجلة"};
  const summary = displayArabicText(plan.summary.split("\n\n")[0], "خطة مرتبة حسب التزاماتك والمواد المتاحة في ملفك الدراسي.");
  return (
    <section className="sf-sp-plan-board">
      <header className="sf-sp-board-header">
        <div className="sf-sp-board-title">
          <span className="sf-sp-eyebrow">خطة التنفيذ</span>
          <div className="sf-sp-section-heading">
            <div><h2>{displayArabicText(plan.title, "خطة المذاكرة")}</h2><p>{summary}</p></div>
            <span className={"sf-sp-status " + (approved ? "is-active" : "is-draft")}>{approved ? "معتمدة" : "بانتظار الاعتماد"}</span>
          </div>
          {studentName && <small>مبنية على البيانات المسجلة في ملف {studentName}</small>}
        </div>
        <PlanExportActions plan={plan} studentName={studentName} />
      </header>

      <div className="sf-sp-board-metrics">
        <article><span>إجمالي الخطوات</span><strong>{plan.steps.length.toLocaleString("ar-EG")}</strong></article>
        <article><span>المهام المنفذة</span><strong>{completedCount.toLocaleString("ar-EG")}</strong></article>
        <article><span>المتراكم المؤكد المدرج / الإجمالي</span><strong>{backlogCoverageLabel}</strong></article>
        <article><span>نقاط المنهج المرتبطة</span><strong>{coveredCurriculumCount.toLocaleString("ar-EG")}</strong></article>
        <article><span>فيديوهات مراجعة مطابقة</span><strong>{plannedReviewCount.toLocaleString("ar-EG")}</strong></article>
        <article><span>التزامات مسجلة</span><strong>{confirmedTaskCount.toLocaleString("ar-EG")}</strong></article>
      </div>

      {teacherSessions.length > 0 && (
        <section className="sf-sp-teacher-schedule" aria-label="مواعيد الحصص القادمة">
          <header>
            <div><span>مواعيد المدرسين</span><h3>الحصص القادمة في جدولك</h3></div>
            <small>مواعيد بداية مسجلة</small>
          </header>
          <div className="sf-sp-teacher-session-list">
            {teacherSessions.map(session => (
              <article key={session.key}>
                <div className="sf-sp-teacher-session-time"><strong>{session.time}</strong><span>{session.dateLabel}</span></div>
                <div className="sf-sp-teacher-session-copy"><strong>{session.teacherName}</strong><span>{session.subjectName}</span></div>
              </article>
            ))}
          </div>
          <p>المساعد يوازن بين المتراكم والتحضير قبل الحصة. لو موضوع المحاضرة الجديدة غير معروف، يثبت الموعد ويختار مراجعة من آخر موضع معروف بدل اختراع درس أو محتوى.</p>
        </section>
      )}

      {plan.executionStrategy && (
        <section className="sf-sp-plan-rationale">
          <span className="sf-sp-eyebrow">ترتيب التنفيذ</span>
          <h3>{displayArabicText(plan.executionStrategy.objective, "الشرح غير المشاهد أولًا، ثم الالتزامات، وبعدها المراجعة.")}</h3>
          {plan.executionStrategy.phases?.length ? (
            <div className="sf-sp-phase-summary">
              {plan.executionStrategy.phases.map(phase => {
                const count = plan.steps.filter(step => step.phaseId === phase.id).length;
                return count > 0 ? (
                  <article key={phase.id}>
                    <span>{count.toLocaleString("ar-EG")}</span>
                    <div><strong>{phaseLabels[phase.id] ?? phase.title}</strong></div>
                  </article>
                ) : null;
              })}
            </div>
          ) : null}
        </section>
      )}

      {plan.quality && (
        <section className={"sf-sp-quality sf-sp-quality-" + plan.quality.status}>
          <div><strong>{plan.quality.status === "ready" ? "الخطة جاهزة للاعتماد" : plan.quality.status === "partial" ? "الخطة تحتاج مراجعة" : "هناك عائق يمنع الاعتماد"}</strong><p>تقييم التوزيع: {plan.quality.score.toLocaleString("ar-EG")} من 100.</p></div>
          <div>{plan.quality.blockers.map((item,index)=><small key={"b"+index}>{displayArabicText(item,"يوجد عائق يحتاج مراجعة.")}</small>)}{plan.quality.warnings.map((item,index)=><small key={"w"+index}>{displayArabicText(item,"هناك ملاحظة على توزيع الخطة.")}</small>)}</div>
        </section>
      )}

      <div className="sf-sp-board-toolbar sf-sp-map-toolbar">
        <div>
          <h3>خريطة تنفيذ الخطة</h3>
          <p>كل مادة وفرع له مساره. اضغط على أي عقدة لعرض تفاصيلها وفتح الدرس أو المهمة مباشرة.</p>
        </div>
        <div className="sf-sp-map-controls">
          <div className="sf-sp-filter-group" role="group" aria-label="تصفية مهام الخطة">
            {([["all","الكل"],["open","المتبقي"],["done","المكتمل"]] as const).map(([key,label]) => (
              <button type="button" key={key} aria-pressed={filter===key} onClick={()=>setFilter(key)}>{label}</button>
            ))}
          </div>
          <div className="sf-sp-view-group" role="group" aria-label="طريقة عرض الخطة">
            <button type="button" aria-pressed={viewMode==="map"} onClick={()=>setViewMode("map")}>الخريطة</button>
            <button type="button" aria-pressed={viewMode==="list"} onClick={()=>setViewMode("list")}>القائمة</button>
          </div>
        </div>
      </div>

      {viewMode === "map" ? (
        <div className="sf-sp-flow-map" dir="rtl">
          <div className="sf-sp-flow-origin">
            <span className="sf-sp-flow-origin-kicker">نقطة البداية</span>
            <strong>موضعك الدراسي الحالي</strong>
            <small>{mapLanes.length.toLocaleString("ar-EG")} مسارات تنفيذ · {plan.steps.length.toLocaleString("ar-EG")} خطوة في الخطة{backlogCoverageLabel !== "غير متاح" ? " · المتراكم المؤكد " + backlogCoverageLabel : ""}</small>
          </div>
          <div className="sf-sp-flow-legend" aria-label="دليل ألوان الخريطة">
            <span><i className="is-learning" /> مذاكرة وشرح</span>
            <span><i className="is-review" /> مراجعة مؤجلة</span>
            <span><i className="is-obligation" /> التزام مسجل</span>
            <span><i className="is-done" /> مهمة منتهية</span>
          </div>
          {mapLanes.length ? (
            <div className="sf-sp-flow-lanes">
              {mapLanes.map(lane => (
                <section className="sf-sp-flow-lane" key={lane.key}>
                  <header className="sf-sp-flow-lane-header">
                    <span className="sf-sp-flow-lane-port" />
                    <div>
                      <small>{lane.subjectId ? "مسار مادة" : "مسار التزامات"}</small>
                      <h4>{lane.title}</h4>
                    </div>
                    <strong>{lane.items.length.toLocaleString("ar-EG")} عقدة</strong>
                  </header>
                  <div className="sf-sp-flow-track">
                    {lane.items.map(({step,index,curriculum}, laneIndex) => {
                      const isDone = step.plannerTaskStatus === "done" || step.existingTask?.status === "done";
                      const isReview = Boolean(step.resourceRecommendation && /مراجعة|review|revision/i.test(step.resourceRecommendation.reason || ""));
                      const isDeferred = step.phaseId === "review_later" || step.scheduleState === "deferred";
                      const isCurrentStep = index === currentStepIndex;
                      const nodeState = (isDone ? "is-done" : isReview || isDeferred ? "is-review" : step.existingTask ? "is-obligation" : "is-learning")
                        + (isCurrentStep ? " is-next" : "");
                      const titleText = displayPlanStepTitle(step, subjectIds);
                      const detailText = displayPlanStepDetail(step, subjectIds);
                      const stageTitles = ["معاينة الدرس", "تحديد المطلوب", "القراءة والفهم", "الاسترجاع من الذاكرة", "المراجعة والتثبيت"];
                      return (
                        <article key={step.plannerTaskId ?? step.existingTask?.id ?? step.sourceStepIndex ?? index} className={"sf-sp-flow-node " + nodeState}>
                          <span className="sf-sp-flow-node-index">{isDone ? <CheckCircle2 className="size-4" /> : (laneIndex + 1).toLocaleString("ar-EG")}</span>
                          <div className="sf-sp-flow-node-card">
                            <div className="sf-sp-flow-node-topline">
                              <span>{step.day || "اليوم غير محدد"}</span>
                              <span>{isCurrentStep ? "الخطوة التالية" : isDone ? "المهمة منتهية" : isReview || isDeferred ? "مراجعة" : step.existingTask ? "التزام" : "مذاكرة"}</span>
                              {step.minutes > 0 && <span>{step.minutes.toLocaleString("ar-EG")} دقيقة</span>}
                            </div>
                            <button
                              type="button"
                              className="sf-sp-flow-node-select"
                              aria-pressed={selectedMapStepIndex === index}
                              onClick={() => setSelectedMapStepIndex(current => current === index ? null : index)}
                            >
                              <h5>{titleText}</h5>
                              <span>{selectedMapStepIndex === index ? "محددة الآن" : "اختر العقدة لعرض تفاصيلها"}</span>
                            </button>
                            {curriculum?.branch && curriculum.branch !== "الدروس" && <small className="sf-sp-flow-node-branch">{curriculum.branch}</small>}
                            <details className="sf-sp-flow-node-details">
                              <summary>تفاصيل هذه الخطوة</summary>
                              <p>{detailText}</p>
                              {step.sourceTitle && <small>عنوان المنهج: {displayCurriculumTitle(step.sourceTitle)}</small>}
                              {step.scheduleNote && <small>{displayArabicText(step.scheduleNote,"تم تأجيل هذه الخطوة للدورة التالية.")}</small>}
                              {step.studyMethod && (
                                <div className="sf-sp-flow-study-method">
                                  <strong>طريقة المذاكرة — {step.studyMethod.stages.length} مراحل</strong>
                                  <ol>
                                    {step.studyMethod.stages.map((stage,stageIndex) => (
                                      <li key={stageIndex}>
                                        <b>{(stageIndex + 1).toLocaleString("ar-EG")}. {displayArabicText(stage.title,stageTitles[stageIndex] ?? "مرحلة المذاكرة")}</b>
                                        <p>{displayArabicText(stage.instruction,"نفّذ هذه المرحلة من مصدر المادة، ثم حدّث تقدمك.")}</p>
                                      </li>
                                    ))}
                                  </ol>
                                  <small>متى تكتمل؟ {displayArabicText(step.studyMethod.completionCriteria,"بعد تنفيذ المراحل وتسجيل تقدمك.")}</small>
                                </div>
                              )}
                              {step.priorityReason && <p>{displayArabicText(step.priorityReason,"تم اختيارها حسب موضعك الدراسي.")}</p>}
                              {step.resourceRecommendation && <a className="sf-sp-resource-link" href={step.resourceRecommendation.url} target="_blank" rel="noreferrer">{isReview ? "افتح المراجعة المطابقة للدرس" : "افتح شرح المدرس المقترح"} <ArrowUpRight className="size-3.5" /></a>}
                            </details>
                            {editing?.index === index ? (
                              <div className="sf-sp-step-editor">
                                <label><span>عنوان المهمة</span><input value={editing.title} onChange={event => setEditing(current => current ? {...current,title:event.target.value} : current)} /></label>
                                <label><span>تفاصيل التنفيذ</span><textarea rows={3} value={editing.detail} onChange={event => setEditing(current => current ? {...current,detail:event.target.value} : current)} /></label>
                                <div>
                                  <Button type="button" variant="ghost" size="sm" onClick={()=>setEditing(null)}>إلغاء</Button>
                                  <Button type="button" size="sm" onClick={saveEdit}>حفظ التعديل</Button>
                                </div>
                              </div>
                            ) : editable && (
                              <div className="sf-sp-step-actions">
                                <Button type="button" size="sm" variant="ghost" onClick={()=>setEditing({index,title:step.title,detail:step.detail})}>تعديل</Button>
                                <Button type="button" size="sm" variant="ghost" disabled={index===0} onClick={()=>onMoveStep(index,-1)}><ArrowUp className="size-3.5" />لأعلى</Button>
                                <Button type="button" size="sm" variant="ghost" disabled={index===plan.steps.length-1} onClick={()=>onMoveStep(index,1)}><ArrowDown className="size-3.5" />لأسفل</Button>
                                <Button type="button" size="sm" variant="ghost" className="text-destructive" disabled={plan.steps.length<=1} onClick={()=>onRemoveStep(index)}><X className="size-3.5" />حذف</Button>
                              </div>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="sf-sp-empty-inline">{filter === "done" ? "لا توجد خطوات مكتملة." : filter === "open" ? "لا توجد خطوات متبقية." : "لا توجد خطوات في الخطة بعد."}</div>
          )}
          {selectedMapStep && (
            <aside className="sf-sp-flow-selection" aria-live="polite">
              <header>
                <div>
                  <span>العقدة المحددة</span>
                  <strong>{selectedMapCurriculum?.subject ?? "التزام مسجل"}{selectedMapCurriculum?.branch ? " · " + selectedMapCurriculum.branch : ""}</strong>
                </div>
                <button type="button" onClick={() => setSelectedMapStepIndex(null)} aria-label="إغلاق تفاصيل العقدة">إغلاق</button>
              </header>
              <h4>{displayPlanStepTitle(selectedMapStep, subjectIds)}</h4>
              <div className="sf-sp-flow-selection-meta">
                {selectedMapStep.day && <span>{selectedMapStep.day}</span>}
                {selectedMapStep.priority && <span>{priorityLabel[selectedMapStep.priority] ?? "أولوية عادية"}</span>}
                {selectedMapStep.existingTask && <span>مهمة مسجلة</span>}
                {selectedMapStep.minutes > 0 && <span>{selectedMapStep.minutes.toLocaleString("ar-EG")} دقيقة</span>}
              </div>
              <p>{displayPlanStepDetail(selectedMapStep, subjectIds)}</p>
              {selectedMapStep.studyMethod && (
                <details className="sf-sp-flow-selection-method" open>
                  <summary>طريقة التنفيذ — {selectedMapStep.studyMethod.stages.length} مراحل</summary>
                  <ol>
                    {selectedMapStep.studyMethod.stages.map((stage, index) => (
                      <li key={index}>
                        <strong>{(index + 1).toLocaleString("ar-EG")}. {displayArabicText(stage.title, "مرحلة المذاكرة")}</strong>
                        <p>{displayArabicText(stage.instruction, "نفّذ هذه المرحلة من مصدر المادة ثم حدّث تقدمك.")}</p>
                      </li>
                    ))}
                  </ol>
                  <small>معيار الاكتمال: {displayArabicText(selectedMapStep.studyMethod.completionCriteria, "بعد تنفيذ المراحل وتسجيل تقدمك الفعلي.")}</small>
                </details>
              )}
              {selectedMapStep.resourceRecommendation && (
                <a className="sf-sp-resource-link" href={selectedMapStep.resourceRecommendation.url} target="_blank" rel="noreferrer">
                  افتح المصدر المرتبط بهذه الخطوة <ArrowUpRight className="size-3.5" />
                </a>
              )}
              <div className="sf-sp-flow-selection-actions">
                {editable && (
                  <Button type="button" size="sm" variant="outline" onClick={() => setEditing({
                    index: selectedMapStepIndex!,
                    title: selectedMapStep.title,
                    detail: selectedMapStep.detail,
                  })}>تعديل الخطوة</Button>
                )}
                {selectedMapCurriculum && selectedMapBranchId && selectedMapNodeId && (
                  <a href={"/study?subject=" + encodeURIComponent(selectedMapCurriculum.subjectId)
                    + "&branch=" + encodeURIComponent(selectedMapBranchId)
                    + "&lesson=" + encodeURIComponent(selectedMapNodeId)}>
                    افتح الدرس في صفحة المذاكرة <ArrowUpRight className="size-3.5" />
                  </a>
                )}
                {selectedMapStep.existingTask && <a href="/tasks">افتح المهمة المسجلة <ArrowUpRight className="size-3.5" /></a>}
              </div>
            </aside>
          )}
          {mapLanes.length > 0 && (
            <div className="sf-sp-flow-finish">
              <span>نقطة النهاية</span>
              <strong>تحديث موضعك وإعادة ترتيب المسارات</strong>
              <small>بعد إنجاز العقدة، يتقدم المسار وتُعاد أولوية الخطوات المتبقية.</small>
            </div>
          )}
        </div>
      ) : (
      <div className="sf-sp-day-groups sf-sp-phase-groups">
        {visibleGroups.length ? visibleGroups.map(group => (
          <section className="sf-sp-day-group sf-sp-phase-group" key={group.key}>
            <header><div><span className="sf-sp-day-dot" /><h4>{group.title}</h4></div><small>{group.items.length.toLocaleString("ar-EG")} خطوة</small></header>
            <div className="sf-sp-day-items">
              {group.items.map(({step,index}) => {
                const isDone = step.plannerTaskStatus === "done" || step.existingTask?.status === "done";
                const curriculum = getPlanStepCurriculum(step, subjectIds);
                const titleText = displayPlanStepTitle(step, subjectIds);
                const detailText = displayPlanStepDetail(step, subjectIds);
                const stageTitles = ["معاينة الدرس", "تحديد المطلوب", "القراءة والفهم", "الاسترجاع من الذاكرة", "المراجعة والتثبيت"];
                return (
                  <article key={step.plannerTaskId ?? step.existingTask?.id ?? step.sourceStepIndex ?? index} className={"sf-sp-plan-step " + (isDone ? "is-done" : "")}>
                    {editing?.index === index ? (
                      <div className="sf-sp-step-editor">
                        <label><span>عنوان المهمة</span><input value={editing.title} onChange={event => setEditing(current => current ? {...current,title:event.target.value} : current)} /></label>
                        <label><span>تفاصيل التنفيذ</span><textarea rows={3} value={editing.detail} onChange={event => setEditing(current => current ? {...current,detail:event.target.value} : current)} /></label>
                        <div><Button type="button" variant="ghost" size="sm" onClick={()=>setEditing(null)}>إلغاء</Button><Button type="button" size="sm" onClick={saveEdit}>حفظ التعديل</Button></div>
                      </div>
                    ) : (
                      <>
                        <div className="sf-sp-step-index">{isDone ? <CheckCircle2 className="size-4" /> : (index+1).toLocaleString("ar-EG")}</div>
                        <div className="sf-sp-step-content">
                          <div className="sf-sp-step-tags">
                            {curriculum && <span>{curriculum.subject}</span>}
                            {curriculum && curriculum.branch !== "الدروس" && <span>{curriculum.branch}</span>}
                            {step.phaseId && <span>{phaseLabel[step.phaseId] || "مرحلة الخطة"}</span>}
                            {step.priority && <span>{priorityLabel[step.priority] || "أولوية عادية"}</span>}
                            {step.difficulty && <span>{difficultyLabel[step.difficulty] || "غير محدد"}</span>}
                            {step.existingTask && <span>التزام مسجل</span>}
                            {step.scheduleState === "deferred" && <span>مؤجلة للدورة القادمة</span>}
                            {isDone && <span>المهمة منتهية</span>}
                            {(formatDate(step.existingTask?.dueAt) || step.day) && <span>يوم التنفيذ: {formatDate(step.existingTask?.dueAt) || step.day}</span>}
                            {step.minutes > 0 && <span>المدة: {step.minutes.toLocaleString("ar-EG")} دقيقة</span>}
                          </div>
                          <h4>{titleText}</h4>
                          {!curriculum && <small className="sf-sp-source-title">{displayPlanStepCategory(step, subjectIds)}</small>}
                          {step.sourceTitle && <small className="sf-sp-source-title">عنوان المنهج: {displayCurriculumTitle(step.sourceTitle)}</small>}
                          <details className="sf-sp-step-details">
                            <summary>تفاصيل التنفيذ</summary>
                            <p>{detailText}</p>
                            {step.scheduleNote && <small className="sf-sp-source-title">{displayArabicText(step.scheduleNote,"تم تأجيل هذه الخطوة إلى دورة التخطيط التالية.")}</small>}
                          </details>
                          {step.studyMethod && (
                            <details className="sf-sp-study-method">
                              <summary>طريقة مذاكرة الدرس — {step.studyMethod.stages.length} مراحل</summary>
                              <ol>
                                {step.studyMethod.stages.map((stage,stageIndex) => (
                                  <li key={stageIndex}>
                                    <strong>{(stageIndex+1).toLocaleString("ar-EG")}. {displayArabicText(stage.title,stageTitles[stageIndex] ?? "مرحلة المذاكرة")}</strong>
                                    {stage.optional && <span>اختياري حسب تكليف المدرس</span>}
                                    <p>{displayArabicText(stage.instruction,"نفّذ هذه المرحلة من مصدر المادة، ثم حدّث تقدم الدرس.")}</p>
                                    <small>الهدف: {displayArabicText(stage.reason,"تثبيت فهمك للجزء الذي تدرسه.")}</small>
                                  </li>
                                ))}
                              </ol>
                              <p className="sf-sp-completion-rule">متى تعتبر المهمة مكتملة؟ {displayArabicText(step.studyMethod.completionCriteria,"بعد تنفيذ الخطوات وتسجيل تقدمك الفعلي في الدرس.")}</p>
                              {step.studyMethod.teacherPolicyNote && <small>{displayArabicText(step.studyMethod.teacherPolicyNote,"راجع متطلبات المدرس المسجلة قبل الانتقال للدرس التالي.")}</small>}
                            </details>
                          )}
                          {step.priorityReason && <details className="sf-sp-step-extra"><summary>لماذا ظهرت هذه الخطوة في الخطة؟</summary><p>{displayArabicText(step.priorityReason,"تم اختيارها حسب ترتيب تقدمك والالتزامات المسجلة.")}</p></details>}
                          {step.resourceRecommendation && <a className="sf-sp-resource-link" href={step.resourceRecommendation.url} target="_blank" rel="noreferrer">{/مراجعة|review|revision/i.test(step.resourceRecommendation.reason || "") ? "شاهد جزء المراجعة المقترح" : "افتح شرح المدرس المقترح"} <ArrowUpRight className="size-3.5" /></a>}
                          {editable && (
                            <div className="sf-sp-step-actions">
                              <Button type="button" size="sm" variant="ghost" onClick={()=>setEditing({index,title:step.title,detail:step.detail})}>تعديل</Button>
                              <Button type="button" size="sm" variant="ghost" disabled={index===0} onClick={()=>onMoveStep(index,-1)}><ArrowUp className="size-3.5" />لأعلى</Button>
                              <Button type="button" size="sm" variant="ghost" disabled={index===plan.steps.length-1} onClick={()=>onMoveStep(index,1)}><ArrowDown className="size-3.5" />لأسفل</Button>
                              <Button type="button" size="sm" variant="ghost" className="text-destructive" disabled={plan.steps.length<=1} onClick={()=>onRemoveStep(index)}><X className="size-3.5" />حذف</Button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        )) : <div className="sf-sp-empty-inline">{filter === "done" ? "لا توجد خطوات مكتملة في هذا العرض." : filter === "open" ? "لا توجد خطوات متبقية." : "لا توجد خطوات ضمن الفلتر الحالي."}</div>}
      </div>
      )}

      {editable ? (
        <footer className="sf-sp-board-footer">
          <Button type="button" variant="outline" onClick={onAddStep}><Plus className="size-4" />أضف خطوة</Button>
          <div><small>سيعاد فحص ترتيب الخطة عند اعتمادها. لن تُنشأ مواعيد أو واجبات غير مسجلة.</small><Button type="button" onClick={() => onApprove(plan)} disabled={approving || !plan.steps.length || !plan.title.trim()}>{approving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}اعتماد الخطة وإضافة المهام</Button></div>
        </footer>
      ) : (
        <footer className="sf-sp-approved-footer"><CheckCircle2 className="size-4" /><span>هذه الخطة معتمدة، والمهام مرتبطة بقائمة عملك. تعديل المصدر يتم من المهام أو من تقدم المنهج.</span>{plan.taskSync && <strong>{plan.taskSync.taskCount.toLocaleString("ar-EG")} مهمة مرتبطة</strong>}</footer>
      )}

      <details className="sf-sp-plan-extra"><summary>ملخص إضافي ومساعد الخطة</summary><p>{displayArabicText(plan.summary,"خطة مذاكرة مرتبة حسب بيانات ملفك الدراسي.")}</p>{plan.habits.length > 0 && <div className="sf-sp-habits">{plan.habits.map((habit,index)=><article key={habit.title+index}><strong>{displayArabicText(habit.title,"عادة دراسية")}</strong><small>{displayArabicText(habit.cue,"استخدمها لدعم الاستمرارية في المذاكرة.")}</small></article>)}</div>}<PlanAssistantChat plan={plan} subjectIds={subjectIds} editable={true} onChange={onChange} onApprove={onApprove} approving={approving} /></details>
    </section>
  );
}


function PlanAssistantChat({ plan, subjectIds, editable, onChange, onApprove, approving }: {
  plan: PlanView;
  subjectIds: string[];
  editable: boolean;
  onChange: (next: PlanView) => void;
  onApprove: (nextPlan?: PlanView) => void;
  approving: boolean;
}) {
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [draft, setDraft] = useState("");
  const [webSearchAvailable, setWebSearchAvailable] = useState<boolean | null>(null);
  const context = useMemo(() => [
    "السياق: المستخدم يتحدث من صفحة خطة المذاكرة في StudyFlow.",
    "أجب دائمًا بالعربية المصرية الواضحة، ولا تستخدم عناوين إنجليزية في الشرح.",
    "اسم الخطة: " + displayArabicText(plan.title, "خطة المذاكرة"),
    "ملخص الخطة: " + displayArabicText(plan.summary, "خطة مرتبة حسب التزاماتك وتقدمك الفعلي."),
    "خطوات الخطة الحالية:",
    ...plan.steps.map((step, index) =>
      `${index + 1}. ${displayPlanStepTitle(step, subjectIds)} | ${displayPlanStepCategory(step, subjectIds)} | ${displayPlanStepDetail(step, subjectIds)}${step.priorityReason ? " | سبب الأولوية: " + displayArabicText(step.priorityReason, "تم اختيارها حسب الأولوية المسجلة.") : ""}`
    ),
  ].join("\n").slice(0, 7_500), [plan, subjectIds]);

  const chat = trpc.ai.chat.useMutation({
    onSuccess: result => {
      setMessages(current => [...current, { role: "assistant" as const, content: result.content }].slice(-20));
      const webSearchAvailable = "webSearchAvailable" in result ? result.webSearchAvailable : false;
      setWebSearchAvailable(webSearchAvailable);
      const planPatch = "planPatch" in result ? result.planPatch : undefined;
      if (planPatch && editable) {
        const updatedPlan = applyPlannerAssistantPatch(plan, planPatch);
        onChange(updatedPlan);
        onApprove(updatedPlan);
        toast("المساعد طبّق التغيير على الخطة ويزامن المهام الآن.");
      }
    },
    onError: error => toast.error(error.message || "تعذّر الوصول إلى مساعد الخطة."),
  });

  const sendMessage = () => {
    const content = draft.trim();
    if (!content || chat.isPending) return;
    const nextMessages = [...messages, { role: "user" as const, content }].slice(-20);
    setMessages(nextMessages);
    setDraft("");
    chat.mutate({
      messages: nextMessages,
      memory: "",
      context,
      ...(editable ? {
        planner: {
          title: plan.title,
          summary: plan.summary,
          steps: plan.steps.map((step, index) => ({
            title: displayPlanStepTitle(step, subjectIds),
            detail: displayPlanStepDetail(step, subjectIds),
            category: displayPlanStepCategory(step, subjectIds),
            priority: step.priority,
            phaseId: step.phaseId,
            completed: step.plannerTaskStatus === "done" || step.existingTask?.status === "done",
            linkedTask: Boolean(step.existingTask),
          })),
        },
      } : {}),
    });
  };

  return (
    <section className="sf-plan-chat lg:col-span-2 overflow-hidden rounded-2xl border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-muted/20 p-4 sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><MessageCircle className="size-5" /></span>
          <div className="min-w-0">
            <h3 className="font-bold">اتكلم مع مساعد خطتك</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">اسأله عن ترتيب الأيام أو وقت أي خطوة أو اطلب اقتراحًا لتعديل الخطة.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-border bg-background px-3 py-1.5 text-[10px] text-muted-foreground">{editable ? "تحرير المسودة متاح" : "الخطة المعتمدة — وضع القراءة"}</span>
          <span className="rounded-full border border-border bg-background px-3 py-1.5 text-[10px] text-muted-foreground">
            {webSearchAvailable === null ? "البحث المباشر غير مفعّل" : webSearchAvailable ? "بحث مباشر متاح" : "البحث المباشر غير مفعّل"}
          </span>
        </div>
      </header>
      <div className="grid gap-3 p-3 sm:p-4">
        <div className="max-h-[360px] min-h-24 space-y-3 overflow-y-auto rounded-xl bg-muted/15 p-3" aria-live="polite">
          {!messages.length && (
            <div className="flex min-h-20 items-center gap-3 text-sm text-muted-foreground">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><BrainCircuit className="size-4" /></span>
              <p>{editable
                ? "أنا شايف تفاصيل الخطة. اطلب تعديل ترتيب الخطوات أو أولوية مهمة أو تفاصيلها، وسأطبّق التغيير على المسودة قبل اعتمادها."
                : "أنا شايف تفاصيل الخطة المعتمدة. اسأل عن سبب الترتيب أو اطلب اقتراحًا؛ التعديل الفعلي يتطلب إنشاء مسودة جديدة."}</p>
            </div>
          )}
          {messages.map((message, index) => (
            <div key={`${index}-${message.role}`} className={message.role === "user" ? "flex justify-start" : "flex justify-end"}>
              <div className={"max-w-[92%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-7 " + (message.role === "user"
                ? "rounded-br-md bg-primary text-primary-foreground"
                : "rounded-bl-md border border-border bg-card text-foreground")}>
                {message.content}
              </div>
            </div>
          ))}
          {chat.isPending && <div className="flex justify-end"><span className="rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground">المساعد بيحلل الخطة...</span></div>}
        </div>
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
              }
            }}
            rows={2}
            maxLength={4_000}
            placeholder="اكتب سؤالك عن الخطة..."
            aria-label="اكتب رسالة لمساعد الخطة"
            className="min-h-12 max-h-32 min-w-0 flex-1 resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/60"
          />
          <Button type="button" onClick={sendMessage} disabled={!draft.trim() || chat.isPending || approving} className="h-12 shrink-0 rounded-xl px-4">
            <Send className="size-4" /><span className="hidden sm:inline">إرسال</span>
          </Button>
        </div>
        <p className="px-1 text-[10px] text-muted-foreground">{editable
          ? "المساعد يقدر يعدّل الخطوات الموجودة ويزامن التغييرات فورًا. المهام المكتملة والواجبات الأصلية المحفوظة محمية من التعديل أو الحذف."
          : "المساعد يشرح الخطة ويقترح البدائل؛ لا يغيّر المهام الفعلية من وضع القراءة."}</p>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-border/70 bg-card/75 p-3">
    <span className="text-[11px] text-muted-foreground">{label}</span>
    <b className="mt-1 block text-sm font-bold">{value}</b>
  </div>;
}
