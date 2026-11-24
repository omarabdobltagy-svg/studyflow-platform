import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import HeroLearningScene from "@/components/HeroLearningScene";
import QueryErrorNotice from "@/components/QueryErrorNotice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { getSIECheckpointBranches, getSIESubject } from "@shared/sie-catalog";
import {
  ArrowLeft, ArrowUpLeft, BookOpenText, CalendarDays, Check, CheckCircle2,
  ChevronLeft, Circle, Clock3, Compass, Goal, LibraryBig, ListChecks, Plus,
  Sparkles, Target, WandSparkles, X,
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const priorityStyle = {
  high: "sf-priority-high",
  medium: "sf-priority-medium",
  low: "sf-priority-low",
};
const priorityLabel = { high: "عالية", medium: "متوسطة", low: "مرنة" };

function arabicDate(date = new Date()) {
  return new Intl.DateTimeFormat("ar-EG", { weekday: "long", day: "numeric", month: "long" }).format(date);
}
function shortDate(date: Date | string) {
  return new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short" }).format(new Date(date));
}

const revealGroup: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.075, delayChildren: 0.08 } },
};
const revealItem: Variants = {
  hidden: { opacity: 0, y: 18, filter: "blur(5px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { type: "spring", stiffness: 170, damping: 19 } },
};

function WorkspaceFolder({
  id,
  title,
  eyebrow,
  subtitle,
  count,
  icon,
  isOpen,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  eyebrow: string;
  subtitle: string;
  count: string;
  icon: ReactNode;
  isOpen: boolean;
  onToggle: (id: string) => void;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      layout
      className={cn("sf-folder", isOpen && "is-open")}
      data-folder={id}
      transition={{ layout: { type: "spring", stiffness: 180, damping: 23 } }}
    >
      <motion.button
        type="button"
        className="sf-folder-trigger"
        onClick={() => onToggle(id)}
        aria-expanded={isOpen}
        whileHover={reduceMotion ? undefined : { y: -4, rotateX: 1.5 }}
        whileTap={reduceMotion ? undefined : { scale: 0.985 }}
        transition={{ type: "spring", stiffness: 280, damping: 19 }}
      >
        <div className="sf-folder-art" aria-hidden="true">
          <motion.div className="sf-folder-paper sf-folder-paper-back"
            animate={isOpen ? { y: -18, rotate: -8, x: -6 } : { y: 0, rotate: -2, x: 0 }}
            transition={{ type: "spring", stiffness: 180, damping: 17 }}
          />
          <motion.div className="sf-folder-paper sf-folder-paper-front"
            animate={isOpen ? { y: -25, rotate: 7, x: 7 } : { y: 0, rotate: 2, x: 0 }}
            transition={{ type: "spring", stiffness: 190, damping: 17, delay: isOpen ? 0.045 : 0 }}
          />
          <motion.div className="sf-folder-back" animate={isOpen ? { rotate: -2, y: -5 } : { rotate: 0, y: 0 }} transition={{ type: "spring", stiffness: 190, damping: 18 }} />
          <motion.div className="sf-folder-front" animate={isOpen ? { rotateX: -9, y: 9, skewX: -1 } : { rotateX: 0, y: 0, skewX: 0 }} transition={{ type: "spring", stiffness: 175, damping: 17 }}>
            <span className="sf-folder-emblem">{icon}</span>
            <span className="sf-folder-index">{id}</span>
          </motion.div>
          <motion.span className="sf-folder-spark" animate={isOpen ? { opacity: 1, scale: 1, y: -6 } : { opacity: 0, scale: 0.5, y: 7 }} transition={{ duration: 0.35 }} />
        </div>
        <div className="sf-folder-copy">
          <span className="sf-folder-eyebrow">{eyebrow}</span>
          <strong>{title}</strong>
          <span className="sf-folder-subtitle">{subtitle}</span>
        </div>
        <div className="sf-folder-meta">
          <span className="sf-folder-count">{count}</span>
          <motion.span
            className="sf-folder-action"
            animate={{ rotate: isOpen ? 45 : 0, backgroundColor: isOpen ? "#6F4E37" : "rgba(255,255,255,.09)" }}
            transition={{ type: "spring", stiffness: 260, damping: 19 }}
          >
            {isOpen ? <X size={16} /> : <ArrowUpLeft size={16} />}
          </motion.span>
        </div>
        <span className="sf-folder-hint">{isOpen ? "إغلاق المجلد" : "اضغط لفتح المجلد"}</span>
      </motion.button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            className="sf-folder-reveal"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ height: { duration: reduceMotion ? 0.01 : 0.72, ease: [0.2, 0.8, 0.2, 1] }, opacity: { duration: 0.28 } }}
          >
            <motion.div
              className="sf-folder-content"
              variants={revealGroup}
              initial="hidden"
              animate="show"
              exit="hidden"
            >
              {children}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

function DataRow({ children, onClick, trailing }: { children: ReactNode; onClick?: () => void; trailing?: ReactNode }) {
  return (
    <motion.button
      type="button"
      className="sf-data-row"
      onClick={onClick}
      whileHover={{ x: -3, backgroundColor: "rgba(111,78,55,.075)" }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.2 }}
    >
      <span className="sf-data-row-main">{children}</span>
      {trailing && <span className="sf-data-row-trailing">{trailing}</span>}
      <ArrowLeft className="sf-data-row-arrow" size={15} />
    </motion.button>
  );
}

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const reduceMotion = useReducedMotion();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const summary = trpc.dashboard.summary.useQuery({ timeZone });
  const learning = trpc.learning.get.useQuery();
  const profile = trpc.studentProfile.get.useQuery();
  const autoPlanRequested = useRef(false);
  const dailyPlan = trpc.plans.ensureDaily.useMutation({
    onError: error => toast.error("تعذّر تحديث خطة اليوم: " + error.message),
  });
  const toggleTask = trpc.tasks.toggle.useMutation({ onSuccess: () => void utils.dashboard.summary.invalidate() });
  const toggleRoutine = trpc.routines.toggleItem.useMutation({ onSuccess: () => void utils.dashboard.summary.invalidate() });
  const [openFolder, setOpenFolder] = useState<string | null>(null);
  const data = summary.data;
  const requestDailyPlan = dailyPlan.mutate;
  useEffect(() => {
    if (!profile.isSuccess || !profile.data?.subjectIds?.length || autoPlanRequested.current) return;
    autoPlanRequested.current = true;
    requestDailyPlan({ dailyMinutes: 120 });
  }, [profile.isSuccess, profile.data, requestDailyPlan]);

  const backlogBySubject = useMemo(() => (profile.data?.subjectIds ?? []).map((subjectId: string) => {
    const subjectName = getSIESubject(subjectId)?.nameAr || subjectId;
    const value = profile.data?.backlog?.[subjectId] ?? profile.data?.backlog?.[subjectName] ?? 0;
    return { subjectId, subjectName, count: Math.max(0, Number(value) || 0) };
  }), [profile.data]);
  const totalBacklog = backlogBySubject.reduce((total, item) => total + item.count, 0);
  const routineRate = data ? (data.routineStats.total ? Math.round((data.routineStats.completed / data.routineStats.total) * 100) : 0) : null;
  const learningPriority = useMemo(() => {
    const gapsBySubject = ((learning.data as any)?.gapByBranch ?? {}) as Record<string, Record<string, any>>;
    const candidates = Object.entries(gapsBySubject).flatMap(([currentSubjectId, subjectGaps]) =>
      getSIECheckpointBranches(currentSubjectId).flatMap(branch => {
        const gap = subjectGaps[branch.branchId];
        if (gap?.status !== "calculated" || gap.gapCount === null || gap.gapCount <= 0 || gap.referencePosition === null) return [];
        const nextIndex = gap.studentPosition;
        const nextLesson = typeof nextIndex === "number" ? branch.choices[nextIndex] : undefined;
        const ratio = gap.referencePosition > 0 ? gap.gapCount / gap.referencePosition : 0;
        return [{
          subjectId: currentSubjectId,
          subjectName: getSIESubject(currentSubjectId)?.nameAr || currentSubjectId,
          branchId: branch.branchId,
          branchTitle: branch.branchTitle,
          pointLabel: branch.branchType === "official_section" ? "موضوع" : "درس",
          gapCount: gap.gapCount as number,
          ratio,
          nextLesson: nextLesson ? { nodeId: nextLesson.nodeId, title: nextLesson.title } : null,
        }];
      })
    );
    return candidates.sort((a, b) => b.ratio - a.ratio)[0] ?? null;
  }, [learning.data]);

  const toggleFolder = (id: string) => {
    setOpenFolder(current => current === id ? null : id);
  };

  return (
    <DashboardLayout
      title="مساحة اليوم"
      description="مساحة هادئة تجمع خطتك وموادك وخطوتك القادمة."
      action={<Button onClick={() => setLocation("/planner")} className="sf-top-action"><Sparkles className="size-4" />المخطط الذكي<ArrowUpLeft className="size-4" /></Button>}
    >
      {summary.isError && <QueryErrorNotice onRetry={() => void summary.refetch()} label="تعذّر تحميل ملخص يومك. لن نعرض أرقامًا صفرية قد توحي بأن بياناتك فارغة." />}

      {!summary.isError && <>
        <section className="sf-home-hero">
          <div className="sf-home-hero-grain" />
          <motion.div className="sf-home-hero-copy" variants={revealGroup} initial="hidden" animate="show">
            <motion.p className="sf-home-date" variants={revealItem}>{arabicDate()}</motion.p>
            <motion.p className="sf-home-eyebrow" variants={revealItem}><span /> STUDYFLOW / YOUR SPACE</motion.p>
            <motion.h2 variants={revealItem}>أهلًا {user?.name?.split(" ")[0] || "بك"}، <em>خلي الصورة أوضح.</em></motion.h2>
            <motion.p className="sf-home-description" variants={revealItem}>مش لازم تمسك كل الخيوط مرة واحدة. افتح اللي محتاجه، شوف التفاصيل، وخلي خطوتك الجاية واضحة.</motion.p>
            <motion.div className="sf-home-hero-actions" variants={revealItem}>
              <Button type="button" onClick={() => setLocation("/tasks")} className="sf-hero-primary">افتح مهامي <ArrowLeft size={16} /></Button>
              <Button type="button" onClick={() => setLocation("/planner")} variant="outline" className="sf-hero-secondary">رتّب يومك <Sparkles size={15} /></Button>
            </motion.div>
            <motion.div className="sf-home-hero-foot" variants={revealItem}>
              <span><i /> مساحتك الدراسية</span>
              <span className="sf-hero-divider" />
              <span>01 <small>/ OVERVIEW</small></span>
            </motion.div>
          </motion.div>

          <motion.div
            className="sf-home-hero-visual"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="sf-home-hero-art" aria-hidden="true">
              <HeroLearningScene />
              <span className="sf-home-orb-caption">STUDYFLOW INTELLIGENCE / LIVE LEARNING MODEL</span>
            </div>
          <motion.aside className="sf-home-next-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.45 }} aria-label="الخطوة الدراسية التالية">
            <div className="sf-home-next-head"><span>الخطوة التالية</span><span>YOUR NEXT STEP</span></div>
            <div className="sf-home-next-body">
              {summary.isLoading ? <><small>ملخص اليوم</small><h3>نراجع مهامك المسجلة</h3><p>سيظهر هنا أقرب إجراء من قائمة مهامك.</p></>
                : data?.tasks[0] ? <><small>{data.tasks[0].category || "مهمة دراسية"}</small><h3>{data.tasks[0].title}</h3><p>{data.tasks[0].dueAt ? "موعدها " + shortDate(data.tasks[0].dueAt) : "لا يوجد موعد محدد — ابدأ بها عندما تكون مستعدًا."}</p></>
                : <><small>مساحتك مفتوحة</small><h3>لا توجد مهمة معلّقة الآن.</h3><p>أضف الخطوة التالية التي تريد إنجازها، وستظهر هنا مباشرة.</p></>}
            </div>
            <Button type="button" onClick={() => setLocation("/tasks")} className="sf-home-next-button">
              {data?.tasks[0] ? "افتح المهمة" : "إدارة المهام"} <ArrowLeft size={15} />
            </Button>
          </motion.aside>
          </motion.div>
          <div className="sf-home-hero-bottom"><span>اسحب لاكتشاف مساحتك</span><i /></div>
        </section>

        <motion.section
          className="sf-home-learning-focus"
          initial={reduceMotion ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32, duration: 0.42 }}
        >
          <div className="sf-home-learning-focus-copy">
            <span className="sf-home-learning-focus-mark"><BookOpenText size={18} /></span>
            <div>
              <p className="sf-home-learning-focus-kicker">SIE / LEARNING PRIORITY</p>
              <h3>{learning.isLoading ? "نراجع مواضع المنهج..." : learningPriority ? "أولوية المذاكرة التالية" : "خريطة تقدمك الدراسي"}</h3>
              <p>
                {learning.isLoading
                  ? "جارٍ تحميل موضعك ومرجع التدريس."
                  : learning.isError
                    ? "تعذّر تحميل بيانات التقدم؛ لن نخمن فجوة أو درسًا غير مسجل."
                    : learningPriority
                      ? learningPriority.subjectName + " · " + learningPriority.branchTitle + " · فجوة " + learningPriority.gapCount + " " + learningPriority.pointLabel
                      : "حدّد موضعك ومرجع التدريس لكل فرع ليختار النظام الخطوة التالية بدقة."}
              </p>
              {learningPriority?.nextLesson && <small>الخطوة التالية: {learningPriority.nextLesson.title}</small>}
            </div>
          </div>
          <Button
            type="button"
            onClick={() => {
              if (learningPriority?.nextLesson) {
                const params = new URLSearchParams({ subject: learningPriority.subjectId, branch: learningPriority.branchId, lesson: learningPriority.nextLesson.nodeId });
                setLocation("/study?" + params.toString());
              } else {
                setLocation("/learning-map");
              }
            }}
            className="sf-home-learning-focus-button"
          >
            {learningPriority?.nextLesson ? "ابدأ الدرس التالي" : "افتح خريطة المنهج"} <ArrowLeft size={15} />
          </Button>
        </motion.section>

        <motion.section
          className="sf-home-intelligence-grid"
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.36, duration: 0.4 }}
        >
          <section className="sf-home-backlog-card">
            <div className="sf-home-intelligence-heading">
              <div><span>STUDY / BACKLOG</span><h3>التراكم الدراسي</h3><p>ملخص سريع من ملف الدراسة والتراكم المحفوظ.</p></div>
              <BookOpenText size={19} />
            </div>
            {profile.isLoading ? <div className="sf-home-intelligence-loading">جارٍ قراءة ملفك الدراسي...</div>
              : profile.isError ? <p className="sf-home-intelligence-empty">تعذّر تحميل بيانات التراكم.</p>
              : <><div className="sf-home-backlog-total"><strong>{totalBacklog}</strong><span>إجمالي العناصر المسجلة كتراكم</span></div>
                <div className="sf-home-backlog-list">
                  {backlogBySubject.map(item => <div key={item.subjectId}><span>{item.subjectName}</span><b>{item.count}</b></div>)}
                </div>
                <p className="sf-home-intelligence-note">الأرقام هنا هي القيم المحفوظة في ملفك، وليست تقديرًا آليًا من عدد وحدات المنهج.</p>
              </>}
          </section>
          <section className="sf-home-daily-plan-card">
            <div className="sf-home-intelligence-heading">
              <div><span>STUDYFLOW / DAILY PLAN</span><h3>خطة الدراسة الحالية</h3><p>تُنشأ من ملفك تلقائيًا، ويُعاد تحديثها عند مرور 24 ساعة على آخر خطة محفوظة وفتحك للمساحة.</p></div>
              <Sparkles size={19} />
            </div>
            {dailyPlan.isPending ? <div className="sf-home-intelligence-loading">المخطط بيقرأ المنهج والتراكم ويرتب أولويات اليوم...</div>
              : dailyPlan.data?.plan ? <><div className="sf-home-plan-status"><span className="sf-home-plan-status-dot" />{dailyPlan.data.generated ? "تم إنشاء خطة محدثة تلقائيًا" : "خطة محفوظة وجاهزة للمتابعة"}</div>
                <h4>{dailyPlan.data.plan.title}</h4>
                <p className="sf-home-plan-summary">{dailyPlan.data.plan.summary}</p>
                <div className="sf-home-plan-steps">{dailyPlan.data.plan.steps.slice(0, 3).map((step, index) => <div key={index}><span>{step.day}</span><strong>{step.title}</strong><small>{step.minutes} دقيقة</small></div>)}</div>
                <div className="sf-home-plan-footer"><span>{dailyPlan.data.plan.steps.length} خطوة · {dailyPlan.data.plan.durationLabel}</span><Button type="button" onClick={() => setLocation("/planner")} className="sf-home-plan-button">مراجعة الخطة <ArrowLeft size={14} /></Button></div>
              </> : <div className="sf-home-intelligence-empty">أكمل ملفك الدراسي وحدد المواد لبدء إنشاء خطتك التلقائية.</div>}
          </section>
        </motion.section>

        <motion.section
          className="sf-metric-strip"
          variants={revealGroup}
          initial="hidden"
          whileInView="show"
          viewport={{ once: false, amount: 0.2 }}
        >
          <motion.button type="button" aria-label="فتح المهام" onClick={() => setLocation("/tasks")} className="sf-metric sf-metric-action" variants={revealItem} whileHover={{ y: -5, rotateX: 2 }} whileTap={{ scale: 0.985 }}>
            <span className="sf-metric-icon"><ListChecks size={18} /></span>
            <div><small>مهام مفتوحة</small><strong>{data ? data.taskStats.remaining : "—"}</strong><span>{data ? "خطوة بانتظارك" : "جار تحميل بياناتك"}</span></div>
          </motion.button>
          <motion.button type="button" aria-label="فتح الروتين" onClick={() => setLocation("/routines")} className="sf-metric sf-metric-action" variants={revealItem} whileHover={{ y: -5, rotateX: 2 }} whileTap={{ scale: 0.985 }}>
            <span className="sf-metric-icon"><Clock3 size={18} /></span>
            <div><small>التزام الروتين</small><strong>{routineRate === null ? "—" : routineRate + "%"}</strong><span>{data ? data.routineStats.completed + " من " + data.routineStats.total + " عادة" : "جار تحميل بياناتك"}</span></div>
          </motion.button>
          <motion.button type="button" aria-label="فتح الأهداف" onClick={() => setLocation("/goals")} className="sf-metric sf-metric-action" variants={revealItem} whileHover={{ y: -5, rotateX: 2 }} whileTap={{ scale: 0.985 }}>
            <span className="sf-metric-icon"><Goal size={18} /></span>
            <div><small>أهداف نشطة</small><strong>{data ? data.goalStats.active : "—"}</strong><span>وجهتك في هذا الفصل</span></div>
          </motion.button>
          <motion.button type="button" aria-label="فتح المكتبة" onClick={() => setLocation("/books")} className="sf-metric sf-metric-action" variants={revealItem} whileHover={{ y: -5, rotateX: 2 }} whileTap={{ scale: 0.985 }}>
            <span className="sf-metric-icon"><BookOpenText size={18} /></span>
            <div><small>كتب في المسار</small><strong>{data ? data.bookStats.total : "—"}</strong><span>تعلم على مهل</span></div>
          </motion.button>
        </motion.section>

        <section className="sf-folders-section">
          <div className="sf-section-heading">
            <div><p>YOUR STUDY SPACE</p><h2>افتح المجلد. <em>شوف اللي جواه.</em></h2></div>
            <span>كل مساحة تبدأ مغلقة، وتفتح وقت ما تحتاجها.</span>
          </div>

          <div className="sf-folder-grid">
            <WorkspaceFolder
              id="01"
              title="مهام اليوم"
              eyebrow="YOUR NEXT STEPS"
              subtitle="الخطوات القادمة وما يستحق تركيزك."
              count={data ? String(data.taskStats.remaining).padStart(2, "0") + " مهمة" : "—"}
              icon={<ListChecks size={21} />}
              isOpen={openFolder === "tasks"}
              onToggle={() => toggleFolder("tasks")}
            >
              {summary.isLoading ? <LoadingRows count={3} /> : data?.tasks.length ? data.tasks.slice(0, 5).map(task => (
                <motion.div className="sf-folder-task" variants={revealItem} key={task.id}>
                  <button className="sf-task-check" onClick={() => toggleTask.mutate({ id: task.id, done: true })} disabled={toggleTask.isPending} aria-label={"إكمال " + task.title}><Check size={14} /></button>
                  <div className="sf-task-copy"><strong>{task.title}</strong><span>{task.category}{task.dueAt ? " · " + shortDate(task.dueAt) : ""}</span></div>
                  <Badge className={cn("sf-priority", priorityStyle[task.priority])}>{priorityLabel[task.priority]}</Badge>
                </motion.div>
              )) : <EmptyBlock label="لا توجد مهام مفتوحة الآن. أضف خطوتك التالية لتبدأ." action="أضف مهمة" onClick={() => setLocation("/tasks")} />}
              <div className="sf-folder-footer"><span>{data ? data.taskStats.completed + " مهمة مكتملة" : "ملخص المهام"}</span><Button variant="ghost" onClick={() => setLocation("/tasks")}>كل المهام <ArrowLeft size={14} /></Button></div>
            </WorkspaceFolder>

            <WorkspaceFolder
              id="02"
              title="مكتبة التعلّم"
              eyebrow="YOUR LEARNING LIBRARY"
              subtitle="كتبك الحالية والفصول التي تعمل عليها."
              count={data ? String(data.bookStats.total).padStart(2, "0") + " كتاب" : "—"}
              icon={<LibraryBig size={21} />}
              isOpen={openFolder === "books"}
              onToggle={() => toggleFolder("books")}
            >
              {summary.isLoading ? <LoadingRows count={3} /> : data?.books.length ? data.books.slice(0, 4).map(book => (
                <motion.div className="sf-folder-book" variants={revealItem} key={book.id}>
                  <button className={cn("sf-book-cover", "tone-" + book.coverColor)} onClick={() => setLocation("/books/" + book.id)} aria-label={"فتح " + book.title}><BookOpenText size={19} /></button>
                  <div className="sf-book-copy"><strong>{book.title}</strong><span>{book.subject}{book.author ? " · " + book.author : ""}</span><Progress value={book.progress} className="sf-book-progress" /></div>
                  <b className="sf-book-rate">{book.progress}%</b>
                </motion.div>
              )) : <EmptyBlock label="أضف أول كتاب، ثم قسّمه إلى فصول لتتابع رحلتك." action="أضف كتابًا" onClick={() => setLocation("/books")} />}
              <div className="sf-folder-footer"><span>مساحة معرفة مرتبة</span><Button variant="ghost" onClick={() => setLocation("/books")}>افتح المكتبة <ArrowLeft size={14} /></Button></div>
            </WorkspaceFolder>

            <WorkspaceFolder
              id="03"
              title="الأهداف"
              eyebrow="KEEP THE DIRECTION"
              subtitle="وجهتك وما قطعته في الطريق."
              count={data ? String(data.goalStats.active).padStart(2, "0") + " هدف" : "—"}
              icon={<Target size={21} />}
              isOpen={openFolder === "goals"}
              onToggle={() => toggleFolder("goals")}
            >
              {summary.isLoading ? <LoadingRows count={3} /> : data?.goals.length ? data.goals.slice(0, 4).map(goal => (
                <motion.div className="sf-folder-goal" variants={revealItem} key={goal.id}>
                  <div className="sf-goal-marker"><Target size={16} /></div>
                  <div className="sf-goal-copy"><strong>{goal.title}</strong><span>{goal.completedTaskCount} من {goal.taskCount} مهام مكتملة</span><Progress value={goal.progress} className="sf-goal-progress" /></div>
                  <b>{goal.progress}%</b>
                </motion.div>
              )) : <EmptyBlock label="ابدأ بهدف واضح، ثم اربطه بمهام صغيرة." action="أنشئ هدفًا" onClick={() => setLocation("/goals")} />}
              <div className="sf-folder-footer"><span>الوجهة قبل السرعة</span><Button variant="ghost" onClick={() => setLocation("/goals")}>كل الأهداف <ArrowLeft size={14} /></Button></div>
            </WorkspaceFolder>

            <WorkspaceFolder
              id="04"
              title="إيقاع اليوم"
              eyebrow="SMALL ROUTINES, STEADY FLOW"
              subtitle="عادات صغيرة تصنع استمرارية أكبر."
              count={data ? String(data.routineStats.total).padStart(2, "0") + " عادة" : "—"}
              icon={<Clock3 size={21} />}
              isOpen={openFolder === "routine"}
              onToggle={() => toggleFolder("routine")}
            >
              {summary.isLoading ? <LoadingRows count={3} /> : data?.routines.some(routine => routine.isActive && routine.items.some(item => item.isActive)) ? data.routines.filter(routine => routine.isActive).map(routine => (
                <div className="sf-routine-group" key={routine.id}>
                  <div className="sf-routine-heading"><strong>{routine.name}</strong><span>{routine.period === "morning" ? "صباحًا" : routine.period === "evening" ? "مساءً" : "مخصص"}</span></div>
                  {routine.items.filter(item => item.isActive).slice(0, 5).map(item => (
                    <motion.button variants={revealItem} key={item.id} className="sf-routine-row" onClick={() => toggleRoutine.mutate({ id: item.id, done: !item.completedToday, timeZone })}>
                      <span className={cn("sf-routine-check", item.completedToday && "is-done")}>{item.completedToday && <Check size={12} />}</span>
                      <span>{item.title}</span><small>{item.durationMinutes} د</small>
                    </motion.button>
                  ))}
                </div>
              )) : <EmptyBlock label="صمّم روتينًا بسيطًا يساند يومك." action="أنشئ روتينًا" onClick={() => setLocation("/routines")} />}
              <div className="sf-folder-footer"><span>الاستمرارية أهم من الكمال</span><Button variant="ghost" onClick={() => setLocation("/routines")}>إدارة الروتين <ArrowLeft size={14} /></Button></div>
            </WorkspaceFolder>
          </div>
        </section>

        <motion.section
          className="sf-ai-bridge"
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.2 }}
          transition={{ type: "spring", stiffness: 105, damping: 20 }}
        >
          <div className="sf-ai-symbol"><WandSparkles size={24} /></div>
          <div className="sf-ai-copy"><span>STUDYFLOW INTELLIGENCE</span><h2>مش عارف تبدأ منين؟ <em>خلّي الصورة تكتمل.</em></h2><p>المخطط الذكي يساعدك تحوّل المطلوب إلى خطوات واقعية، والمساعد موجود لما تحتاج تسأل أو تراجع قرار.</p></div>
          <div className="sf-ai-actions">
            <Button onClick={() => setLocation("/planner")} className="sf-ai-primary">افتح المخطط <ArrowUpLeft size={15} /></Button>
            <Button onClick={() => setLocation("/assistant")} variant="outline" className="sf-ai-secondary">اسأل المساعد <Sparkles size={15} /></Button>
          </div>
        </motion.section>
      </>}
    </DashboardLayout>
  );
}

function EmptyBlock({ label, action, onClick }: { label: string; action: string; onClick: () => void }) {
  return <div className="sf-empty-block"><Circle size={19} /><p>{label}</p><Button variant="link" onClick={onClick}><Plus size={14} />{action}</Button></div>;
}
function LoadingRows({ count }: { count: number }) {
  return <div className="sf-folder-loading">{Array.from({ length: count }).map((_, i) => <div key={i}><span /><i /><i /></div>)}</div>;
}
