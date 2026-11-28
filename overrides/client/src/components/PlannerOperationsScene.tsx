// @ts-nocheck -- Three.js has no declaration package in this repository; matches ThreeAmbientScene.tsx.
import * as THREE from "three";
import { gsap } from "gsap";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { getSIECheckpointChoices, getSIESubject, getSIETeacher } from "@shared/sie-catalog";
import { Button } from "@/components/ui/button";
import { Check, ChevronLeft, Clock3, Layers3, ListChecks, Plus, Target, CalendarDays, GraduationCap, BarChart3, Sparkles } from "lucide-react";
import { toast } from "sonner";

type LayerId = "overview" | "tasks" | "goals" | "schedule" | "learning" | "insights";
type SceneNode = { id: LayerId; label: string; value: string; color: number };

const layerMeta: Record<LayerId, { title: string; eyebrow: string; description: string; path?: string }> = {
  overview: { title: "مركز القيادة", eyebrow: "نظرة اليوم", description: "صورة واحدة لما يحتاج انتباهك الآن." },
  tasks: { title: "إدارة المهام", eyebrow: "إدارة المهام", description: "التقط المهمة، صنّفها، حدّد أولويتها، وأنهِها من نفس المساحة.", path: "/tasks" },
  goals: { title: "الأهداف والمراحل", eyebrow: "منظومة الأهداف", description: "تابع العلاقة بين الهدف ومراحله والمهام التي تحرّكه.", path: "/goals" },
  schedule: { title: "الجدول الزمني", eyebrow: "المواعيد والجدول", description: "المواعيد القادمة والمهام ذات التاريخ في خط زمني واحد.", path: "/calendar" },
  learning: { title: "خريطة التعلّم", eyebrow: "مسار التعلّم", description: "المواد والمدرسون ونقطة التقدم والتراكم المسجل.", path: "/study" },
  insights: { title: "مؤشرات الأداء", eyebrow: "مؤشرات التقدم", description: "قراءة تشغيلية من سجلاتك الفعلية، وليست حكمًا على مستوى إتقانك.", path: "/analytics" },
};

const cairoDateKey = (value: Date | string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date(value));
const formatDate = (value: Date | string | null | undefined) =>
  value ? new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short", weekday: "short", timeZone: "Africa/Cairo" }).format(new Date(value)) : "بلا موعد";
const priorityLabel: Record<string, string> = { high: "عالية", medium: "متوسطة", low: "مرنة" };

export default function PlannerOperationsScene() {
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const tasksQuery = trpc.tasks.list.useQuery();
  const goalsQuery = trpc.goals.list.useQuery();
  const calendarQuery = trpc.calendar.list.useQuery();
  const profileQuery = trpc.studentProfile.get.useQuery();
  const [layer, setLayer] = useState<LayerId>("overview");
  const [taskFilter, setTaskFilter] = useState<"open" | "today" | "late" | "done">("open");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftCategory, setDraftCategory] = useState("مذاكرة");
  const [draftPriority, setDraftPriority] = useState<"low" | "medium" | "high">("medium");
  const [draftDueDate, setDraftDueDate] = useState("");
  const [draftGoalTitle, setDraftGoalTitle] = useState("");
  const [draftEventTitle, setDraftEventTitle] = useState("");
  const [draftEventAt, setDraftEventAt] = useState("");
  const [learningSubject, setLearningSubject] = useState("");
  const [learningLesson, setLearningLesson] = useState("");
  const [learningDraft, setLearningDraft] = useState<{ key: string; steps: string[] }>({ key: "", steps: [] });

  const tasks = tasksQuery.data ?? [];
  const goals = goalsQuery.data ?? [];
  const events = calendarQuery.data ?? [];
  const profile = profileQuery.data;
  const profileSubjectIds = ((profile as any)?.subjectIds ?? (profile as any)?.subjects ?? []) as string[];
  const now = Date.now();
  const todayKey = cairoDateKey(new Date());
  const openTasks = tasks.filter(task => task.status === "todo");
  const doneTasks = tasks.filter(task => task.status === "done");
  const lateTasks = openTasks.filter(task => task.dueAt && new Date(task.dueAt).getTime() < now);
  const activeGoals = goals.filter(goal => goal.status === "active" && !goal.parentGoalId);
  const upcomingEvents = events.filter(event => new Date(event.startAt).getTime() >= now).slice(0, 8);
  const completionRate = tasks.length ? Math.round((doneTasks.length / tasks.length) * 100) : 0;

  const toggleTask = trpc.tasks.toggle.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.tasks.list.invalidate(),
        utils.goals.list.invalidate(),
        utils.calendar.list.invalidate(),
        utils.dashboard.summary.invalidate(),
      ]);
      toast.success("تم تحديث حالة المهمة.");
    },
    onError: error => toast.error(error.message),
  });
  const createTask = trpc.tasks.create.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.tasks.list.invalidate(),
        utils.calendar.list.invalidate(),
        utils.dashboard.summary.invalidate(),
      ]);
      setDraftTitle("");
      setDraftDueDate("");
      toast.success("أُضيفت المهمة إلى مساحتك.");
    },
    onError: error => toast.error(error.message),
  });

  const createGoal = trpc.goals.create.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.goals.list.invalidate(), utils.dashboard.summary.invalidate()]);
      setDraftGoalTitle("");
      toast.success("أُضيف الهدف إلى مساحتك.");
    },
    onError: error => toast.error(error.message),
  });
  const createEvent = trpc.calendar.create.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.calendar.list.invalidate(), utils.dashboard.summary.invalidate()]);
      setDraftEventTitle("");
      setDraftEventAt("");
      toast.success("تم حفظ الموعد في الجدول.");
    },
    onError: error => toast.error(error.message),
  });
  const saveLessonProgress = trpc.study.saveSubjectLessonProgress.useMutation({
    onSuccess: async () => {
      await utils.studentProfile.get.invalidate();
      toast.success("تم حفظ تقدم الدرس.");
    },
    onError: error => toast.error(error.message),
  });

  const nodes = useMemo<SceneNode[]>(() => [
    { id: "overview", label: "اليوم", value: String(openTasks.length), color: 0xc0a06a },
    { id: "tasks", label: "المهام", value: String(openTasks.length), color: 0x9c7469 },
    { id: "goals", label: "الأهداف", value: String(activeGoals.length), color: 0xb98653 },
    { id: "schedule", label: "الجدول", value: String(upcomingEvents.length), color: 0xb99b70 },
    { id: "learning", label: "التعلّم", value: String(profileSubjectIds.length ?? 0), color: 0x9b7772 },
    { id: "insights", label: "الأداء", value: completionRate + "%", color: 0xa19a8b },
  ], [openTasks.length, activeGoals.length, upcomingEvents.length, profileSubjectIds.length, completionRate]);

  const onSceneSelect = useCallback((next: LayerId) => setLayer(next), []);
  const visibleTasks = useMemo(() => {
    const rows = [...tasks].filter(task => {
      if (taskFilter === "done") return task.status === "done";
      if (taskFilter === "today") return task.status === "todo" && task.dueAt && cairoDateKey(task.dueAt) === todayKey;
      if (taskFilter === "late") return task.status === "todo" && task.dueAt && new Date(task.dueAt).getTime() < Date.now();
      return task.status === "todo";
    });
    return rows.sort((a, b) => {
      const priority = { high: 0, medium: 1, low: 2 };
      const priorityDifference = (priority[a.priority as keyof typeof priority] ?? 3) - (priority[b.priority as keyof typeof priority] ?? 3);
      if (priorityDifference) return priorityDifference;
      return new Date(a.dueAt ?? "2999-12-31").getTime() - new Date(b.dueAt ?? "2999-12-31").getTime();
    }).slice(0, 8);
  }, [tasks, taskFilter, todayKey]);

  const submitTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = draftTitle.trim();
    if (!title) return;
    const dueAt = draftDueDate ? new Date(draftDueDate + "T20:00:00") : null;
    createTask.mutate({
      title,
      category: draftCategory,
      priority: draftPriority,
      dueAt,
    });
  };

  const submitGoal = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = draftGoalTitle.trim();
    if (!title) return;
    createGoal.mutate({ title, category: "دراسة", kind: "short", color: "violet" });
  };
  const submitEvent = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draftEventTitle.trim() || !draftEventAt) return;
    const startAt = new Date(draftEventAt);
    if (Number.isNaN(startAt.getTime())) {
      toast.error("تاريخ الموعد غير صالح.");
      return;
    }
    createEvent.mutate({
      title: draftEventTitle.trim(),
      type: "event",
      startAt,
      endAt: null,
      allDay: false,
      color: "violet",
    });
  };

  const learningSubjectId = profileSubjectIds.includes(learningSubject)
    ? learningSubject
    : profileSubjectIds[0] ?? "";
  const learningChoices = learningSubjectId ? getSIECheckpointChoices(learningSubjectId) : [];
  const selectedLesson = learningChoices.find(choice => choice.nodeId === learningLesson) ?? learningChoices[0];
  const progressKey = selectedLesson ? learningSubjectId + "|" + selectedLesson.nodeId : "";
  const profileSelection = (profile?.selection || {}) as Record<string, any>;
  const savedLessonSteps = selectedLesson
    ? (profileSelection.subjectLessonProgress?.[learningSubjectId]?.[selectedLesson.nodeId]?.completedSteps as string[] | undefined) ?? []
    : [];
  const currentLessonSteps = learningDraft.key === progressKey ? learningDraft.steps : savedLessonSteps;
  const learningStepOptions = [
    ["survey", "تصفّح الدرس"],
    ["question", "تحديد الأسئلة"],
    ["read", "القراءة والفهم"],
    ["recite", "الاسترجاع من الذاكرة"],
    ["review", "المراجعة والتثبيت"],
  ] as const;

  const hasReadError = tasksQuery.isError || goalsQuery.isError || calendarQuery.isError || profileQuery.isError;
  const activeMeta = layerMeta[layer];

  return (
    <section className="sf-ops-workspace mb-7" aria-label="مساحة التشغيل التفاعلية" data-testid="studyflow-live-workspace" data-workspace-mode="interactive">
      <div className="sf-ops-heading">
        <div>
          <p className="eyebrow">مساحة العمل التفاعلية</p>
          <h2>مساحة تشغيل خطتك</h2>
          <p>كل طبقة متصلة ببياناتها وإجراءاتها. اختر عقدة من المشهد أو افتح القسم مباشرة.</p>
        </div>
        <span className="sf-ops-live"><span />متصل ببيانات مساحتك</span>
      </div>

      {hasReadError && (
        <div className="sf-ops-warning" role="status">
          تعذّر تحديث بعض الطبقات. البيانات التي لم تُحمّل لن تُعرض كأنها صفر.
          <button type="button" onClick={() => void Promise.all([tasksQuery.refetch(), goalsQuery.refetch(), calendarQuery.refetch(), profileQuery.refetch()])}>إعادة المحاولة</button>
        </div>
      )}

      <div className="sf-ops-grid">
        <section className="sf-ops-scene-card">
          <div className="sf-ops-card-heading">
            <div><p>خريطة الوظائف</p><h3>خريطة الوظائف</h3></div>
            <span><Layers3 className="size-4" /> 6 طبقات مترابطة</span>
          </div>
          <FunctionScene nodes={nodes} selectedId={layer} onSelect={onSceneSelect} />
          <div className="sf-ops-node-list" aria-label="اختيار طبقة مساحة العمل">
            {nodes.map(node => (
              <button key={node.id} type="button" onClick={() => setLayer(node.id)} aria-pressed={layer === node.id} className={layer === node.id ? "is-selected" : ""}>
                <span style={{ background: "#" + node.color.toString(16).padStart(6, "0") }} />
                <b>{node.label}</b><small>{node.value}</small>
              </button>
            ))}
          </div>
          <p className="sf-ops-scene-footnote">المشهد نفسه قابل للاختيار؛ اضغط على أي عقدة ثلاثية الأبعاد أو استخدم أسماء الطبقات أسفله.</p>
        </section>

        <section className="sf-ops-detail-card" aria-live="polite">
          <div className="sf-ops-detail-heading">
            <div><p>{activeMeta.eyebrow}</p><h3>{activeMeta.title}</h3><span>{activeMeta.description}</span></div>
            {activeMeta.path && <Button type="button" variant="outline" size="sm" onClick={() => setLocation(activeMeta.path!)}>فتح القسم <ChevronLeft className="size-4" /></Button>}
          </div>

          {layer === "overview" && (
            <div className="sf-ops-layer-body">
              <div className="sf-ops-stat-grid">
                <Metric label="مهام مفتوحة" value={tasksQuery.isLoading ? "…" : hasReadError && tasksQuery.isError ? "—" : openTasks.length} hint="تحتاج إجراء" />
                <Metric label="متأخرة" value={tasksQuery.isLoading ? "…" : tasksQuery.isError ? "—" : lateTasks.length} hint="موعدها عدى" tone="warm" />
                <Metric label="أهداف نشطة" value={goalsQuery.isLoading ? "…" : goalsQuery.isError ? "—" : activeGoals.length} hint="وجهات قيد التنفيذ" />
                <Metric label="إنجاز المهام" value={tasksQuery.isLoading ? "…" : tasksQuery.isError ? "—" : completionRate + "%"} hint="من سجلات المهام" />
              </div>
              <div className="sf-ops-next">
                <span className="sf-ops-next-icon"><Sparkles className="size-5" /></span>
                <div><b>الخطوة التالية المقترحة</b><p>{lateTasks[0]?.title || openTasks[0]?.title || "لا توجد مهمة مفتوحة مسجلة الآن."}</p><small>{lateTasks.length ? "ابدأ بالمهمة المتأخرة قبل إضافة التزامات جديدة." : openTasks.length ? "ابدأ بأعلى مهمة أولوية، ثم حدّث حالتها بعد التنفيذ." : "أضف مهمة صغيرة أو أنشئ خطة من المخطط الذكي."}</small></div>
              </div>
              <div className="sf-ops-quick-actions">
                <button type="button" onClick={() => setLayer("tasks")}><ListChecks />إدارة المهام</button>
                <button type="button" onClick={() => setLayer("schedule")}><CalendarDays />عرض الجدول</button>
                <button type="button" onClick={() => setLayer("learning")}><GraduationCap />مراجعة التراكم</button>
              </div>
            </div>
          )}

          {layer === "tasks" && (
            <div className="sf-ops-layer-body">
              <form className="sf-ops-capture" onSubmit={submitTask}>
                <div className="sf-ops-capture-title"><Plus className="size-4" /><b>التقاط سريع لمهمة</b><span>إضافة سريعة</span></div>
                <input value={draftTitle} onChange={event => setDraftTitle(event.target.value)} maxLength={220} placeholder="اكتب المهمة… مثل: حل 20 سؤالًا على الدرس" aria-label="عنوان المهمة الجديدة" />
                <div className="sf-ops-capture-fields">
                  <select value={draftCategory} onChange={event => setDraftCategory(event.target.value)} aria-label="تصنيف المهمة">
                    <option value="مذاكرة">مذاكرة</option><option value="مراجعة">مراجعة</option><option value="حل">حل وتدريب</option><option value="شخصي">شخصي</option>
                  </select>
                  <select value={draftPriority} onChange={event => setDraftPriority(event.target.value as "low" | "medium" | "high")} aria-label="أولوية المهمة">
                    <option value="high">أولوية عالية</option><option value="medium">أولوية متوسطة</option><option value="low">مرنة</option>
                  </select>
                  <input type="date" value={draftDueDate} onChange={event => setDraftDueDate(event.target.value)} aria-label="موعد المهمة" />
                  <Button type="submit" disabled={!draftTitle.trim() || createTask.isPending} size="sm"><Plus className="size-4" />إضافة</Button>
                </div>
              </form>
              <div className="sf-ops-filter-row">
                {(["open", "today", "late", "done"] as const).map(filter => <button key={filter} type="button" onClick={() => setTaskFilter(filter)} className={taskFilter === filter ? "is-active" : ""}>{filter === "open" ? "المفتوحة" : filter === "today" ? "اليوم" : filter === "late" ? "المتأخرة" : "المكتملة"}</button>)}
                <span>{visibleTasks.length} ظاهرة</span>
              </div>
              {tasksQuery.isLoading ? <PanelMessage>تحميل المهام…</PanelMessage> : tasksQuery.isError ? <PanelMessage>تعذّر تحميل المهام.</PanelMessage> : visibleTasks.length ? (
                <div className="sf-ops-task-list">
                  {visibleTasks.map(task => (
                    <article key={task.id} className={task.status === "done" ? "is-done" : ""}>
                      <button type="button" className="sf-ops-task-check" aria-label={task.status === "done" ? "إعادة فتح المهمة" : "إكمال المهمة"} disabled={toggleTask.isPending} onClick={() => toggleTask.mutate({ id: task.id, done: task.status !== "done" })}>{task.status === "done" ? <Check className="size-4" /> : null}</button>
                      <div className="sf-ops-task-copy"><b>{task.title}</b><span>{task.category || "عام"} · {priorityLabel[task.priority] || "متوسطة"} · {formatDate(task.dueAt)}</span></div>
                      <span className={"sf-ops-priority sf-ops-priority-" + (task.priority || "medium")}>{priorityLabel[task.priority] || "متوسطة"}</span>
                    </article>
                  ))}
                </div>
              ) : <PanelMessage>لا توجد مهام في هذا العرض. غيّر التصفية أو أضف مهمة جديدة.</PanelMessage>}
            </div>
          )}

          {layer === "goals" && (
            <div className="sf-ops-layer-body">
              <form className="sf-ops-capture" onSubmit={submitGoal}>
                <div className="sf-ops-capture-title"><Target className="size-4" /><b>إنشاء هدف سريع</b><span>إنشاء هدف</span></div>
                <div className="sf-ops-capture-fields sf-ops-create-single">
                  <input value={draftGoalTitle} onChange={event => setDraftGoalTitle(event.target.value)} maxLength={180} placeholder="ما النتيجة التي تريد الوصول إليها؟" aria-label="عنوان الهدف الجديد" />
                  <Button type="submit" disabled={!draftGoalTitle.trim() || createGoal.isPending} size="sm"><Plus className="size-4" />إنشاء هدف</Button>
                </div>
              </form>
              {goalsQuery.isLoading ? <PanelMessage>تحميل الأهداف…</PanelMessage> : goalsQuery.isError ? <PanelMessage>تعذّر تحميل الأهداف.</PanelMessage> : activeGoals.length ? (
                <div className="sf-ops-goal-list">{activeGoals.slice(0, 6).map(goal => {
                  const progress = Math.max(0, Math.min(100, Number(goal.progress) || 0));
                  return <article key={goal.id}><div><b>{goal.title}</b><span>{goal.taskCount} مهام · {goal.completedTaskCount} مكتملة</span></div><strong>{progress}%</strong><div className="sf-ops-progress"><span style={{ width: progress + "%" }} /></div></article>;
                })}</div>
              ) : <PanelMessage>لا توجد أهداف نشطة مسجلة بعد.</PanelMessage>}
              <button type="button" className="sf-ops-full-link" onClick={() => setLocation("/goals")}>إدارة الأهداف والمراحل <ChevronLeft className="size-4" /></button>
            </div>
          )}

          {layer === "schedule" && (
            <div className="sf-ops-layer-body">
              <form className="sf-ops-capture" onSubmit={submitEvent}>
                <div className="sf-ops-capture-title"><CalendarDays className="size-4" /><b>إضافة موعد</b><span>تفاصيل الموعد</span></div>
                <div className="sf-ops-capture-fields sf-ops-create-single">
                  <input value={draftEventTitle} onChange={event => setDraftEventTitle(event.target.value)} maxLength={180} placeholder="عنوان الموعد أو جلسة المذاكرة" aria-label="عنوان الموعد الجديد" />
                  <input type="datetime-local" value={draftEventAt} onChange={event => setDraftEventAt(event.target.value)} aria-label="تاريخ ووقت الموعد" />
                  <Button type="submit" disabled={!draftEventTitle.trim() || !draftEventAt || createEvent.isPending} size="sm"><Plus className="size-4" />حفظ</Button>
                </div>
              </form>
              {calendarQuery.isLoading ? <PanelMessage>تحميل المواعيد…</PanelMessage> : calendarQuery.isError ? <PanelMessage>تعذّر تحميل المواعيد.</PanelMessage> : upcomingEvents.length ? (
                <div className="sf-ops-agenda">{upcomingEvents.map(event => <article key={event.id}><time>{formatDate(event.startAt)}</time><span className={"sf-ops-event-mark sf-ops-event-" + event.source} /><div><b>{event.title}</b><small>{event.source === "task" ? "مهمة مرتبطة بموعد" : event.type === "study" ? "جلسة مذاكرة" : "موعد مسجل"}</small></div></article>)}</div>
              ) : <PanelMessage>لا توجد مواعيد مستقبلية مسجلة. أضف موعدًا من التقويم أو حدّد موعدًا لمهمة.</PanelMessage>}
              <button type="button" className="sf-ops-full-link" onClick={() => setLocation("/calendar")}>فتح التقويم الكامل <ChevronLeft className="size-4" /></button>
            </div>
          )}

          {layer === "learning" && (
            <div className="sf-ops-layer-body">
              {profileQuery.isLoading ? <PanelMessage>تحميل الملف الدراسي…</PanelMessage> : profileQuery.isError ? <PanelMessage>تعذّر تحميل الملف الدراسي.</PanelMessage> : profileSubjectIds.length ? (
                <>
                  <div className="sf-ops-subject-list">{profileSubjectIds.map((subjectId: string) => {
                    const selection = (profile.selection || {}) as Record<string, any>;
                    const teacherId = selection.teacherChoices?.[subjectId] || profile.teacherSelections?.[subjectId];
                    const teacher = teacherId ? getSIETeacher(teacherId) : undefined;
                    const frontier = selection.teacherFrontiers?.[subjectId] || selection.teacherProgressState?.[subjectId]?.studentAttendedFrontier;
                    const checkpoint = getSIECheckpointChoices(subjectId).find(item => item.nodeId === frontier);
                    const subject = getSIESubject(subjectId);
                    const backlog = profile.backlog?.[subjectId] || profile.backlog?.[subject?.nameAr || ""] || 0;
                    return <article key={subjectId}><span className="sf-ops-subject-icon"><GraduationCap className="size-4" /></span><div><b>{subject?.nameAr || subjectId}</b><small>{teacher?.nameAr || "لم يحدد مدرس"} · {checkpoint?.title || "موضع التقدم غير محدد"}</small></div><strong>{backlog} تراكم</strong></article>;
                  })}</div>
                  {learningChoices.length > 0 && (
                    <section className="sf-ops-learning-editor">
                      <div className="sf-ops-capture-title"><GraduationCap className="size-4" /><b>تحديث تقدم درس</b><span>متابعة الدرس</span></div>
                      <div className="sf-ops-learning-selects">
                        <select value={learningSubjectId} onChange={event => { setLearningSubject(event.target.value); setLearningLesson(""); setLearningDraft({ key: "", steps: [] }); }} aria-label="اختيار المادة">
                          {profileSubjectIds.map((subjectId: string) => <option key={subjectId} value={subjectId}>{getSIESubject(subjectId)?.nameAr || subjectId}</option>)}
                        </select>
                        <select value={selectedLesson?.nodeId || ""} onChange={event => { setLearningLesson(event.target.value); setLearningDraft({ key: "", steps: [] }); }} aria-label="اختيار الدرس">
                          {learningChoices.map(choice => <option key={choice.nodeId} value={choice.nodeId}>{choice.title}</option>)}
                        </select>
                      </div>
                      {selectedLesson && <div className="sf-ops-sqrr">
                        {learningStepOptions.map(([step, label]) => <label key={step}>
                          <input type="checkbox" checked={currentLessonSteps.includes(step)} onChange={event => {
                            const next = event.target.checked
                              ? [...currentLessonSteps, step]
                              : currentLessonSteps.filter(item => item !== step);
                            setLearningDraft({ key: progressKey, steps: next });
                          }} />
                          <span>{label}</span>
                        </label>)}
                        <Button type="button" size="sm" disabled={saveLessonProgress.isPending} onClick={() => saveLessonProgress.mutate({
                          subjectId: learningSubjectId,
                          lessonId: selectedLesson.nodeId,
                          completedSteps: currentLessonSteps as ("survey" | "question" | "read" | "recite" | "review")[],
                          difficulty: "unknown",
                          notes: "",
                        })}>حفظ تقدم الدرس</Button>
                      </div>}
                    </section>
                  )}
                </>
              ) : <PanelMessage>أكمل ملفك الدراسي لتظهر المواد ونقاط التقدم هنا.</PanelMessage>}
              <p className="sf-ops-hint">التراكم اليدوي مؤشر يحتاج تأكيدًا؛ لا نحوله تلقائيًا إلى دروس محددة ما لم تتوفر نقطة منهج موثوقة.</p>
              <button type="button" className="sf-ops-full-link" onClick={() => setLocation("/study")}>فتح مساحة التعلّم <ChevronLeft className="size-4" /></button>
            </div>
          )}

          {layer === "insights" && (
            <div className="sf-ops-layer-body">
              <div className="sf-ops-stat-grid sf-ops-stat-grid-three">
                <Metric label="إجمالي المهام" value={tasksQuery.isError ? "—" : tasks.length} hint="المسجل في النظام" />
                <Metric label="مكتملة" value={tasksQuery.isError ? "—" : doneTasks.length} hint="حالة المهمة = مكتملة" />
                <Metric label="متأخرة" value={tasksQuery.isError ? "—" : lateTasks.length} hint="موعد مضى ولم تُغلق" tone="warm" />
              </div>
              <div className="sf-ops-insight-note"><BarChart3 className="size-5" /><div><b>ماذا تعني هذه المؤشرات؟</b><p>هي قياسات لسلوك تنفيذ المهام والمواعيد المحفوظة فقط. لا تدّعي قياس الفهم أو إتقان المنهج؛ ذلك يحتاج نتائج اختبارات وتقييمات أكاديمية.</p></div></div>
              <button type="button" className="sf-ops-full-link" onClick={() => setLocation("/analytics")}>فتح التحليل التفصيلي <ChevronLeft className="size-4" /></button>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

function Metric({ label, value, hint, tone = "default" }: { label: string; value: string | number; hint: string; tone?: "default" | "warm" }) {
  return <article className={"sf-ops-metric " + (tone === "warm" ? "is-warm" : "")}><small>{label}</small><b>{value}</b><span>{hint}</span></article>;
}

function PanelMessage({ children }: { children: ReactHooks.ReactNode }) {
  return <div className="sf-ops-panel-message">{children}</div>;
}

function FunctionScene({ nodes, selectedId, onSelect }: { nodes: SceneNode[]; selectedId: LayerId; onSelect: (id: LayerId) => void }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const callbackRef = useRef(onSelect);
  const selectedRef = useRef(selectedId);
  const groupsRef = useRef<Map<LayerId, THREE.Group>>(new Map());
  const reducedMotionRef = useRef(false);

  callbackRef.current = onSelect;
  selectedRef.current = selectedId;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer | null = null;
    let frame = 0;
    let observer: ResizeObserver | null = null;
    let disposed = false;
    let ambientTimeline: gsap.core.Timeline | null = null;
    const nodeGroups = new Map<LayerId, THREE.Group>();
    const ownedGeometries: THREE.BufferGeometry[] = [];
    const ownedMaterials: THREE.Material[] = [];

    try {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 30);
      camera.position.set(0, 0, 6.4);

      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
        precision: "mediump",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.display = "block";
      renderer.domElement.setAttribute("aria-hidden", "true");
      host.appendChild(renderer.domElement);

      scene.add(new THREE.AmbientLight(0xffffff, 1.55));
      const keyLight = new THREE.PointLight(0xc9a56a, 22, 12);
      keyLight.position.set(-2.5, 2.2, 3);
      scene.add(keyLight);
      const cyanLight = new THREE.PointLight(0x8999a7, 14, 12);
      cyanLight.position.set(2.5, -1.6, 2);
      scene.add(cyanLight);

      const center = new THREE.Group();
      scene.add(center);
      const coreGeometry = new THREE.IcosahedronGeometry(0.53, 2);
      const coreMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x4d4741,
        metalness: 0.25,
        roughness: 0.18,
        clearcoat: 1,
        emissive: 0x211f1c,
        emissiveIntensity: 0.55,
      });
      ownedGeometries.push(coreGeometry);
      ownedMaterials.push(coreMaterial);
      center.add(new THREE.Mesh(coreGeometry, coreMaterial));

      const ringGeometry = new THREE.TorusGeometry(0.9, 0.012, 8, 100);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0xc9a56a,
        transparent: true,
        opacity: 0.7,
      });
      ownedGeometries.push(ringGeometry);
      ownedMaterials.push(ringMaterial);
      const centerRing = new THREE.Mesh(ringGeometry, ringMaterial);
      centerRing.rotation.x = 1.05;
      center.add(centerRing);

      const hitTargets: THREE.Mesh[] = [];
      const linkPositions: number[] = [];
      nodes.forEach((node, index) => {
        const angle = (index / nodes.length) * Math.PI * 2 - Math.PI / 2;
        const group = new THREE.Group();
        group.position.set(
          Math.cos(angle) * 2.05,
          Math.sin(angle) * 1.35,
          index % 2 ? -0.12 : 0.12,
        );
        group.userData.layerId = node.id;

        const color = new THREE.Color(node.color);
        const geometry = new THREE.DodecahedronGeometry(0.32, 1);
        const material = new THREE.MeshPhysicalMaterial({
          color,
          emissive: color,
          emissiveIntensity: node.id === selectedRef.current ? 0.3 : 0.1,
          metalness: 0.3,
          roughness: 0.2,
          clearcoat: 1,
        });
        ownedGeometries.push(geometry);
        ownedMaterials.push(material);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData.layerId = node.id;
        group.add(mesh);

        const haloGeometry = new THREE.TorusGeometry(0.42, 0.009, 7, 70);
        const haloMaterial = new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: node.id === selectedRef.current ? 0.95 : 0.45,
        });
        ownedGeometries.push(haloGeometry);
        ownedMaterials.push(haloMaterial);
        const halo = new THREE.Mesh(haloGeometry, haloMaterial);
        halo.rotation.x = Math.PI / 2.4;
        group.add(halo);

        scene.add(group);
        nodeGroups.set(node.id, group);
        hitTargets.push(mesh);
        linkPositions.push(0, 0, 0, group.position.x, group.position.y, group.position.z);
      });

      groupsRef.current = nodeGroups;
      const linkGeometry = new THREE.BufferGeometry();
      linkGeometry.setAttribute("position", new THREE.Float32BufferAttribute(linkPositions, 3));
      const linksMaterial = new THREE.LineBasicMaterial({
        color: 0x5c554d,
        transparent: true,
        opacity: 0.28,
      });
      ownedGeometries.push(linkGeometry);
      ownedMaterials.push(linksMaterial);
      scene.add(new THREE.LineSegments(linkGeometry, linksMaterial));

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      const updatePointer = (event: PointerEvent | MouseEvent) => {
        const bounds = renderer!.domElement.getBoundingClientRect();
        pointer.x = ((event.clientX - bounds.left) / Math.max(bounds.width, 1)) * 2 - 1;
        pointer.y = -(((event.clientY - bounds.top) / Math.max(bounds.height, 1)) * 2 - 1);
        raycaster.setFromCamera(pointer, camera);
      };
      const onPointerMove = (event: PointerEvent) => {
        updatePointer(event);
        const hit = raycaster.intersectObjects(hitTargets, false)[0];
        renderer!.domElement.style.cursor = hit ? "pointer" : "grab";
      };
      const onClick = (event: MouseEvent) => {
        updatePointer(event);
        const hit = raycaster.intersectObjects(hitTargets, false)[0];
        const layerId = hit?.object.userData.layerId as LayerId | undefined;
        if (layerId) callbackRef.current(layerId);
      };
      renderer.domElement.addEventListener("pointermove", onPointerMove, { passive: true });
      renderer.domElement.addEventListener("click", onClick);

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      reducedMotionRef.current = reduceMotion;

      const resize = () => {
        if (!renderer || disposed) return;
        const width = Math.max(1, host.clientWidth);
        const height = Math.max(1, host.clientHeight);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.position.z = width < 420 ? 7.6 : 6.4;
        camera.updateProjectionMatrix();
      };
      resize();
      observer = new ResizeObserver(resize);
      observer.observe(host);

      if (!reduceMotion) {
        ambientTimeline = gsap.timeline({ repeat: -1, yoyo: true });
        ambientTimeline
          .to(center.rotation, { y: 0.3, duration: 5.8, ease: "sine.inOut" })
          .to(center.rotation, { x: -0.12, duration: 4.2, ease: "sine.inOut" }, 0);

        nodeGroups.forEach((group, index) => {
          gsap.to(group.position, {
            y: group.position.y + (index % 2 === 0 ? 0.09 : -0.09),
            duration: 2.4 + index * 0.17,
            delay: index * 0.13,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
          });
        });
      }

      const render = () => {
        if (disposed || !renderer) return;
        renderer.render(scene, camera);
        if (!reduceMotion) frame = window.requestAnimationFrame(render);
      };
      render();

      return () => {
        disposed = true;
        window.cancelAnimationFrame(frame);
        observer?.disconnect();
        ambientTimeline?.kill();
        renderer?.domElement.removeEventListener("pointermove", onPointerMove);
        renderer?.domElement.removeEventListener("click", onClick);
        nodeGroups.forEach(group => {
          gsap.killTweensOf(group.position);
          gsap.killTweensOf(group.scale);
        });
        gsap.killTweensOf(center.rotation);
        groupsRef.current.clear();
        ownedGeometries.forEach(geometry => geometry.dispose());
        ownedMaterials.forEach(material => material.dispose());
        renderer?.dispose();
        renderer?.domElement.remove();
      };
    } catch (error) {
      console.error("StudyFlow functional scene unavailable:", error);
      disposed = true;
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      ambientTimeline?.kill();
      renderer?.dispose();
      renderer?.domElement.remove();
      host.replaceChildren();
      return;
    }
  }, [nodes]);

  useEffect(() => {
    groupsRef.current.forEach((group, id) => {
      const scale = selectedId === id ? 1.2 : 1;
      gsap.to(group.scale, {
        x: scale,
        y: scale,
        z: scale,
        duration: reducedMotionRef.current ? 0 : 0.34,
        ease: "power3.out",
        overwrite: "auto",
      });
    });
  }, [selectedId]);

  return (
    <div className="sf-ops-scene-viewport">
      <div
        ref={hostRef}
        className="sf-ops-scene-canvas"
        aria-label="مشهد ثلاثي الأبعاد تفاعلي لوظائف StudyFlow"
        role="img"
      />
      <div className="sf-ops-scene-hint"><span />اضغط على عقدة لاختيار مساحة العمل</div>
    </div>
  );
}
