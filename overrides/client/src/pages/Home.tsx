import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import QueryErrorNotice from "@/components/QueryErrorNotice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  BookOpenText,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  Circle,
  Clock3,
  Goal,
  ListChecks,
  Plus,
  Sparkles,
} from "lucide-react";
import { useLocation } from "wouter";

const priorityStyle = { high: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200", medium: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200", low: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-200" };
const priorityLabel = { high: "عالية", medium: "متوسطة", low: "مرنة" };

function arabicDate(date = new Date()) {
  return new Intl.DateTimeFormat("ar-EG", { weekday: "long", day: "numeric", month: "long" }).format(date);
}

function shortDate(date: Date) {
  return new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short" }).format(new Date(date));
}

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const summary = trpc.dashboard.summary.useQuery({ timeZone });
  const toggleTask = trpc.tasks.toggle.useMutation({ onSuccess: () => void utils.dashboard.summary.invalidate() });
  const toggleRoutine = trpc.routines.toggleItem.useMutation({ onSuccess: () => void utils.dashboard.summary.invalidate() });
  const data = summary.data;
  const completedRate = data ? (data.taskStats.total ? Math.round((data.taskStats.completed / data.taskStats.total) * 100) : 0) : null;
  const routineRate = data ? (data.routineStats.total ? Math.round((data.routineStats.completed / data.routineStats.total) * 100) : 0) : null;

  return (
    <DashboardLayout
      title="لوحة اليوم"
      description="رتّب يومك من مهمة صغيرة إلى هدف بعيد، ثم اترك الإيقاع الهادئ يرافقك خطوة بخطوة."
      action={<Button onClick={() => setLocation("/planner")} className="pressable hidden rounded-2xl bg-primary px-4 sm:flex"><Sparkles className="size-4" />أنشئ خطة</Button>}
    >
      {summary.isError && <QueryErrorNotice onRetry={() => void summary.refetch()} label="تعذّر تحميل ملخص يومك. لن نعرض أرقامًا صفرية قد توحي بأن بياناتك فارغة." />}
      {!summary.isError && <>
      <section className="sf-welcome-hero enter relative mb-6 overflow-hidden rounded-[1.6rem] px-5 py-6 text-primary-foreground sm:px-8 sm:py-8">
        <div className="relative flex flex-col justify-between gap-7 md:flex-row md:items-end">
          <div><p className="mb-2 text-sm text-primary-foreground/65">{arabicDate()}</p><h2 className="text-2xl font-bold tracking-tight sm:text-3xl">أهلًا {user?.name?.split(" ")[0] || "بك"}، ما الذي يستحق تركيزك اليوم؟</h2><p className="mt-3 max-w-xl text-sm leading-7 text-primary-foreground/72">تقدم بسيط ومتّسق يصنع مسارًا أكبر. اختر المهمة التالية وابدأ الآن.</p></div>
          <div className="flex items-center gap-4 rounded-2xl border border-white/12 bg-white/8 px-4 py-3 backdrop-blur-sm"><div className="flex size-11 items-center justify-center rounded-xl bg-white/12"><CheckCircle2 className="size-5 text-violet-200" /></div><div><p className="text-xs text-primary-foreground/65">إنجاز المهام</p><p className="num mt-0.5 text-xl font-medium">{completedRate === null ? "—" : `${completedRate}%`}</p></div><div className="h-8 w-px bg-white/12" /><p className="text-sm font-semibold">{data ? data.taskStats.completed : "—"}<span className="mr-1 text-primary-foreground/60">من {data ? data.taskStats.total : "—"}</span></p></div>
        </div>
      </section>

      <section className="sf-kpi-grid mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="المهام المفتوحة" value={data ? data.taskStats.remaining : "—"} sublabel={data ? "خطوة بانتظارك" : "جار تحميل البيانات"} icon={<ListChecks className="size-5" />} tone="violet" />
        <StatCard label="التزام الروتين" value={routineRate === null ? "—" : `${routineRate}%`} sublabel={data ? `${data.routineStats.completed} من ${data.routineStats.total} عادة` : "جار تحميل البيانات"} icon={<Clock3 className="size-5" />} tone="amber" />
        <StatCard label="أهداف نشطة" value={data ? data.goalStats.active : "—"} sublabel="وجهتك في هذا الفصل" icon={<Goal className="size-5" />} tone="emerald" />
        <StatCard label="كتب في المسار" value={data ? data.bookStats.total : "—"} sublabel="تعلم على مهل" icon={<BookOpenText className="size-5" />} tone="sky" />
      </section>

      <section className="sf-home-grid grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,.75fr)]">
        <div className="sf-home-column space-y-6">
          <div className="app-card sf-home-panel overflow-hidden">
            <CardHeader icon={<ListChecks className="size-5" />} title="مهامك القادمة" subtitle="اختر المهمة التالية لتبقى في تدفقك." action={<Button variant="ghost" size="sm" onClick={() => setLocation("/tasks")} className="gap-1 rounded-xl text-primary hover:bg-secondary">كل المهام<ChevronLeft className="size-4" /></Button>} />
            <div className="divide-y divide-border/65 px-5 pb-2 sm:px-6">
              {summary.isLoading ? <LoadingRows count={4} /> : data?.tasks.length ? data.tasks.map(task => (
                <div key={task.id} className="flex items-center gap-3 py-4">
                  <button onClick={() => toggleTask.mutate({ id: task.id, done: true })} disabled={toggleTask.isPending} className="pressable flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-primary/35 text-primary hover:bg-primary hover:text-primary-foreground" aria-label={`إكمال ${task.title}`}><Check className="size-3.5" /></button>
                  <div className="min-w-0 flex-1"><p className="truncate font-semibold">{task.title}</p><div className="mt-1.5 flex flex-wrap gap-2 text-xs text-muted-foreground"><span>{task.category}</span>{task.dueAt && <span className="inline-flex items-center gap-1"><CalendarDays className="size-3" />{shortDate(task.dueAt)}</span>}</div></div>
                  <Badge className={cn("rounded-lg border-0 px-2 py-1 text-[11px] font-medium", priorityStyle[task.priority])}>{priorityLabel[task.priority]}</Badge>
                </div>
              )) : <EmptyBlock label="لا توجد مهام مفتوحة الآن. أضف خطوتك التالية لتبدأ." action="أضف مهمة" onClick={() => setLocation("/tasks")} />}
            </div>
          </div>

          <div className="app-card sf-home-panel overflow-hidden">
            <CardHeader icon={<BookOpenText className="size-5" />} title="رحلة التعلّم" subtitle="كتبك الحالية ونِسب التقدّم فيها." action={<Button variant="ghost" size="sm" onClick={() => setLocation("/books")} className="gap-1 rounded-xl text-primary hover:bg-secondary">المكتبة<ChevronLeft className="size-4" /></Button>} />
            <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2 sm:px-6">
              {summary.isLoading ? <LoadingBookCards /> : data?.books.length ? data.books.map(book => <button key={book.id} onClick={() => setLocation(`/books/${book.id}`)} className="pressable group rounded-2xl border border-border/65 bg-muted/28 p-4 text-right hover:border-primary/25 hover:bg-secondary/35"><div className="mb-5 flex items-start justify-between gap-3"><span className={cn("flex h-12 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm", book.coverColor === "emerald" ? "bg-emerald-600" : book.coverColor === "amber" ? "bg-amber-600" : book.coverColor === "sky" ? "bg-sky-600" : "bg-violet-600")}><BookOpenText className="size-5" /></span><span className="num rounded-lg bg-background px-2 py-1 text-xs text-muted-foreground">{book.progress}%</span></div><p className="line-clamp-1 font-bold">{book.title}</p><p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{book.subject}{book.author ? ` · ${book.author}` : ""}</p><Progress value={book.progress} className="mt-4 h-1.5 bg-border" /></button>) : <EmptyBlock label="أضف أول كتاب، ثم قسّمه إلى فصول لتتابع رحلتك." action="أضف كتابًا" onClick={() => setLocation("/books")} />}
            </div>
          </div>
        </div>

        <div className="sf-home-column space-y-6">
          <div className="app-card sf-home-panel overflow-hidden"><CardHeader icon={<Goal className="size-5" />} title="أهداف قريبة" subtitle="حافظ على الوجهة حاضرة." action={<Button variant="ghost" size="sm" onClick={() => setLocation("/goals")} className="gap-1 rounded-xl text-primary hover:bg-secondary">عرض<ChevronLeft className="size-4" /></Button>} /><div className="space-y-3 px-5 pb-5">{summary.isLoading ? <LoadingRows count={3} /> : data?.goals.length ? data.goals.map(goal => <button key={goal.id} onClick={() => setLocation("/goals")} className="pressable w-full rounded-2xl bg-muted/40 p-4 text-right hover:bg-secondary/55"><div className="mb-3 flex items-center justify-between gap-3"><p className="truncate font-semibold">{goal.title}</p><span className="num text-sm font-medium text-primary">{goal.progress}%</span></div><Progress value={goal.progress} className="h-1.5 bg-background" /><p className="mt-2 text-xs text-muted-foreground">{goal.completedTaskCount} من {goal.taskCount} مهام مكتملة</p></button>) : <EmptyBlock label="ابدأ بهدف واضح، ثم اربطه بمهام صغيرة." action="أنشئ هدفًا" onClick={() => setLocation("/goals")} />}</div></div>

          <div className="app-card sf-home-panel overflow-hidden"><CardHeader icon={<SunMediumIcon />} title="إيقاع اليوم" subtitle="روتينك الصغير يصنع ثباتك." action={<Button variant="ghost" size="sm" onClick={() => setLocation("/routines")} className="gap-1 rounded-xl text-primary hover:bg-secondary">تعديل<ChevronLeft className="size-4" /></Button>} /><div className="px-5 pb-5">{summary.isLoading ? <LoadingRows count={3} /> : data?.routines.some(routine => routine.isActive && routine.items.some(item => item.isActive)) ? <div className="space-y-4">{data.routines.filter(routine => routine.isActive).map(routine => <div key={routine.id}><div className="mb-2 flex items-center justify-between"><p className="text-sm font-semibold">{routine.name}</p><span className="text-xs text-muted-foreground">{routine.period === "morning" ? "صباحًا" : routine.period === "evening" ? "مساءً" : "مخصص"}</span></div><div className="space-y-2">{routine.items.filter(item => item.isActive).slice(0, 4).map(item => <button key={item.id} onClick={() => toggleRoutine.mutate({ id: item.id, done: !item.completedToday, timeZone })} className="pressable flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-right hover:bg-muted/70"><span className={cn("flex size-5 shrink-0 items-center justify-center rounded-md border", item.completedToday ? "border-emerald-500 bg-emerald-500 text-white" : "border-border bg-background")}>{item.completedToday && <Check className="size-3" />}</span><span className={cn("flex-1 text-sm", item.completedToday && "text-muted-foreground line-through")}>{item.title}</span><span className="num text-[11px] text-muted-foreground">{item.durationMinutes} د</span></button>)}</div></div>)}</div> : <EmptyBlock label="صمّم روتينًا بسيطًا يساند يومك." action="أنشئ روتينًا" onClick={() => setLocation("/routines")} />}</div></div>

          <div className="rounded-[1.35rem] border border-primary/10 bg-gradient-to-br from-secondary/85 to-card p-5 shadow-[0_16px_40px_-30px_rgba(45,37,92,.55)]"><div className="flex gap-4"><span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Sparkles className="size-5" /></span><div><p className="font-bold">لست متأكدًا من البداية؟</p><p className="mt-1 text-sm leading-6 text-muted-foreground">اكتب ما تريد إنجازه، وسيحوّله المخطط الذكي إلى خطوات واقعية.</p><Button onClick={() => setLocation("/planner")} variant="link" className="mt-2 h-auto gap-1 px-0 text-primary">ابدأ التخطيط<ArrowLeft className="size-4" /></Button></div></div></div>
        </div>
      </section>
      </>}
    </DashboardLayout>
  );
}

function StatCard({ label, value, sublabel, icon, tone }: { label: string; value: string | number; sublabel: string; icon: React.ReactNode; tone: "violet" | "amber" | "emerald" | "sky" }) {
  const toneClass = { violet: "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-200", amber: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-200", emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200", sky: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-200" }[tone];
  return <div className="app-card sf-stat-card pressable p-4 sm:p-5"><div className="flex items-start justify-between"><span className={cn("flex size-10 items-center justify-center rounded-2xl", toneClass)}>{icon}</span><span className="num text-2xl font-medium tracking-tight">{value}</span></div><p className="mt-5 text-sm font-semibold">{label}</p><p className="mt-1 text-xs text-muted-foreground">{sublabel}</p></div>;
}

function CardHeader({ icon, title, subtitle, action }: { icon: React.ReactNode; title: string; subtitle: string; action?: React.ReactNode }) {
  return <div className="sf-card-header flex items-start justify-between gap-3 px-5 pb-4 pt-5 sm:px-6"><div className="flex gap-3"><span className="mt-0.5 flex size-9 items-center justify-center rounded-xl bg-secondary text-primary">{icon}</span><div><h2 className="font-bold">{title}</h2><p className="mt-1 text-xs text-muted-foreground">{subtitle}</p></div></div>{action}</div>;
}

function EmptyBlock({ label, action, onClick }: { label: string; action: string; onClick: () => void }) {
  return <div className="flex min-h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/25 px-5 py-5 text-center"><Circle className="mb-2 size-5 text-muted-foreground/60" /><p className="max-w-xs text-sm leading-6 text-muted-foreground">{label}</p><Button variant="link" onClick={onClick} className="mt-1 h-auto gap-1 text-primary"><Plus className="size-3.5" />{action}</Button></div>;
}

function LoadingRows({ count }: { count: number }) { return <>{Array.from({ length: count }).map((_, i) => <div key={i} className="flex items-center gap-3 py-4"><span className="size-6 animate-pulse rounded-full bg-muted" /><div className="flex-1 space-y-2"><div className="h-3.5 w-3/5 animate-pulse rounded bg-muted" /><div className="h-2.5 w-1/4 animate-pulse rounded bg-muted" /></div></div>)}</>; }
function LoadingBookCards() { return <>{[0, 1].map(i => <div key={i} className="h-44 animate-pulse rounded-2xl bg-muted" />)}</>; }
function SunMediumIcon() { return <Clock3 className="size-5" />; }
