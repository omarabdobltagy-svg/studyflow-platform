import DashboardLayout from "@/components/DashboardLayout";
import ThreeAmbientScene from "@/components/ThreeAmbientScene";
import PlannerOperationsScene from "@/components/PlannerOperationsScene";
import { motion } from "framer-motion";
import PlanExportActions from "@/components/PlanExportActions";
import QueryErrorNotice from "@/components/QueryErrorNotice";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { getSIECheckpointChoices, getSIESubject, getSIETeacher } from "@shared/sie-catalog";
import { BrainCircuit, CheckCircle2, Clock3, Lightbulb, ListTree, Loader2, Sparkles, Target, UserRound } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";

type PlanView = { title: string; summary: string; strategy?: string; durationLabel: string; coverage?: { requiredLessons: number; coveredLessons: number; appendedLessons: number; unverifiedBacklog: { subject: string; count: number }[] }; steps: { day: string; title: string; detail: string; minutes: number; category: string; subtasks?: string[] }[]; habits: { title: string; cue: string }[]; reviewQuestion: string };
const todayCairo = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
const starters = ["أريد إنهاء فصلين من مادة صعبة خلال هذا الأسبوع، لدي ساعة واحدة مساءً.", "لدي تراكم محاضرات وأشعر بقلة الطاقة، اصنع لي خطة عودة تدريجية.", "لدي اختبار بعد 14 يومًا وأريد خطة مراجعة واقعية دون ضغط مفرط."];

export default function Planner() {
  const utils = trpc.useUtils();
  const [prompt, setPrompt] = useState("");
  const [plan, setPlan] = useState<PlanView | null>(null);
  const [approvedPlanKey, setApprovedPlanKey] = useState<string | null>(null);
  const [approvalResult, setApprovalResult] = useState<{ parentGoalId: number; stageCount: number; taskCount: number } | null>(null);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [useProfile, setUseProfile] = useState(true);
  const [startDate, setStartDate] = useState(todayCairo);
  const [dailyMinutes, setDailyMinutes] = useState(120);
  const history = trpc.plans.list.useQuery();
  const profile = trpc.studentProfile.get.useQuery();
  const generate = trpc.plans.generate.useMutation({ onSuccess: result => { setPlan(result); void utils.plans.list.invalidate(); toast.success("خطتك الشخصية جاهزة للمراجعة."); }, onError: error => toast.error(error.message) });
  const approve = trpc.plans.approve.useMutation({ onSuccess: (result, variables) => { setApprovedPlanKey(`${variables.plan.title}|${variables.plan.summary}`); setApprovalResult(result); setApprovalOpen(false); void utils.goals.list.invalidate(); void utils.tasks.list.invalidate(); toast.success("تم اعتماد الخطة وتوزيع المهام على التقويم حسب وقتك اليومي."); }, onError: error => toast.error(error.message) });
  const submit = (event: FormEvent) => { event.preventDefault(); const request = prompt.trim() || "حلّل ملفي الدراسي ومواضعي مع المدرسين والتراكم المسجل، ثم ابنِ خطة واقعية حسب الوقت المتاح وأولوية الدروس وصعوبتها. لا تطلب مني إعادة كتابة بيانات موجودة في ملفي."; generate.mutate({ prompt: request, includeStudentProfile: useProfile, dailyMinutes, startDate }); };
  const planKey = plan ? `${plan.title}|${plan.summary}` : "";
  const savedPlans = useMemo(() => (history.data || []).flatMap(record => { try { return [{ id: record.id, createdAt: record.createdAt, plan: JSON.parse(record.planJson) as PlanView }]; } catch { return []; } }), [history.data]);
  const openApproval = () => { if (!plan || approvedPlanKey === planKey) return; setApprovalOpen(true); };
  return <DashboardLayout title="المخطط الذكي" description="اكتب ما تريد إنجازه، وسنحوّله إلى مسار واقعي يراعي ملفك الدراسي ووقتك وطاقة يومك." action={<div className="hidden items-center gap-2 rounded-2xl bg-secondary px-3 py-2 text-xs font-semibold text-primary sm:flex"><BrainCircuit className="size-4" />تخطيط متكيف</div>}>
    {history.isError && <QueryErrorNotice onRetry={() => void history.refetch()} label="تعذّر تحميل خططك المحفوظة." />}
    {profile.isError && <QueryErrorNotice onRetry={() => void profile.refetch()} label="تعذّر تحميل ملفك الدراسي؛ يمكنك إنشاء خطة عامة، لكن لن تُخصّص حتى يعود الملف." />}
    <motion.section className="sf-feature-hero sf-planner-hero relative mb-6 overflow-hidden rounded-[1.55rem] p-6 text-primary-foreground shadow-2xl sm:p-8"
      initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: "easeOut" }}>
      <div className="sf-planner-hero-grid">
        <div className="sf-planner-hero-copy">
          <p className="eyebrow text-primary-foreground/65">STUDYFLOW / INTELLIGENT PLANNING</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">كل درس معروف. وكل خطوة لها موعد وسبب.</h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-primary-foreground/75">لا نختزل التراكم في مهمتين عامتين. نقرأ الفجوات المؤكدة داخل كل فرع، ثم نحول كل درس مطلوب إلى مسار مذاكرة قابل للتنفيذ.</p>
          <div className="sf-planner-proof-row mt-5"><span>تغطية الدروس المطلوبة</span><span>ترتيب حسب الأولوية</span><span>توزيع حسب وقتك</span></div>
          {profile.data && <p className="mt-5 text-xs text-primary-foreground/70">مساحة {profile.data.studentName} · {profile.data.track}</p>}
        </div>
        <div className="sf-planner-scene" aria-hidden="true">
          <div className="sf-planner-scene-glow" />
          <ThreeAmbientScene />
          <span className="sf-planner-orbit-label sf-planner-orbit-label-one">LEARN</span>
          <span className="sf-planner-orbit-label sf-planner-orbit-label-two">PLAN</span>
        </div>
      </div>
      <div className="sf-planner-hero-footer"><span><span className="sf-planner-live-dot" />محرك التخطيط نشط</span><span>الموافقة تسبق إنشاء المهام</span></div>
    </motion.section>
    <PlannerOperationsScene />
    {profile.data && <section className="app-card mb-6 p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow">قراءة الملف تلقائيًا</p><h2 className="mt-1 font-bold">المواد والمدرسون ونقطة التقدم</h2><p className="mt-1 text-xs text-muted-foreground">يستخدم المخطط ما هو مسجل بالفعل بدل مطالبتك بإدخاله مرة أخرى.</p></div><span className="rounded-xl bg-secondary px-3 py-2 text-xs font-semibold text-primary">{profile.data.subjects.length} مواد</span></div>
      <div className="grid gap-3 md:grid-cols-2">
        {profile.data.subjects.map((subjectId: string) => {
          const selection = (profile.data?.selection || {}) as Record<string, any>;
          const teacherId = selection.teacherChoices?.[subjectId] || profile.data?.teacherSelections?.[subjectId];
          const teacher = teacherId ? getSIETeacher(teacherId) : undefined;
          const studentFrontier = selection.teacherFrontiers?.[subjectId] || selection.teacherProgressState?.[subjectId]?.studentAttendedFrontier;
          const lesson = getSIECheckpointChoices(subjectId).find(item => item.nodeId === studentFrontier);
          const backlog = profile.data?.backlog?.[subjectId] || profile.data?.backlog?.[getSIESubject(subjectId)?.nameAr || ""] || 0;
          const knownLessons = getSIECheckpointChoices(subjectId).length;
          return <article key={subjectId} className="rounded-2xl border border-border/70 bg-muted/20 p-4">
            <div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">{getSIESubject(subjectId)?.nameAr || subjectId}</h3><p className="mt-1 text-xs text-muted-foreground">{teacher?.nameAr || "لم يحدد مدرس لهذه المادة"}</p></div><span className="rounded-lg bg-background px-2.5 py-1 text-xs font-semibold text-primary">{backlog} تراكم</span></div>
            <div className="mt-3 grid gap-2 text-xs leading-5 text-muted-foreground">
              <p>موضعك المسجل: <b className="text-foreground">{lesson?.title || (studentFrontier ? "نقطة مسجلة غير موجودة في الفهرس الحالي" : "لم تحدد بعد")}</b></p>
              <p>آخر محتوى عام للمدرس: <b className="text-foreground">{teacher?.latestPublicCheckpoint || "غير متاح"}</b></p>
              <p>دروس المنهج المتاحة: <b className="text-foreground">{knownLessons || "الفهرس غير محمّل"}</b></p>
            </div>
          </article>;
        })}
      </div>
    </section>}
    <section className="app-card mb-6 overflow-hidden"><form onSubmit={submit} className="p-5 sm:p-6"><label className="mb-2 flex items-center gap-2 font-bold"><Target className="size-4 text-primary" />قيود إضافية للمخطط (اختياري)</label><Textarea value={prompt} onChange={event => setPrompt(event.target.value)} placeholder="اكتب اختبارًا قريبًا أو ظرفًا جديدًا غير موجود في ملفك. يمكنك تركه فارغًا ليستخدم المخطط بياناتك تلقائيًا." className="min-h-36 rounded-2xl bg-muted/25 p-4 leading-8" /><div className="mt-3 flex flex-col gap-4"><div className="flex flex-wrap gap-2">{starters.map((starter, index) => <button type="button" key={starter} onClick={() => setPrompt(starter)} className="pressable rounded-lg bg-muted px-2.5 py-1.5 text-right text-[11px] text-muted-foreground hover:bg-secondary hover:text-primary">فكرة {index + 1}</button>)}</div><div className="grid gap-3 border-t border-border/60 pt-4 sm:grid-cols-2"><div><label htmlFor="plan-start-date" className="mb-1.5 block text-xs font-semibold text-muted-foreground">تاريخ بدء تنفيذ الخطة</label><Input id="plan-start-date" type="date" min={todayCairo} value={startDate} onChange={event => setStartDate(event.target.value)} className="h-10 rounded-xl bg-background" /></div><div><label htmlFor="plan-daily-minutes" className="mb-1.5 block text-xs font-semibold text-muted-foreground">الوقت المتاح يوميًا بالدقائق</label><Input id="plan-daily-minutes" type="number" min={20} max={600} step={5} value={dailyMinutes} onChange={event => setDailyMinutes(Math.min(600, Math.max(20, Number(event.target.value) || 20)))} className="h-10 rounded-xl bg-background" /></div></div><div className="flex flex-col gap-3 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between"><label className="flex items-center gap-3 text-sm text-muted-foreground"><input type="checkbox" checked={useProfile} onChange={event => setUseProfile(event.target.checked)} className="size-4 accent-[var(--primary)]" />استخدم ملفي الدراسي والتراكم لتخصيص الخطة</label><Button disabled={generate.isPending || !startDate} className="pressable min-w-44 rounded-xl bg-primary">{generate.isPending ? <><Loader2 className="size-4 animate-spin" />يبني خطة مناسبة...</> : <><Sparkles className="size-4" />ولّد خطتي</>}</Button></div></div></form></section>
    {generate.isPending && <PlanLoading />}
    {plan ? <><PlanCard plan={plan} title="خطتك المقترحة" onApprove={openApproval} isApproving={approve.isPending} isApproved={approvedPlanKey === planKey} approvalResult={approvedPlanKey === planKey ? approvalResult : null} studentName={profile.data?.studentName} /><AlertDialog open={approvalOpen} onOpenChange={setApprovalOpen}><AlertDialogContent dir="rtl"><AlertDialogHeader><AlertDialogTitle>تأكيد إنشاء هيكل الخطة</AlertDialogTitle><AlertDialogDescription>سيُنشأ هدف رئيسي باسم «{plan.title}»، وتحته {plan.steps.length} مراحل و{plan.steps.length} مهام مرتبطة. ستتوزع مواعيد المهام ابتداءً من {new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Cairo" }).format(new Date(`${startDate}T12:00:00`))} مع حد يومي قدره {dailyMinutes} دقيقة، وستظهر في التقويم. لن يحدث أي تغيير قبل اختيار «اعتماد وإنشاء».</AlertDialogDescription></AlertDialogHeader><div className="rounded-2xl bg-secondary/60 p-4 text-sm leading-7"><p className="font-bold text-primary">راجع قبل الاعتماد</p><p className="mt-1 text-muted-foreground">{plan.steps.slice(0, 3).map(step => step.title).join(" · ")}{plan.steps.length > 3 ? " · ..." : ""}</p></div><AlertDialogFooter><AlertDialogCancel>رجوع للمراجعة</AlertDialogCancel><AlertDialogAction onClick={() => approve.mutate({ plan, schedule: { startDate, dailyMinutes } })} disabled={approve.isPending} className="bg-primary">{approve.isPending ? <><Loader2 className="size-4 animate-spin" />يجري الإنشاء...</> : <><CheckCircle2 className="size-4" />اعتماد وإنشاء</>}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>{approvedPlanKey === planKey && approvalResult && <section className="no-print enter mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-100"><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 size-5 shrink-0" /><div><p className="font-bold">تم اعتماد الخطة داخل أهدافك</p><p className="mt-1 text-sm leading-6">أُنشئ هدف رئيسي واحد، وتحته {approvalResult.stageCount} مراحل و{approvalResult.taskCount} مهام موزعة حسب الوقت اليومي، مع مواعيد ظاهرة في التقويم.</p><div className="mt-3 flex flex-wrap gap-2"><a href="/goals" className="pressable inline-flex rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800 dark:bg-emerald-500 dark:text-emerald-950">فتح صفحة الأهداف</a><a href="/tasks" className="pressable inline-flex rounded-lg border border-emerald-700/20 px-3 py-2 text-xs font-bold text-emerald-800 dark:text-emerald-100">متابعة المهام اليومية</a></div></div></div></section>}</> : <section className="grid gap-4 md:grid-cols-3"><Feature icon={<ListTree className="size-5" />} title="مراحل قابلة للمتابعة" copy="تحويل الخطة إلى هدف ومراحل ومهام بعد موافقتك فقط." /><Feature icon={<Clock3 className="size-5" />} title="وقت يناسب طاقتك" copy="جلسات قصيرة وخيارات حد أدنى عندما يكون اليوم ثقيلًا." /><Feature icon={<Lightbulb className="size-5" />} title="عودة بلا جلد ذات" copy="خطة تعيدك تدريجيًا من التراكم بدل أن تضاعف الضغط." /></section>}
    {savedPlans.length > 0 && <section className="no-print mt-8"><div className="mb-4 flex items-center justify-between"><div><p className="eyebrow">محفوظاتك</p><h2 className="mt-1 font-bold">خطط سابقة</h2></div><span className="text-xs text-muted-foreground">{savedPlans.length} خطط محفوظة</span></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{savedPlans.map(item => <button key={item.id} onClick={() => setPlan(item.plan)} className="app-card pressable p-4 text-right hover:border-primary/25"><div className="flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary"><BrainCircuit className="size-4" /></span><div className="min-w-0 flex-1"><p className="truncate font-semibold">{item.plan.title}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.plan.summary}</p><p className="mt-2 text-[11px] text-muted-foreground">{new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short" }).format(new Date(item.createdAt))}</p></div></div></button>)}</div></section>}
  </DashboardLayout>;
}

function PlanLoading() { return <section className="enter app-card mb-6 p-5" role="status" aria-live="polite"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary"><Sparkles className="size-5 animate-pulse" /></span><div><p className="font-bold">نرتب الخطة على مقاسك...</p><p className="mt-1 text-xs text-muted-foreground">نوازن المواد والتراكم ووقت البداية.</p></div></div><div className="mt-5 space-y-3"><div className="loading-shimmer h-14 rounded-2xl" /><div className="loading-shimmer h-14 rounded-2xl" /><div className="loading-shimmer h-14 rounded-2xl" /></div></section>; }
function Feature({ icon, title, copy }: { icon: React.ReactNode; title: string; copy: string }) { return <article className="app-card p-5 transition-transform duration-200 hover:-translate-y-1"><span className="flex size-10 items-center justify-center rounded-2xl bg-secondary text-primary">{icon}</span><h2 className="mt-4 font-bold">{title}</h2><p className="mt-1.5 text-sm leading-6 text-muted-foreground">{copy}</p></article>; }
function PlanCard({ plan, title, onApprove, isApproving, isApproved, approvalResult, studentName }: {
  plan: PlanView; title: string; onApprove?: () => void; isApproving?: boolean; isApproved?: boolean;
  approvalResult?: { stageCount: number; taskCount: number } | null; studentName?: string;
}) {
  const coverage = plan.coverage;
  return (
    <motion.section className="sf-planner-result enter app-card overflow-hidden"
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}>
      <div className="sf-planner-result-heading">
        <div className="min-w-0"><p className="eyebrow">{title}</p><h2 className="mt-1 text-xl font-bold">{plan.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">{plan.summary}</p>
          {studentName && <p className="mt-2 text-xs text-primary">مخصصة لـ {studentName}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2"><span className="sf-planner-duration"><Clock3 className="size-3.5" />{plan.durationLabel}</span><PlanExportActions plan={plan} studentName={studentName} /></div>
      </div>
      <div className="sf-planner-analysis-grid">
        <div className="sf-planner-analysis-main">
          <div className="sf-planner-analysis-title"><div><p className="eyebrow">COVERAGE CHECK</p><h3>تغطية التراكم المؤكد</h3></div>
            <span className="sf-planner-coverage-total">{coverage?.coveredLessons ?? plan.steps.length}<small>عنصر</small></span>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {coverage?.requiredLessons ? `تم فحص ${coverage.requiredLessons} درسًا مطلوبًا داخل فروع المنهج، وإضافة ${coverage.appendedLessons} درسًا لم تتضمنه استجابة التخطيط الأولى.` : "لا توجد فجوة منهجية قابلة للقياس حاليًا؛ لا يتم افتراض تراكم من بيانات غير مكتملة."}
          </p>
          {coverage?.unverifiedBacklog?.length ? <div className="sf-planner-unverified-note"><b>تراكم يدوي يحتاج تأكيدًا</b>
            <span>{coverage.unverifiedBacklog.map(item => `${item.subject}: ${item.count}`).join(" · ")}</span>
            <small>لم نخلطه مع فجوات المنهج المؤكدة ولم نخترع أسماء دروس له.</small></div> : null}
          {plan.strategy && <div className="sf-planner-strategy"><b>لماذا هذا الترتيب؟</b><p>{plan.strategy}</p></div>}
        </div>
        <aside className="sf-planner-principles"><span className="sf-planner-principle-icon"><Lightbulb className="size-5" /></span>
          <h3>طريقة تنفيذ الدرس</h3><p>شرح أو محاضرة، ثم فهم واسترجاع، ثم حل وتصحيح. لا تعتبر المهمة منتهية بمجرد مشاهدة الفيديو.</p>
        </aside>
      </div>
      <div className="sf-planner-path">
        <div className="sf-planner-path-heading"><div><p className="eyebrow">EXECUTION MAP</p><h3>مسار التنفيذ</h3></div><span>{plan.steps.length} مهام تنفيذية</span></div>
        <div className="sf-planner-step-list">
          {plan.steps.map((step, index) => <motion.article key={`${step.day}-${index}-${step.title}`} className="sf-planner-step"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, delay: Math.min(index * 0.025, 0.45) }}>
            <span className="sf-planner-step-index">{String(index + 1).padStart(2, "0")}</span>
            <div className="min-w-0 flex-1">
              <div className="sf-planner-step-meta"><span>{step.day}</span><span>{step.category}</span><span className="sf-planner-step-time"><Clock3 className="size-3" />{step.minutes} دقيقة</span></div>
              <h4>{step.title}</h4><p>{step.detail}</p>
              {step.subtasks?.length ? <ul className="sf-planner-subtasks">{step.subtasks.map((subtask, subtaskIndex) => <li key={`${index}-${subtaskIndex}`}>{subtask}</li>)}</ul> : null}
            </div>
          </motion.article>)}
        </div>
      </div>
      <div className="sf-planner-support-grid">
        <div className="sf-planner-habits"><Lightbulb className="size-5" /><h3>عادات داعمة</h3>
          {plan.habits.map((habit, index) => <div key={`${habit.title}-${index}`}><b>{habit.title}</b><span>{habit.cue}</span></div>)}
        </div>
        <div className="sf-planner-review"><CheckCircle2 className="size-5" /><h3>سؤال المراجعة</h3><p>{plan.reviewQuestion}</p></div>
      </div>
      {onApprove && <div className="no-print sf-planner-approval">
        <div><b>جاهزة للتحويل إلى أهدافك ومهامك؟</b><p>ستُنشأ {plan.steps.length} مهمة مرتبطة بمرحلة واضحة. راجعها أولًا؛ لن يتغير شيء قبل موافقتك.</p></div>
        <Button type="button" disabled={isApproving || isApproved} onClick={onApprove} className="pressable shrink-0 rounded-xl bg-primary">
          {isApproved ? <><CheckCircle2 className="size-4" />تم اعتماد الخطة</> : isApproving ? <><Loader2 className="size-4 animate-spin" />يجري الاعتماد...</> : <><CheckCircle2 className="size-4" />مراجعة واعتماد</>}
        </Button>
      </div>}
      {isApproved && approvalResult && <p className="sf-planner-approved-message"><CheckCircle2 className="size-4" />تم إنشاء {approvalResult.stageCount} مراحل و{approvalResult.taskCount} مهام.</p>}
    </motion.section>
  );
}
