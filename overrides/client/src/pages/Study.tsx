import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { getSIECheckpointBranches, getSIECheckpointChoices, getSIECheckpointChoiceDisplayLabel, getSIECheckpointChoiceTypeLabel, getSIESubject, getSIETeacher, getSIETeachersForSubject, type SIESystemId } from "@shared/sie-catalog";
import { calculateLearningGap } from "@shared/sie-learning-progress";
import { Activity, BookOpenText, Check, CircleHelp, Eye, Gauge, Mic2, RefreshCcw, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";

const steps = [
  { id: "survey", title: "مسح", hint: "استكشف عنوان الدرس وأفكاره الرئيسية قبل البدء.", icon: Eye },
  { id: "question", title: "تساؤل", hint: "حوّل العناوين إلى أسئلة تريد أن تعرف إجابتها.", icon: CircleHelp },
  { id: "read", title: "قراءة وفهم", hint: "ادرس الدرس بتركيز وأجب عن أسئلتك بالأدلة والأمثلة.", icon: BookOpenText },
  { id: "recite", title: "تسميع", hint: "استرجع الفكرة دون النظر إلى المصدر، شفهيًا أو كتابة.", icon: Mic2 },
  { id: "review", title: "مراجعة", hint: "راجع إجاباتك وحدد نقطة تحتاج إلى تثبيت لاحقًا.", icon: RefreshCcw },
] as const;
type StepId = typeof steps[number]["id"];
type LessonProgress = { completedSteps?: StepId[]; difficulty?: "unknown" | "easy" | "medium" | "hard"; notes?: string; updatedAt?: string };

export default function Study() {
  const utils = trpc.useUtils();
  const profile = trpc.studentProfile.get.useQuery();
  const learning = trpc.learning.get.useQuery();
  const activeExternalSession = trpc.learning.activeExternalSession.useQuery();
  const [sessionNow, setSessionNow] = useState(Date.now());
  const [teacherChoiceDrafts, setTeacherChoiceDrafts] = useState<Record<string, string>>({});
  const [markSessionLessonCompleted, setMarkSessionLessonCompleted] = useState(false);
  const initialStudyParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const [subjectId, setSubjectId] = useState(initialStudyParams?.get("subject") || "");
  const [branchId, setBranchId] = useState(initialStudyParams?.get("branch") || "");
  const [lessonId, setLessonId] = useState(initialStudyParams?.get("lesson") || "");
  const [completedSteps, setCompletedSteps] = useState<StepId[]>([]);
  const [difficulty, setDifficulty] = useState<"unknown" | "easy" | "medium" | "hard">("unknown");
  const [notes, setNotes] = useState("");
  const subjects = profile.data?.subjectIds || [];
  const subjectChoices = useMemo(() => getSIECheckpointChoices(subjectId), [subjectId]);
  const branches = useMemo(() => getSIECheckpointBranches(subjectId), [subjectId]);
  const currentBranch = branches.find(branch => branch.branchId === branchId) ?? branches[0];
  const branchChoices = currentBranch?.choices ?? [];
  const lessons = branchChoices;
  const currentBranchId = currentBranch?.branchId ?? "";
  const currentBranchPointLabel = currentBranch?.branchType === "official_section" ? "موضوع" : "درس";
  const selection = (profile.data?.selection || {}) as Record<string, unknown>;
  const progressMap = (selection.subjectLessonProgress || {}) as Record<string, Record<string, LessonProgress>>;
  const currentProgress = progressMap[subjectId] && progressMap[subjectId][lessonId];

  type CourseStatus = "not_started" | "in_progress" | "caught_up" | "needs_review";
  const courseProgressMap = (selection.learningCourseProgress || {}) as Record<string, any>;
  const currentCourseProgress = courseProgressMap[subjectId] || {};
  const branchProgressMap = (currentCourseProgress.branches || {}) as Record<string, Record<string, any>>;
  const currentBranchProgress = currentBranchId ? branchProgressMap[currentBranchId] || {} : {};
  const branchGapMap = ((learning.data as any)?.gapByBranch?.[subjectId] || {}) as Record<string, any>;
  const savedTeacherId = ((selection.teacherChoices || {}) as Record<string, string>)[subjectId]
    || (profile.data?.teacherSelections || {})[subjectId];
  const selectedTeacherId = Object.prototype.hasOwnProperty.call(teacherChoiceDrafts, subjectId)
    ? (teacherChoiceDrafts[subjectId] === "__NONE__" ? undefined : teacherChoiceDrafts[subjectId])
    : (savedTeacherId && savedTeacherId !== "__SKIP__" ? savedTeacherId : undefined);
  const selectedTeacher = selectedTeacherId ? getSIETeacher(selectedTeacherId) : undefined;
  const systemId: SIESystemId = selection.systemId === "EG_GENERAL_SECONDARY"
    ? "EG_GENERAL_SECONDARY"
    : selection.systemId === "EG_BACCALAUREATE"
      ? "EG_BACCALAUREATE"
      : profile.data?.educationSystem === "general_secondary"
        ? "EG_GENERAL_SECONDARY"
        : "EG_BACCALAUREATE";
  const teacherOptions = useMemo(() => {
    const eligible = getSIETeachersForSubject(subjectId, systemId);
    const selected = selectedTeacherId ? getSIETeacher(selectedTeacherId) : undefined;
    if (selected && selected.subjectIds.includes(subjectId) && !eligible.some(item => item.teacherId === selected.teacherId)) {
      return [selected, ...eligible];
    }
    return eligible;
  }, [subjectId, systemId, selectedTeacherId]);
  const [lastCompletedLessonId, setLastCompletedLessonId] = useState("");
  const [teacherTeachingFrontierId, setTeacherTeachingFrontierId] = useState("__UNKNOWN__");
  const [schoolClassFrontierId, setSchoolClassFrontierId] = useState("__UNKNOWN__");
  const [schoolClassEvidenceSource, setSchoolClassEvidenceSource] = useState<"unknown" | "teacher_confirmed" | "classmate_confirmed" | "class_notes" | "class_group">("unknown");
  const [teacherCourseFrontier, setTeacherCourseFrontier] = useState("");
  const [courseStatus, setCourseStatus] = useState<CourseStatus>("not_started");
  const [estimatedMinutes, setEstimatedMinutes] = useState(45);
  const [courseDifficulty, setCourseDifficulty] = useState<"unknown" | "easy" | "medium" | "hard">("unknown");
  const [courseNotes, setCourseNotes] = useState("");
  const [learningObstacle, setLearningObstacle] = useState("");

  const currentGap = calculateLearningGap(branchChoices, {
    studentFrontierId: lastCompletedLessonId || null,
    teacherTeachingFrontierId,
    schoolClassFrontierId,
  });


  useEffect(() => {
    if (!subjectId && subjects.length) setSubjectId(subjects[0]);
  }, [subjects, subjectId]);

  useEffect(() => {
    if (!branches.length) {
      setBranchId("");
      return;
    }
    if (!branches.some(branch => branch.branchId === branchId)) setBranchId(branches[0].branchId);
  }, [subjectId, branches, branchId]);

  useEffect(() => {
    if (!branchChoices.length) {
      setLessonId("");
      return;
    }
    if (!branchChoices.some(lesson => lesson.nodeId === lessonId)) {
      setLessonId(branchChoices[0].nodeId);
    }
  }, [subjectId, currentBranchId, branchChoices, lessonId]);

  useEffect(() => {
    setCompletedSteps(currentProgress?.completedSteps || []);
    setDifficulty(currentProgress?.difficulty || "unknown");
    setNotes(currentProgress?.notes || "");
  }, [subjectId, lessonId, currentProgress?.updatedAt]);

  useEffect(() => {
    const legacyTeacherState = ((selection.teacherProgressState || {}) as Record<string, Record<string, any>>)[subjectId] || {};
    const subjectLessonRecords = progressMap[subjectId] || {};
    const latestSq3rCompleted = [...branchChoices].reverse().find(lesson => {
      const record = subjectLessonRecords[lesson.nodeId];
      return Array.isArray(record?.completedSteps) && record.completedSteps.length === 5;
    })?.nodeId;
    const belongsToCurrentBranch = (value: unknown): value is string =>
      typeof value === "string" &&
      (value === "__NOT_STARTED__" ||
        branchChoices.some(lesson => lesson.nodeId === value));
    const legacyStudentFrontier = currentCourseProgress.lastCompletedLessonId
      ?? legacyTeacherState.studentAttendedFrontier;
    const studentFrontier = Object.prototype.hasOwnProperty.call(currentBranchProgress, "lastCompletedLessonId")
      ? currentBranchProgress.lastCompletedLessonId
      : belongsToCurrentBranch(legacyStudentFrontier)
        ? legacyStudentFrontier
        : latestSq3rCompleted ?? "__UNKNOWN__";
    const branchTeacherMatchesSelection = !currentBranchProgress.teacherId
      || currentBranchProgress.teacherId === selectedTeacherId;
    const teacherFrontier = !branchTeacherMatchesSelection
      ? "__UNKNOWN__"
      : Object.prototype.hasOwnProperty.call(currentBranchProgress, "teacherTeachingFrontierId")
        ? currentBranchProgress.teacherTeachingFrontierId
        : belongsToCurrentBranch(currentCourseProgress.teacherTeachingFrontierId)
          ? currentCourseProgress.teacherTeachingFrontierId
          : "__UNKNOWN__";
    const schoolFrontier = Object.prototype.hasOwnProperty.call(currentBranchProgress, "schoolClassFrontierId")
      ? currentBranchProgress.schoolClassFrontierId
      : belongsToCurrentBranch(currentCourseProgress.schoolClassFrontierId)
        ? currentCourseProgress.schoolClassFrontierId
        : "__UNKNOWN__";
    setLastCompletedLessonId(studentFrontier || "__UNKNOWN__");
    setTeacherTeachingFrontierId(teacherFrontier || "__UNKNOWN__");
    setSchoolClassFrontierId(schoolFrontier || "__UNKNOWN__");
    setSchoolClassEvidenceSource(currentBranchProgress.schoolClassFrontierEvidenceSource || "unknown");
    setTeacherCourseFrontier(branchTeacherMatchesSelection ? currentCourseProgress.teacherCourseFrontier || "" : "");
    setCourseStatus(currentCourseProgress.status || "not_started");
    setEstimatedMinutes(Number(currentCourseProgress.estimatedMinutesPerLesson ?? 45));
    setCourseDifficulty(currentCourseProgress.difficulty || "unknown");
    setCourseNotes(currentBranchProgress.notes ?? currentCourseProgress.notes ?? "");
    setLearningObstacle(currentCourseProgress.obstacle ?? profile.data?.obstacle ?? "");
  }, [subjectId, currentBranchId, selectedTeacherId, currentBranchProgress.updatedAt, currentCourseProgress.updatedAt, profile.data?.obstacle, branches, branchChoices, progressMap]);


  const saveProgress = trpc.study.saveSubjectLessonProgress.useMutation({
    onSuccess: async () => {
      await utils.studentProfile.get.invalidate();
      toast.success("تم حفظ تقدمك في الدرس.");
    },
    onError: error => toast.error(error.message),
  });

  const saveCourseProgress = trpc.learning.updateCourseProgress.useMutation({
    onSuccess: async () => {
      setTeacherChoiceDrafts(current => {
        const next = { ...current };
        delete next[subjectId];
        return next;
      });
      await Promise.all([utils.studentProfile.get.invalidate(), utils.learning.get.invalidate()]);
      toast.success("تم تحديث التراكم والتقدم الدراسي.");
    },
    onError: error => toast.error(error.message),
  });
  const startExternalSession = trpc.learning.startExternalSession.useMutation({
    onSuccess: async () => {
      setMarkSessionLessonCompleted(false);
      await utils.learning.activeExternalSession.invalidate();
      await utils.studentProfile.get.invalidate();
      toast.success("بدأت جلسة المذاكرة الخارجية. يمكنك الانتقال إلى تطبيق المدرس أو ملف PDF.");
    },
    onError: error => toast.error(error.message),
  });

  const reviewRecommendations = trpc.teachers.recommendReviews.useMutation({
    onError: error => toast.error(error.message || "تعذّر البحث عن مراجعات لهذا الفرع."),
  });
  const finishExternalSession = trpc.learning.finishExternalSession.useMutation({
    onSuccess: async result => {
      await utils.learning.activeExternalSession.invalidate();
      await Promise.all([utils.studentProfile.get.invalidate(), utils.learning.get.invalidate()]);
      const minutes = Math.floor(result.durationSeconds / 60);
      toast.success(result.lessonMarkedCompleted
        ? `انتهت الجلسة: ${minutes} دقيقة، وتم تحديث موضعك في المنهج.`
        : `انتهت الجلسة: ${minutes} دقيقة. لم يتم تغيير موضع المنهج.`);
      if (result.requiresTimeReview) toast.warning("الجلسة تجاوزت 12 ساعة؛ تم تسجيل الحد الأعلى فقط.");
    },
    onError: error => toast.error(error.message),
  });

  const submitCourseProgress = () => {
    if (!subjectId) return;
    saveCourseProgress.mutate({
      subjectId,
      branchId: currentBranchId,
      teacherId: selectedTeacherId || null,
      lastCompletedLessonId: lastCompletedLessonId || "__UNKNOWN__",
      teacherTeachingFrontierId,
      schoolClassFrontierId,
      schoolClassFrontierEvidenceSource: schoolClassEvidenceSource,
      teacherCourseFrontier: teacherCourseFrontier.trim(),
      status: courseStatus,
      estimatedMinutesPerLesson: Math.max(5, Math.min(480, estimatedMinutes)),
      difficulty: courseDifficulty,
      notes: courseNotes,
      obstacle: learningObstacle,
    });
  };

  const beginExternalStudy = () => {
    if (!subjectId || !currentBranchId || !lessonId) {
      toast.error("اختر المادة والفرع والدرس أولًا.");
      return;
    }
    startExternalSession.mutate({
      subjectId,
      branchId: currentBranchId,
      lessonId,
    });
  };

  const endExternalStudy = () => {
    const session = activeExternalSession.data;
    if (!session?.sessionId) return;
    finishExternalSession.mutate({
      sessionId: session.sessionId,
      markLessonCompleted: markSessionLessonCompleted,
    });
  };

  const updateProgress = (nextSteps: StepId[], nextDifficulty = difficulty, nextNotes = notes) => {
    if (!subjectId || !lessonId) return;
    setCompletedSteps(nextSteps);
    saveProgress.mutate({
      subjectId,
      lessonId,
      completedSteps: nextSteps,
      difficulty: nextDifficulty,
      notes: nextNotes,
    });
  };

  const toggleStep = (stepId: StepId) => {
    const next = completedSteps.includes(stepId)
      ? completedSteps.filter(item => item !== stepId)
      : [...completedSteps, stepId];
    updateProgress(next);
  };

  const subjectName = (getSIESubject(subjectId)?.nameAr || subjectId);
  const doneCount = completedSteps.length;
  const completion = Math.round((doneCount / steps.length) * 100);
  const selectedLesson = lessons.find(item => item.nodeId === lessonId);
  const externalSession = activeExternalSession.data;
  const externalSessionElapsed = externalSession?.startedAt
    ? Math.max(0, Math.floor((sessionNow - Date.parse(externalSession.startedAt)) / 1_000))
    : 0;
  const formatSessionDuration = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3_600);
    const minutes = Math.floor((totalSeconds % 3_600) / 60);
    const seconds = totalSeconds % 60;
    return [hours, minutes, seconds].map((value, index) =>
      index === 0 && value === 0 ? null : String(value).padStart(2, "0")
    ).filter(Boolean).join(":") || "00:00";
  };
  const externalSessionSubjectName = externalSession ? getSIESubject(externalSession.subjectId)?.nameAr || externalSession.subjectId : "";
  const externalSessionLessonTitle = externalSession
    ? getSIECheckpointChoices(externalSession.subjectId).find(item => item.nodeId === externalSession.lessonId)?.title || "درس غير معروف"
    : "";

  useEffect(() => {
    if (!externalSession?.startedAt) {
      setSessionNow(Date.now());
      return;
    }
    const update = () => setSessionNow(Date.now());
    update();
    const interval = window.setInterval(update, 1_000);
    return () => window.clearInterval(interval);
  }, [externalSession?.sessionId, externalSession?.startedAt]);

  return (
    <DashboardLayout title="المذاكرة وذكاء التقدم" description="تابع تقدمك وتراكمك، ثم استخدم SQ3R لتحويل كل درس إلى خطوات تعلم قابلة للقياس.">
      {profile.isError && <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm">تعذّر تحميل ملفك الدراسي. <button className="font-bold underline" onClick={() => void profile.refetch()}>إعادة المحاولة</button></div>}
      <section className="app-card mb-5 overflow-hidden rounded-2xl">
        <div className="border-b border-border/70 bg-gradient-to-l from-secondary/65 to-card p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary"><BookOpenText className="size-5" /></span>
              <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">CURRICULUM PICKER</p><h2 className="font-bold">حدد مكانك في المنهج</h2><p className="text-xs text-muted-foreground">ثلاث خطوات واضحة: المادة، الفرع، ثم الدرس.</p></div>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
              <span className="rounded-lg bg-primary/10 px-2.5 py-1.5 text-primary">1 المادة</span><span>←</span><span className="rounded-lg bg-muted px-2.5 py-1.5">2 الفرع</span><span>←</span><span className="rounded-lg bg-muted px-2.5 py-1.5">3 الدرس</span>
            </div>
          </div>
        </div>
        <div className="grid gap-4 p-5 sm:p-6 md:grid-cols-[.78fr_.95fr_1.35fr]">
          <div className="min-w-0">
            <label className="mb-2 block text-xs font-bold text-muted-foreground">01 · المادة الدراسية</label>
            <Select value={subjectId} onValueChange={value => { setSubjectId(value); setBranchId(""); setLessonId(""); }} disabled={profile.isLoading || subjects.length === 0}>
              <SelectTrigger className="h-12 rounded-xl bg-background"><SelectValue placeholder="اختر المادة" /></SelectTrigger>
              <SelectContent>{subjects.map(id => <SelectItem key={id} value={id}>{getSIESubject(id)?.nameAr || id}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="min-w-0">
            <label className="mb-2 block text-xs font-bold text-muted-foreground">02 · فرع المادة</label>
            <Select value={currentBranchId} onValueChange={value => { setBranchId(value); setLessonId(""); }} disabled={!branches.length}>
              <SelectTrigger className="h-12 rounded-xl bg-background"><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
              <SelectContent>
                {branches.map(branch => <SelectItem key={branch.branchId} value={branch.branchId}>{branch.branchTitle}</SelectItem>)}
                {subjectId === "ARB_G2_BAC" && <SelectItem value="__ARB_BALAGHA_UNINDEXED__" disabled>البلاغة · لا توجد موضوعات مفهرسة في الجزء الأول</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0">
            <label className="mb-2 block text-xs font-bold text-muted-foreground">03 · الدرس داخل الفرع</label>
            <Select value={lessonId} onValueChange={setLessonId} disabled={!branchChoices.length}>
              <SelectTrigger className="h-12 rounded-xl bg-background"><SelectValue placeholder="اختر درسًا من الفرع المحدد" /></SelectTrigger>
              <SelectContent className="max-h-[360px]">
                {lessons.map(lesson => (
                  <SelectItem key={lesson.nodeId} value={lesson.nodeId} textValue={getSIECheckpointChoiceDisplayLabel(lesson)}>
                    <span className="flex min-w-0 flex-col gap-1 py-1 text-right" dir="rtl">
                      <span className="text-sm font-semibold leading-5">{lesson.lessonType === "topic" ? `Lesson ${lesson.lessonNumber} — ${lesson.title}` : lesson.lessonType === "grammar" ? `قاعدة نحوية ${lesson.lessonNumber} — ${lesson.title}` : lesson.lessonNumber ? `الدرس ${lesson.lessonNumber} — ${lesson.title}` : lesson.title}</span>
                      <span className="text-[11px] leading-4 text-muted-foreground">{getSIECheckpointChoiceTypeLabel(lesson)} · {lesson.branchTitle ?? lesson.unitTitle}</span>
                      <span className="text-[10px] leading-4 text-muted-foreground">{lesson.lessonType === "topic" ? `Unit ${lesson.unitNumber}: ${lesson.unitTitle}` : `الوحدة ${lesson.unitNumber ?? ""}: ${lesson.unitTitle}`}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {selectedLesson && <div className="mx-5 mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-primary/15 bg-primary/5 p-3 sm:mx-6">
          <span className="text-xs font-bold text-foreground">{selectedLesson.lessonType === "topic" ? `Lesson ${selectedLesson.lessonNumber}` : `الدرس ${selectedLesson.lessonNumber}`}</span>
          <span className="text-xs text-foreground">{selectedLesson.title}</span>
          <span className="rounded-md bg-background px-2 py-1 text-[10px] font-semibold text-primary">{getSIECheckpointChoiceTypeLabel(selectedLesson)}</span>
          <span className="text-[10px] text-muted-foreground">{selectedLesson.branchTitle}</span>
        </div>}
        {subjectId === "ARB_G2_BAC" && <div className="mx-5 mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-muted/20 p-3 sm:mx-6">
          <span className="rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary">النحو · 6 موضوعات</span>
          <span className="rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary">القراءة والنصوص · 9 دروس</span>
          <span className="rounded-lg border border-dashed border-border bg-background px-2.5 py-1.5 text-xs text-muted-foreground">البلاغة · غير مفهرسة في الجزء الأول</span>
        </div>}
        {subjectId && !subjectChoices.length && <p className="mx-5 mb-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm leading-6 text-muted-foreground sm:mx-6">فهرس هذه المادة غير محمّل في النسخة الحالية؛ لن نعرض دروسًا مخمّنة.</p>}
        {!subjects.length && !profile.isLoading && <p className="m-5 rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">لم تُضف مواد إلى ملفك الدراسي بعد. أضف المواد من الملف الشخصي أولًا.</p>}
      </section>
      <section className="app-card mb-5 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">CROSS-APP STUDY SESSION</p>
            <h2 className="mt-1 font-bold">جلسة مذاكرة خارج SIE</h2>
            {externalSession ? (
              <>
                <p className="mt-1 text-sm text-muted-foreground">{externalSessionSubjectName} · {externalSessionLessonTitle}</p>
                <p className="mt-2 text-xs leading-6 text-muted-foreground">الجلسة محفوظة على الخادم وتستمر عند انتقالك إلى منصة المدرس أو قارئ PDF. ارجع إلى SIE واضغط إنهاء عند الانتهاء.</p>
              </>
            ) : (
              <p className="mt-1 text-xs leading-6 text-muted-foreground">ابدأ المؤقت قبل فتح منصة المدرس أو ملف PDF. عند رجوعك، أوقفه وسجّل ما إذا كنت أنهيت الدرس.</p>
            )}
          </div>
          {externalSession ? (
            <div className="flex shrink-0 flex-col items-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-5 py-3">
              <p className="text-[10px] font-semibold text-muted-foreground">الوقت المسجل</p>
              <p className="text-3xl font-bold tabular-nums text-primary">{formatSessionDuration(externalSessionElapsed)}</p>
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">جلسة نشطة</span>
            </div>
          ) : (
            <Button type="button" onClick={beginExternalStudy} disabled={startExternalSession.isPending || activeExternalSession.isLoading || !subjectId || !currentBranchId || !lessonId} className="shrink-0 rounded-xl bg-primary">
              {startExternalSession.isPending ? "جارٍ بدء الجلسة..." : "ابدأ جلسة خارج SIE"}
            </Button>
          )}
        </div>
        {externalSession && (
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/25 p-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-start gap-2 text-sm leading-6">
              <input type="checkbox" checked={markSessionLessonCompleted} onChange={event => setMarkSessionLessonCompleted(event.target.checked)} className="mt-1 size-4 accent-primary" />
              <span>أنهيت دراسة هذا الدرس؛ حدّث موضعي في فرع المنهج عند إنهاء الجلسة.</span>
            </label>
            <Button type="button" variant="outline" onClick={endExternalStudy} disabled={finishExternalSession.isPending} className="shrink-0 rounded-xl">
              {finishExternalSession.isPending ? "جارٍ إنهاء الجلسة..." : "إنهاء الجلسة وحفظ الوقت"}
            </Button>
          </div>
        )}
      </section>
      <motion.section
        className="learning-progress-panel app-card mb-6 overflow-hidden"
        initial={{ opacity: 0, y: 22, rotateX: -1.5 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="sf-learning-hero relative overflow-hidden rounded-t-2xl px-5 py-6 text-white sm:px-7">
          <div className="relative z-10 max-w-[70%] sm:max-w-[74%]">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--sf-gold-light)]">LEARNING INTELLIGENCE</p>
            <h2 className="mt-2 text-xl font-bold sm:text-2xl">حالة تعلّمك الفعلية</h2>
            <p className="mt-2 max-w-xl text-xs leading-6 text-white/65 sm:text-sm">يتابع SIE موضعك وموضع التدريس داخل كل فرع رسمي بصورة مستقلة؛ ولن يقارن بين وحدات أو أقسام مختلفة.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-[11px] text-white/80">{subjectName}</span>
              <span className="rounded-full border border-[var(--sf-gold)]/30 bg-[var(--sf-gold)]/10 px-3 py-1.5 text-[11px] text-[var(--sf-gold-light)]">{selectedTeacher?.nameAr || "لم تحدد مدرسًا"}</span>
            </div>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-l from-transparent via-[var(--sf-gold)]/70 to-transparent" />
        </div>

        <div className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[1.2fr_.8fr]">
          <div className="rounded-2xl border border-accent/25 bg-accent/5 p-4 text-sm leading-7 text-muted-foreground xl:col-span-2">
            <p className="font-bold text-foreground">حدّث موضع المدرس بنفسك</p>
            <p className="mt-1">اختر آخر درس شرح المدرس محتواه بالفعل، وليس الدرس التالي في الخطة أو جدول المنهج. هذه المعلومة التي يبلغك بها الطالب هي مرجع المخطط لحساب التراكم.</p>
            <p className="mt-1">لكي تُحسب الفجوة، حدّد أيضًا آخر درس أنهيته أنت. موضع المدرس له الأولوية؛ وموضع الفصل يُستخدم بديلًا فقط عندما لا يكون موضع المدرس معروفًا.</p>
          </div>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <label className="text-sm font-semibold">
                المدرس الذي تتابعه في هذه المادة
                <Select
                  value={selectedTeacherId || "__NONE__"}
                  onValueChange={value => {
                    setTeacherChoiceDrafts(current => ({ ...current, [subjectId]: value }));
                    setTeacherTeachingFrontierId("__UNKNOWN__");
                    setTeacherCourseFrontier("");
                  }}
                  disabled={!subjectId || profile.isLoading}
                >
                  <SelectTrigger className="mt-2 h-11 rounded-xl bg-background"><SelectValue placeholder="اختر المدرس" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__NONE__">لم أحدد مدرسًا بعد</SelectItem>
                    {teacherOptions.map(teacher => (
                      <SelectItem key={teacher.teacherId} value={teacher.teacherId}>{teacher.nameAr}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="mt-1 block text-[11px] font-normal text-muted-foreground">
                  اختيار المدرس هنا يحفظه في ملفك الدراسي ويُفعّل اختيار موضع شرحه للمنهج.
                </span>
                {!teacherOptions.length && (
                  <span className="mt-1 block text-[11px] font-normal text-amber-700 dark:text-amber-300">
                    لا توجد ترشيحات مدرسين موثقة لهذه المادة والنظام حاليًا. يمكنك مراجعة اختيار المدرس من الملف الدراسي.
                  </span>
                )}
              </label>
              <label className="text-sm font-semibold">
                آخر درس أنهيته أنت
                <Select value={lastCompletedLessonId || "__UNKNOWN__"} onValueChange={setLastCompletedLessonId} disabled={!branchChoices.length}>
                  <SelectTrigger className="mt-2 h-11 rounded-xl bg-background"><SelectValue placeholder="غير محدد" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__UNKNOWN__">غير محدد</SelectItem>
                    <SelectItem value="__NOT_STARTED__">لم أبدأ المنهج بعد</SelectItem>
                    {branchChoices.map(lesson => <SelectItem key={lesson.nodeId} value={lesson.nodeId}>{getSIECheckpointChoiceDisplayLabel(lesson)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <span className="mt-1 block text-[11px] font-normal text-muted-foreground">ده موضع الطالب، وليس موضع المدرس أو المدرسة.</span>
              </label>
              <label className="text-sm font-semibold">
                المدرس وصل لحد أنهي درس؟
                <Select value={teacherTeachingFrontierId} onValueChange={setTeacherTeachingFrontierId} disabled={!selectedTeacher || !lessons.length}>
                  <SelectTrigger className="mt-2 h-11 rounded-xl bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__UNKNOWN__">لا أعرف / غير متاح</SelectItem>
                    <SelectItem value="__NOT_STARTED__">لم يبدأ التدريس بعد</SelectItem>
                    {branchChoices.map(lesson => <SelectItem key={lesson.nodeId} value={lesson.nodeId}>{getSIECheckpointChoiceDisplayLabel(lesson)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <span className="mt-1 block text-[11px] font-normal text-muted-foreground">يُستخدم كمرجع أول فقط عندما يكون معروفًا.</span>
              </label>
              <div className="rounded-xl border border-border/70 bg-background/55 p-3">
                <label className="block text-sm font-semibold">آخر درس انتهت المدرسة من شرحه للفصل
                  <Select value={schoolClassFrontierId} onValueChange={setSchoolClassFrontierId} disabled={!branchChoices.length}>
                    <SelectTrigger className="mt-2 h-11 rounded-xl bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__UNKNOWN__">لا أعرف حتى الآن</SelectItem>
                      <SelectItem value="__NOT_STARTED__">لم يبدأ الفصل المادة بعد</SelectItem>
                      {branchChoices.map(lesson => <SelectItem key={lesson.nodeId} value={lesson.nodeId}>{getSIECheckpointChoiceDisplayLabel(lesson)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </label>
                <label className="mt-3 block text-sm font-semibold">مصدر المعلومة
                  <Select value={schoolClassEvidenceSource} onValueChange={value => setSchoolClassEvidenceSource(value as typeof schoolClassEvidenceSource)}>
                    <SelectTrigger className="mt-2 h-11 rounded-xl bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unknown">لم أتحقق بعد</SelectItem>
                      <SelectItem value="teacher_confirmed">أكده المدرس</SelectItem>
                      <SelectItem value="classmate_confirmed">أكده زميل في الفصل</SelectItem>
                      <SelectItem value="class_notes">من كشكول/ملاحظات الحصة</SelectItem>
                      <SelectItem value="class_group">من مجموعة الفصل</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                <p className="mt-2 text-[11px] font-normal leading-5 text-muted-foreground">هذه معلومة يبلّغ بها الطالب حاليًا؛ لا يوجد اتصال مباشر بنظام المدرسة. إذا كان موضع المدرس معروفًا فسيظل هو المرجع الأول في حساب الفجوة.</p>
              </div>
              <label className="text-sm font-semibold">
                آخر محاضرة شاهدتها على منصة المدرس (اختياري)
                <Input value={teacherCourseFrontier} onChange={event => setTeacherCourseFrontier(event.target.value)} placeholder="مثال: المحاضرة 12" maxLength={120} className="mt-2 h-11 rounded-xl bg-background" />
                <span className="mt-1 block text-[11px] font-normal text-muted-foreground">للتوثيق فقط؛ لا تدخل في حساب فجوة المنهج.</span>
              </label>
              <label className="text-sm font-semibold">
                وضعك الحالي مع المادة
                <Select value={courseStatus} onValueChange={value => setCourseStatus(value as CourseStatus)}>
                  <SelectTrigger className="mt-2 h-11 rounded-xl bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_started">لم أبدأ بعد</SelectItem>
                    <SelectItem value="in_progress">أتابع المحتوى حاليًا</SelectItem>
                    <SelectItem value="caught_up">مواكب لآخر محتوى</SelectItem>
                    <SelectItem value="needs_review">أنهيت المحتوى ويحتاج مراجعة</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="text-sm font-semibold">
                الوقت المعتاد للدرس بالدقائق
                <Input type="number" min={5} max={480} value={estimatedMinutes} onChange={event => setEstimatedMinutes(Math.max(5, Math.min(480, Number(event.target.value) || 5)))} className="mt-2 h-11 rounded-xl bg-background" />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-[.7fr_1.3fr]">
              <label className="text-sm font-semibold">
                صعوبة المادة
                <Select value={courseDifficulty} onValueChange={value => setCourseDifficulty(value as typeof courseDifficulty)}>
                  <SelectTrigger className="mt-2 h-11 rounded-xl bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unknown">غير محددة</SelectItem>
                    <SelectItem value="easy">سهلة</SelectItem>
                    <SelectItem value="medium">متوسطة</SelectItem>
                    <SelectItem value="hard">صعبة وتحتاج وقتًا</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="text-sm font-semibold">
                ملاحظات اختيارية
                <Input value={courseNotes} onChange={event => setCourseNotes(event.target.value)} placeholder="مثال: المحاضرتان الأخيرتان لم أراجعهما" maxLength={600} className="mt-2 h-11 rounded-xl bg-background" />
              </label>
            </div>
            <label className="block text-sm font-semibold">
              العائق الرئيسي الذي يؤثر على مذاكرتك (اختياري)
              <Textarea value={learningObstacle} onChange={event => setLearningObstacle(event.target.value)} placeholder="مثال: صعوبة البدء، تشتت، وقت قليل، أو تراكم كبير" maxLength={600} className="mt-2 min-h-20 rounded-xl bg-background leading-7" />
            </label>
            <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-muted/25 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-6 text-muted-foreground">سيُحفظ موضعك وموضع المدرس وموضع الفصل كلٌّ على حدة داخل فرع «{currentBranch?.branchTitle || "غير محدد"}» فقط. إذا لم تحدد آخر درس أنهيته أنت، فستظل الفجوة غير محسوبة حتى لو حفظت موضع المدرسة.</p>
              <Button type="button" onClick={submitCourseProgress} disabled={saveCourseProgress.isPending || !subjectId} className="pressable shrink-0 rounded-xl bg-primary">
                {saveCourseProgress.isPending ? "جارٍ حفظ التقدم..." : "حفظ موضع المدرس وتقدمك"}
              </Button>
            </div>
          </div>

          <aside className="learning-glass-card rounded-2xl border border-border/70 bg-muted/20 p-4 sm:p-5">
            <div className="flex items-center gap-2"><Activity className="size-4 text-primary" /><h3 className="font-bold">مؤشرات المادة</h3></div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border/60 bg-background/75 p-3">
                <p className="text-[11px] text-muted-foreground">فجوة المنهج المحسوبة</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-primary">{currentGap.gapCount === null ? "—" : currentGap.gapCount}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">{currentBranch?.branchTitle || "الفرع غير محدد"} · {currentGap.referenceSource === "teacher" ? "المرجع: المدرس" : currentGap.referenceSource === "school" ? "المرجع: المدرسة" : "لا يوجد مرجع داخل هذا الفرع"}</p>
              </div>
            </div>
            <div className="mt-3 rounded-xl border border-border/60 bg-background/75 p-3">
              <p className="text-[11px] text-muted-foreground">حالة المقارنة</p>
              <p className="mt-1 text-sm font-semibold">{currentGap.status === "calculated" ? (currentGap.gapCount! > 0 ? "الطالب متأخر عن المرجع" : currentGap.aheadCount! > 0 ? "الطالب متقدم على المرجع" : "الطالب مواكب للمرجع") : currentGap.status === "student_position_missing" ? "موضع الطالب غير محدد" : "لا يوجد موضع مرجعي معروف"}</p>
              {currentGap.aheadCount !== null && currentGap.aheadCount > 0 && <p className="mt-1 text-[11px] text-muted-foreground">تقدم بمقدار {currentGap.aheadCount} {currentBranchPointLabel} عن المرجع.</p>}
            </div>
            <div className="mt-3 flex items-start gap-2 text-xs leading-6 text-muted-foreground">
              <Gauge className="mt-1 size-4 shrink-0 text-primary" />
              <p>المخطط سيوازن التراكم مع صعوبة الدروس ودرجة تقدمك في كل فرع بدل اعتبار عدد المحاضرات مقياسًا وحيدًا.</p>
            </div>
          </aside>
        </div>

        <section className="border-t border-border/70 p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">BRANCH OVERVIEW</p>
              <h3 className="mt-1 font-bold">ملخص التقدم في كل فروع المادة</h3>
              <p className="mt-1 text-xs text-muted-foreground">كل وحدة أو فصل أو قسم يُقارن بمرجعه داخل حدوده فقط. اضغط على أي فرع لتحديث مواضعه.</p>
            </div>
            <span className="rounded-full border border-border bg-background px-3 py-1 text-[11px] text-muted-foreground">{branches.length} فروع مستقلة</span>
          </div>
          {learning.isLoading ? (
            <p className="rounded-xl border border-border/70 bg-background/70 p-4 text-sm text-muted-foreground">جارٍ تحميل مؤشرات الفروع...</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {branches.map(branch => {
                const gap = branchGapMap[branch.branchId];
                const saved = branchProgressMap[branch.branchId] || {};
                const studentLabel = gap?.studentFrontierTitle
                  || (gap?.studentFrontierId === "__NOT_STARTED__" || saved.lastCompletedLessonId === "__NOT_STARTED__" ? "لم يبدأ بعد" : "غير محدد");
                const referenceLabel = gap?.referenceFrontierTitle
                  || (gap?.referenceFrontierId === "__NOT_STARTED__" ? "لم يبدأ بعد" : "غير معروف");
                const referenceSourceLabel = gap?.referenceSource === "teacher"
                  ? "المدرس" : gap?.referenceSource === "school" ? "المدرسة" : "لا يوجد مرجع";
                const branchPointLabel = branch.branchType === "official_section" ? "موضوع" : "درس";
                const gapLabel = gap?.gapCount === null || gap?.gapCount === undefined
                  ? "غير محسوبة" : `${gap.gapCount} ${branchPointLabel}`;
                const isSelected = branch.branchId === currentBranchId;
                return (
                  <button
                    key={branch.branchId}
                    type="button"
                    onClick={() => setBranchId(branch.branchId)}
                    className={`rounded-xl border p-4 text-start transition-colors ${isSelected ? "border-primary/50 bg-primary/5" : "border-border/70 bg-background/70 hover:bg-muted/50"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="text-sm font-semibold leading-6">{branch.branchTitle}</h4>
                      <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">{branch.choices.length} {branchPointLabel === "موضوع" ? "موضوعات" : "دروس"}</span>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">موضع الطالب: <span className="font-medium text-foreground">{studentLabel}</span></p>
                    <p className="mt-1 text-xs text-muted-foreground">موضع {referenceSourceLabel}: <span className="font-medium text-foreground">{referenceLabel}</span></p>
                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-3">
                      <span className="text-[11px] text-muted-foreground">فجوة هذا الفرع</span>
                      <span className="text-sm font-bold tabular-nums text-primary">{gapLabel}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

      </motion.section>

      {lessonId && selectedLesson ? (
        <>
          <section className="app-card mb-5 overflow-hidden">
            <div className="flex flex-col gap-4 bg-gradient-to-l from-secondary/70 to-card p-5 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-xs font-semibold text-primary">{subjectName} · {selectedLesson.unitTitle}</p><h2 className="mt-1 text-xl font-bold">{selectedLesson.title}</h2><p className="mt-2 text-sm text-muted-foreground">تقدم خطوات SQ3R لهذا الدرس</p></div>
              <div className="min-w-32 rounded-2xl border border-border/70 bg-background/80 p-3 text-center"><p className="text-2xl font-bold tabular-nums text-primary">{completion}%</p><p className="text-[11px] text-muted-foreground">{doneCount} من 5 خطوات</p></div>
            </div>
            <div className="h-1.5 bg-muted"><div className="h-full bg-primary transition-all" style={{ width: completion + "%" }} /></div>
          </section>
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-3">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const done = completedSteps.includes(step.id);
                return <button type="button" key={step.id} onClick={() => toggleStep(step.id)} disabled={saveProgress.isPending} className={"app-card flex w-full items-center gap-4 p-4 text-right transition-colors sm:p-5 " + (done ? "border-emerald-500/30 bg-emerald-500/5" : "hover:border-primary/25")}>
                  <span className={"flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold " + (done ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground")}>{done ? <Check className="size-4" /> : index + 1}</span>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary"><Icon className="size-5" /></span>
                  <span className="min-w-0 flex-1"><span className="block font-bold">{step.title}</span><span className="mt-1 block text-sm leading-6 text-muted-foreground">{step.hint}</span></span>
                  <span className={"shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold " + (done ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground")}>{done ? "تمت" : "تسجيل"}</span>
                </button>;
              })}
            </div>
            <aside className="app-card h-fit p-5">
              <h3 className="font-bold">صعوبة الدرس</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">تساعد هذه المعلومة المخطط على تقدير الوقت المناسب.</p>
              <Select value={difficulty} onValueChange={value => { const next = value as typeof difficulty; setDifficulty(next); updateProgress(completedSteps, next); }}>
                <SelectTrigger className="mt-3 h-10 rounded-xl bg-background"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="unknown">لم أحدد بعد</SelectItem><SelectItem value="easy">سهل</SelectItem><SelectItem value="medium">متوسط</SelectItem><SelectItem value="hard">صعب ويحتاج وقتًا</SelectItem></SelectContent>
              </Select>
              <h3 className="mt-6 font-bold">ملاحظاتك</h3>
              <Textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="اكتب سؤالًا أو فكرة تريد الرجوع إليها..." className="mt-2 min-h-28 rounded-xl bg-background leading-7" maxLength={2_000} />
              <Button type="button" onClick={() => updateProgress(completedSteps, difficulty, notes)} disabled={saveProgress.isPending} className="mt-3 w-full rounded-xl bg-primary">{saveProgress.isPending ? "جارٍ الحفظ..." : "حفظ الملاحظة والتقدم"}</Button>
              <p className="mt-3 text-[11px] leading-5 text-muted-foreground">{currentProgress?.updatedAt ? "آخر حفظ: " + new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(currentProgress.updatedAt)) : "لم يُسجّل تقدم لهذا الدرس بعد."}</p>
            </aside>
          </section>
        </>
      ) : (
        <section className="app-card soft-grid flex min-h-64 flex-col items-center justify-center p-6 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-secondary text-primary"><Sparkles className="size-6" /></span>
          <h2 className="mt-4 text-lg font-bold">اختر المادة والدرس للبدء</h2>
          <p className="mt-2 max-w-md text-sm leading-7 text-muted-foreground">لن تحتاج إلى اختيار كتاب. بعد تحديد الدرس ستظهر خطوات المسح والتساؤل والقراءة والتسميع والمراجعة.</p>
        </section>
      )}

      <section className="app-card mt-6 p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">REVIEW DISCOVERY</p>
            <h2 className="mt-1 font-bold">مراجعات مقترحة لهذا الفرع</h2>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">يبحث عن مراجعات على YouTube بالاستناد إلى المادة والفرع والمدرس المختار. راجع محتوى الفيديو قبل الاعتماد عليه.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={reviewRecommendations.isPending || !subjectId || !currentBranchId}
            onClick={() => reviewRecommendations.mutate({ subjectId, branchId: currentBranchId, teacherId: selectedTeacherId || undefined })}
            className="shrink-0 rounded-xl"
          >
            {reviewRecommendations.isPending ? "جارٍ البحث..." : "ابحث عن مراجعات"}
          </Button>
        </div>
        {reviewRecommendations.isError && <p role="alert" className="mt-3 rounded-xl bg-destructive/5 p-3 text-sm text-destructive">تعذّر تحميل النتائج. يمكنك المحاولة مرة أخرى.</p>}
        {reviewRecommendations.data && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>المادة: {reviewRecommendations.data.subject}</span>
              <span>·</span>
              <span>الفرع: {reviewRecommendations.data.branch}</span>
              {reviewRecommendations.data.teacher && <><span>·</span><span>المدرس: {reviewRecommendations.data.teacher}</span></>}
            </div>
            {reviewRecommendations.data.items.length ? reviewRecommendations.data.items.map((item, index) => (
              <article key={item.url + index} className="rounded-xl border border-border/70 bg-muted/15 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="font-semibold leading-6 text-primary underline-offset-4 hover:underline">{item.title}</a>
                    <p className="mt-1 text-xs text-muted-foreground">{item.channelTitle}{item.publishedAt ? " · " + item.publishedAt : ""}</p>
                  </div>
                  <span className="shrink-0 rounded-lg bg-secondary px-2 py-1 text-[10px] font-medium text-muted-foreground">{item.relevance}</span>
                </div>
                {item.description && <p className="mt-2 line-clamp-3 text-xs leading-6 text-muted-foreground">{item.description}</p>}
              </article>
            )) : <p className="rounded-xl bg-muted/30 p-4 text-sm text-muted-foreground">لم يُعثر على نتائج مطابقة كافية لهذا البحث. جرّب البحث مرة أخرى لاحقًا.</p>}
            <p className="text-[11px] leading-5 text-muted-foreground">{reviewRecommendations.data.note}</p>
          </div>
        )}
      </section>
    </DashboardLayout>
  );
}
