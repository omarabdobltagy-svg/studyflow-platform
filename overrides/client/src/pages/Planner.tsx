import DashboardLayout from "@/components/DashboardLayout";
import PlanExportActions from "@/components/PlanExportActions";
import QueryErrorNotice from "@/components/QueryErrorNotice";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { buildLearningBacklogSummary } from "@/lib/learningBacklog";
import { getSIECheckpointBranches, getSIESubject } from "@shared/sie-catalog";
import { ArrowUpRight, BrainCircuit, CheckCircle2, Clock3, Lightbulb, ListTree, Loader2, Sparkles, Target, UserRound } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";

type PlanView = { title: string; summary: string; durationLabel: string; steps: { day: string; title: string; detail: string; minutes: number; category: string; priority?: "critical" | "high" | "medium" | "low"; difficulty?: "easy" | "medium" | "hard" | "unknown"; lessonSize?: "small" | "medium" | "large" | "unknown"; difficultyBasis?: "student_report" | "assessment_history" | "curriculum_profile" | "unknown"; difficultyConfidence?: "low" | "medium" | "high"; printedPageRange?: [number, number]; sourcePages?: number[] }[]; habits: { title: string; cue: string }[]; reviewQuestion: string; taskSync?: { parentGoalId: number; stageCount: number; taskCount: number; routineId?: number | null } };
const todayCairo = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
const starters = [
  { label: "ترتيب التراكم", prompt: "حلّل التراكم الحالي ورتّب أولويات إنهائه على مراحل واقعية." },
  { label: "الاستعداد لاختبار", prompt: "ابنِ خطة استعداد للاختبار القادم ووازن بين الفهم والحل والمراجعة." },
  { label: "العودة للمذاكرة", prompt: "ابنِ خطة عودة تدريجية تبدأ بأهم خطوة وتراعي ضغط التراكم." },
];
function formatStudyDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder} دقيقة`;
  const hoursLabel = hours === 1 ? "ساعة" : hours === 2 ? "ساعتان" : `${hours} ساعات`;
  return remainder ? `${hoursLabel} و${remainder} دقيقة` : hoursLabel;
}

export default function Planner() {
  const utils = trpc.useUtils();
  const [prompt, setPrompt] = useState("");
  const [contextText, setContextText] = useState("");
  const [plan, setPlan] = useState<PlanView | null>(null);
  const [startDate] = useState(todayCairo);
  const [dailyMinutes, setDailyMinutes] = useState(120);
  const history = trpc.plans.list.useQuery();
  const profile = trpc.studentProfile.get.useQuery();
  const learning = trpc.learning.get.useQuery();
  const backlogBySubject = useMemo(
    () => buildLearningBacklogSummary(
      profile.data?.subjectIds ?? [],
      (learning.data as any)?.gapByBranch ?? {},
      profile.data?.backlog ?? {},
    ),
    [profile.data, learning.data],
  );
  const generate = trpc.plans.generate.useMutation({
    onSuccess: result => {
      setPlan(result);
      void utils.plans.list.invalidate();
      void utils.goals.list.invalidate();
      void utils.tasks.list.invalidate();
      void utils.calendar.list.invalidate();
      void utils.dashboard.summary.invalidate();
      toast.success(`تم إنشاء الخطة وإضافة ${result.taskSync?.taskCount ?? result.steps.length} مهام إلى قائمة مهامك تلقائيًا.`);
    },
    onError: error => toast.error(error.message),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const intent = prompt.trim() || "حلّل ملفي الدراسي كاملًا وحدد أهم ما أحتاج إلى إنجازه الآن. ابنِ خطة واقعية حسب المنهج والتراكم والصعوبة والوقت المتاح.";
    const extraContext = contextText.trim();
    const request = extraContext
      ? intent + "\n\nالسياق الإضافي والظروف الحالية:\n" + extraContext
      : intent;
    generate.mutate({ prompt: request, includeStudentProfile: true, dailyMinutes, startDate });
  };
  const savedPlans = useMemo(() => (history.data || []).flatMap(record => { try { const saved = JSON.parse(record.planJson) as PlanView; return [{ id: record.id, createdAt: record.createdAt, plan: { ...saved, habits: Array.isArray(saved.habits) ? saved.habits : [], steps: Array.isArray(saved.steps) ? saved.steps.map(step => ({ priority: "medium" as const, difficulty: "unknown" as const, lessonSize: "unknown" as const, difficultyBasis: "unknown" as const, difficultyConfidence: "low" as const, sourcePages: [], ...step })) : [] } }]; } catch { return []; } }), [history.data]);
  return <DashboardLayout title="المخطط الذكي" description="اكتب ما تريد إنجازه، وسنحوّله إلى مسار واقعي يراعي ملفك الدراسي ووقتك وطاقة يومك." action={<div className="hidden items-center gap-2 rounded-2xl bg-secondary px-3 py-2 text-xs font-semibold text-primary sm:flex"><BrainCircuit className="size-4" />تخطيط متكيف</div>}>
    {history.isError && <QueryErrorNotice onRetry={() => void history.refetch()} label="تعذّر تحميل خططك المحفوظة." />}
    {profile.isError && <QueryErrorNotice onRetry={() => void profile.refetch()} label="تعذّر تحميل ملفك الدراسي؛ لا يمكن إنشاء خطة مخصصة قبل عودة بيانات الملف." />}
    {learning.isError && <QueryErrorNotice onRetry={() => void learning.refetch()} label="تعذّر تحميل مواضع الفروع؛ أعد المحاولة حتى يستطيع المخطط قراءة التراكم المحسوب." />}
    <section className="sf-feature-hero relative mb-6 overflow-hidden rounded-[1.55rem] p-6 text-primary-foreground shadow-2xl sm:p-8"><div className="onboarding-orb onboarding-orb-one" /><div className="onboarding-orb onboarding-orb-two" /><div className="relative grid gap-6 lg:grid-cols-[1.1fr_.9fr]"><div><p className="eyebrow text-primary-foreground/65">من الوصف إلى مسار عملي</p><h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">خطة مبنية على المنهج، لا على تخمين عدد المهام.</h2><p className="mt-3 max-w-xl text-sm leading-7 text-primary-foreground/75">يربط المخطط الدروس بتقدمك وموضع المدرس وتقييمك للصعوبة، ويستخدم نصوص الكتب المتاحة فعليًا. ثم يقسم الدروس الكبيرة إلى جلسات فهم وتطبيق واسترجاع، ويرتبها حسب الأولوية والوقت.</p><div className="mt-5 flex flex-wrap gap-2">{["فجوة كل وحدة مستقلة", "أولوية وصعوبة وحجم الدرس", "تحويل تلقائي إلى مهام"].map(item => <span key={item} className="rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-xs text-primary-foreground/75">{item}</span>)}</div></div><div className="rounded-2xl border border-white/12 bg-white/8 p-4 backdrop-blur-sm"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-white/12"><Sparkles className="size-5 text-violet-200" /></span><div><p className="font-semibold">مبدأ التخطيط</p><p className="mt-1 text-xs leading-5 text-primary-foreground/65">جلسة تبدأ بها اليوم أفضل من خطة لا تفتحها.</p></div></div>{profile.data && <div className="mt-4 flex items-center gap-2 rounded-xl bg-black/10 p-3 text-xs text-primary-foreground/75"><UserRound className="size-4" />{profile.data.studentName} · {profile.data.track}</div>}<a href="/study" className="mt-3 flex items-center justify-between rounded-xl border border-white/15 bg-white/8 px-3 py-3 text-sm font-semibold text-primary-foreground hover:bg-white/12"><span>تحديث موضع المدرس وتقدمك</span><ArrowUpRight className="size-4" /></a></div></div></section>
    {profile.data && <section className="app-card mb-6 p-5 sm:p-6">
       <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow">ملف الدراسة والتراكم</p><h2 className="mt-1 font-bold">الفجوات المحسوبة من مواضعك</h2><p className="mt-1 text-xs leading-6 text-muted-foreground">المخطط يقرأ موضعك وموضع المدرس أو المجموعة داخل كل فرع، ولا يحوّل الفروع غير المكتملة إلى صفر.</p></div><div className="flex items-center gap-2"><span className="rounded-xl bg-secondary px-3 py-2 text-xs font-semibold text-primary">{profile.data.subjectIds.length} مواد</span><a href="/study" className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:border-primary/40 hover:text-primary">تحديث المواضع <ArrowUpRight className="size-3.5" /></a></div></div>
       <div className="grid gap-3 md:grid-cols-2">
         {profile.data.subjectIds.map((subjectId: string) => {
           const branches = getSIECheckpointBranches(subjectId).map(branch => subjectId === "PROG_AI_G2_BAC"
             ? { ...branch, choices: branch.choices.filter((choice: any) => /^PROG_[1-4]_/.test(choice.nodeId)) }
             : branch).filter(branch => branch.choices.length > 0);
           const backlog = backlogBySubject.find(item => item.subjectId === subjectId);
           const knownLessons = branches.reduce((total, branch) => total + branch.choices.length, 0);
           return <article key={subjectId} className="sf-planner-subject-card rounded-2xl border border-border/70 bg-muted/20 p-4">
             <div className="flex items-start justify-between gap-3">
               <div><h3 className="font-bold">{getSIESubject(subjectId)?.nameAr || subjectId}</h3><p className="mt-1 text-xs text-muted-foreground">{backlog?.coverageLabel || "لم تُحسب فجوة هذا الفرع بعد"}</p></div>
               <span className="rounded-lg bg-background px-2.5 py-1 text-xs font-semibold text-primary">{backlog?.countLabel || "غير محسوب"}</span>
             </div>
             <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/60 pt-3 text-xs text-muted-foreground">
               <span>نطاق المنهج المفهرس</span><b className="text-foreground">{knownLessons} درسًا / موضوعًا</b>
             </div>
           </article>;
         })}
       </div>
     </section>}
    <section className="app-card mb-6 overflow-hidden"><form onSubmit={submit} className="p-5 sm:p-6"><label className="mb-2 flex items-center gap-2 font-bold"><Target className="size-4 text-primary" />ما الذي تريد أن تحققه؟ <span className="text-xs font-normal text-muted-foreground">اختياري</span></label><Textarea value={prompt} onChange={event => setPrompt(event.target.value)} placeholder="اكتب هدفك بطريقتك العادية. مش مطلوب صياغة برومبت مثالي؛ المخطط هيحلل ملفك ويستنتج المطلوب." className="min-h-28 rounded-2xl bg-muted/25 p-4 leading-8" />
    <label htmlFor="planner-context" className="mb-2 mt-4 block text-sm font-semibold">السياق والظروف الحالية <span className="font-normal text-muted-foreground">اختياري</span></label>
    <Textarea id="planner-context" value={contextText} onChange={event => setContextText(event.target.value)} placeholder="مثال: عندي يومين مشغولين، عندي اختبار قريب، أو فيه ظروف أثرت على مذاكرتي. المخطط هيجمع ده مع ملفك الدراسي تلقائيًا." className="min-h-24 rounded-2xl bg-muted/25 p-4 leading-8" />
    <div className="mt-4 flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">{starters.map(starter => <button type="button" key={starter.label} onClick={() => setPrompt(starter.prompt)} className="pressable rounded-xl border border-border/70 bg-muted/45 px-3 py-2 text-right text-xs text-muted-foreground transition hover:border-primary/30 hover:bg-secondary hover:text-primary">{starter.label}</button>)}</div>
      <div className="grid gap-3 border-t border-border/60 pt-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div>
          <label htmlFor="plan-daily-minutes" className="mb-1.5 block text-xs font-semibold text-muted-foreground">الوقت المتاح يوميًا</label>
          <select id="plan-daily-minutes" value={dailyMinutes} onChange={event => setDailyMinutes(Number(event.target.value))} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {Array.from({ length: 31 }, (_, index) => (index + 2) * 15).map(minutes => <option key={minutes} value={minutes}>{formatStudyDuration(minutes)}</option>)}
          </select>
          <p className="mt-1.5 text-[11px] text-muted-foreground">اختيارات ثابتة كل 15 دقيقة؛ البداية من نصف ساعة حتى 8 ساعات.</p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <p className="text-xs text-muted-foreground">سيستخدم المخطط ملف الدراسة والتراكم تلقائيًا، ويبدأ من اليوم.</p>
          <Button disabled={generate.isPending || profile.isLoading || !profile.data} className="pressable min-w-44 rounded-xl bg-primary">{generate.isPending ? <><Loader2 className="size-4 animate-spin" />يبني خطة مناسبة...</> : <><Sparkles className="size-4" />ولّد خطتي</>}</Button></div></div></div></form></section>
    {generate.isPending && <PlanLoading />}
    {plan ? <PlanCard plan={plan} title="خطتك المقترحة" studentName={profile.data?.studentName} /> : <section className="grid gap-4 md:grid-cols-3"><Feature icon={<ListTree className="size-5" />} title="مراحل قابلة للمتابعة" copy="تحويل الخطة تلقائيًا إلى هدف ومراحل ومهام داخل قائمة مهامك." /><Feature icon={<Clock3 className="size-5" />} title="وقت يناسب طاقتك" copy="جلسات قصيرة وخيارات حد أدنى عندما يكون اليوم ثقيلًا." /><Feature icon={<Lightbulb className="size-5" />} title="عودة بلا جلد ذات" copy="خطة تعيدك تدريجيًا من التراكم بدل أن تضاعف الضغط." /></section>}
    {savedPlans.length > 0 && <section className="no-print mt-8"><div className="mb-4 flex items-center justify-between"><div><p className="eyebrow">محفوظاتك</p><h2 className="mt-1 font-bold">خطط سابقة</h2></div><span className="text-xs text-muted-foreground">{savedPlans.length} خطط محفوظة</span></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{savedPlans.map(item => <button key={item.id} onClick={() => setPlan(item.plan)} className="app-card pressable p-4 text-right hover:border-primary/25"><div className="flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary"><BrainCircuit className="size-4" /></span><div className="min-w-0 flex-1"><p className="truncate font-semibold">{item.plan.title}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.plan.summary}</p><p className="mt-2 text-[11px] text-muted-foreground">{new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short" }).format(new Date(item.createdAt))}</p></div></div></button>)}</div></section>}
  </DashboardLayout>;
}

function PlanLoading() { return <section className="enter app-card mb-6 p-5" role="status" aria-live="polite"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary"><Sparkles className="size-5 animate-pulse" /></span><div><p className="font-bold">نرتب الخطة على مقاسك...</p><p className="mt-1 text-xs text-muted-foreground">نوازن المواد والتراكم ووقت البداية.</p></div></div><div className="mt-5 space-y-3"><div className="loading-shimmer h-14 rounded-2xl" /><div className="loading-shimmer h-14 rounded-2xl" /><div className="loading-shimmer h-14 rounded-2xl" /></div></section>; }
function Feature({ icon, title, copy }: { icon: React.ReactNode; title: string; copy: string }) { return <article className="app-card p-5 transition-transform duration-200 hover:-translate-y-1"><span className="flex size-10 items-center justify-center rounded-2xl bg-secondary text-primary">{icon}</span><h2 className="mt-4 font-bold">{title}</h2><p className="mt-1.5 text-sm leading-6 text-muted-foreground">{copy}</p></article>; }
function PlanCard({ plan, title, studentName }: { plan: PlanView; title: string; studentName?: string }) {
  const totalMinutes = plan.steps.reduce((sum, step) => sum + step.minutes, 0);
  const priorityLabel = (value?: string) => value === "critical" ? "عاجل" : value === "high" ? "أولوية عالية" : value === "low" ? "منخفضة" : "متوسطة";
  const difficultyLabel = (value?: string) => value === "hard" ? "صعب" : value === "easy" ? "سهل" : value === "medium" ? "متوسط" : "غير محدد";
  const sizeLabel = (value?: string) => value === "large" ? "درس كبير" : value === "small" ? "درس صغير" : value === "medium" ? "حجم متوسط" : "الحجم غير معروف";
  return <section className="enter app-card overflow-hidden">
    <div className="border-b border-border/65 bg-gradient-to-l from-secondary/65 to-card p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0"><p className="eyebrow">{title}</p><h2 className="mt-1 text-xl font-bold">{plan.title}</h2><p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">{plan.summary}</p>{studentName && <p className="mt-3 text-xs text-primary">خطة مخصصة لـ {studentName}</p>}</div>
        <div className="flex flex-wrap items-center gap-2"><span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-card px-3 py-2 text-xs font-semibold text-primary shadow-sm"><Clock3 className="size-3.5" />{plan.durationLabel}</span><PlanExportActions plan={plan} studentName={studentName} /></div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-border/70 bg-card/70 p-3"><span className="text-[11px] text-muted-foreground">عدد المهام</span><b className="mt-1 block text-lg">{plan.steps.length}</b></div>
        <div className="rounded-xl border border-border/70 bg-card/70 p-3"><span className="text-[11px] text-muted-foreground">إجمالي الوقت</span><b className="mt-1 block text-lg">{totalMinutes} د</b></div>
        <div className="rounded-xl border border-border/70 bg-card/70 p-3"><span className="text-[11px] text-muted-foreground">دروس صعبة</span><b className="mt-1 block text-lg">{plan.steps.filter(step => step.difficulty === "hard").length}</b></div>
        <div className="rounded-xl border border-border/70 bg-card/70 p-3"><span className="text-[11px] text-muted-foreground">مهام عالية الأولوية</span><b className="mt-1 block text-lg">{plan.steps.filter(step => step.priority === "critical" || step.priority === "high").length}</b></div>
      </div>
      {plan.taskSync && <div className="no-print mt-5 flex flex-col gap-2 rounded-xl border border-border/70 bg-muted/35 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><CheckCircle2 className="size-4 text-primary" />تم إنشاء المهام تلقائيًا داخل قائمة مهامك</div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground"><span>{plan.taskSync.taskCount} مهام مجدولة</span><a href="/tasks" className="font-semibold text-primary hover:underline">فتح المهام</a></div>
      </div>}
    </div>
    <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,.65fr)] sm:p-6">
      <div><div className="mb-4 flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 font-bold"><ListTree className="size-4 text-primary" />خطة التنفيذ المرتبة</h3><span className="text-xs text-muted-foreground">{plan.steps.length} خطوة</span></div>
        <div className="space-y-3">{plan.steps.map((step, index) => <article key={`${step.day}-${index}`} className="rounded-2xl border border-border/70 bg-muted/15 p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs"><span className="font-semibold text-primary">{step.day}</span><span className="text-muted-foreground">· {step.category}</span><span className="mr-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Clock3 className="size-3" />{step.minutes} دقيقة</span></div>
          <h4 className="mt-2 font-semibold">{step.title}</h4><p className="mt-1 text-sm leading-7 text-muted-foreground">{step.detail}</p>
          <div className="mt-3 flex flex-wrap gap-1.5"><span className="rounded-lg border border-border bg-background px-2 py-1 text-[10px] font-semibold">{priorityLabel(step.priority)}</span><span className="rounded-lg border border-border bg-background px-2 py-1 text-[10px]">{difficultyLabel(step.difficulty)}</span><span className="rounded-lg border border-border bg-background px-2 py-1 text-[10px]">{sizeLabel(step.lessonSize)}</span><span className="rounded-lg border border-border bg-background px-2 py-1 text-[10px]">{step.difficultyBasis === "student_report" ? "حسب تقييمك" : step.difficultyBasis === "assessment_history" ? "حسب نتائجك" : step.difficultyBasis === "curriculum_profile" ? "تقدير منهجي أولي" : "مصدر الصعوبة غير محدد"} · ثقة {step.difficultyConfidence === "high" ? "مرتفعة" : step.difficultyConfidence === "medium" ? "متوسطة" : "منخفضة"}</span>{step.printedPageRange ? <span className="rounded-lg border border-border bg-background px-2 py-1 text-[10px]">صفحات الكتاب المطبوعة: {step.printedPageRange[0]}–{step.printedPageRange[1]}</span> : null}{step.sourcePages?.length ? <span className="rounded-lg border border-border bg-background px-2 py-1 text-[10px]">مراجع PDF: {step.sourcePages.join("، ")}</span> : null}</div>
        </article>)}</div>
      </div>
      <aside className="space-y-4">
        <div className="rounded-2xl border border-border/70 bg-muted/25 p-4"><div className="flex items-center gap-2 font-bold"><Lightbulb className="size-4 text-primary" />عادات داعمة</div>{plan.habits.length ? <div className="mt-3 space-y-3">{plan.habits.map((habit,index)=><div key={`${habit.title}-${index}`} className="rounded-xl bg-background p-3"><p className="text-sm font-semibold">{habit.title}</p><p className="mt-1 text-xs leading-6 text-muted-foreground">التوقيت المقترح: {habit.cue}</p></div>)}</div> : <p className="mt-2 text-xs leading-6 text-muted-foreground">لا توجد عادات إضافية لازمة لهذه الخطة.</p>}</div>
        <div className="rounded-2xl border border-border/70 bg-muted/25 p-4"><div className="flex items-center gap-2 font-bold"><CheckCircle2 className="size-4 text-emerald-600" />اختبار الاسترجاع</div><p className="mt-2 text-sm leading-7 text-muted-foreground">{plan.reviewQuestion}</p></div>
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4"><p className="text-sm font-bold">كيف قُدرت صعوبة الدروس؟</p><p className="mt-1 text-xs leading-6 text-muted-foreground">التقدير يعتمد على النص المفهرس ونتائجك السابقة وتقييمك الشخصي. إذا لم يتوفر نص كافٍ ستظهر الصعوبة «غير محدد» بدل التخمين.</p><a href="/study" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">تحديث تقييم الدروس وموضع المدرس <ArrowUpRight className="size-3.5" /></a></div>
      </aside>
    </div>
  </section>;
}
