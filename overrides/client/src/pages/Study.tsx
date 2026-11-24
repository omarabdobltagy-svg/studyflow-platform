import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { trpc } from "@/lib/trpc";
import { getSIECheckpointBranches, getSIECheckpointChoices, getSIESubject, getSIETeacher } from "@shared/sie-catalog";
import { calculateLearningGap } from "@shared/sie-learning-progress";
import { BookOpenText, Check, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";

export default function Study() {
  const utils = trpc.useUtils();
  const profile = trpc.studentProfile.get.useQuery();
  const activeExternalSession = trpc.learning.activeExternalSession.useQuery();
  const [sessionNow, setSessionNow] = useState(Date.now());
  const [markSessionLessonCompleted, setMarkSessionLessonCompleted] = useState(false);
  const initialStudyParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const [subjectId, setSubjectId] = useState(initialStudyParams?.get("subject") || "");
  const [branchId, setBranchId] = useState(initialStudyParams?.get("branch") || "");
  const [lessonId, setLessonId] = useState(initialStudyParams?.get("lesson") || "");
  const [subjectSearch, setSubjectSearch] = useState("");
  const subjects = profile.data?.subjectIds || [];
  const selection = (profile.data?.selection || {}) as Record<string, any>;
  const courseProgressMap = (selection.learningCourseProgress || {}) as Record<string, any>;
  const currentCourseProgress = courseProgressMap[subjectId] || {};
  const branchProgressMap = (currentCourseProgress.branches || {}) as Record<string, Record<string, any>>;
  const savedTeacherId = ((selection.teacherChoices || {}) as Record<string, string>)[subjectId]
    || (profile.data?.teacherSelections || {})[subjectId];
  const selectedTeacherId = savedTeacherId && savedTeacherId !== "__SKIP__" ? savedTeacherId : undefined;
  const selectedTeacher = selectedTeacherId ? getSIETeacher(selectedTeacherId) : undefined;
  const savedCourseModes = (selection.courseModes || {}) as Record<string, "center" | "online">;
  const courseMode = savedCourseModes[subjectId] || currentCourseProgress.courseMode || "";
  const savedTeacherNames = (selection.customTeacherNames || {}) as Record<string, string>;
  const teacherReferenceNameBase = (savedTeacherNames[subjectId] || selectedTeacher?.nameAr || "").trim();
  const branches = useMemo(() => getSIECheckpointBranches(subjectId), [subjectId]);
  const currentBranch = branches.find(branch => branch.branchId === branchId) ?? branches[0];
  const branchChoices = currentBranch?.choices ?? [];
  const lessons = branchChoices;
  const currentBranchId = currentBranch?.branchId ?? "";
  const currentBranchPointLabel = currentBranch?.branchType === "official_section" ? "موضوع" : "درس";
  const isLinearSubject = subjectId === "HIS_G2_BAC" || subjectId === "PROG_AI_G2_BAC";
  const legacyLinearRecords = isLinearSubject ? Object.values(branchProgressMap) : [];
  const legacyFrontierFromRecords = (field: string, teacherOnly = false) => {
    const candidates = legacyLinearRecords
      .filter(record => Object.prototype.hasOwnProperty.call(record, field))
      .filter(record => !teacherOnly || (
        selectedTeacherId
          ? (!record.teacherId || record.teacherId === selectedTeacherId)
          : (!record.teacherName || record.teacherName === teacherReferenceNameBase)
      ))
      .map(record => {
        const value = record[field] as string;
        const rank = value === "__UNKNOWN__" ? -2
          : value === "__NOT_STARTED__" ? -1
            : branchChoices.findIndex(choice => choice.nodeId === value);
        return { value, rank };
      })
      .filter(item => item.rank >= -2)
      .sort((left, right) => left.rank - right.rank);
    return candidates.length ? candidates[candidates.length - 1].value : undefined;
  };
  const legacyLinearProgress = {
    ...(legacyFrontierFromRecords("lastCompletedLessonId") !== undefined
      ? { lastCompletedLessonId: legacyFrontierFromRecords("lastCompletedLessonId") } : {}),
    ...(legacyFrontierFromRecords("teacherTeachingFrontierId", true) !== undefined
      ? { teacherTeachingFrontierId: legacyFrontierFromRecords("teacherTeachingFrontierId", true) } : {}),
    ...(legacyFrontierFromRecords("schoolClassFrontierId") !== undefined
      ? { schoolClassFrontierId: legacyFrontierFromRecords("schoolClassFrontierId") } : {}),
    ...(selectedTeacherId ? { teacherId: selectedTeacherId } : {}),
    ...(teacherReferenceNameBase ? { teacherName: teacherReferenceNameBase } : {}),
  };
  const currentBranchProgress = currentBranchId
    ? branchProgressMap[currentBranchId] || legacyLinearProgress
    : {};
  const subjectIndex = Math.max(0, subjects.indexOf(subjectId));  const subjectIndex = Math.max(0, subjects.indexOf(subjectId));
  const branchIndex = Math.max(0, branches.findIndex(branch => branch.branchId === currentBranchId));
  const [studentFrontierDrafts, setStudentFrontierDrafts] = useState<Record<string, string>>({});

  const studentFrontierDraftKey  const studentFrontierDraftKey = subjectId + "::" + currentBranchId;
  const legacyStudentState = ((selection.teacherProgressState || {}) as Record<string, Record<string, any>>)[subjectId] || {};
  const belongsToCurrentBranch = (value: unknown): value is string =>
    typeof value === "string" &&
    (value === "__NOT_STARTED__" || branchChoices.some(lesson => lesson.nodeId === value));
  const legacyStudentFrontier = currentCourseProgress.lastCompletedLessonId
    ?? legacyStudentState.studentAttendedFrontier;
  const savedStudentFrontierId = Object.prototype.hasOwnProperty.call(currentBranchProgress, "lastCompletedLessonId")
    ? currentBranchProgress.lastCompletedLessonId
    : belongsToCurrentBranch(legacyStudentFrontier)
      ? legacyStudentFrontier
      : "__UNKNOWN__";
  const currentBranchTeacherMatchesSelection = !currentBranchProgress.teacherId
    || currentBranchProgress.teacherId === selectedTeacherId;
  const teacherTeachingFrontierId = selectedTeacherId && currentBranchTeacherMatchesSelection
    ? (typeof currentBranchProgress.teacherTeachingFrontierId === "string"
      ? currentBranchProgress.teacherTeachingFrontierId
      : belongsToCurrentBranch(currentCourseProgress.teacherTeachingFrontierId)
        ? currentCourseProgress.teacherTeachingFrontierId
        : "__UNKNOWN__")
    : "__UNKNOWN__";
  const schoolClassFrontierId = Object.prototype.hasOwnProperty.call(currentBranchProgress, "schoolClassFrontierId")
    ? currentBranchProgress.schoolClassFrontierId
    : belongsToCurrentBranch(currentCourseProgress.schoolClassFrontierId)
      ? currentCourseProgress.schoolClassFrontierId
      : "__UNKNOWN__";
  const lastCompletedLessonId = Object.prototype.hasOwnProperty.call(studentFrontierDrafts, studentFrontierDraftKey)  const lastCompletedLessonId = Object.prototype.hasOwnProperty.call(studentFrontierDrafts, studentFrontierDraftKey)
    ? studentFrontierDrafts[studentFrontierDraftKey]
    : savedStudentFrontierId;
  const hasStudentFrontierSelection = lastCompletedLessonId !== "__UNKNOWN__"
    || Boolean(currentBranchProgress.studentFrontierConfirmedAt)
    || Object.prototype.hasOwnProperty.call(studentFrontierDrafts, studentFrontierDraftKey);
  const branchChoiceOptions = branchChoices.map((choice, index) => ({
    value: choice.nodeId,
    label: choice.title,
    description: choice.courseSequenceNumber
      ? "تسلسل الكورس " + choice.courseSequenceNumber
      : choice.lessonNumber
        ? (choice.unitNumber ? "الوحدة " + choice.unitNumber + " · " : "") + "الدرس " + choice.lessonNumber
        : choice.unitTitle || "نقطة " + (index + 1),
  }));
  const currentBranchLastLessonId = branchChoices[branchChoices.length - 1]?.nodeId;
  const isCurrentBranchComplete = Boolean(currentBranchLastLessonId && lastCompletedLessonId === currentBranchLastLessonId);
  const setLastCompletedLessonId = (value: string) => {
    setStudentFrontierDrafts(current => ({ ...current, [studentFrontierDraftKey]: value }));
  };

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
      setLessonId("");
    }
  }, [subjectId, currentBranchId, branchChoices, lessonId]);

  const saveBranchFrontier = trpc.learning.updateBranchFrontier.useMutation({
    onSuccess: async result => {
      await Promise.all([utils.studentProfile.get.invalidate(), utils.learning.get.invalidate()]);
      if (result.savedStudent) {
        setStudentFrontierDrafts(current => {
          const next = { ...current };
          delete next[studentFrontierDraftKey];
          return next;
        });
        const lastLessonId = currentBranch?.choices[currentBranch.choices.length - 1]?.nodeId;
        const branchCompleted = Boolean(lastLessonId && result.record?.lastCompletedLessonId === lastLessonId);
        if (!branchCompleted) {
          toast.success("تم حفظ تقدمك في " + (currentBranch?.branchTitle || "الفرع") + ". ستبقى هنا حتى تسجل إكمال آخر درس.");
          return;
        }
        const nextBranch = branches[branchIndex + 1];
        if (nextBranch) {
          setBranchId(nextBranch.branchId);
          setLessonId("");
          toast.success("تم حفظ موضع " + (currentBranch?.branchTitle || "الفرع") + "؛ ننتقل إلى " + nextBranch.branchTitle + ".");
          return;
        }
        const nextSubjectId = subjects[subjectIndex + 1];
        if (nextSubjectId) {
          setSubjectId(nextSubjectId);
          setBranchId("");
          setLessonId("");
          toast.success("اكتملت فروع " + subjectName + "؛ ننتقل إلى " + (getSIESubject(nextSubjectId)?.nameAr || "المادة التالية") + ".");
          return;
        }
        toast.success("تم حفظ موضعك واكتمل المرور على فروع المادة.");
      } else {
        toast.success("تم حفظ موضع المدرس / المجموعة فقط. موضعك أنت لم يتغير.");
      }
    },
    onError: error => toast.error(error.message || "تعذّر حفظ موضع المنهج."),
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

  const submitBranchProgress = () => {
    if (!subjectId || !currentBranchId || !branchChoices.length) {
      toast.error("اختَر فرعًا له فهرس دروس متاح أولًا.");
      return;
    }
    if (!hasStudentFrontierSelection) {
      toast.error("حدد آخر درس أنهيته، أو اختر «موضعي غير معروف».");
      return;
    }
    const validFrontier = (value: string) =>
      value === "__UNKNOWN__" || value === "__NOT_STARTED__" || branchChoices.some(choice => choice.nodeId === value);
    const studentFrontier = validFrontier(lastCompletedLessonId) ? lastCompletedLessonId : "__UNKNOWN__";
    saveBranchFrontier.mutate({ subjectId, branchId: currentBranchId, studentFrontierId: studentFrontier });
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

  const subjectName = (getSIESubject(subjectId)?.nameAr || subjectId);
  const visibleSubjects = subjects.filter(id =>
    normalizeFrontierSearch(getSIESubject(id)?.nameAr || id).includes(normalizeFrontierSearch(subjectSearch))
  );
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
    <DashboardLayout title="المذاكرة والتقدم" description="اختر المادة، وسجّل آخر نقطة وصلت إليها في المنهج.">
      {profile.isError && <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm">تعذّر تحميل ملفك الدراسي. <button className="font-bold underline" onClick={() => void profile.refetch()}>إعادة المحاولة</button></div>}
      <section className="app-card mb-5 overflow-hidden rounded-2xl">
        <header className="border-b border-border/70 bg-gradient-to-l from-secondary/65 to-card p-5 sm:p-6">
          <p className="text-[10px] font-bold tracking-[0.12em] text-primary">المادة</p>
          <h2 className="mt-1 text-xl font-bold">اختيار المادة</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">اختر المادة التي تريد متابعة تقدمك فيها. بيانات المدرّس وطريقة الدراسة محفوظة في ملف حسابك.</p>
        </header>
        <div className="space-y-3 p-5 sm:p-6">
          <div className="relative">
            <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={subjectSearch} onChange={event => setSubjectSearch(event.target.value)}
              placeholder="ابحث عن مادة..." aria-label="البحث عن مادة" className="h-11 rounded-xl pr-9 text-sm" />
            {subjectSearch && <button type="button" aria-label="مسح البحث" onClick={() => setSubjectSearch("")}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted"><X className="size-3.5" /></button>}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {visibleSubjects.map(id => {
              const active = id === subjectId;
              return <motion.button key={id} type="button" aria-pressed={active}
                onClick={() => { setSubjectId(id); setBranchId(""); setLessonId(""); }}
                whileTap={{ scale: 0.98 }}
                className={"min-h-12 rounded-xl border px-3 py-3 text-sm font-semibold transition " + (active ? "border-primary bg-primary/10 text-foreground ring-2 ring-primary/15" : "border-border bg-background text-muted-foreground hover:border-primary/35")}>
                {getSIESubject(id)?.nameAr || id}
              </motion.button>;
            })}
          </div>
          {!visibleSubjects.length && <p className="rounded-xl bg-muted/30 p-4 text-center text-sm text-muted-foreground">لا توجد مادة مطابقة لبحثك.</p>}
        </div>
      </section>

      <section className="app-card mb-5 overflow-hidden rounded-2xl">
        <header className="border-b border-border/70 bg-gradient-to-l from-secondary/55 to-card p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold tracking-[0.12em] text-primary">تقدم المنهج</p>
              <h2 className="mt-1 text-xl font-bold">اختر فرع المنهج</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                اختَر الفرع، ثم حدّد آخر درس أنهيته أنت. البحث إضافة لتسهيل الوصول، وكل الاختيارات تظل ظاهرة.
              </p>
            </div>
            <div className="flex max-w-full flex-col gap-1 rounded-xl border border-border/70 bg-background/70 px-3 py-2 text-xs">
              <span className="font-bold">{subjectName}</span>
            </div>
          </div>
        </header>
        <div className="space-y-5 p-4 sm:p-6">
          {branches.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/15 p-5 text-center">
              <BookOpenText className="mx-auto size-7 text-muted-foreground" />
              <h3 className="mt-3 font-bold">فهرس المادة غير متاح بعد</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">لن نعرض نطاقًا زمنيًا تقديريًا أو نخترع دروسًا غير موجودة في الفهرس. سجّل هذه المادة بعد تحميل فهرسها المعتمد.</p>
            </div>
          ) : (
            <>
              {branches.length > 1 && (
                <div className="rounded-2xl border border-border/70 bg-muted/15 p-3 sm:p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold">فروع {subjectName}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">اختَر الفرع الذي تريد تسجيل التقدم فيه.</p>
                    </div>
                    <span className="shrink-0 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-bold tabular-nums">{branchIndex + 1} / {branches.length}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                    {branches.map((branch, index) => {
                      const savedPosition = branchProgressMap[branch.branchId]?.lastCompletedLessonId;
                      const hasProgress = typeof savedPosition === "string"
                        && savedPosition !== "__UNKNOWN__"
                        && savedPosition !== "__NOT_STARTED__"
                        && branch.choices.some(choice => choice.nodeId === savedPosition);
                      const isComplete = branch.choices.length > 0
                        && savedPosition === branch.choices[branch.choices.length - 1]?.nodeId;
                      const active = branch.branchId === currentBranchId;
                      return (
                        <button key={branch.branchId} type="button" aria-pressed={active} aria-current={active ? "step" : undefined}
                          onClick={() => {
                            setBranchId(branch.branchId);
                            setLessonId("");
                          }}
                          className={"flex min-h-14 min-w-0 items-center gap-2 rounded-xl border px-3 py-2.5 text-right text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 " +
                            (active ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/20" : isComplete ? "border-emerald-500/25 bg-emerald-500/[0.05] text-foreground" : hasProgress ? "border-primary/25 bg-primary/[0.035] text-foreground" : "border-border bg-background text-muted-foreground hover:border-primary/35 hover:text-foreground")}>
                          <span className={"flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] " + (isComplete ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                            {isComplete ? <Check className="size-3.5" /> : index + 1}
                          </span>
                          <span className="min-w-0 break-words leading-5">{branch.branchTitle}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={subjectId + "::" + currentBranchId}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }} className="space-y-4">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold tracking-[0.12em] text-primary">الفرع الحالي · {branchIndex + 1}</p>
                      <h3 className="mt-1 text-lg font-bold">{currentBranch?.branchTitle || "الفرع الحالي"}</h3>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{branchChoices.length} {currentBranchPointLabel} في فهرس هذا الفرع.</p>
                    </div>
                    <span className="rounded-lg border border-border bg-background px-3 py-2 text-[11px] font-semibold text-muted-foreground">
                      {branches[branchIndex + 1] ? "التالي: " + branches[branchIndex + 1].branchTitle : "آخر فرع في المادة"}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <motion.div className="h-full rounded-full bg-primary" initial={false}
                      animate={{ width: ((branchIndex + 1) / Math.max(branches.length, 1) * 100) + "%" }}
                      transition={{ type: "spring", stiffness: 110, damping: 22 }} />
                  </div>
                  {branchChoices.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border bg-muted/10 p-4">
                      <div className="flex items-start gap-3">
                        <BookOpenText className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-foreground">فهرس الدروس لم يكتمل بعد</h4>
                          <p className="mt-1 text-xs leading-6 text-muted-foreground">
                            المادة موجودة في ملفك، لكن عناوين دروسها المعتمدة لم تُربط بالتطبيق بعد. لن نخترع أسماء دروس أو نسجّل تقدمًا غير مؤكد.
                          </p>
                          <Button type="button" variant="outline" size="sm" className="mt-3 rounded-lg"
                            onClick={() => {
                              const nextSubjectId = subjects[subjectIndex + 1];
                              if (nextSubjectId) {
                                setSubjectId(nextSubjectId);
                                setBranchId("");
                                setLessonId("");
                                toast.success("تم تجاوز " + subjectName + " مؤقتًا؛ انتقلنا إلى " + (getSIESubject(nextSubjectId)?.nameAr || "المادة التالية") + ".");
                              } else {
                                toast.info("وصلت إلى آخر مادة في ملفك. هذه المادة ما زالت تحتاج إلى فهرس معتمد.");
                              }
                            }}>
                            {subjects[subjectIndex + 1] ? "تجاوز المادة مؤقتًا واستمر" : "وصلت لآخر مادة"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="min-w-0 rounded-2xl border border-primary/20 bg-primary/[0.035] p-3 sm:p-4">
                      <div className="border-b border-border/70 pb-3">
                        <p className="text-[10px] font-bold tracking-[0.12em] text-primary">تقدمك</p>
                        <h4 className="mt-1 break-words text-sm font-bold sm:text-base">آخر درس أنهيته</h4>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">اختَر موضعك من قائمة الدروس؛ ويمكنك البحث لتصفية الاختيارات فقط.</p>
                      </div>
                      <div className="mt-3">
                        <SearchableFrontierPicker label="موضعك في هذا الفرع"
                          hint="كل الدروس متاحة للاختيار، والبحث يضيّق النتائج فقط."
                          value={hasStudentFrontierSelection ? lastCompletedLessonId : ""}
                          onChange={setLastCompletedLessonId} disabled={saveBranchFrontier.isPending}
                          options={[
                            { value: "__NOT_STARTED__", label: "لم أبدأ هذا الفرع" },
                            { value: "__UNKNOWN__", label: "موضعي غير معروف" },
                            ...branchChoiceOptions,
                          ]} />
                      </div>
                    </div>
                  )}
                  <div className="flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[11px] leading-6 text-muted-foreground">
                      احفظ موضعك الحالي. الانتقال للفرع التالي يحدث عند تأكيد إكمال آخر درس في الفرع.
                    </p>
                    <Button type="button" onClick={submitBranchProgress}
                      disabled={!hasStudentFrontierSelection || saveBranchFrontier.isPending || !branchChoices.length || !currentBranchId}
                      className="w-full shrink-0 rounded-xl bg-primary sm:w-auto">
                      {saveBranchFrontier.isPending
                        ? "جارٍ حفظ التقدم..."
                        : isCurrentBranchComplete
                          ? branches[branchIndex + 1] ? "إكمال الفرع والانتقال للتالي" : "إكمال الفرع"
                          : "حفظ التقدم"}
                    </Button>
                  </div>
                </motion.div>
              </AnimatePresence>
            </>
          )}
        </div>
      </section>

      <section className="app-card mb-5 overflow-hidden rounded-2xl">
        <header className="border-b border-border/70 bg-card p-5 sm:p-6">
          <p className="text-[10px] font-bold tracking-[0.12em] text-primary">التراكم الدراسي</p>
          <h2 className="mt-1 text-xl font-bold">التراكم الدراسي</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">قراءة مستقلة للفجوة داخل الفرع الحالي. يظهر المرجع المحفوظ في ملف حسابك تلقائيًا دون الحاجة لاختياره هنا.</p>
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
            {currentGap.status === "student_position_missing" ? "حدد موضعك أنت أولًا." : currentGap.status === "reference_missing" ? "لا يوجد مرجع محفوظ للمقارنة حتى الآن؛ يمكنك متابعة تقدمك دون إعداد إضافي هنا." : "الحساب يستخدم عدد نقاط الفهرس داخل هذا الفرع فقط؛ لا يعمم الرقم على بقية فروع المادة."}
          </p>
        </div>
      </section>

      <section className="app-card mb-5 p-5 sm:p-6">
        <div>
          <p className="text-[10px] font-bold tracking-[0.12em] text-primary">المذاكرة</p>
          <h2 className="mt-1 text-lg font-bold">اختيار درس لجلسة المذاكرة</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">اختر الدرس الذي ستذاكره خارج StudyFlow. هذه الجلسة ومؤقتها منفصلان عن SQ3R وعن تسجيل تقدم المنهج.</p>
        </div>
        {branchChoices.length ? (
          <div className="mt-4">
            <SearchableFrontierPicker label="الدرس" hint="تظهر كل دروس الفرع، ويمكنك البحث بينها دون استبدال الاختيارات."
              value={lessonId} onChange={setLessonId} options={branchChoiceOptions} />
          </div>
        ) : <p className="mt-4 rounded-xl bg-muted/30 p-3 text-xs leading-6 text-muted-foreground">لا توجد دروس مفهرسة لهذا الفرع بعد.</p>}
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


      <section className="app-card mt-6 p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[0.12em] text-primary">اقتراحات المراجعة</p>
            <h2 className="mt-1 font-bold">مراجعات مقترحة لهذا الفرع</h2>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">يبحث عن مراجعات بالاستناد إلى المادة والفرع والمدرس المسجل في ملف حسابك. راجع محتوى الفيديو قبل الاعتماد عليه.</p>
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


type ChoiceButtonOption = { value: string; label: string; description?: string };

function normalizeFrontierSearch(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ـ/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function SearchableFrontierPicker({
  label, hint, value, onChange, options, disabled = false,
}: {
  label: string; hint?: string; value: string; onChange: (value: string) => void;
  options: ChoiceButtonOption[]; disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = normalizeFrontierSearch(query);
  const visibleOptions = normalizedQuery
    ? options.filter(option => normalizeFrontierSearch(option.label + " " + (option.description ?? "")).includes(normalizedQuery))
    : options;
  return (
    <div className="min-w-0 space-y-2.5">
      <div><p className="text-sm font-bold">{label}</p>{hint && <p className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</p>}</div>
      <div className="relative">
        <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={event => setQuery(event.target.value)} disabled={disabled}
          placeholder="ابحث باسم الدرس أو رقمه..." aria-label={"البحث في " + label} className="h-11 rounded-xl pr-9 pl-9 text-xs" />
        {query && <button type="button" aria-label="مسح البحث" onClick={() => setQuery("")}
          className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted"><X className="size-3.5" /></button>}
      </div>
      <div className="grid max-h-[430px] gap-2 overflow-y-auto overscroll-contain pr-1 sm:grid-cols-2">
        {visibleOptions.map(option => {
          const selected = value === option.value;
          return <button key={option.value} type="button" aria-pressed={selected} disabled={disabled}
            onClick={() => onChange(option.value)}
            className={"flex min-h-14 min-w-0 items-center justify-between gap-2 rounded-xl border px-3 py-3 text-right transition disabled:cursor-not-allowed disabled:opacity-50 " + (selected ? "border-primary bg-primary/10 text-foreground ring-2 ring-primary/10" : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground")}>
            <span className="min-w-0"><span className="block break-words text-sm font-semibold leading-5">{option.label}</span>
              {option.description && <span className="mt-1 block text-[10px] leading-4 text-muted-foreground">{option.description}</span>}</span>
            <span className={"flex size-6 shrink-0 items-center justify-center rounded-full border " + (selected ? "border-primary bg-primary text-primary-foreground" : "border-border text-transparent")}>{selected && <Check className="size-3.5" />}</span>
          </button>;
        })}
      </div>
      {!visibleOptions.length && <p className="rounded-xl bg-muted/30 p-3 text-center text-xs text-muted-foreground">لا توجد نتيجة مطابقة في فهرس هذا الفرع.</p>}
      {value && <button type="button" disabled={disabled} onClick={() => onChange("")}
        className="text-xs font-semibold text-muted-foreground underline underline-offset-4 disabled:opacity-50">إلغاء الاختيار</button>}
    </div>
  );
}
