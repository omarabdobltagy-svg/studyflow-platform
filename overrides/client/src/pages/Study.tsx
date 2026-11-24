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
  const [courseModeDrafts, setCourseModeDrafts] = useState<Record<string, "center" | "online">>({});
  const [teacherNameDrafts, setTeacherNameDrafts] = useState<Record<string, string>>({});
  const [advanceAfterSave, setAdvanceAfterSave] = useState(false);
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
  const savedCourseModes = (selection.courseModes || {}) as Record<string, "center" | "online">;
  const savedTeacherNames = (selection.customTeacherNames || {}) as Record<string, string>;
  const courseMode = courseModeDrafts[subjectId] || savedCourseModes[subjectId] || currentCourseProgress.courseMode || "";
  const teacherName = Object.prototype.hasOwnProperty.call(teacherNameDrafts, subjectId)
    ? teacherNameDrafts[subjectId]
    : savedTeacherNames[subjectId] || currentBranchProgress.teacherName || currentCourseProgress.teacherName || "";
  const teacherReferenceName = teacherName.trim() || selectedTeacher?.nameAr || "";
  const subjectIndex = Math.max(0, subjects.indexOf(subjectId));
  const branchIndex = Math.max(0, branches.findIndex(branch => branch.branchId === currentBranchId));
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
    schoolClassFrontierId: courseMode === "center" ? schoolClassFrontierId : "__UNKNOWN__",
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
      await Promise.all([utils.studentProfile.get.invalidate(), utils.learning.get.invalidate()]);
      const shouldAdvance = advanceAfterSave;
      setAdvanceAfterSave(false);
      if (shouldAdvance) {
        const nextBranch = branches[branchIndex + 1];
        if (nextBranch) {
          setBranchId(nextBranch.branchId);
          setLessonId("");
          toast.success("تم حفظ " + (currentBranch?.branchTitle || "الفرع") + "؛ ننتقل للفرع التالي.");
        } else {
          const nextSubjectId = subjects[subjectIndex + 1];
          if (nextSubjectId) {
            setSubjectId(nextSubjectId);
            setBranchId("");
            setLessonId("");
            toast.success("اكتملت فروع " + subjectName + "؛ ننتقل إلى " + (getSIESubject(nextSubjectId)?.nameAr || "المادة التالية") + ".");
          } else {
            toast.success("تم حفظ آخر فرع. اكتمل تحديث تقدم موادك.");
          }
        }
      } else {
        toast.success("تم حفظ تقدم هذا الفرع.");
      }
    },
    onError: error => { setAdvanceAfterSave(false); toast.error(error.message); },
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

  const submitCourseProgress = (advance = false) => {
    if (!subjectId) return;
    if (!courseMode) {
      toast.error("حدد أولًا هل تدرس المادة في سنتر أم أونلاين.");
      return;
    }
    if (!currentBranchId) {
      toast.error("لا يوجد فرع منهج محدد لهذه المادة.");
      return;
    }
    if (teacherTeachingFrontierId !== "__UNKNOWN__" && !teacherReferenceName) {
      toast.error("اكتب اسم المدرس أو اختره قبل تحديد موضع شرحه.");
      return;
    }
    setAdvanceAfterSave(advance);
    saveCourseProgress.mutate({
      subjectId,
      branchId: currentBranchId,
      teacherId: selectedTeacherId || null,
      teacherName: teacherReferenceName,
      courseMode,
      lastCompletedLessonId: lastCompletedLessonId || "__UNKNOWN__",
      teacherTeachingFrontierId,
      schoolClassFrontierId: courseMode === "center" ? schoolClassFrontierId : "__UNKNOWN__",
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
        <header className="border-b border-border/70 bg-gradient-to-l from-secondary/65 to-card p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">تقدمك الدراسي</p>
              <h2 className="mt-1 text-xl font-bold">نحدد مكانك خطوة بخطوة</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">المادة {subjectIndex + 1} من {subjects.length} · {subjectName}</p>
            </div>
            <span className="rounded-full border border-border bg-background px-3 py-2 text-xs font-semibold">الفرع {branchIndex + 1} من {branches.length}</span>
          </div>
        </header>
        <div className="space-y-5 p-5 sm:p-6">
          {subjects.length > 1 && (
            <div className="flex flex-wrap gap-2" aria-label="المواد الدراسية">
              {subjects.map((id, index) => (
                <span key={id} className={"rounded-lg px-3 py-2 text-xs font-semibold " + (id === subjectId ? "bg-primary text-primary-foreground" : index < subjectIndex ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground")}>
                  {index + 1}. {getSIESubject(id)?.nameAr || id}
                </span>
              ))}
            </div>
          )}
          <div>
            <p className="mb-2 text-sm font-bold">طريقة دراستك للمادة دي</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" aria-pressed={courseMode === "center"} onClick={() => setCourseModeDrafts(current => ({ ...current, [subjectId]: "center" }))}
                className={"rounded-xl border p-4 text-right transition " + (courseMode === "center" ? "border-primary bg-secondary/40 ring-1 ring-primary/20" : "border-border hover:border-primary/30")}>
                <span className="block font-bold">سنتر / مجموعة</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">بتحضر مع مدرس في مكان أو مجموعة.</span>
              </button>
              <button type="button" aria-pressed={courseMode === "online"} onClick={() => setCourseModeDrafts(current => ({ ...current, [subjectId]: "online" }))}
                className={"rounded-xl border p-4 text-right transition " + (courseMode === "online" ? "border-primary bg-secondary/40 ring-1 ring-primary/20" : "border-border hover:border-primary/30")}>
                <span className="block font-bold">أونلاين</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">بتتابع الشرح من منصة أو فيديوهات.</span>
              </button>
            </div>
          </div>
          {courseMode && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {courseMode === "online" && (
                  <label className="block text-sm font-semibold">
                    المدرس الذي تتابعه أونلاين
                    <Select value={selectedTeacherId || "__NONE__"} onValueChange={value => {
                      setTeacherChoiceDrafts(current => ({ ...current, [subjectId]: value }));
                      setTeacherNameDrafts(current => ({ ...current, [subjectId]: "" }));
                      setTeacherTeachingFrontierId("__UNKNOWN__");
                    }}>
                      <SelectTrigger className="mt-2 h-11 rounded-xl bg-background"><SelectValue placeholder="اختر مدرسك" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__NONE__">لم أحدد مدرسًا بعد</SelectItem>
                        {teacherOptions.map(teacher => <SelectItem key={teacher.teacherId} value={teacher.teacherId}>{teacher.nameAr}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </label>
                )}
                <label className="block text-sm font-semibold">
                  {courseMode === "center" ? "اسم مدرس السنتر" : "اسم مدرس آخر (لو مش موجود في القائمة)"}
                  <Input value={teacherName} onChange={event => {
                    setTeacherNameDrafts(current => ({ ...current, [subjectId]: event.target.value }));
                    if (event.target.value.trim()) setTeacherChoiceDrafts(current => ({ ...current, [subjectId]: "__NONE__" }));
                  }} placeholder={courseMode === "center" ? "اكتب اسم مدرس السنتر" : "اختياري"} maxLength={120} className="mt-2 h-11 rounded-xl bg-background" />
                </label>
              </div>
              <div className="rounded-2xl border border-border/70 bg-muted/15 p-4">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold">الفرع الحالي: {currentBranch?.branchTitle || "غير محدد"}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">اختار موضعك وموضع المدرس في الفرع ده فقط. مش بنقارن فروع مختلفة ببعض.</p>
                  </div>
                  <span className="rounded-full bg-background px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">{branchChoices.length} عنصر مفهرس حاليًا</span>
                </div>
                {branches.length > 1 && (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {branches.map((branch, index) => (
                      <button key={branch.branchId} type="button" aria-pressed={branch.branchId === currentBranchId} onClick={() => { setBranchId(branch.branchId); setLessonId(""); }}
                        className={"rounded-lg border px-3 py-2 text-xs font-semibold transition " + (branch.branchId === currentBranchId ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:border-primary/30")}>
                        {index + 1}. {branch.branchTitle}
                      </button>
                    ))}
                  </div>
                )}
                {branchChoices.length === 1 && (
                  <p className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-6 text-muted-foreground">
                    الفهرس الحالي يعرض عنصرًا واحدًا فقط لهذا الفرع. ده لا يعني إن الفرع كله درس واحد؛ عدد العناصر المعروضة هو ما تم فهرسته حاليًا فقط.
                  </p>
                )}
                {branchChoices.length === 0 && (
                  <p className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-6 text-muted-foreground">
                    فهرس هذا الفرع غير متاح أو لم يكتمل بعد. لن نخمن دروسًا أو نحسب فجوة غير موثوقة؛ يمكنك حفظ إعداد المادة والانتقال للفرع التالي.
                  </p>
                )}
                {branchChoices.length > 0 && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block text-sm font-semibold">
                      أنت خلصت لحد أنهي درس؟
                      <Select value={lastCompletedLessonId || "__UNKNOWN__"} onValueChange={setLastCompletedLessonId}>
                        <SelectTrigger className="mt-2 h-11 rounded-xl bg-background"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__UNKNOWN__">لسه ما حددتش</SelectItem><SelectItem value="__NOT_STARTED__">لسه ما بدأتش الفرع ده</SelectItem>
                          {branchChoices.map(choice => <SelectItem key={choice.nodeId} value={choice.nodeId}>{getSIECheckpointChoiceDisplayLabel(choice)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <span className="mt-1 block text-[11px] font-normal text-muted-foreground">اختار آخر درس خلصت مذاكرته فعلًا، مش الدرس اللي بدأت فيه.</span>
                    </label>
                    <label className="block text-sm font-semibold">
                      {teacherReferenceName ? "مدرسك (" + teacherReferenceName + ") وصل لحد فين؟" : "مدرسك وصل لحد فين؟"}
                      <Select value={teacherTeachingFrontierId} onValueChange={setTeacherTeachingFrontierId} disabled={!teacherReferenceName}>
                        <SelectTrigger className="mt-2 h-11 rounded-xl bg-background"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__UNKNOWN__">مش عارف / لسه ما حددتش</SelectItem><SelectItem value="__NOT_STARTED__">لسه ما بدأش الفرع ده</SelectItem>
                          {branchChoices.map(choice => <SelectItem key={choice.nodeId} value={choice.nodeId}>{getSIECheckpointChoiceDisplayLabel(choice)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <span className="mt-1 block text-[11px] font-normal text-muted-foreground">{teacherReferenceName ? "حدد آخر درس انتهى المدرس من شرحه بالفعل." : "اكتب اسم المدرس أولًا عشان نسجل موضع شرحه."}</span>
                    </label>
                    {courseMode === "center" && (
                      <div className="rounded-xl border border-border/70 bg-background/65 p-3 md:col-span-2">
                        <label className="block text-sm font-semibold">
                          السنتر / المجموعة وصلوا لحد أنهي درس في الفرع ده؟
                          <Select value={schoolClassFrontierId} onValueChange={setSchoolClassFrontierId}>
                            <SelectTrigger className="mt-2 h-11 rounded-xl bg-background"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__UNKNOWN__">مش عارف / مش متأكد</SelectItem><SelectItem value="__NOT_STARTED__">لسه ما شرحوش الفرع ده</SelectItem>
                              {branchChoices.map(choice => <SelectItem key={choice.nodeId} value={choice.nodeId}>{getSIECheckpointChoiceDisplayLabel(choice)}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </label>
                        <label className="mt-3 block text-sm font-semibold">عرفت المعلومة دي منين؟
                          <Select value={schoolClassEvidenceSource} onValueChange={value => setSchoolClassEvidenceSource(value as typeof schoolClassEvidenceSource)}>
                            <SelectTrigger className="mt-2 h-10 rounded-xl bg-background"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unknown">لسه ما تأكدتش</SelectItem><SelectItem value="teacher_confirmed">المدرس أكّدها</SelectItem><SelectItem value="classmate_confirmed">زميل في المجموعة قالّي</SelectItem><SelectItem value="class_notes">من ملاحظات الحصة</SelectItem><SelectItem value="class_group">من جروب المجموعة</SelectItem>
                            </SelectContent>
                          </Select>
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                <p className="text-sm font-bold">ماذا يعني التقدم هنا؟</p>
                <p className="mt-1 text-xs leading-6 text-muted-foreground">نقارن آخر درس أنهيته بآخر درس شرحه المدرس داخل الفرع نفسه. لو أنت في سنتر، نستخدم تقدم المجموعة كمرجع بديل فقط عندما لا نعرف تقدم المدرس.</p>
                <p className="mt-3 text-sm font-semibold text-foreground">
                  {currentGap.status === "calculated"
                    ? currentGap.gapCount! > 0 ? "أنت متأخر عن المرجع بـ " + currentGap.gapCount + " درس"
                      : currentGap.aheadCount! > 0 ? "أنت متقدم على المرجع بـ " + currentGap.aheadCount + " درس"
                      : "أنت مواكب للمرجع في الفرع ده"
                    : currentGap.status === "student_position_missing" ? "حدد آخر درس أنهيته أنت عشان نحسب الفرق" : "حدد موضعك وموضع المدرس عشان نحسب الفرق"}
                </p>
                {currentGap.status === "calculated" && <p className="mt-1 text-[11px] text-muted-foreground">المرجع المستخدم: {currentGap.referenceSource === "teacher" ? "مدرسك" : currentGap.referenceSource === "school" ? "السنتر / المجموعة" : "غير محدد"}</p>}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-6 text-muted-foreground">هنحفظ موضعك في الفرع ده فقط، وبعدها نفتح الفرع التالي. بيانات الفروع الأخرى تفضل محفوظة كما هي.</p>
                <Button type="button" onClick={() => submitCourseProgress(true)} disabled={saveCourseProgress.isPending || !courseMode || !currentBranchId} className="shrink-0 rounded-xl bg-primary">
                  {saveCourseProgress.isPending ? "جارٍ الحفظ..." : branchIndex < branches.length - 1 ? "حفظ والانتقال للفرع التالي" : subjectIndex < subjects.length - 1 ? "حفظ وإنهاء " + subjectName : "حفظ وإنهاء الإعداد"}
                </Button>
              </div>
            </>
          )}
          {!courseMode && <p className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm leading-6 text-muted-foreground">اختار طريقة دراسة المادة الأول. بعدها هتظهر بيانات المدرس والفرع والأسئلة المناسبة.</p>}
        </div>
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


      <section className="app-card mb-5 p-5 sm:p-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">ابدأ المذاكرة</p>
          <h2 className="mt-1 text-lg font-bold">الدرس الذي ستذاكره الآن</h2>
          <p className="mt-1 text-xs leading-6 text-muted-foreground">{subjectName} · {currentBranch?.branchTitle || "الفرع الحالي"}</p>
        </div>
        {branchChoices.length ? (
          <Select value={lessonId} onValueChange={setLessonId}>
            <SelectTrigger className="mt-4 h-12 rounded-xl bg-background"><SelectValue placeholder="اختر الدرس الذي ستذاكره" /></SelectTrigger>
            <SelectContent className="max-h-[360px]">
              {branchChoices.map(lesson => <SelectItem key={lesson.nodeId} value={lesson.nodeId}>{getSIECheckpointChoiceDisplayLabel(lesson)}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : <p className="mt-4 rounded-xl bg-muted/30 p-3 text-xs leading-6 text-muted-foreground">لا توجد دروس مفهرسة كافية لهذا الفرع حاليًا؛ لن نعرض اختيارًا غير موثوق.</p>}
      </section>

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
