import DashboardLayout from "@/components/DashboardLayout";
import PlanExportActions from "@/components/PlanExportActions";
import QueryErrorNotice from "@/components/QueryErrorNotice";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ENGLISH_CURRICULUM_LABELS, displayBranchTitle, displayCurriculumTitle } from "@/lib/curriculum-display";
import {
  getSIECheckpointProgressBranches,
  getSIEStudentVisibleBranches,
  getSIESubject,
  matchSIECheckpointTask,
} from "@shared/sie-catalog";
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
  phaseId?: "backlog" | "teacher_sync" | "steady";
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
type ExecutionStrategyPhase = { id: "backlog" | "teacher_sync" | "steady"; title: string; purpose: string; actions: string[]; completionCriteria: string };
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
    };
  }
  const match = matchSIECheckpointTask(subjectIds, [step.title, step.detail, step.category].join(" "));
  if (match) {
    return {
      subjectId: match.subjectId,
      subject: getSIESubject(match.subjectId)?.nameAr ?? "مادة دراسية",
      branch: displayBranchTitle(match.branchTitle),
      lesson: displayCurriculumTitle(match.title),
    };
  }
  return null;
}

function displayPlanStepTitle(step: PlanStep, subjectIds: string[]): string {
  const curriculum = getPlanStepCurriculum(step, subjectIds);
  const hasLatinText = /[A-Za-z]{3,}/.test(String(step.title ?? ""));
  if (curriculum && hasLatinText) {
    const segment = step.segmentIndex && step.segmentCount && step.segmentCount > 1
      ? " — الجزء " + step.segmentIndex.toLocaleString("ar-EG") + " من " + step.segmentCount.toLocaleString("ar-EG")
      : "";
    return curriculum.subject + " · " + curriculum.branch + " · " + curriculum.lesson + segment;
  }
  return displayArabicText(displayCurriculumTitle(step.title), curriculum
    ? curriculum.subject + " · " + curriculum.branch + " · " + curriculum.lesson
    : "مهمة دراسية");
}

function displayPlanStepCategory(step: PlanStep, subjectIds: string[]): string {
  const curriculum = getPlanStepCurriculum(step, subjectIds);
  if (curriculum) return curriculum.subject + " · " + curriculum.branch;
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
  const [plannerTab, setPlannerTab] = useState<"overview" | "schedule" | "curriculum" | "tasks" | "history">("overview");

  const history = trpc.plans.list.useQuery();
  const profile = trpc.studentProfile.get.useQuery(undefined, {
    retry: 1,
    refetchOnWindowFocus: true,
  });
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
  const curriculumLinkedTasks = mappedOpenTasks.filter(item => item.match);
  const taskProgressConflicts = curriculumLinkedTasks.filter(({ task, match }) => {
    if (!match) return false;
    const branch = getSIECheckpointProgressBranches(match.subjectId).find(item => item.branchId === match.branchId);
    const gap = (learning.data as any)?.gapByBranch?.[match.subjectId]?.[match.branchId];
    const index = branch?.choices.findIndex(choice => choice.nodeId === match.nodeId) ?? -1;
    return index >= 0 && typeof gap?.studentPosition === "number" && index < gap.studentPosition;
  });
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
    if (history.isLoading || history.isError || waitingForActivePlan || historyInitialized.current) return;
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
    activeDailyPlan.isLoading,
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
  const nextPlanStep = plan?.steps.find(step => step.plannerTaskStatus !== "done" && step.existingTask?.status !== "done") ?? null;
  const taskRows = tasksQuery.data ?? [];
  const openTaskRows = taskRows.filter(task => task.status !== "done");
  const overdueTaskRows = openTaskRows.filter(task => task.dueAt && new Date(task.dueAt).getTime() < Date.now());
  const todayTaskRows = openTaskRows.filter(task => task.dueAt && new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date(task.dueAt)) === todayCairo);
  const curriculumGapCount = progressPreview.reduce((sum, item) => sum + (typeof item.gapCount === "number" ? item.gapCount : 0), 0);
  const workloadReady = !tasksQuery.isLoading && !learning.isLoading && !tasksQuery.isError && !learning.isError;
  const paceRecommendation: StudyPace = !workloadReady
    ? "balanced"
    : overdueTaskRows.length >= 3 || openTaskRows.length >= 10 || curriculumGapCount >= 12
      ? "intensive"
      : openTaskRows.length <= 2 && overdueTaskRows.length === 0 && curriculumGapCount <= 3
        ? "relaxed"
        : "balanced";
  const paceEvidence = !workloadReady
    ? "لم تكتمل قراءة المهام وتقدم المنهج؛ ستظهر التوصية بعد تحميل البيانات."
    : "بياناتك الحالية: " + openTaskRows.length.toLocaleString("ar-EG") + " مهمة مفتوحة، "
      + overdueTaskRows.length.toLocaleString("ar-EG") + " متأخرة، و"
      + curriculumGapCount.toLocaleString("ar-EG") + " موضعًا متأخرًا عن مرجع المدرس عبر الفروع المعروفة.";
  const pacePersonalReasons: Record<StudyPace, string> = {
    relaxed: "لديك " + openTaskRows.length.toLocaleString("ar-EG") + " مهمة مفتوحة و"
      + overdueTaskRows.length.toLocaleString("ar-EG") + " متأخرة، مع " + curriculumGapCount.toLocaleString("ar-EG")
      + " موضعًا معروفًا في فجوات المنهج. الإيقاع المرن يقلل عدد الخطوات ويترك مساحة للثبات.",
    balanced: "لديك " + openTaskRows.length.toLocaleString("ar-EG") + " مهمة مفتوحة و"
      + overdueTaskRows.length.toLocaleString("ar-EG") + " متأخرة، و" + curriculumGapCount.toLocaleString("ar-EG")
      + " موضعًا في فجوات المنهج. المتوازن يقسم الانتباه بين إغلاق الالتزامات ومواكبة المواد.",
    intensive: "لديك " + openTaskRows.length.toLocaleString("ar-EG") + " مهمة مفتوحة، منها "
      + overdueTaskRows.length.toLocaleString("ar-EG") + " متأخرة، إضافة إلى "
      + curriculumGapCount.toLocaleString("ar-EG") + " موضعًا في فجوات المنهج. المكثف يرفع عدد الخطوات المقترحة لتقليل هذا التراكم تدريجيًا.",
  };
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
              <span>{selectedPace === "relaxed" ? "إيقاع مرن" : selectedPace === "intensive" ? "إيقاع مكثف" : "إيقاع متوازن"}</span>
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
            ["curriculum", "المنهج", BrainCircuit],
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
                  <div><span className="sf-sp-eyebrow">اختيار إيقاع الخطة</span><h2>تختار تذاكر بإيقاع إيه؟</h2></div>
                </div>
                <p>الاختيار يحدد حجم المهام التي يقترحها المحرك، ويظل قابلًا للتعديل. التوصية تتغير تلقائيًا حسب التراكم والمهام المتأخرة وفجوات المنهج.</p>
                <div className="sf-sp-pace-options">
                  {([
                    ["relaxed", "مرنة", "خطوات أقل", "للاستمرارية الهادئة وإنجاز الأولويات القريبة."],
                    ["balanced", "متوازنة", "توزيع متوازن", "للموازنة بين المتراكم ومواكبة جميع المواد."],
                    ["intensive", "مكثفة", "خطوات أكثر", "لتقليل التراكم عندما تسمح طاقتك بذلك."],
                  ] as const).map(([pace, label, subtitle, baseReason]) => (
                    <button
                      key={pace}
                      type="button"
                      aria-pressed={selectedPace === pace}
                      className={"sf-sp-pace-choice " + (selectedPace === pace ? "is-selected" : "") + (paceRecommendation === pace ? " is-recommended" : "")}
                      onClick={() => setSelectedPace(pace)}
                    >
                      <span className="sf-sp-pace-choice-top">
                        <strong>{label}</strong>
                        {workloadReady && paceRecommendation === pace && <em>الموصى بها لك</em>}
                      </span>
                      <small>{subtitle}</small>
                      <p>{baseReason}</p>
                      <span className="sf-sp-pace-personal">{workloadReady
                        ? pacePersonalReasons[pace]
                        : "تظهر ملاءمة هذا الإيقاع بعد اكتمال قراءة بياناتك."}</span>
                    </button>
                  ))}
                </div>
                <div className="sf-sp-pace-evidence">
                  <strong>{workloadReady ? "لماذا رُشّح هذا الإيقاع؟" : "جاري تجهيز التوصية"}</strong>
                  <p>{paceEvidence}</p>
                  <small>{workloadReady
                    ? (paceRecommendation === "intensive"
                      ? "تميل التوصية للمكثف عند وجود 3 مهام متأخرة أو 10 مهام مفتوحة أو 12 موضع فجوة فأكثر."
                      : paceRecommendation === "relaxed"
                        ? "تميل التوصية للمرن عندما تكون المهام المفتوحة 2 أو أقل، ولا توجد مهام متأخرة، والفجوات المعروفة 3 أو أقل."
                        : "المتوازن هو الاختيار الافتراضي عندما لا تكون البيانات قليلة بما يكفي للمرن، ولا مرتفعة بما يكفي للمكثف.")
                    : "لن نحدد إيقاعًا موصى به قبل اكتمال تحميل بيانات المهام والمنهج."}</small>
                </div>
                <Button type="button" className="sf-sp-build-button" disabled={!isPreflightReady || ensureDaily.isPending || !profile.data?.subjectIds?.length} onClick={runGeneration}>
                  {ensureDaily.isPending ? <><Loader2 className="size-4 animate-spin" /> جارٍ تحديث الخطة</> : <>{plan ? <RefreshCw className="size-4" /> : <Sparkles className="size-4" />}{plan ? "إعادة بناء الخطة الحالية" : "تحديث خطة المذاكرة"}</>}
                </Button>
                <small>StudyFlow ينشئ خطة واحدة تلقائيًا من التراكم وتحديثات المدرسين، ثم يحدّث المهام المفتوحة بدل نسخها. إعادة البناء تستبدل الخطة الحالية وتحافظ على المهام المكتملة.</small>
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
                <a href="/profile"><ArrowUpRight className="size-4" />افتح الملف الدراسي</a>
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

            {plan?.executionStrategy && (
              <section className="sf-sp-strategy" data-scroll-reveal>
                <div className="sf-sp-section-heading"><div><span className="sf-sp-eyebrow">منطق ترتيب الأولويات</span><h2>{plan.executionStrategy.objective}</h2></div></div>
                <p>{plan.executionStrategy.rationale}</p>
                {plan.executionStrategy.phases?.length ? (
                  <div className="sf-sp-phase-summary">
                    {plan.executionStrategy.phases.map((phase,index) => (
                      <article key={phase.id}><span>{(index+1).toLocaleString("ar-EG")}</span><div><strong>{phase.title}</strong><small>{phase.purpose}</small></div></article>
                    ))}
                  </div>
                ) : null}
              </section>
            )}
          </div>
        )}

        {plannerTab === "schedule" && (
          <div className="sf-sp-panel" data-scroll-reveal>
            {plan ? (
              <PlanCard plan={plan} subjectIds={profile.data?.subjectIds ?? []} title={approved ? "الخطة المعتمدة" : loadedSavedDraft ? "مسودة محفوظة" : "مقترح للمراجعة"} studentName={profile.data?.studentName} editable={!approved} onChange={updatePlan} onApprove={approveCurrentPlan} onAddStep={addStep} onRemoveStep={removeStep} onMoveStep={moveStep} approving={approvePlan.isPending} approved={approved} />
            ) : (
              <section className="sf-sp-empty"><h2>لا يوجد توزيع مذاكرة حالي</h2><p>أنشئ مقترحًا أولًا، ثم راجع توزيع المهام حسب الأولوية والمرحلة واعتمده لإضافته إلى قائمتك.</p><Button type="button" onClick={() => setPlannerTab("overview")}>العودة إلى الملخص</Button></section>
            )}
          </div>
        )}

        {plannerTab === "curriculum" && (
          <div className="sf-sp-panel sf-sp-curriculum-panel">
            <section className="sf-sp-section-card" data-scroll-reveal>
              <div className="sf-sp-section-heading"><div><span className="sf-sp-eyebrow">تقدم موثّق</span><h2>خريطة ما أُنجز وما تبقى</h2></div><a href="/curriculum" className="sf-sp-text-action">فتح خريطة المنهج <ArrowUpRight className="size-4" /></a></div>
              <p className="sf-sp-muted-intro">نقطة الطالب ومرجع المدرس مستقلان. أي فرع لا توجد له بيانات كافية سيظهر كغير محدد بدل اعتباره صفرًا.</p>
              {progressPreview.length ? (
                <div className="sf-sp-curriculum-list">
                  {progressPreview.map(item => {
                    const percent = item.completedCount === null ? null : Math.round(item.completedCount / Math.max(1,item.totalCount) * 100);
                    return (
                      <article key={item.key} className="sf-sp-curriculum-row">
                        <div className="sf-sp-curriculum-main">
                          <div className="sf-sp-branch-heading"><span>{item.subject}</span><small>{item.branch}</small></div>
                          <strong>الخطوة التالية: {item.next}</strong>
                          <p>آخر درس مكتمل: {item.lastCompleted}</p>
                          <small>مرجع المدرس: {item.reference}</small>
                        </div>
                        <div className="sf-sp-curriculum-side">
                          <strong>{item.gapCount === null ? "غير محسوبة" : item.gapCount.toLocaleString("ar-EG") + " درس"}</strong>
                          <span>فجوة التقدم عن المرجع</span>
                          <div className="sf-sp-progress-track"><i style={{width:(percent ?? 0) + "%"}} /></div>
                          <small>{percent === null ? "لا توجد نقطة طالب مؤكدة" : percent.toLocaleString("ar-EG") + "% من الفرع"}</small>
                          <a href={"/study?subject=" + encodeURIComponent(item.subjectId) + "&branch=" + encodeURIComponent(item.branchId)}>افتح هذا الفرع <ArrowUpRight className="size-3.5" /></a>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : <div className="sf-sp-empty-inline">لا توجد بيانات منهج مرتبطة بالمواد المحددة.</div>}
              <div className="sf-sp-curriculum-total">إجمالي الفجوات المحسوبة: <strong>{curriculumGapCount.toLocaleString("ar-EG")}</strong> موضعًا عبر الفروع المعروفة فقط.</div>
            </section>
          </div>
        )}

        {plannerTab === "tasks" && (
          <div className="sf-sp-panel">
            <section className="sf-sp-section-card" data-scroll-reveal>
              <div className="sf-sp-section-heading"><div><span className="sf-sp-eyebrow">قائمة العمل الفعلية</span><h2>مهام مفتوحة تؤثر على ترتيب المذاكرة</h2></div><a href="/tasks" className="sf-sp-text-action">إدارة كل المهام <ArrowUpRight className="size-4" /></a></div>
              {taskProgressConflicts.length > 0 && <div className="sf-sp-conflict"><strong>تحتاج مراجعة حالة المنهج</strong><p>هناك {taskProgressConflicts.length.toLocaleString("ar-EG")} مهمة مرتبطة بموضع يظهر مكتملًا بالفعل في تقدم المنهج. إكمال المهمة لا يغيّر تقدم المنهج تلقائيًا.</p><a href="/curriculum">راجع خريطة المنهج</a></div>}
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
  const stages: Array<{ id: GenerationProgress["currentStage"]; title: string }> = [
    { id: "profile", title: "قراءة ملف الطالب والتقدم المسجل" },
    { id: "curriculum", title: "تحميل خريطة الكتب والفروع والمتطلبات" },
    { id: "model", title: "تحليل الأولويات وتكوين المسودة" },
    { id: "validation", title: "مراجعة المسودة والقواعد المعتمدة" },
    { id: "saving", title: "حفظ المسودة للمراجعة" },
  ];
  return (
    <section className="app-card rounded-2xl p-5 sm:p-6" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-secondary text-primary"><Sparkles className="size-5 animate-pulse" /></span>
        <div>
          <h3 className="font-bold">بنجهّز مسودة خطتك</h3>
          <p className="mt-1 text-sm text-muted-foreground">{progress?.detail || "نراجع ملفك الدراسي والمهام وتقدم المنهج قبل ترتيب الأولويات."}</p>
        </div>
        <Loader2 className="mr-auto size-5 animate-spin text-primary" />
      </div>
      <ol className="mt-5 space-y-2">
        {stages.map((stage, index) => {
          const done = progress?.completedStages.includes(stage.id) ?? false;
          const current = progress?.status === "running" && progress.currentStage === stage.id;
          return (
            <li key={stage.id} className={"flex items-center gap-3 rounded-xl border px-3 py-3 " + (current
              ? "border-primary/40 bg-primary/5"
              : done ? "border-emerald-500/20 bg-emerald-500/5" : "border-border/60 bg-muted/10")}>
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border/70 text-xs">
                {done ? <CheckCircle2 className="size-4 text-emerald-600" /> : current ? <Loader2 className="size-4 animate-spin text-primary" /> : index + 1}
              </span>
              <span className={"text-sm " + (current || done ? "font-semibold" : "text-muted-foreground")}>{stage.title}</span>
              {current && <span className="mr-auto text-[11px] font-medium text-primary">جارٍ الآن</span>}
              {done && <span className="mr-auto text-[11px] text-emerald-700">اكتملت</span>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function PlanCard({ plan, subjectIds, title, studentName, editable, onChange, onApprove, onAddStep, onRemoveStep, onMoveStep, approving, approved }: {
  plan: PlanView; subjectIds: string[]; title: string; studentName?: string; editable: boolean;
  onChange: (next: PlanView) => void; onApprove: (nextPlan?: PlanView) => void; onAddStep: () => void;
  onRemoveStep: (index: number) => void; onMoveStep: (index: number, direction: -1 | 1) => void;
  approving: boolean; approved: boolean;
}) {
  const [editing, setEditing] = useState<{ index: number; title: string; detail: string } | null>(null);
  const [filter, setFilter] = useState<"all" | "open" | "done">("all");
  const completedCount = plan.steps.filter(step => step.plannerTaskStatus === "done" || step.existingTask?.status === "done").length;
    const subjectCount = new Set(plan.steps.map(step => getPlanStepCurriculum(step, subjectIds)?.subjectId).filter(Boolean)).size;
  const confirmedTaskCount = plan.steps.filter(step => Boolean(step.existingTask)).length;
  const phaseLabels: Record<string,string> = {
    backlog: "المتراكم والالتزامات المفتوحة",
    teacher_sync: "مواكبة شرح المدرسين",
    steady: "استكمال المنهج والتثبيت",
    deferred: "خطوات مؤجلة للدورة القادمة",
  };
  const phaseOrder = ["backlog", "teacher_sync", "steady", "deferred"];
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
  const phaseLabel: Record<string,string> = {backlog:"المتراكم",teacher_sync:"مواكبة المدرس",steady:"التثبيت"};
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
        <article><span>الخطوات المكتملة</span><strong>{completedCount.toLocaleString("ar-EG")}</strong></article>
        <article><span>المواد الممثلة</span><strong>{subjectCount.toLocaleString("ar-EG")}</strong></article>
        <article><span>التزامات مسجلة</span><strong>{confirmedTaskCount.toLocaleString("ar-EG")}</strong></article>
      </div>

      {plan.executionStrategy && (
        <section className="sf-sp-plan-rationale">
          <span className="sf-sp-eyebrow">منطق الترتيب</span>
          <h3>{displayArabicText(plan.executionStrategy.objective, "نبدأ بالأولويات المسجلة، ثم نواكب شرح المدرس ونكمل المنهج.")}</h3>
          <p>{displayArabicText(plan.executionStrategy.rationale, "يراعي الترتيب المهام المفتوحة وتقدمك الفعلي في كل مادة، من دون تكرار ما أنجزته.")}</p>
          {plan.executionStrategy.phases?.length ? (
            <div className="sf-sp-phase-summary">
              {plan.executionStrategy.phases.map((phase,index) => (
                <article key={phase.id}><span>{(index+1).toLocaleString("ar-EG")}</span><div><strong>{phaseLabels[phase.id] ?? phase.title}</strong><small>{displayArabicText(phase.purpose, "مرحلة لتنفيذ الخطوات ذات الأولوية.")}</small></div></article>
              ))}
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

      <div className="sf-sp-board-toolbar">
        <div><h3>خطوات المذاكرة</h3><p>كل خطوة مرتبطة بيوم تنفيذ محدد، ويتغير عدد الأجزاء حسب إيقاعك الدراسي.</p></div>
        <div className="sf-sp-filter-group" role="group" aria-label="تصفية مهام الخطة">
          {([["all","الكل"],["open","المتبقي"],["done","المكتمل"]] as const).map(([key,label]) => <button type="button" key={key} aria-pressed={filter===key} onClick={()=>setFilter(key)}>{label}</button>)}
        </div>
      </div>

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
                            {curriculum && <span>{curriculum.branch}</span>}
                            {step.phaseId && <span>{phaseLabel[step.phaseId] || "مرحلة الخطة"}</span>}
                            {step.priority && <span>{priorityLabel[step.priority] || "أولوية عادية"}</span>}
                            {step.difficulty && <span>{difficultyLabel[step.difficulty] || "غير محدد"}</span>}
                            {step.existingTask && <span>التزام مسجل</span>}
                            {step.scheduleState === "deferred" && <span>مؤجلة للدورة القادمة</span>}
                            {isDone && <span>مكتملة</span>}
                            {(formatDate(step.existingTask?.dueAt) || step.day) && <span>يوم التنفيذ: {formatDate(step.existingTask?.dueAt) || step.day}</span>}
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
                          {step.resourceRecommendation && <a className="sf-sp-resource-link" href={step.resourceRecommendation.url} target="_blank" rel="noreferrer">افتح شرح المدرس المقترح <ArrowUpRight className="size-3.5" /></a>}
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
      setWebSearchAvailable(result.webSearchAvailable ?? false);
      if (result.planPatch && editable) {
        const updatedPlan = applyPlannerAssistantPatch(plan, result.planPatch);
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
