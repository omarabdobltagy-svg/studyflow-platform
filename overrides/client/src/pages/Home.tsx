import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import QueryErrorNotice from "@/components/QueryErrorNotice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  BookOpenText, CalendarDays, Check, CheckCircle2, ChevronLeft, Clock3,
  Goal, ListChecks, Plus, Sparkles, Target, Timer, TrendingUp,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useLocation } from "wouter";
import type { ReactNode } from "react";

const priorityStyle = { high: "sf-priority-high", medium: "sf-priority-medium", low: "sf-priority-low" } as const;
const priorityLabel = { high: "عالية", medium: "متوسطة", low: "مرنة" } as const;

function arabicDate(date = new Date()) {
  return new Intl.DateTimeFormat("ar-EG", { weekday: "long", day: "numeric", month: "long" }).format(date);
}
function shortDate(date: Date | string) {
  return new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short" }).format(new Date(date));
}

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const summary = trpc.dashboard.summary.useQuery({ timeZone });
  const toggleTask = trpc.tasks.toggle.useMutation({ onSuccess: () => {
    void utils.dashboard.summary.invalidate();
    void utils.tasks.list.invalidate();
  }});
  const toggleRoutine = trpc.routines.toggleItem.useMutation({ onSuccess: () => {
    void utils.dashboard.summary.invalidate();
    void utils.routines.list.invalidate();
  }});
  const reduceMotion = useReducedMotion();
  const data = summary.data;
  const completedRate = data ? (data.taskStats.total ? Math.round(data.taskStats.completed / data.taskStats.total * 100) : 0) : null;
  const routineRate = data ? (data.routineStats.total ? Math.round(data.routineStats.completed / data.routineStats.total * 100) : 0) : null;
  const focusTask = data?.tasks?.[0];
  const upcomingTasks = data?.tasks?.slice(0, 5) ?? [];
  const priorityCounts = {
    high: upcomingTasks.filter(task => task.priority === "high").length,
    medium: upcomingTasks.filter(task => task.priority === "medium").length,
    low: upcomingTasks.filter(task => task.priority === "low").length,
  };
  const activeRoutines = data?.routines?.filter(routine => routine.isActive && routine.items.some(item => item.isActive)) ?? [];
  const activeGoals = data?.goals?.slice(0, 2) ?? [];
  const activeBooks = data?.books?.slice(0, 3) ?? [];

  return (
    <DashboardLayout title="نظرة اليوم" description="صورة واضحة لما أنجزته، وما يحتاج انتباهك، والخطوة التالية التي يمكنك البدء بها."
      action={<Button onClick={() => setLocation("/planner")} className="pressable rounded-xl bg-primary px-4"><Sparkles className="size-4" /> خطّط يومك</Button>}>
      {summary.isError && <QueryErrorNotice onRetry={() => void summary.refetch()} label="تعذّر تحميل ملخص يومك. لن نعرض أرقامًا صفرية قد توحي بأن بياناتك فارغة." />}

      {!summary.isError && <>
        <motion.section className="sf-daily-stage" initial={reduceMotion ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : .42, ease: [0.22, 1, .36, 1] }}>
          <div className="sf-daily-stage-copy">
            <div className="sf-daily-date"><span className="sf-live-dot" />{arabicDate()}</div>
            <p className="sf-daily-kicker">TODAY / IN FOCUS</p>
            <h2>أهلًا {user?.name?.split(" ")[0] || "بك"}، خلّي البداية واضحة.</h2>
            <p className="sf-daily-intro">مش مطلوب تخلّص كل حاجة مرة واحدة. راجع الصورة، اختار خطوة مناسبة، وسيب الباقي يتظبط على تقدمك الفعلي.</p>
            <div className="sf-focus-task">
              <div className="sf-focus-task-top">
                <span>الخطوة التالية في قائمتك</span>
                {focusTask && <Badge className={cn("sf-priority-badge", priorityStyle[focusTask.priority])}>أولوية {priorityLabel[focusTask.priority]}</Badge>}
              </div>
              {summary.isLoading ? <div className="sf-focus-skeleton"><span /><span /><span /></div> : focusTask ? <>
                <h3>{focusTask.title}</h3>
                <div className="sf-focus-meta">
                  {focusTask.category && <span>{focusTask.category}</span>}
                  {focusTask.dueAt && <span><CalendarDays />{shortDate(focusTask.dueAt)}</span>}
                </div>
                <div className="sf-focus-actions">
                  <Button onClick={() => setLocation("/tasks")} className="rounded-xl bg-white text-[#38204f] hover:bg-[#f3eaf8]">فتح المهمة <ChevronLeft className="size-4" /></Button>
                  <Button type="button" variant="ghost" disabled={toggleTask.isPending} onClick={() => toggleTask.mutate({ id: focusTask.id, done: true })} className="rounded-xl text-white hover:bg-white/10 hover:text-white"><CheckCircle2 className="size-4" /> تسجيل الإنجاز</Button>
                </div>
              </> : <div className="sf-focus-empty">
                <h3>قائمتك خفيفة حاليًا.</h3><p>أضف مهمة واضحة أو استخدم المخطط لتقسيم هدف كبير إلى خطوات.</p>
                <Button onClick={() => setLocation("/tasks")} className="mt-3 rounded-xl bg-white text-[#38204f] hover:bg-[#f3eaf8]"><Plus className="size-4" /> إضافة مهمة</Button>
              </div>}
            </div>
          </div>

          <div className="sf-daily-stage-aside">
            <div className="sf-day-progress">
              <div className="sf-day-progress-heading"><span>إنجاز المهام</span><TrendingUp className="size-4" /></div>
              <div className="sf-day-ring" role="progressbar" aria-label="نسبة إنجاز المهام" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completedRate ?? 0}
                style={{ background: "conic-gradient(#d6b6f0 " + (completedRate ?? 0) + "%, rgb(255 255 255 / 16%) 0)" }}>
                <div><strong>{completedRate === null ? "—" : completedRate + "%"}</strong><span>من مهامك</span></div>
              </div>
              <div className="sf-day-progress-stat"><strong>{data ? data.taskStats.completed : "—"} <small>/ {data ? data.taskStats.total : "—"}</small></strong><span>مهام مكتملة</span></div>
              <div className="sf-day-progress-track"><span style={{ width: (completedRate ?? 0) + "%" }} /></div>
              <p>النسبة محسوبة من المهام المسجّلة، وليست تقديرًا تلقائيًا.</p>
            </div>
            <div className="sf-day-priority">
              <div className="sf-day-priority-head"><span>توزيع الأولوية</span><small>المهام القادمة المعروضة</small></div>
              {([
                { key: "high", label: "عالية", tone: "high" },
                { key: "medium", label: "متوسطة", tone: "medium" },
                { key: "low", label: "مرنة", tone: "low" },
              ] as const).map(item => {
                const count = priorityCounts[item.key];
                const total = Math.max(1, upcomingTasks.length);
                return <div className="sf-priority-row" key={item.key}>
                  <span>{item.label}</span><div className="sf-priority-rail"><i className={item.tone} style={{ width: (count / total) * 100 + "%" }} /></div><b>{count}</b>
                </div>;
              })}
            </div>
          </div>
          <span className="sf-stage-orbit sf-stage-orbit-one" aria-hidden="true" />
          <span className="sf-stage-orbit sf-stage-orbit-two" aria-hidden="true" />
        </motion.section>

        <motion.section className="sf-daily-metrics" initial={reduceMotion ? false : "hidden"} animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: reduceMotion ? 0 : .07, delayChildren: reduceMotion ? 0 : .08 } } }}>
          <MetricTile tone="lilac" icon={<ListChecks />} label="المهام المتبقية" value={data ? data.taskStats.remaining : "—"} detail="خطوات لم تُغلق بعد" loading={summary.isLoading} />
          <MetricTile tone="mint" icon={<Clock3 />} label="التزام الروتين" value={routineRate === null ? "—" : routineRate + "%"} detail={data ? data.routineStats.completed + " من " + data.routineStats.total + " عادة" : "بانتظار البيانات"} loading={summary.isLoading} />
          <MetricTile tone="sun" icon={<Goal />} label="الأهداف النشطة" value={data ? data.goalStats.active : "—"} detail="وجهات تعمل عليها" loading={summary.isLoading} />
          <MetricTile tone="blue" icon={<BookOpenText />} label="الكتب في مكتبتك" value={data ? data.bookStats.total : "—"} detail="مواد محفوظة في المسار" loading={summary.isLoading} />
        </motion.section>

        <section className="sf-daily-grid">
          <div className="sf-daily-main-column">
            <motion.section className="sf-work-panel sf-tasks-panel" initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : .32, delay: reduceMotion ? 0 : .12 }}>
              <PanelHeading overline="NEXT ACTIONS" title="مهامك القادمة" description="قائمة قصيرة تساعدك تختار ما تبدأ به." icon={<ListChecks />} action={<Button variant="ghost" size="sm" onClick={() => setLocation("/tasks")} className="sf-panel-link">كل المهام <ChevronLeft /></Button>} />
              {summary.isLoading ? <TaskSkeleton /> : upcomingTasks.length ? <div className="sf-upcoming-list">
                {upcomingTasks.map((task, index) => <article className="sf-upcoming-row" key={task.id}>
                  <button type="button" className="sf-task-complete" onClick={() => toggleTask.mutate({ id: task.id, done: true })} disabled={toggleTask.isPending} aria-label={"تسجيل إنجاز " + task.title}><Check /></button>
                  <div className="sf-upcoming-index">{String(index + 1).padStart(2, "0")}</div>
                  <div className="sf-upcoming-copy"><h3>{task.title}</h3><div>
                    {task.category && <span>{task.category}</span>}
                    {task.dueAt && <span><CalendarDays />{shortDate(task.dueAt)}</span>}
                  </div></div>
                  <span className={cn("sf-priority-dot", priorityStyle[task.priority])} title={"أولوية " + priorityLabel[task.priority]} />
                </article>)}
              </div> : <EmptyState icon={<CheckCircle2 />} title="لا توجد مهام قادمة." description="أضف خطوة صغيرة أو قسّم هدفك من المخطط الذكي." action="إضافة مهمة" onClick={() => setLocation("/tasks")} />}
            </motion.section>

            <motion.section className="sf-work-panel sf-library-panel" initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : .32, delay: reduceMotion ? 0 : .2 }}>
              <PanelHeading overline="YOUR LEARNING SHELF" title="مسارات التعلّم" description="المواد التي أضفتها وتقدمك المسجل فيها." icon={<BookOpenText />} action={<Button variant="ghost" size="sm" onClick={() => setLocation("/books")} className="sf-panel-link">فتح المكتبة <ChevronLeft /></Button>} />
              {summary.isLoading ? <div className="sf-book-skeletons"><span /><span /><span /></div> : activeBooks.length ? <div className="sf-book-shelf">
                {activeBooks.map((book, index) => <button type="button" key={book.id} onClick={() => setLocation("/books/" + book.id)} className={cn("sf-book-shelf-item", "tone-" + (index + 1))}>
                  <span className="sf-book-glyph"><BookOpenText /></span>
                  <span className="sf-book-copy"><b>{book.title}</b><small>{book.subject}{book.author ? " · " + book.author : ""}</small><span className="sf-book-progress"><i style={{ width: book.progress + "%" }} /></span></span>
                  <strong>{book.progress}%</strong>
                </button>)}
              </div> : <EmptyState icon={<BookOpenText />} title="مكتبتك لسه فاضية." description="أضف كتابك أو ملف المنهج حتى تتابع تقدمه من مكان واحد." action="إضافة كتاب" onClick={() => setLocation("/books")} />}
            </motion.section>
          </div>

          <aside className="sf-daily-side-column">
            <section className="sf-work-panel sf-goals-panel">
              <PanelHeading overline="KEEP THE DIRECTION" title="أهدافك القريبة" description="تقدم مبني على المهام التي أنجزتها." icon={<Target />} action={<Button variant="ghost" size="sm" onClick={() => setLocation("/goals")} className="sf-panel-link">الأهداف <ChevronLeft /></Button>} />
              {summary.isLoading ? <TaskSkeleton compact /> : activeGoals.length ? <div className="sf-goal-stack">
                {activeGoals.map(goal => <button type="button" key={goal.id} onClick={() => setLocation("/goals")} className="sf-goal-item">
                  <div className="sf-goal-item-top"><b>{goal.title}</b><strong>{goal.progress}%</strong></div>
                  <Progress value={goal.progress} className="sf-goal-progress" />
                  <small>{goal.completedTaskCount} من {goal.taskCount} مهام مكتملة</small>
                </button>)}
              </div> : <EmptyState icon={<Goal />} title="حدد وجهة قريبة." description="اربط الهدف بخطوات صغيرة عشان تتابع التقدم الفعلي." action="إنشاء هدف" onClick={() => setLocation("/goals")} />}
            </section>

            <section className="sf-work-panel sf-routine-panel">
              <PanelHeading overline="DAILY RHYTHM" title="إيقاع اليوم" description="العادات النشطة التي اخترت متابعتها." icon={<Timer />} action={<Button variant="ghost" size="sm" onClick={() => setLocation("/routines")} className="sf-panel-link">إدارة <ChevronLeft /></Button>} />
              {summary.isLoading ? <TaskSkeleton compact /> : activeRoutines.length ? <div className="sf-routine-stack">
                {activeRoutines.slice(0, 2).map(routine => <div className="sf-routine-block" key={routine.id}>
                  <div className="sf-routine-block-heading"><b>{routine.name}</b><small>{routine.period === "morning" ? "صباحًا" : routine.period === "evening" ? "مساءً" : "مخصص"}</small></div>
                  {routine.items.filter(item => item.isActive).slice(0, 3).map(item => <button type="button" key={item.id} className={cn("sf-routine-check", item.completedToday && "is-done")} onClick={() => toggleRoutine.mutate({ id: item.id, done: !item.completedToday, timeZone })} disabled={toggleRoutine.isPending} aria-pressed={item.completedToday}>
                    <span>{item.completedToday && <Check />}</span><b>{item.title}</b><small>{item.durationMinutes} د</small>
                  </button>)}
                </div>)}
              </div> : <EmptyState icon={<Timer />} title="ابنِ إيقاعك الخاص." description="الروتين المرن يساعدك تكرر خطوات مناسبة ليومك." action="إنشاء روتين" onClick={() => setLocation("/routines")} />}
            </section>

            <button type="button" className="sf-planner-callout" onClick={() => setLocation("/planner")}>
              <span className="sf-planner-callout-icon"><Sparkles /></span>
              <span><small>NEED A PLAN?</small><b>حوّل التراكم إلى خطوات قابلة للتنفيذ.</b><em>ابدأ من المخطط <ChevronLeft /></em></span>
            </button>
          </aside>
        </section>
      </>}
    </DashboardLayout>
  );
}

function MetricTile({ tone, icon, label, value, detail, loading }: {
  tone: "lilac" | "mint" | "sun" | "blue"; icon: ReactNode;
  label: string; value: string | number; detail: string; loading: boolean;
}) {
  const reduceMotion = useReducedMotion();
  return <motion.article className={"sf-metric-tile tone-" + tone} variants={{
    hidden: reduceMotion ? false : { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 },
  }} transition={{ duration: reduceMotion ? 0 : .28 }}>
    <span className="sf-metric-icon">{icon}</span><div className="sf-metric-number">{loading ? "—" : value}</div>
    <b>{label}</b><small>{detail}</small>
  </motion.article>;
}

function PanelHeading({ overline, title, description, icon, action }: {
  overline: string; title: string; description: string; icon: ReactNode; action?: ReactNode;
}) {
  return <div className="sf-panel-heading">
    <span className="sf-panel-heading-icon">{icon}</span>
    <div className="sf-panel-heading-copy"><small>{overline}</small><h2>{title}</h2><p>{description}</p></div>
    {action}
  </div>;
}
function EmptyState({ icon, title, description, action, onClick }: {
  icon: ReactNode; title: string; description: string; action: string; onClick: () => void;
}) {
  return <div className="sf-empty-state">
    <span>{icon}</span><b>{title}</b><p>{description}</p>
    <Button type="button" variant="outline" onClick={onClick} className="mt-3 rounded-xl">{action} <ChevronLeft className="size-4" /></Button>
  </div>;
}
function TaskSkeleton({ compact = false }: { compact?: boolean }) {
  return <div className={cn("sf-task-skeleton", compact && "is-compact")}>
    {Array.from({ length: compact ? 2 : 4 }).map((_, index) => <span key={index} />)}
  </div>;
}
