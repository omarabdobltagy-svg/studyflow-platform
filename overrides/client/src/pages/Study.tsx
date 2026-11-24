import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { getSIECheckpointBranches, getSIECheckpointChoices, getSIECheckpointChoiceDisplayLabel, getSIECheckpointChoiceTypeLabel, getSIESubject, getSIETeacher, getSIETeachersForSubject, type SIESystemId } from "@shared/sie-catalog";
import { calculateLearningGap } from "@shared/sie-learning-progress";
import { Activity, BookOpenText, Check, ChevronDown, CircleHelp, Eye, Gauge, Mic2, RefreshCcw, Sparkles } from "lucide-react";
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
  const savedTeacherChoiceValue = savedTeacherId && savedTeacherId !== "__SKIP__" ? savedTeacherId : "__NONE__";
  const persistedCourseMode = savedCourseModes[subjectId] || currentCourseProgress.courseMode || "";
  const persistedTeacherName = savedTeacherNames[subjectId] || currentBranchProgress.teacherName || currentCourseProgress.teacherName || "";
  const teacherSelectionDirty = courseMode !== persistedCourseMode
    || (selectedTeacherId || "__NONE__") !== savedTeacherChoiceValue
    || teacherName.trim() !== persistedTeacherName.trim();
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
  }, [subjectId, currentBranchId, selectedTeacherId, currentBranchProgress.updatedAt, currentCourseProgress.updatedAt, profile.data?.obstacle, branches, branchChoices, progressMap]);


  const saveProgress = trpc.study.saveSubjectLessonProgress.useMutation({
    onSuccess: async () => {
      await utils.studentProfile.get.invalidate();
      toast.success("تم حفظ تقدمك في الدرس.");
    },
    onError: error => toast.error(error.message),
  });

  const saveBranchFrontier = trpc.learning.updateBranchFrontier.useMutation({
    onSuccess: async result => {
      await Promise.all([utils.studentProfile.get.invalidate(), utils.learning.get.invalidate()]);
      toast.success(result.savedStudent
        ? "تم حفظ موضعك أنت فقط. موضع المدرس لم يتغير."
        : "تم حفظ موضع المدرس / المجموعة فقط. موضعك أنت لم يتغير.");
    },
    onError: error => toast.error(error.message || "تعذّر حفظ موضع المنهج."),
  });
  const saveTeacherSelection = trpc.studentProfile.updateTeacherSelection.useMutation({
    onSuccess: async () => {
      await utils.studentProfile.get.invalidate();
      setTeacherChoiceDrafts(current => { const next = { ...current }; delete next[subjectId]; return next; });
      setCourseModeDrafts(current => { const next = { ...current }; delete next[subjectId]; return next; });
      setTeacherNameDrafts(current => { const next = { ...current }; delete next[subjectId]; return next; });
      toast.success("تم حفظ اختيار المدرس وطريقة الدراسة بشكل مستقل.");
    },
    onError: error => toast.error(error.message || "تعذّر حفظ اختيار المدرس."),
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

  const submitTeacherChoice = () => {
    if (!subjectId || !courseMode) {
      toast.error("حدد طريقة الدراسة أولًا.");
      return;
    }
    saveTeacherSelection.mutate({
      subjectId,
      courseMode,
      teacherId: selectedTeacherId ?? null,
      teacherName: teacherName.trim(),
    });
  };

  const submitStudentFrontier = () => {
    if (!subjectId || !currentBranchId) {
      toast.error("اختر المادة والفرع أولًا.");
      return;
    }
    if (!courseMode || teacherSelectionDirty) {
      toast.error("احفظ طريقة الدراسة واختيار المدرس أولًا من القسم المستقل.");
      return;
    }
    saveBranchFrontier.mutate({
      subjectId,
      branchId: currentBranchId,
      studentFrontierId: lastCompletedLessonId || "__UNKNOWN__",
    });
  };

  const submitTeacherFrontier = () => {
    if (!subjectId || !currentBranchId) {
      toast.error("اختر المادة والفرع أولًا.");
      return;
    }
    if (!courseMode || teacherSelectionDirty) {
      toast.error("احفظ طريقة الدراسة واختيار المدرس أولًا من القسم المستقل.");
      return;
    }
    if (!teacherReferenceName && courseMode !== "center") {
      toast.error("اختر المدرس أو اكتب اسمه قبل تسجيل موضع شرحه.");
      return;
    }
    const payload: {
      subjectId: string;
      branchId: string;
      teacherTeachingFrontierId?: string;
      schoolClassFrontierId?: string;
      schoolClassFrontierEvidenceSource?: typeof schoolClassEvidenceSource;
    } = { subjectId, branchId: currentBranchId };
    if (teacherReferenceName) payload.teacherTeachingFrontierId = teacherTeachingFrontierId;
    if (courseMode === "center") {
      payload.schoolClassFrontierId = schoolClassFrontierId;
      payload.schoolClassFrontierEvidenceSource = schoolClassEvidenceSource;
    }
    if (payload.teacherTeachingFrontierId === undefined && payload.schoolClassFrontierId === undefined) {
      toast.error("لا توجد بيانات مدرس أو مجموعة لحفظها.");
      return;
    }
    saveBranchFrontier.mutate(payload);
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
    <DashboardLayout title="المذاكرة وذكاء التقدم" description="كل وظيفة في قسم مستقل: اختيار المدرس، موضعك في المنهج، موضع المدرس، التراكم، ثم جلسة SQ3R.">
      {profile.isError && <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm">تعذّر تحميل ملفك الدراسي. <button className="font-bold underline" onClick={() => void profile.refetch()}>إعادة المحاولة</button></div>}
      <section className="app-card mb-5 overflow-hidden rounded-2xl">
        <header className="border-b border-border/70 bg-gradient-to-l from-secondary/65 to-card p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">01 · TEACHER SETUP</p>
              <h2 className="mt-1 text-xl font-bold">اختيار المدرس</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{subjectName} · حدد طريقة الدراسة والمدرس فقط. ده مستقل عن تسجيل تقدمك والتراكم.</p>
            </div>
            <span className="rounded-full border border-border bg-background px-3 py-2 text-xs font-semibold">المادة {subjectIndex + 1} من {subjects.length}</span>
          </div>
        </header>
        <div className="space-y-5 p-5 sm:p-6">
          {subjects.length > 1 && (
            <NativeSelectField
              label="المادة"
              value={subjectId}
              onChange={nextSubjectId => {
                setSubjectId(nextSubjectId);
                setBranchId("");
                setLessonId("");
              }}
              options={subjects.map(id => ({ value: id, label: getSIESubject(id)?.nameAr || id }))}
            />
          )}
          <div>
            <p className="mb-3 text-sm font-bold">طريقة دراسة المادة</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" aria-pressed={courseMode === "center"} onClick={() => {
                setCourseModeDrafts(current => ({ ...current, [subjectId]: "center" }));
                setTeacherChoiceDrafts(current => ({ ...current, [subjectId]: "__NONE__" }));
                setTeacherNameDrafts(current => ({ ...current, [subjectId]: "" }));
                setTeacherTeachingFrontierId("__UNKNOWN__");
              }} className={"rounded-2xl border p-4 text-right transition " + (courseMode === "center" ? "border-primary bg-secondary/45 ring-1 ring-primary/20" : "border-border bg-card hover:border-primary/35")}>
                <span className="block font-bold">سنتر / مجموعة</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">تحضر شرح المادة مع مدرس أو مجموعة. بيانات تقدم المجموعة ستظهر في قسم المنهج فقط.</span>
              </button>
              <button type="button" aria-pressed={courseMode === "online"} onClick={() => {
                setCourseModeDrafts(current => ({ ...current, [subjectId]: "online" }));
                setTeacherChoiceDrafts(current => ({ ...current, [subjectId]: "__NONE__" }));
                setTeacherNameDrafts(current => ({ ...current, [subjectId]: "" }));
                setTeacherTeachingFrontierId("__UNKNOWN__");
              }} className={"rounded-2xl border p-4 text-right transition " + (courseMode === "online" ? "border-primary bg-secondary/45 ring-1 ring-primary/20" : "border-border bg-card hover:border-primary/35")}>
                <span className="block font-bold">أونلاين</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">تتابع الشرح من منصة أو فيديوهات. اختر المدرس من قائمة المادة أو اكتبه يدويًا.</span>
              </button>
            </div>
          </div>

          {courseMode === "online" && (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-bold">مين المدرس اللي بتتابعه؟</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">اضغط على اسم واحد لتحديده. الاختيار يظهر بوضوح ويمكن تغييره في أي وقت.</p>
              </div>
              {teacherOptions.length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {teacherOptions.map(teacher => {
                    const selected = selectedTeacherId === teacher.teacherId;
                    return (
                      <button key={teacher.teacherId} type="button" aria-pressed={selected}
                        onClick={() => {
                          setTeacherChoiceDrafts(current => ({ ...current, [subjectId]: teacher.teacherId }));
                          setTeacherNameDrafts(current => ({ ...current, [subjectId]: "" }));
                          setTeacherTeachingFrontierId("__UNKNOWN__");
                        }}
                        className={"flex min-h-16 items-center justify-between gap-3 rounded-xl border p-4 text-right transition " + (selected ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border bg-background hover:border-primary/40")}>
                        <span className="min-w-0">
                          <span className="block font-bold">{teacher.nameAr}</span>
                          <span className="mt-1 block text-[11px] text-muted-foreground">{teacher.brandName || teacher.selectionLabel}</span>
                        </span>
                        <span className={"flex size-6 shrink-0 items-center justify-center rounded-full border " + (selected ? "border-primary bg-primary text-primary-foreground" : "border-border text-transparent")}>
                          {selected && <Check className="size-4" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-border bg-muted/20 p-3 text-xs leading-6 text-muted-foreground">لا توجد أسماء موثقة في القائمة لهذه المادة والنظام حاليًا. يمكنك كتابة اسم المدرس يدويًا.</p>
              )}
              <button type="button" aria-pressed={!selectedTeacherId && !teacherName.trim()}
                onClick={() => {
                  setTeacherChoiceDrafts(current => ({ ...current, [subjectId]: "__NONE__" }));
                  setTeacherNameDrafts(current => ({ ...current, [subjectId]: "" }));
                  setTeacherTeachingFrontierId("__UNKNOWN__");
                }}
                className={"rounded-lg border px-3 py-2 text-xs font-semibold transition " + (!selectedTeacherId && !teacherName.trim() ? "border-primary bg-secondary/40 text-foreground" : "border-border text-muted-foreground hover:border-primary/30")}>
                لم أحدد مدرسًا بعد
              </button>
            </div>
          )}

          {courseMode === "center" && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-bold">اسم مدرس السنتر</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">اكتب الاسم الذي تتابعه. موضع شرح المدرس ومكان المجموعة سيتسجلان كلٌّ في مكانه بقسم المنهج.</p>
              <Input value={teacherName} onChange={event => {
                setTeacherNameDrafts(current => ({ ...current, [subjectId]: event.target.value }));
                setTeacherChoiceDrafts(current => ({ ...current, [subjectId]: "__NONE__" }));
                if (event.target.value.trim()) setTeacherTeachingFrontierId("__UNKNOWN__");
              }} placeholder="اسم مدرس السنتر" maxLength={120} className="mt-3 h-12 rounded-xl bg-background" />
            </div>
          )}

          {courseMode === "online" && (
            <label className="block text-sm font-semibold">مدرس آخر (لو مش موجود في القائمة)
              <Input value={teacherName} onChange={event => {
                setTeacherNameDrafts(current => ({ ...current, [subjectId]: event.target.value }));
                if (event.target.value.trim()) {
                  setTeacherChoiceDrafts(current => ({ ...current, [subjectId]: "__NONE__" }));
                  setTeacherTeachingFrontierId("__UNKNOWN__");
                }
              }} placeholder="اكتب اسم المدرس يدويًا" maxLength={120} className="mt-2 h-12 rounded-xl bg-background" />
            </label>
          )}

          <div className="flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className={"text-xs leading-6 " + (teacherSelectionDirty ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground")}>
              {teacherSelectionDirty ? "يوجد تغيير غير محفوظ في المدرس أو طريقة الدراسة." : selectedTeacher ? "المدرس الحالي: " + selectedTeacher.nameAr + " · الاختيار محفوظ." : teacherName.trim() ? "المدرس الحالي: " + teacherName.trim() + " · الاختيار محفوظ." : "بيانات اختيار المدرس محفوظة بشكل مستقل."}
            </p>
            <Button type="button" onClick={submitTeacherChoice} disabled={!courseMode || !teacherSelectionDirty || saveTeacherSelection.isPending} className="rounded-xl bg-primary">
              {saveTeacherSelection.isPending ? "جارٍ حفظ اختيار المدرس..." : "حفظ اختيار المدرس"}
            </Button>
          </div>
        </div>
      </section>

      <section className="app-card mb-5 overflow-hidden rounded-2xl">
        <header className="border-b border-border/70 bg-card p-5 sm:p-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">02 · CURRICULUM POSITION</p>
          <h2 className="mt-1 text-xl font-bold">موضعك في المنهج</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">حدد آخر نقطة أنهيتها أنت في كل فرع. هذا لا يغير اختيار المدرس ولا يسجل جلسة مذاكرة.</p>
        </header>
        <div className="space-y-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">المادة: {subjectName}</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs font-semibold text-muted-foreground">الفرع {branchIndex + 1} من {Math.max(branches.length, 1)}</span>
          </div>
          {branches.length > 1 && (
            <div>
              <p className="mb-2 text-sm font-bold">اختر الفرع الذي تسجل تقدمك فيه</p>
              <div className="flex flex-wrap gap-2">
                {branches.map((branch, index) => (
                  <button key={branch.branchId} type="button" aria-pressed={branch.branchId === currentBranchId}
                    onClick={() => { setBranchId(branch.branchId); setLessonId(""); }}
                    className={"rounded-xl border px-4 py-3 text-sm font-semibold transition " + (branch.branchId === currentBranchId ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground")}>
                    {branch.branchTitle}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="rounded-2xl border border-border/70 bg-muted/15 p-4">
            <div className="mb-4">
              <p className="font-bold">{currentBranch?.branchTitle || "الفرع الحالي"}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{branchChoices.length} عنصر مفهرس متاح في هذا الفرع. اختيارك هنا يخص موضعك أنت فقط.</p>
            </div>
            {branchChoices.length ? (
              <NativeSelectField
                label="آخر درس أنهيته أنت"
                hint="اختر آخر نقطة أنهيت مذاكرتها بالفعل، وليس الدرس الذي بدأت فيه فقط."
                value={lastCompletedLessonId || "__UNKNOWN__"}
                onChange={setLastCompletedLessonId}
                options={[
                  { value: "__UNKNOWN__", label: "لم أحدد بعد" },
                  { value: "__NOT_STARTED__", label: "لم أبدأ هذا الفرع" },
                  ...branchChoices.map((choice, index) => ({ value: choice.nodeId, label: (choice.courseSequenceNumber ? "الدرس " + choice.courseSequenceNumber : choice.lessonNumber ? "الدرس " + choice.lessonNumber : "عنصر " + (index + 1)) + " — " + choice.title })),
                ]}
              />
            ) : (
              <p className="rounded-xl border border-dashed border-border bg-background p-4 text-sm leading-6 text-muted-foreground">فهرس هذا الفرع غير متاح بعد. لن نختلق دروسًا أو نحسب تراكمًا غير موثوق.</p>
            )}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-6 text-muted-foreground">احفظ موضعك في هذا الفرع فقط. مواضع الفروع الأخرى تظل مستقلة.</p>
            <Button type="button" onClick={submitStudentFrontier} disabled={saveBranchFrontier.isPending || !courseMode || teacherSelectionDirty || !currentBranchId} className="rounded-xl bg-primary">
              {saveBranchFrontier.isPending ? "جارٍ الحفظ..." : "حفظ موضعك فقط"}
            </Button>
          </div>
        </div>
      </section>

      <section className="app-card mb-5 overflow-hidden rounded-2xl">
        <header className="border-b border-border/70 bg-card p-5 sm:p-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">03 · TEACHER FRONTIER</p>
          <h2 className="mt-1 text-xl font-bold">موضع المدرس / المجموعة</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">سجل آخر نقطة انتهى المدرس من شرحها. لو الدراسة في سنتر، سجل موضع المجموعة في حقل منفصل؛ الأونلاين لا يعرض بيانات مجموعة.</p>
        </header>
        <div className="space-y-4 p-5 sm:p-6">
          {!teacherReferenceName && (
            <p className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm leading-6 text-muted-foreground">احفظ اسم المدرس أولًا في قسم اختيار المدرس حتى نربط موضع الشرح بالشخص الصحيح.</p>
          )}
          {branchChoices.length > 0 ? (
            <NativeSelectField
              label={teacherReferenceName ? "آخر درس انتهى " + teacherReferenceName + " من شرحه" : "موضع شرح المدرس"}
              hint="هذا تقرير عن تقدم المدرس، وليس تقدمك أنت."
              value={teacherTeachingFrontierId}
              onChange={setTeacherTeachingFrontierId}
              disabled={!teacherReferenceName || teacherSelectionDirty}
              options={[
                { value: "__UNKNOWN__", label: "لا أعرف / لم أحدد" },
                { value: "__NOT_STARTED__", label: "لم يبدأ هذا الفرع" },
                ...branchChoices.map((choice, index) => ({ value: choice.nodeId, label: (choice.courseSequenceNumber ? "الدرس " + choice.courseSequenceNumber : choice.lessonNumber ? "الدرس " + choice.lessonNumber : "عنصر " + (index + 1)) + " — " + choice.title })),
              ]}
            />
          ) : (
            <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">لا تتوفر نقاط منهج مفهرسة لهذا الفرع حاليًا.</p>
          )}
          {courseMode === "center" && (
            <div className="rounded-2xl border border-border/70 bg-muted/15 p-4">
              <NativeSelectField
                label="آخر نقطة وصل لها السنتر / المجموعة"
                hint="هذه معلومة مستقلة عن آخر نقطة شرحها المدرس، وقد تستخدم كمرجع بديل عند غياب بيانات المدرس."
                value={schoolClassFrontierId}
                onChange={setSchoolClassFrontierId}
                options={[
                  { value: "__UNKNOWN__", label: "لا أعرف / غير متأكد" },
                  { value: "__NOT_STARTED__", label: "لم يبدأوا هذا الفرع" },
                  ...branchChoices.map((choice, index) => ({ value: choice.nodeId, label: (choice.courseSequenceNumber ? "الدرس " + choice.courseSequenceNumber : choice.lessonNumber ? "الدرس " + choice.lessonNumber : "عنصر " + (index + 1)) + " — " + choice.title })),
                ]}
              />
              <NativeSelectField
                label="مصدر المعلومة"
                value={schoolClassEvidenceSource}
                onChange={value => setSchoolClassEvidenceSource(value as typeof schoolClassEvidenceSource)}
                options={[
                  { value: "unknown", label: "لم أتأكد بعد" },
                  { value: "teacher_confirmed", label: "المدرس أكدها" },
                  { value: "classmate_confirmed", label: "زميل في المجموعة قال لي" },
                  { value: "class_notes", label: "من ملاحظات الحصة" },
                  { value: "class_group", label: "من جروب المجموعة" },
                ]}
              />
            </div>
          )}
          <div className="flex justify-end">
            <Button type="button" onClick={submitTeacherFrontier} disabled={saveBranchFrontier.isPending || !courseMode || teacherSelectionDirty || !currentBranchId} variant="outline" className="rounded-xl">
              حفظ موضع المدرس
            </Button>
          </div>
        </div>
      </section>

      <section className="app-card mb-5 overflow-hidden rounded-2xl">
        <header className="border-b border-border/70 bg-card p-5 sm:p-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">04 · LEARNING GAP</p>
          <h2 className="mt-1 text-xl font-bold">التراكم الدراسي</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">قراءة مستقلة للفرق بين تقدمك والمرجع الذي اخترته، داخل الفرع الحالي فقط.</p>
        </header>
        <div className="grid gap-3 p-5 sm:grid-cols-3 sm:p-6">
          <div className="rounded-xl border border-border/70 bg-background p-4">
            <p className="text-xs text-muted-foreground">موضعك أنت</p>
            <p className="mt-2 font-semibold">{currentGap.studentFrontierTitle || (lastCompletedLessonId === "__NOT_STARTED__" ? "لم تبدأ الفرع" : "غير محدد")}</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-background p-4">
            <p className="text-xs text-muted-foreground">المرجع المقارن</p>
            <p className="mt-2 font-semibold">{currentGap.referenceFrontierTitle || (currentGap.referenceSource === "teacher" ? "موضع المدرس" : currentGap.referenceSource === "school" ? "موضع المجموعة" : "غير محدد")}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{currentGap.referenceSource === "teacher" ? "المدرس" : currentGap.referenceSource === "school" ? "السنتر / المجموعة" : "لا يوجد مرجع محفوظ"}</p>
          </div>
          <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
            <p className="text-xs text-muted-foreground">الفجوة في هذا الفرع</p>
            <p className="mt-2 text-xl font-bold text-primary">
              {currentGap.status !== "calculated" ? "غير محسوبة" : currentGap.gapCount! > 0 ? currentGap.gapCount + " " + currentBranchPointLabel : currentGap.aheadCount! > 0 ? "متقدم بـ " + currentGap.aheadCount + " " + currentBranchPointLabel : "لا يوجد تراكم"}
            </p>
          </div>
          <p className="text-xs leading-6 text-muted-foreground sm:col-span-3">
            {currentGap.status === "student_position_missing" ? "حدد موضعك أنت أولًا." : currentGap.status === "reference_missing" ? "حدد موضع المدرس، أو موضع المجموعة عند الدراسة في سنتر، حتى يظهر التراكم." : "الحساب يستخدم عدد نقاط الفهرس داخل هذا الفرع فقط؛ لا يعمم الرقم على بقية فروع المادة."}
          </p>
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
          <h2 className="mt-1 text-lg font-bold">جلسة SQ3R</h2>
          <p className="mt-1 text-xs leading-6 text-muted-foreground">اختر درسًا لبدء خطوات المسح والتساؤل والقراءة والتسميع والمراجعة. لا يؤثر هذا الاختيار على تحديد موضعك في المنهج.</p>
        </div>
        {branchChoices.length ? (
          <NativeSelectField
            label="اختر الدرس الذي ستطبق عليه SQ3R"
            value={lessonId}
            onChange={setLessonId}
            options={branchChoices.map((lesson, index) => ({ value: lesson.nodeId, label: (lesson.courseSequenceNumber ? "الدرس " + lesson.courseSequenceNumber : lesson.lessonNumber ? "الدرس " + lesson.lessonNumber : "عنصر " + (index + 1)) + " — " + lesson.title }))}
          />
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
              <div className="mt-3">
                <NativeSelectField
                  label="مستوى الصعوبة"
                  value={difficulty}
                  onChange={value => { const next = value as typeof difficulty; setDifficulty(next); updateProgress(completedSteps, next); }}
                  options={[
                    { value: "unknown", label: "لم أحدد بعد" },
                    { value: "easy", label: "سهل" },
                    { value: "medium", label: "متوسط" },
                    { value: "hard", label: "صعب ويحتاج وقتًا" },
                  ]}
                />
              </div>
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

type NativeSelectOption = { value: string; label: string };

function NativeSelectField({
  label,
  hint,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  options: NativeSelectOption[];
  disabled?: boolean;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <label className="block text-sm font-bold">{label}</label>
      {hint && <p className="text-xs leading-5 text-muted-foreground">{hint}</p>}
      <div className="relative">
        <select
          dir="rtl"
          aria-label={label}
          value={value}
          onChange={event => onChange(event.target.value)}
          disabled={disabled}
          className="h-12 w-full appearance-none rounded-xl border border-border bg-background px-4 pl-11 text-sm font-medium text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    </div>
  );
}
