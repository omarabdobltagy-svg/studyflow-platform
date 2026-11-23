import { useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue, type Variants } from "framer-motion";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import QueryErrorNotice from "@/components/QueryErrorNotice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, ArrowUpLeft, BookOpenText, CalendarDays, Check, CheckCircle2,
  ChevronLeft, Circle, Clock3, Compass, Goal, LibraryBig, ListChecks, Plus,
  Sparkles, Target, WandSparkles, X,
} from "lucide-react";
import { useLocation } from "wouter";

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

function StudyOrb({ progress, y }: { progress: number | null; y: MotionValue<number> }) {
  const reduceMotion = useReducedMotion();
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const smoothX = useSpring(pointerX, { stiffness: 95, damping: 18, mass: 0.7 });
  const smoothY = useSpring(pointerY, { stiffness: 95, damping: 18, mass: 0.7 });
  const rotateY = useTransform(smoothX, [-1, 1], [-12, 12]);
  const rotateX = useTransform(smoothY, [-1, 1], [10, -10]);

  return (
    <motion.div
      className="sf-orb-stage"
      style={{ y }}
      onPointerMove={(event) => {
        if (reduceMotion || event.pointerType !== "mouse") return;
        const rect = event.currentTarget.getBoundingClientRect();
        pointerX.set(((event.clientX - rect.left) / rect.width - 0.5) * 2);
        pointerY.set(((event.clientY - rect.top) / rect.height - 0.5) * 2);
      }}
      onPointerLeave={() => { pointerX.set(0); pointerY.set(0); }}
      aria-label="عنصر بصري تفاعلي يرمز إلى StudyFlow"
    >
      <div className="sf-orb-halo" />
      <motion.div
        className="sf-orb-orbit sf-orb-orbit-a"
        animate={reduceMotion ? undefined : { rotate: 360 }}
        transition={{ duration: 34, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="sf-orb-orbit sf-orb-orbit-b"
        animate={reduceMotion ? undefined : { rotate: -360 }}
        transition={{ duration: 46, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="sf-orb-object"
        style={{ rotateX, rotateY }}
        animate={reduceMotion ? undefined : { y: [0, -9, 0], rotateZ: [-2, 1.5, -2] }}
        transition={{ duration: 7.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="sf-orb-inner-ring" />
        <span>sf</span>
        <small>STUDY / FLOW</small>
        <i className="sf-orb-glint" />
      </motion.div>
      <motion.div className="sf-orb-chip sf-orb-chip-plan" animate={reduceMotion ? undefined : { y: [0, -6, 0] }} transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}>
        <Target size={13} /><span>PLAN</span>
      </motion.div>
      <motion.div className="sf-orb-chip sf-orb-chip-learn" animate={reduceMotion ? undefined : { y: [0, 7, 0] }} transition={{ duration: 6.4, repeat: Infinity, ease: "easeInOut" }}>
        <BookOpenText size={13} /><span>LEARN</span>
      </motion.div>
      <div className="sf-orb-status"><span /> {progress === null ? "جاري قراءة تقدمك" : "إنجاز اليوم " + progress + "%"}</div>
    </motion.div>
  );
}

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
            <span className="sf-folder-index">{id.toUpperCase()} / SF</span>
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
            animate={{ rotate: isOpen ? 45 : 0, backgroundColor: isOpen ? "#426a70" : "rgba(255,255,255,.09)" }}
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
      whileHover={{ x: -3, backgroundColor: "rgba(66,106,112,.075)" }}
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
  const heroRef = useRef<HTMLElement | null>(null);
  const reduceMotion = useReducedMotion();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const summary = trpc.dashboard.summary.useQuery({ timeZone });
  const toggleTask = trpc.tasks.toggle.useMutation({ onSuccess: () => void utils.dashboard.summary.invalidate() });
  const toggleRoutine = trpc.routines.toggleItem.useMutation({ onSuccess: () => void utils.dashboard.summary.invalidate() });
  const [openFolder, setOpenFolder] = useState<string | null>(null);
  const data = summary.data;
  const completedRate = data ? (data.taskStats.total ? Math.round((data.taskStats.completed / data.taskStats.total) * 100) : 0) : null;
  const routineRate = data ? (data.routineStats.total ? Math.round((data.routineStats.completed / data.routineStats.total) * 100) : 0) : null;

  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const orbY = useTransform(scrollYProgress, [0, 1], [0, 72]);
  const orbScale = useTransform(scrollYProgress, [0, 1], [1, 0.9]);
  const smoothOrbY = useSpring(orbY, { stiffness: 80, damping: 22 });

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
        <section ref={heroRef} className="sf-home-hero">
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

          <motion.div className="sf-home-hero-art" style={{ scale: orbScale }}>
            <StudyOrb progress={completedRate} y={smoothOrbY} />
          </motion.div>
          <div className="sf-home-hero-bottom"><span>اسحب لاكتشاف مساحتك</span><i /></div>
        </section>

        <motion.section
          className="sf-metric-strip"
          variants={revealGroup}
          initial="hidden"
          whileInView="show"
          viewport={{ once: false, amount: 0.2 }}
        >
          <motion.article className="sf-metric" variants={revealItem} whileHover={{ y: -5, rotateX: 2 }}>
            <span className="sf-metric-icon"><ListChecks size={18} /></span>
            <div><small>مهام مفتوحة</small><strong>{data ? data.taskStats.remaining : "—"}</strong><span>{data ? "خطوة بانتظارك" : "جار تحميل بياناتك"}</span></div>
          </motion.article>
          <motion.article className="sf-metric" variants={revealItem} whileHover={{ y: -5, rotateX: 2 }}>
            <span className="sf-metric-icon"><Clock3 size={18} /></span>
            <div><small>التزام الروتين</small><strong>{routineRate === null ? "—" : routineRate + "%"}</strong><span>{data ? data.routineStats.completed + " من " + data.routineStats.total + " عادة" : "جار تحميل بياناتك"}</span></div>
          </motion.article>
          <motion.article className="sf-metric" variants={revealItem} whileHover={{ y: -5, rotateX: 2 }}>
            <span className="sf-metric-icon"><Goal size={18} /></span>
            <div><small>أهداف نشطة</small><strong>{data ? data.goalStats.active : "—"}</strong><span>وجهتك في هذا الفصل</span></div>
          </motion.article>
          <motion.article className="sf-metric" variants={revealItem} whileHover={{ y: -5, rotateX: 2 }}>
            <span className="sf-metric-icon"><BookOpenText size={18} /></span>
            <div><small>كتب في المسار</small><strong>{data ? data.bookStats.total : "—"}</strong><span>تعلم على مهل</span></div>
          </motion.article>
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
