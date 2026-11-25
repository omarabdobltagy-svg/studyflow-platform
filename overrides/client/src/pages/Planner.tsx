import DashboardLayout from "@/components/DashboardLayout";
import PlanExportActions from "@/components/PlanExportActions";
import QueryErrorNotice from "@/components/QueryErrorNotice";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  BrainCircuit,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type Pace = "intensive" | "balanced" | "relaxed";
type PlanStep = {
  day: string;
  title: string;
  detail: string;
  minutes: number;
  category: string;
  priority?: "critical" | "high" | "medium" | "low";
  priorityScore?: number;
  priorityReason?: string;
  priorityEvidenceConfidence?: "low" | "medium" | "high";
  examComponentLabel?: string;
  examComponentMarks?: number;
  examPaperMarks?: number;
  curriculumNodeIds?: string[];
  resourceRecommendation?: { title: string; url: string; teacherName?: string; reason: string };
  difficulty?: "easy" | "medium" | "hard" | "unknown";
  lessonSize?: "small" | "medium" | "large" | "unknown";
  difficultyBasis?: "student_report" | "assessment_history" | "curriculum_profile" | "unknown";
  difficultyConfidence?: "low" | "medium" | "high";
  printedPageRange?: [number, number];
  sourcePages?: number[];
};
type PlanView = {
  title: string;
  summary: string;
  durationLabel: string;
  steps: PlanStep[];
  habits: { title: string; cue: string }[];
  reviewQuestion: string;
  taskSync?: { parentGoalId: number; stageCount: number; taskCount: number; routineId?: number | null };
};
const EXAM_DATE = "2027-06-12";
const DAILY_SNAPSHOT_PREFIX = "SIE_DAILY_PLAN_V4:";
const todayCairo = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
const initialPrompt = "حلّل ملفي الدراسي كاملًا وأنشئ مسودة خطة سنوية واقعية تغطي المنهج المتبقي، وتراعي التراكم ونتائج التقييم وصعوبة الدروس والمتطلبات السابقة، وتبدأ من اليوم وتستهدف الاستعداد لامتحان نهاية السنة.";
const paceOptions: Array<{ value: Pace; title: string; subtitle: string }> = [
  { value: "intensive", title: "مكثفة", subtitle: "إنجاز أسرع وحمل يومي أعلى" },
  { value: "balanced", title: "متوازنة", subtitle: "تقدم ثابت مع مساحة للمراجعة" },
  { value: "relaxed", title: "مريحة", subtitle: "جلسات أخف ووقت استيعاب أكبر" },
];

function formatStudyDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder} دقيقة`;
  const hoursLabel = hours === 1 ? "ساعة" : hours === 2 ? "ساعتان" : `${hours} ساعات`;
  return remainder ? `${hoursLabel} و${remainder} دقيقة` : hoursLabel;
}

function parseSavedPlan(record: { planJson: string }): PlanView | null {
  try {
    const saved = JSON.parse(record.planJson) as Partial<PlanView>;
    if (!saved || typeof saved.title !== "string" || !Array.isArray(saved.steps) || saved.steps.length === 0) return null;
    return {
      title: saved.title,
      summary: typeof saved.summary === "string" ? saved.summary : "خطة دراسية مبنية على ملفك وتقدمك.",
      durationLabel: typeof saved.durationLabel === "string" ? saved.durationLabel : "مدة مرنة",
      steps: saved.steps.map((raw: any, index) => ({
        day: typeof raw.day === "string" ? raw.day : `اليوم ${index + 1}`,
        title: typeof raw.title === "string" ? raw.title : "مهمة دراسية",
        detail: typeof raw.detail === "string" ? raw.detail : "نفّذ المهمة ثم سجّل تقدمك.",
        minutes: Number.isFinite(Number(raw.minutes)) ? Math.max(5, Math.min(480, Math.round(Number(raw.minutes)))) : 30,
        category: typeof raw.category === "string" ? raw.category : "دراسة",
        ...raw,
      })),
      habits: Array.isArray(saved.habits) ? saved.habits : [],
      reviewQuestion: "", // Legacy export compatibility only; StudyFlow no longer generates or displays self-test questions.
    };
  } catch {
    return null;
  }
}

export default function Planner() {
  const utils = trpc.useUtils();
  const [plan, setPlan] = useState<PlanView | null>(null);
  const [pace, setPace] = useState<Pace>("balanced");
  const [dailyMinutes, setDailyMinutes] = useState(120);
  const [usePersonalDeadline, setUsePersonalDeadline] = useState(false);
  const [personalDeadline, setPersonalDeadline] = useState("");
  const [approved, setApproved] = useState(false);
  const autoStarted = useRef(false);

  const history = trpc.plans.list.useQuery();
  const profile = trpc.studentProfile.get.useQuery(undefined, {
    retry: 1,
    refetchOnWindowFocus: true,
  });

  const savedPlans = useMemo(() => (history.data || [])
    .filter(record => !String(record.prompt || "").startsWith(DAILY_SNAPSHOT_PREFIX))
    .flatMap(record => {
      const saved = parseSavedPlan(record);
      return saved ? [{ id: record.id, createdAt: record.createdAt, plan: saved }] : [];
    }), [history.data]);

  const generate = trpc.plans.generate.useMutation({
    onSuccess: result => {
      setPlan({
        ...result,
        habits: Array.isArray(result.habits) ? result.habits : [],
        steps: Array.isArray(result.steps) ? result.steps : [],
        reviewQuestion: "", // Ignore legacy or provider-supplied self-test questions.
      });
      setApproved(false);
      void utils.plans.list.invalidate();
      toast.success("المسودة جاهزة. راجعها واضبطها قبل اعتماد المهام.");
    },
    onError: error => toast.error("تعذّر بناء الخطة: " + error.message),
  });

  const approvePlan = trpc.plans.approve.useMutation({
    onSuccess: async result => {
      setApproved(true);
      setPlan(current => current ? {
        ...current,
        taskSync: {
          parentGoalId: result.parentGoalId,
          stageCount: result.taskCount,
          taskCount: result.taskCount,
          routineId: result.routineId ?? null,
        },
      } : current);
      await Promise.all([
        utils.plans.currentDaily.invalidate(),
        utils.tasks.list.invalidate(),
        utils.goals.list.invalidate(),
        utils.dashboard.summary.invalidate(),
        utils.plans.list.invalidate(),
      ]);
      toast.success(`تم اعتماد خطتك وإنشاء ${result.taskCount} مهام في قائمة المهام.`);
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
      autoStarted.current = false;
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

  const runGeneration = (selectedPace: Pace, selectedMinutes: number, deadline: string | null) => {
    if (deadline && deadline < todayCairo) {
      toast.error("الموعد الشخصي يجب أن يكون اليوم أو في المستقبل.");
      return;
    }
    generate.mutate({
      prompt: initialPrompt,
      includeStudentProfile: true,
      dailyMinutes: selectedMinutes,
      startDate: todayCairo,
      pace: selectedPace,
      deadline,
    });
  };

  useEffect(() => {
    if (history.isLoading || profile.isLoading || history.isError || profile.isError || autoStarted.current) return;
    if (!profile.data || !Array.isArray(profile.data.subjectIds) || profile.data.subjectIds.length === 0) return;

    // Always build a fresh draft automatically when the student opens
    // the planner. History is intentionally opt-in; it must not silently
    // replace today's generated draft with an old saved plan.
    autoStarted.current = true;
    const savedDailyMinutes = Number((profile.data as any)?.selection?.studyConditions?.dailyMinutes);
    runGeneration("balanced", Number.isFinite(savedDailyMinutes) && savedDailyMinutes >= 20
      ? Math.min(600, savedDailyMinutes)
      : 120, null);
  }, [history.isLoading, history.isError, profile.isLoading, profile.isError, profile.data]);

  const updatePlan = (next: PlanView) => {
    setPlan(next);
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
        day: `اليوم ${plan.steps.length + 1}`,
        title: "مهمة جديدة",
        detail: "اكتب ما الذي تريد إنجازه في هذه الجلسة.",
        minutes: 30,
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

  const approveCurrentPlan = () => {
    if (!plan) return;
    approvePlan.mutate({
      plan: {
        title: plan.title,
        summary: plan.summary,
        steps: plan.steps.map((step, index) => ({
          ...step,
          day: step.day || `اليوم ${index + 1}`,
        })),
      },
      schedule: { startDate: todayCairo, dailyMinutes },
    });
  };

  const handleDeleteAll = () => {
    const confirmed = window.confirm(
      "سيتم حذف كل خطط الذكاء الاصطناعي المحفوظة، مع المهام ومراحل الأهداف التي أنشأتها هذه الخطط فقط. لن تُحذف المهام اليدوية أو تقدمك في المنهج أو ملفك الدراسي. هل تؤكد؟",
    );
    if (confirmed) deleteAllPlans.mutate();
  };

  return (
    <DashboardLayout
      title="المخطط الذكي"
      description="الخطة تبدأ تلقائيًا من ملفك الدراسي. راجعها وعدّلها، ثم اعتمدها لتحويلها إلى مهام."
    >
      <div className="space-y-5">
        {history.isError && <QueryErrorNotice onRetry={() => void history.refetch()} label="تعذّر تحميل خططك المحفوظة." />}
        {profile.isError && <QueryErrorNotice onRetry={() => void profile.refetch()} label="تعذّر تحميل ملفك الدراسي. أعد المحاولة قبل توليد الخطة." />}

        <section className="relative overflow-hidden rounded-[1.6rem] border border-slate-700/60 bg-gradient-to-l from-slate-950 via-slate-900 to-indigo-950 p-5 text-white shadow-xl sm:p-7">
          <div className="pointer-events-none absolute -left-12 -top-16 size-56 rounded-full bg-violet-500/15 blur-3xl" />
          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] font-bold tracking-[0.2em] text-violet-200/75">STUDYFLOW · AI STUDY PLAN</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">خطة واحدة. قرار واضح. وتنفيذ تحت سيطرتك.</h2>
              <p className="mt-2 text-sm leading-7 text-slate-300">
                الذكاء الاصطناعي يبني المسودة من موادك وتقدمك وتراكمك. أنت تراجع المهام وتغيّرها قبل أن تتحول إلى جدول تنفيذ.
              </p>
            </div>
            <div className="shrink-0 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <div className="flex items-center gap-2 text-xs font-semibold text-violet-100"><CalendarClock className="size-4" />موعد امتحان نهاية السنة</div>
              <div className="mt-2 text-xl font-bold">12 يونيو 2027</div>
              <p className="mt-1 text-[11px] text-slate-300">موعد ثابت في حسابات التخطيط</p>
            </div>
          </div>
          {profile.data && (
            <div className="relative mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4 text-xs text-slate-300">
              <span className="rounded-full bg-white/10 px-3 py-1.5">{profile.data.studentName}</span>
              <span className="rounded-full bg-white/10 px-3 py-1.5">{profile.data.track}</span>
              <span className="rounded-full bg-white/10 px-3 py-1.5">{profile.data.subjectIds.length} مواد محددة</span>
            </div>
          )}
        </section>

        {!profile.isLoading && profile.data && (!profile.data.subjectIds || profile.data.subjectIds.length === 0) && (
          <section className="app-card rounded-2xl p-5">
            <h3 className="font-bold">أكمل ملفك الدراسي أولًا</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">حدد نظامك وصفك وموادك حتى يستطيع المخطط اختيار الدروس الصحيحة بدل إنشاء خطة عامة.</p>
            <a href="/profile" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">فتح الملف الدراسي <ArrowUpRight className="size-4" /></a>
          </section>
        )}

        {generate.isPending && !plan && <PlanLoading />}
        {!generate.isPending && !plan && !profile.isLoading && profile.data?.subjectIds?.length && !profile.isError && (
          <section className="app-card rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary"><BrainCircuit className="size-5" /></span>
              <div>
                <h3 className="font-bold">لم تتكوّن المسودة بعد</h3>
                <p className="mt-1 text-sm text-muted-foreground">يمكنك إعادة تشغيل التوليد من هنا.</p>
              </div>
            </div>
            <Button className="mt-4 rounded-xl" onClick={() => runGeneration(pace, dailyMinutes, usePersonalDeadline ? personalDeadline : null)} disabled={generate.isPending}>
              <Sparkles className="size-4" /> إنشاء المسودة
            </Button>
          </section>
        )}

        {plan && (
          <>
            <PlanCard
              plan={plan}
              title={approved ? "الخطة المعتمدة" : "المسودة التي أنشأها المخطط"}
              studentName={profile.data?.studentName}
              editable={!approved}
              onChange={updatePlan}
              onApprove={approveCurrentPlan}
              onAddStep={addStep}
              onRemoveStep={removeStep}
              onMoveStep={moveStep}
              approving={approvePlan.isPending}
              approved={approved}
            />

            {!approved && (
              <section className="app-card rounded-2xl border border-border/70 p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="eyebrow">PERSONALIZE YOUR PLAN</p>
                    <h3 className="mt-1 text-lg font-bold">خلّيني أضبط الخطة على أسلوبك</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">دي أول نسخة. جاوب على الأسئلة دي، وأنا أعيد توزيع الحمل والمدة من غير ما أطلب منك إدخال بيانات ملفك مرة ثانية.</p>
                  </div>
                  <span className="rounded-xl bg-secondary px-3 py-2 text-xs font-semibold text-primary">3 اختيارات بسيطة</span>
                </div>

                <div className="mt-5">
                  <p className="mb-2 text-sm font-semibold">1. تحب إيقاع الخطة يكون إزاي؟</p>
                  <div className="grid gap-2 md:grid-cols-3">
                    {paceOptions.map(option => (
                      <button
                        type="button"
                        key={option.value}
                        onClick={() => setPace(option.value)}
                        aria-pressed={pace === option.value}
                        className={"rounded-xl border p-3 text-right transition " + (pace === option.value
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : "border-border bg-muted/20 hover:border-primary/40")}
                      >
                        <span className="block text-sm font-bold">{option.title}</span>
                        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{option.subtitle}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div>
                    <label htmlFor="planner-daily-time" className="mb-2 block text-sm font-semibold">2. تقدر تخصص كام دقيقة للمذاكرة يوميًا؟</label>
                    <select
                      id="planner-daily-time"
                      value={dailyMinutes}
                      onChange={event => setDailyMinutes(Number(event.target.value))}
                      className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {[60, 90, 120, 150, 180, 210, 240, 300, 360, 420].map(value => (
                        <option key={value} value={value}>{formatStudyDuration(value)}</option>
                      ))}
                    </select>
                    <p className="mt-1.5 text-xs text-muted-foreground">الوقت ده هو متوسط متاح، مش إلزام يومي ثابت.</p>
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-semibold">3. هل عندك موعد شخصي تخلص قبله؟</p>
                    <label className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-muted/20 px-3 text-sm">
                      <input type="checkbox" checked={usePersonalDeadline} onChange={event => setUsePersonalDeadline(event.target.checked)} className="size-4 accent-primary" />
                      عندي موعد نهائي إضافي
                    </label>
                    {usePersonalDeadline && (
                      <input
                        type="date"
                        min={todayCairo}
                        max={EXAM_DATE}
                        value={personalDeadline}
                        onChange={event => setPersonalDeadline(event.target.value)}
                        className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    )}
                    <p className="mt-1.5 text-xs text-muted-foreground">لو مفيش موعد إضافي، هنخطط مباشرة حتى امتحان 12 يونيو 2027.</p>
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs leading-5 text-muted-foreground">إعادة الضبط تنشئ نسخة جديدة للمراجعة فقط، ولا تغيّر مهامك الحالية قبل اعتمادها.</p>
                  <Button
                    className="rounded-xl"
                    onClick={() => runGeneration(pace, dailyMinutes, usePersonalDeadline ? personalDeadline : null)}
                    disabled={generate.isPending || (usePersonalDeadline && !personalDeadline)}
                  >
                    {generate.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                    أعد توزيع الخطة
                  </Button>
                </div>
              </section>
            )}
          </>
        )}

        {savedPlans.length > 0 && (
          <section className="app-card rounded-2xl p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow">PLAN HISTORY</p>
                <h3 className="mt-1 text-lg font-bold">المسودات السابقة</h3>
                <p className="mt-1 text-xs text-muted-foreground">اختر مسودة قديمة لفتحها ومراجعتها من جديد.</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{savedPlans.length} محفوظة</span>
                <Button type="button" variant="destructive" size="sm" className="rounded-xl" onClick={handleDeleteAll} disabled={deleteAllPlans.isPending}>
                  {deleteAllPlans.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                  مسح كل الخطط
                </Button>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {savedPlans.map(item => (
                <article key={item.id} className="rounded-xl border border-border/70 bg-muted/15 p-3">
                  <button
                    type="button"
                    onClick={() => { setPlan(item.plan); setApproved(false); }}
                    className="w-full text-right"
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold"><BrainCircuit className="size-4 text-primary" />{item.plan.title}</span>
                    <span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground">{item.plan.summary}</span>
                    <span className="mt-2 block text-[11px] text-muted-foreground">{new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short", year: "numeric" }).format(new Date(item.createdAt))}</span>
                  </button>
                  <div className="mt-3 flex justify-end border-t border-border/60 pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive"
                      disabled={deleteSavedPlan.isPending}
                      onClick={() => {
                        if (window.confirm("حذف هذه المسودة من السجل؟")) deleteSavedPlan.mutate({ id: item.id });
                      }}
                    >
                      <Trash2 className="size-3.5" />حذف
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {(savedPlans.length === 0 && !history.isLoading) && (
          <div className="flex justify-end">
            <Button type="button" variant="ghost" className="text-xs text-muted-foreground" onClick={handleDeleteAll} disabled={deleteAllPlans.isPending}>
              مسح بيانات الخطط والمهام المولّدة القديمة
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function PlanLoading() {
  return (
    <section className="app-card rounded-2xl p-5 sm:p-6" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-secondary text-primary"><Sparkles className="size-5 animate-pulse" /></span>
        <div>
          <h3 className="font-bold">ببني أول مسودة لخطة دراستك</h3>
          <p className="mt-1 text-sm text-muted-foreground">براجع المواد والتقدم والتراكم وبوازن الحمل قبل عرض المهام.</p>
        </div>
        <Loader2 className="mr-auto size-5 animate-spin text-primary" />
      </div>
      <div className="mt-5 space-y-3">
        <div className="loading-shimmer h-16 rounded-xl" />
        <div className="loading-shimmer h-16 rounded-xl" />
        <div className="loading-shimmer h-16 rounded-xl" />
      </div>
    </section>
  );
}

function PlanCard({
  plan,
  title,
  studentName,
  editable,
  onChange,
  onApprove,
  onAddStep,
  onRemoveStep,
  onMoveStep,
  approving,
  approved,
}: {
  plan: PlanView;
  title: string;
  studentName?: string;
  editable: boolean;
  onChange: (next: PlanView) => void;
  onApprove: () => void;
  onAddStep: () => void;
  onRemoveStep: (index: number) => void;
  onMoveStep: (index: number, direction: -1 | 1) => void;
  approving: boolean;
  approved: boolean;
}) {
  const totalMinutes = plan.steps.reduce((sum, step) => sum + step.minutes, 0);
  const priorityLabel = (value?: string) => value === "critical" ? "عاجل" : value === "high" ? "أولوية عالية" : value === "low" ? "منخفضة" : "متوسطة";
  const difficultyLabel = (value?: string) => value === "hard" ? "صعب" : value === "easy" ? "سهل" : value === "medium" ? "متوسط" : "غير محدد";
  return (
    <section className="app-card overflow-hidden rounded-2xl border border-border/80">
      <div className="border-b border-border/70 bg-gradient-to-l from-secondary/60 to-card p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="eyebrow">{title}</p>
            <input
              aria-label="عنوان الخطة"
              disabled={!editable}
              value={plan.title}
              onChange={event => onChange({ ...plan, title: event.target.value })}
              className="mt-1 w-full rounded-lg border border-transparent bg-transparent px-1 py-1 text-xl font-bold outline-none focus:border-primary/40 focus:bg-background/60 disabled:opacity-100"
            />
            <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">{plan.summary}</p>
            {studentName && <p className="mt-2 text-xs text-primary">خطة مخصصة لـ {studentName}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-card px-3 py-2 text-xs font-semibold text-primary shadow-sm"><Clock3 className="size-3.5" />{plan.durationLabel || formatStudyDuration(totalMinutes)}</span>
            <PlanExportActions plan={plan} studentName={studentName} />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric label="خطوات" value={plan.steps.length.toString()} />
          <Metric label="إجمالي الوقت" value={formatStudyDuration(totalMinutes)} />
          <Metric label="خطوات عالية الأولوية" value={plan.steps.filter(step => step.priority === "critical" || step.priority === "high").length.toString()} />
          <Metric label="دروس صعبة" value={plan.steps.filter(step => step.difficulty === "hard").length.toString()} />
        </div>

        {plan.taskSync && (
          <div className="mt-4 flex flex-col gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold"><CheckCircle2 className="size-4 text-emerald-600" />تم اعتماد الخطة وإنشاء المهام</div>
            <a href="/tasks" className="inline-flex items-center gap-1 text-xs font-semibold text-primary">فتح قائمة المهام <ArrowUpRight className="size-3.5" /></a>
          </div>
        )}
      </div>

      <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(230px,.65fr)]">
        <main className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-bold">تفاصيل التنفيذ</h3>
              <p className="mt-1 text-xs text-muted-foreground">{editable ? "اضغط داخل المهمة لتغيير محتواها ومدتها أو ترتيبها." : "تم تثبيت المهام في قائمة التنفيذ."}</p>
            </div>
            {editable && <Button type="button" size="sm" variant="outline" className="rounded-lg" onClick={onAddStep}><Plus className="size-4" />إضافة مهمة</Button>}
          </div>

          <div className="space-y-3">
            {plan.steps.map((step, index) => (
              <article key={`${step.day}-${index}`} className="rounded-xl border border-border/70 bg-muted/15 p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-lg bg-secondary px-2 py-1 font-semibold text-primary">{step.day || `اليوم ${index + 1}`}</span>
                  <span className="text-muted-foreground">{step.category}</span>
                  {step.priority && <span className="mr-auto rounded-lg border border-border bg-background px-2 py-1">{priorityLabel(step.priority)}</span>}
                </div>

                {editable ? (
                  <>
                    <label className="mt-3 block text-[11px] font-semibold text-muted-foreground">عنوان المهمة</label>
                    <input
                      value={step.title}
                      onChange={event => onChange({ ...plan, steps: plan.steps.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item) })}
                      className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-semibold outline-none focus:border-primary/50"
                    />
                    <label className="mt-3 block text-[11px] font-semibold text-muted-foreground">تفاصيل التنفيذ</label>
                    <Textarea
                      value={step.detail}
                      onChange={event => onChange({ ...plan, steps: plan.steps.map((item, itemIndex) => itemIndex === index ? { ...item, detail: event.target.value } : item) })}
                      className="mt-1 min-h-20 rounded-lg bg-background text-sm leading-6"
                    />
                    <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-muted-foreground">المدة بالدقائق</label>
                        <input
                          type="number"
                          min={5}
                          max={480}
                          step={5}
                          value={step.minutes}
                          onChange={event => {
                            const minutes = Number(event.target.value);
                            onChange({ ...plan, steps: plan.steps.map((item, itemIndex) => itemIndex === index ? { ...item, minutes: Number.isFinite(minutes) ? Math.max(5, Math.min(480, minutes)) : 5 } : item) });
                          }}
                          className="mt-1 h-10 w-28 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary/50"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <Button type="button" variant="ghost" size="icon" className="size-8" disabled={index === 0} onClick={() => onMoveStep(index, -1)} aria-label="نقل المهمة لأعلى"><ArrowUp className="size-4" /></Button>
                        <Button type="button" variant="ghost" size="icon" className="size-8" disabled={index === plan.steps.length - 1} onClick={() => onMoveStep(index, 1)} aria-label="نقل المهمة لأسفل"><ArrowDown className="size-4" /></Button>
                        <Button type="button" variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" disabled={plan.steps.length <= 1} onClick={() => onRemoveStep(index)} aria-label="حذف المهمة"><X className="size-4" /></Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <h4 className="mt-3 font-semibold">{step.title}</h4>
                    <p className="mt-1 text-sm leading-7 text-muted-foreground">{step.detail}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{step.minutes} دقيقة</p>
                  </>
                )}

                {step.priorityReason && <p className="mt-2 border-t border-border/60 pt-2 text-xs leading-6 text-muted-foreground">سبب الأولوية: {step.priorityReason}</p>}
                {step.resourceRecommendation && (
                  <a href={step.resourceRecommendation.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex max-w-full flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10">
                    <ArrowUpRight className="size-3.5" />
                    مشاهدة مقترحة من {step.resourceRecommendation.teacherName || "المدرس"}: {step.resourceRecommendation.title}
                    <span className="font-normal text-muted-foreground">— {step.resourceRecommendation.reason}</span>
                  </a>
                )}
                <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                  {step.examComponentLabel && <span className="rounded-md border border-border bg-background px-2 py-1">{step.examComponentLabel} · {step.examComponentMarks}/{step.examPaperMarks}</span>}
                  {step.priorityScore !== undefined && <span className="rounded-md border border-border bg-background px-2 py-1">أولوية {step.priorityScore}/100</span>}
                  {step.difficulty && <span className="rounded-md border border-border bg-background px-2 py-1">الصعوبة: {difficultyLabel(step.difficulty)}</span>}
                  {step.printedPageRange && <span className="rounded-md border border-border bg-background px-2 py-1">صفحات {step.printedPageRange[0]}–{step.printedPageRange[1]}</span>}
                </div>
              </article>
            ))}
          </div>
          {editable && (
            <Button type="button" variant="outline" className="mt-4 w-full rounded-xl" onClick={onApprove} disabled={approving || plan.steps.length === 0 || !plan.title.trim()}>
              {approving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              اعتماد الخطة وإنشاء المهام
            </Button>
          )}
        </main>

        <aside className="space-y-3">
          <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
            <h3 className="flex items-center gap-2 font-bold"><BrainCircuit className="size-4 text-primary" />ملخص الخطة</h3>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">{plan.summary}</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
            <h3 className="font-bold">عادات داعمة</h3>
            {plan.habits.length ? (
              <div className="mt-3 space-y-2">
                {plan.habits.map((habit, index) => <div key={`${habit.title}-${index}`} className="rounded-lg bg-background p-3"><p className="text-sm font-semibold">{habit.title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{habit.cue}</p></div>)}
              </div>
            ) : <p className="mt-2 text-xs leading-6 text-muted-foreground">لا توجد عادات إضافية لازمة لهذه الخطة.</p>}
          </div>
          {editable && (
            <p className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs leading-6 text-muted-foreground">
              التعديلات هنا لا تؤثر على ملف المنهج أو تقدمك. لن تُنشأ مهام أو مواعيد فعلية إلا بعد الضغط على «اعتماد الخطة».
            </p>
          )}
        </aside>
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
