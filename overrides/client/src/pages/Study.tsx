import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { trpc } from "@/lib/trpc";
import { getSIECheckpointBranches, getSIESubject } from "@shared/sie-catalog";
import { calculateLearningGap, getNextLearningTarget, moveLearningFrontier } from "@shared/sie-learning-progress";
import { BookOpenText, Check, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";

export default function Study() {
  const utils = trpc.useUtils();
  const profile = trpc.studentProfile.get.useQuery();
  const initialStudyParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const [subjectId, setSubjectId] = useState(initialStudyParams?.get("subject") || "");
  const [branchId, setBranchId] = useState(initialStudyParams?.get("branch") || "");
  const [subjectSearch, setSubjectSearch] = useState("");
  const subjects = profile.data?.subjectIds || [];
  const selection = (profile.data?.selection || {}) as Record<string, any>;
  const courseProgressMap = (selection.learningCourseProgress || {}) as Record<string, any>;
  const currentCourseProgress = courseProgressMap[subjectId] || {};
  const branchProgressMap = (currentCourseProgress.branches || {}) as Record<string, Record<string, any>>;
  const savedTeacherId = ((selection.teacherChoices || {}) as Record<string, string>)[subjectId]
    || (profile.data?.teacherSelections || {})[subjectId];
  const selectedTeacherId = savedTeacherId && savedTeacherId !== "__SKIP__" ? savedTeacherId : undefined;
  const savedTeacherNames = (selection.customTeacherNames || {}) as Record<string, string>;
  const teacherReferenceNameBase = (savedTeacherNames[subjectId] || "").trim();
  const savedCourseModes = (selection.courseModes || {}) as Record<string, "center" | "online">;
  const persistedCourseMode = savedCourseModes[subjectId] || currentCourseProgress.courseMode || "online";
  const [courseModeOverrides, setCourseModeOverrides] = useState<Record<string, "center" | "online">>({});
  const courseMode = courseModeOverrides[subjectId] ?? persistedCourseMode;
  const branches = useMemo(() => getSIECheckpointBranches(subjectId), [subjectId]);
  const currentBranch = branches.find(branch => branch.branchId === branchId) ?? branches[0];
  const branchChoices = currentBranch?.choices ?? [];
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
          : teacherReferenceNameBase
            ? (!record.teacherName || record.teacherName === teacherReferenceNameBase)
            : true
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
  const subjectIndex = Math.max(0, subjects.indexOf(subjectId));
  const branchIndex = Math.max(0, branches.findIndex(branch => branch.branchId === currentBranchId));
  const [studentFrontierDrafts, setStudentFrontierDrafts] = useState<Record<string, string>>({});
  const [teacherFrontierDrafts, setTeacherFrontierDrafts] = useState<Record<string, string>>({});
  const [schoolFrontierDrafts, setSchoolFrontierDrafts] = useState<Record<string, string>>({});

  const studentFrontierDraftKey = subjectId + "::" + currentBranchId;
  const legacyStudentState = ((selection.teacherProgressState || {}) as Record<string, Record<string, any>>)[subjectId] || {};
  const belongsToCurrentBranch = (value: unknown): value is string =>
    typeof value === "string" &&
    (value === "__NOT_STARTED__" || branchChoices.some(lesson => lesson.nodeId === value));
  const legacyStudentFrontierCandidates = [
    currentCourseProgress.lastCompletedLessonId,
    ((selection.teacherFrontiers || {}) as Record<string, string>)[subjectId],
    legacyStudentState.studentAttendedFrontier,
  ];
  const legacyStudentFrontier = legacyStudentFrontierCandidates.find(belongsToCurrentBranch) ?? "__UNKNOWN__";
  const resolveSavedFrontier = (
    field: "lastCompletedLessonId" | "teacherTeachingFrontierId" | "schoolClassFrontierId",
    confirmationKey: "studentFrontierConfirmedAt" | "teacherFrontierConfirmedAt" | "schoolFrontierConfirmedAt",
    legacyValue: unknown,
  ) => {
    const branchValue = currentBranchProgress[field];
    if (belongsToCurrentBranch(branchValue)) return branchValue;
    if (branchValue === "__UNKNOWN__" && currentBranchProgress[confirmationKey]) return "__UNKNOWN__";
    return belongsToCurrentBranch(legacyValue) ? legacyValue : "__UNKNOWN__";
  };
  const savedStudentFrontierId = resolveSavedFrontier(
    "lastCompletedLessonId", "studentFrontierConfirmedAt", legacyStudentFrontier,
  );
  const savedTeacherFrontierId = resolveSavedFrontier(
    "teacherTeachingFrontierId", "teacherFrontierConfirmedAt", currentCourseProgress.teacherTeachingFrontierId,
  );
  const teacherTeachingFrontierId = Object.prototype.hasOwnProperty.call(teacherFrontierDrafts, studentFrontierDraftKey)
    ? teacherFrontierDrafts[studentFrontierDraftKey] : savedTeacherFrontierId;
  const savedSchoolFrontierId = resolveSavedFrontier(
    "schoolClassFrontierId", "schoolFrontierConfirmedAt", currentCourseProgress.schoolClassFrontierId,
  );
  const schoolClassFrontierId = Object.prototype.hasOwnProperty.call(schoolFrontierDrafts, studentFrontierDraftKey)
    ? schoolFrontierDrafts[studentFrontierDraftKey] : savedSchoolFrontierId;
  const lastCompletedLessonId = Object.prototype.hasOwnProperty.call(studentFrontierDrafts, studentFrontierDraftKey)
    ? studentFrontierDrafts[studentFrontierDraftKey]
    : savedStudentFrontierId;
  const hasStudentFrontierSelection = lastCompletedLessonId !== "__UNKNOWN__"
    || Boolean(currentBranchProgress.studentFrontierConfirmedAt)
    || Object.prototype.hasOwnProperty.call(studentFrontierDrafts, studentFrontierDraftKey);
  const hasTeacherFrontierSelection = teacherTeachingFrontierId !== "__UNKNOWN__"
    || Boolean(currentBranchProgress.teacherFrontierConfirmedAt)
    || Object.prototype.hasOwnProperty.call(teacherFrontierDrafts, studentFrontierDraftKey);
  const hasSchoolFrontierSelection = schoolClassFrontierId !== "__UNKNOWN__"
    || Boolean(currentBranchProgress.schoolFrontierConfirmedAt)
    || Object.prototype.hasOwnProperty.call(schoolFrontierDrafts, studentFrontierDraftKey);
  const branchChoiceOptions = branchChoices.map(choice => ({
    value: choice.nodeId,
    label: choice.title,
    description: choice.lessonNumber
      ? (choice.unitNumber ? "الوحدة " + choice.unitNumber + " · " : "") + "الدرس " + choice.lessonNumber
      : choice.unitTitle || "",
  }));
  const currentBranchLastLessonId = branchChoices[branchChoices.length - 1]?.nodeId;
  const isCurrentBranchComplete = Boolean(currentBranchLastLessonId && lastCompletedLessonId === currentBranchLastLessonId);
  const autoSaveFingerprintRef = useRef("");
  const setLastCompletedLessonId = (value: string) => {
    autoSaveFingerprintRef.current = "";
    setStudentFrontierDrafts(current => ({ ...current, [studentFrontierDraftKey]: value }));
  };

  const currentGap = calculateLearningGap(branchChoices, {
    studentFrontierId: lastCompletedLessonId || null,
    teacherTeachingFrontierId,
    schoolClassFrontierId: courseMode === "center" ? schoolClassFrontierId : "__UNKNOWN__",
  });
  const nextStudentLesson = typeof currentGap.studentPosition === "number"
    ? branchChoices[currentGap.studentPosition]
    : undefined;
  const isStudentDoneWithBranch = currentGap.studentPosition === branchChoices.length && branchChoices.length > 0;


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

  const saveBranchFrontier = trpc.learning.updateBranchFrontier.useMutation({
    onSuccess: async result => {
      await Promise.all([utils.studentProfile.get.invalidate(), utils.learning.get.invalidate()]);
      const clearDraft = (drafts: Record<string, string>) => { const next = { ...drafts }; delete next[studentFrontierDraftKey]; return next; };
      setStudentFrontierDrafts(clearDraft); setTeacherFrontierDrafts(clearDraft); setSchoolFrontierDrafts(clearDraft);
      if (result.savedStudent && result.learningGap?.studentPosition === branchChoices.length && branchChoices.length > 0) {
        const nextTarget = getNextLearningTarget(subjects, subjectId, branches, currentBranchId);
        if (nextTarget) {
          setSubjectId(nextTarget.subjectId);
          setBranchId(nextTarget.branchId || "");
          const nextLabel = nextTarget.branchId
            ? branches.find(item => item.branchId === nextTarget.branchId)?.branchTitle
            : getSIESubject(nextTarget.subjectId)?.nameAr;
          toast.success("أنهيت موضوعات هذا الفرع؛ انتقلنا إلى " + (nextLabel || "الموضع التالي") + ".");
          return;
        }
        toast.success("أنهيت كل نقاط المنهج المفهرسة في مسارك الحالي.");
      } else if (result.savedStudent) {
        const nextLesson = typeof result.learningGap?.studentPosition === "number"
          ? branchChoices[result.learningGap.studentPosition]
          : undefined;
        toast.success(nextLesson
          ? "تم حفظ آخر موضوع أنهيته. التالي عليك: " + nextLesson.title + "."
          : "تم حفظ آخر موضوع أنهيته في هذا الفرع.");
      } else if (result.savedTeacher) toast.success("تم حفظ موضع المدرس لهذا الفرع.");
      else toast.success("تم حفظ التقدم.");
    },
    onError: error => toast.error(error.message || "تعذّر حفظ موضع المنهج."),
  });
  const updateTeacherSelection = trpc.studentProfile.updateTeacherSelection.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.studentProfile.get.invalidate(), utils.learning.get.invalidate()]);
      toast.success("تم حفظ طريقة الدراسة.");
    },
    onError: error => {
      setCourseModeOverrides(current => { const next = { ...current }; delete next[subjectId]; return next; });
      toast.error(error.message || "تعذّر حفظ طريقة الدراسة.");
    },
  });
  const changeCourseMode = (nextMode: "center" | "online") => {
    if (!subjectId || updateTeacherSelection.isPending || nextMode === courseMode) return;
    setCourseModeOverrides(current => ({ ...current, [subjectId]: nextMode }));
    updateTeacherSelection.mutate({
      subjectId,
      courseMode: nextMode,
      teacherId: selectedTeacherId ?? null,
      teacherName: teacherReferenceNameBase,
    });
  };
  const setTeacherFrontier = (value: string) => {
    autoSaveFingerprintRef.current = "";
    setTeacherFrontierDrafts(current => ({ ...current, [studentFrontierDraftKey]: value }));
  };
  const setSchoolFrontier = (value: string) => {
    autoSaveFingerprintRef.current = "";
    setSchoolFrontierDrafts(current => ({ ...current, [studentFrontierDraftKey]: value }));
  };
  const stepFrontier = (value: string, direction: "previous" | "next") => moveLearningFrontier(branchChoices, value, direction);
  const frontierIndex = (value: string) => branchChoices.findIndex(choice => choice.nodeId === value);
  const canMovePrevious = (value: string) => frontierIndex(value) >= 0;
  const canMoveNext = (value: string) => branchChoices.length > 0 && value !== branchChoices[branchChoices.length - 1]?.nodeId;
  useEffect(() => {
    const hasDraft = Object.prototype.hasOwnProperty.call(studentFrontierDrafts, studentFrontierDraftKey)
      || Object.prototype.hasOwnProperty.call(teacherFrontierDrafts, studentFrontierDraftKey)
      || (courseMode === "center" && Object.prototype.hasOwnProperty.call(schoolFrontierDrafts, studentFrontierDraftKey));
    if (!hasDraft || !subjectId || !currentBranchId || !branchChoices.length
      || !hasStudentFrontierSelection || !hasTeacherFrontierSelection
      || saveBranchFrontier.isPending || profile.isLoading) return;
    const fingerprint = [
      subjectId, currentBranchId, lastCompletedLessonId, teacherTeachingFrontierId,
      courseMode, courseMode === "center" && hasSchoolFrontierSelection ? schoolClassFrontierId : "",
    ].join("::");
    if (autoSaveFingerprintRef.current === fingerprint) return;
    autoSaveFingerprintRef.current = fingerprint;
    saveBranchFrontier.mutate({
      subjectId,
      branchId: currentBranchId,
      studentFrontierId: lastCompletedLessonId,
      teacherTeachingFrontierId,
      ...(courseMode === "center" && hasSchoolFrontierSelection ? { schoolClassFrontierId } : {}),
    });
  }, [
    subjectId, currentBranchId, branchChoices.length, hasStudentFrontierSelection,
    hasTeacherFrontierSelection, hasSchoolFrontierSelection, lastCompletedLessonId,
    teacherTeachingFrontierId, schoolClassFrontierId, courseMode,
    studentFrontierDrafts, teacherFrontierDrafts, schoolFrontierDrafts, studentFrontierDraftKey,
    saveBranchFrontier.isPending, profile.isLoading,
  ]);
  const subjectName = (getSIESubject(subjectId)?.nameAr || subjectId);
  const visibleSubjects = subjects.filter(id => normalizeFrontierSearch(getSIESubject(id)?.nameAr || id).includes(normalizeFrontierSearch(subjectSearch)));

  return (
    <DashboardLayout title="المذاكرة والتقدم" description="اختر المادة وحدّد موضعك وموضع شرح المدرس في المنهج.">
      {profile.isError && <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm">تعذّر تحميل ملفك الدراسي. <button className="font-bold underline" onClick={() => void profile.refetch()}>إعادة المحاولة</button></div>}
      <section className="grid gap-6">
        <article className="app-card min-w-0 overflow-hidden rounded-2xl">
          <header className="border-b border-border/70 bg-gradient-to-l from-secondary/65 to-card p-5">
            <p className="text-[10px] font-bold tracking-[0.12em] text-primary">المادة</p><h2 className="mt-1 text-xl font-bold">اختر المادة</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">كل مواد ملفك ظاهرة، والبحث يساعدك على الوصول للمادة فقط.</p>
          </header>
          <div className="space-y-3 p-4 sm:p-5">
            <div className="relative"><Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={subjectSearch} onChange={event => setSubjectSearch(event.target.value)} placeholder="ابحث عن مادة..." aria-label="البحث عن مادة" className="h-11 rounded-xl pr-9 text-sm" />
              {subjectSearch && <button type="button" aria-label="مسح البحث" onClick={() => setSubjectSearch("")} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted"><X className="size-3.5" /></button>}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {visibleSubjects.map(id => { const active = id === subjectId; return <motion.button key={id} type="button" aria-pressed={active} onClick={() => { setSubjectId(id); setBranchId(""); }} whileTap={{ scale: 0.98 }}
                className={"min-h-12 rounded-xl border px-3 py-3 text-sm font-semibold transition " + (active ? "border-primary bg-primary/10 text-foreground ring-2 ring-primary/15" : "border-border bg-background text-muted-foreground hover:border-primary/35")}>{getSIESubject(id)?.nameAr || id}</motion.button>; })}
            </div>
            {!visibleSubjects.length && <p className="rounded-xl bg-muted/30 p-4 text-center text-sm text-muted-foreground">لا توجد مادة مطابقة لبحثك.</p>}
          </div>
        </article>
      </section>

      <section className="app-card mb-5 overflow-hidden rounded-2xl">
        <header className="border-b border-border/70 bg-gradient-to-l from-secondary/55 to-card p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold tracking-[0.12em] text-primary">تقدم المنهج</p>
              <h2 className="mt-1 text-xl font-bold">اختر فرع المنهج</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                حدّد موضعك وموضع شرح المدرس؛ يتم حفظ الموضعين تلقائيًا، وعند إكمال الفرع ينتقل بك التطبيق للفرع التالي.
              </p>
            </div>
            <div className="flex max-w-full flex-col gap-1 rounded-xl border border-border/70 bg-background/70 px-3 py-2 text-xs">
              <span className="font-bold">{subjectName}</span>
            </div>
          </div>
        </header>
        <div className="space-y-6 p-4 sm:p-6">
          <div className="rounded-2xl border border-border/70 bg-muted/15 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold">طريقة الدراسة</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">حدّد الطريقة المستخدمة في هذه المادة.</p>
              </div>
              <div className="grid w-full grid-cols-2 gap-3 sm:w-auto sm:min-w-[320px]" role="group" aria-label="طريقة الدراسة">
                <motion.button type="button" whileTap={{ scale: 0.98 }} disabled={updateTeacherSelection.isPending}
                  aria-pressed={courseMode === "online"} onClick={() => changeCourseMode("online")}
                  className={"min-h-11 rounded-xl border px-4 py-3 text-sm font-semibold transition disabled:opacity-50 " + (courseMode === "online" ? "border-primary bg-primary/10 text-foreground ring-2 ring-primary/15" : "border-border bg-background text-muted-foreground hover:border-primary/40")}>
                  أونلاين
                </motion.button>
                <motion.button type="button" whileTap={{ scale: 0.98 }} disabled={updateTeacherSelection.isPending}
                  aria-pressed={courseMode === "center"} onClick={() => changeCourseMode("center")}
                  className={"min-h-11 rounded-xl border px-4 py-3 text-sm font-semibold transition disabled:opacity-50 " + (courseMode === "center" ? "border-primary bg-primary/10 text-foreground ring-2 ring-primary/15" : "border-border bg-background text-muted-foreground hover:border-primary/40")}>
                  سنتر / مجموعة
                </motion.button>
              </div>
            </div>
          </div>
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
                  initial={{ opacity: 0, x: 16, scale: 0.99 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -16, scale: 0.99 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }} className="space-y-4">
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
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">اختيارك يعني أنك أنهيت هذه النقطة بالفعل. النقطة التالية بعدها هي أول ما يدخل في تراكمك. يتم الحفظ تلقائيًا بعد تحديد موضع المدرس أيضًا.</p>
                      </div>
                      <div className="mt-4 grid gap-6 md:grid-cols-2">
                        <div className="min-w-0 rounded-xl border border-border/70 bg-background/70 p-3">
                          <SearchableFrontierPicker label="آخر موضوع أنهيته" hint="اختيارك هنا يحدد آخر موضوع اكتمل. الموضوع الذي يليه يظل ضمن المتراكم عليك."
                            value={hasStudentFrontierSelection ? lastCompletedLessonId : ""} onChange={setLastCompletedLessonId} disabled={saveBranchFrontier.isPending}
                            onPrevious={() => setLastCompletedLessonId(stepFrontier(lastCompletedLessonId, "previous"))}
                            onNext={() => setLastCompletedLessonId(stepFrontier(lastCompletedLessonId || "__UNKNOWN__", "next"))}
                            previousDisabled={!canMovePrevious(lastCompletedLessonId)} nextDisabled={!canMoveNext(lastCompletedLessonId)}
                            options={[{ value: "__NOT_STARTED__", label: "لم أبدأ هذا الفرع" },{ value: "__UNKNOWN__", label: "موضعي غير معروف" },...branchChoiceOptions]} />
                          {hasStudentFrontierSelection && currentGap.studentPosition !== null && <div className="mt-3 rounded-xl border border-primary/15 bg-primary/[0.045] px-3 py-2.5">
                            <p className="text-[10px] font-semibold text-muted-foreground">الخطوة التالية عليك</p>
                            <p className="mt-1 text-sm font-bold text-foreground">{nextStudentLesson?.title || (isStudentDoneWithBranch ? "أنهيت كل الموضوعات المفهرسة في هذا الفرع" : "لم يتم تحديد الموضوع التالي")}</p>
                          </div>}
                        </div>
                        <div className="min-w-0 rounded-xl border border-border/70 bg-background/70 p-3">
                          <SearchableFrontierPicker label="موضع المدرس في هذا الفرع"
                            hint="آخر نقطة وصل إليها المدرس في شرحه لهذا الفرع."
                            value={teacherTeachingFrontierId} onChange={setTeacherFrontier}
                            disabled={saveBranchFrontier.isPending}
                            onPrevious={() => setTeacherFrontier(stepFrontier(teacherTeachingFrontierId, "previous"))}
                            onNext={() => setTeacherFrontier(stepFrontier(teacherTeachingFrontierId, "next"))}
                            previousDisabled={!canMovePrevious(teacherTeachingFrontierId)}
                            nextDisabled={!canMoveNext(teacherTeachingFrontierId)}
                            options={[{ value: "__UNKNOWN__", label: "لا أعرف / غير متاح" },{ value: "__NOT_STARTED__", label: "لم يبدأ التدريس بعد" },...branchChoiceOptions]} />
                        </div>
                        {courseMode === "center" ? (
                          <div className="min-w-0 rounded-xl border border-border/70 bg-background/70 p-3 md:col-span-2">
                            <SearchableFrontierPicker label="موضع السنتر / المجموعة (اختياري)" hint="يمكنك تسجيل موضع المجموعة عند الحاجة."
                              value={schoolClassFrontierId} onChange={setSchoolFrontier} disabled={saveBranchFrontier.isPending}
                              onPrevious={() => setSchoolFrontier(stepFrontier(schoolClassFrontierId, "previous"))}
                              onNext={() => setSchoolFrontier(stepFrontier(schoolClassFrontierId, "next"))}
                              previousDisabled={!canMovePrevious(schoolClassFrontierId)} nextDisabled={!canMoveNext(schoolClassFrontierId)}
                              options={[{ value: "__UNKNOWN__", label: "لا أعرف حتى الآن" },{ value: "__NOT_STARTED__", label: "لم يبدأ السنتر / المجموعة" },...branchChoiceOptions]} />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )}
                  <div className="border-t border-border/70 pt-4">
                    <AnimatePresence mode="wait" initial={false}>
                      {saveBranchFrontier.isPending ? (
                        <motion.div key="saving" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                          className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/[0.045] p-3 text-sm font-semibold">
                          <motion.span className="size-2.5 rounded-full bg-primary" animate={{ scale: [1, 1.45, 1], opacity: [0.6, 1, 0.6] }} transition={{ duration: 1, repeat: Infinity }} />
                          جارٍ مزامنة موضعك مع موضع المدرس وحفظ التقدم...
                        </motion.div>
                      ) : saveBranchFrontier.isError ? (
                        <motion.div key="error" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                          className="rounded-xl border border-destructive/20 bg-destructive/[0.04] p-3 text-sm font-semibold">
                          تعذّر حفظ التقدم. غيّر أحد الموضعين لإعادة المحاولة.
                        </motion.div>
                      ) : hasStudentFrontierSelection && hasTeacherFrontierSelection ? (
                        <motion.div key="saved" initial={{ opacity: 0, y: 10, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }}
                          className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.045] p-3">
                          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                            <motion.span initial={{ scale: 0.6, rotate: -18 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 240, damping: 14 }}
                              className="flex size-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"><Check className="size-3.5" /></motion.span>
                            تم حفظ موضعك وموضع المدرس تلقائيًا.
                          </div>
                          <p className="mt-1 pr-8 text-xs leading-5 text-muted-foreground">
                            {isCurrentBranchComplete
                              ? branches[branchIndex + 1] ? "اكتمل الفرع؛ يتم الانتقال تلقائيًا إلى الفرع التالي." : "اكتمل هذا الفرع، ولا توجد فروع أخرى في المادة."
                              : "يمكنك تعديل أي موضع في أي وقت، وسيُحفظ التحديث تلقائيًا."}
                          </p>
                        </motion.div>
                      ) : (
                        <motion.p key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          className="text-xs leading-6 text-muted-foreground">اختر موضعك وموضع المدرس، وسيتم الحفظ تلقائيًا دون زر حفظ منفصل.</motion.p>
                      )}
                    </AnimatePresence>
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
  onPrevious, onNext, previousDisabled = false, nextDisabled = false,
}: {
  label: string; hint?: string; value: string; onChange: (value: string) => void;
  options: ChoiceButtonOption[]; disabled?: boolean;
  onPrevious?: () => void; onNext?: () => void;
  previousDisabled?: boolean; nextDisabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [showAllOptions, setShowAllOptions] = useState(false);
  const optionsIdentity = options.length + "::" + (options[0]?.value ?? "") + "::" + (options[options.length - 1]?.value ?? "");
  useEffect(() => {
    setShowAllOptions(false);
    setQuery("");
  }, [optionsIdentity]);
  const normalizedQuery = normalizeFrontierSearch(query);
  const matchingOptions = normalizedQuery
    ? options.filter(option => normalizeFrontierSearch(option.label + " " + (option.description ?? "")).includes(normalizedQuery))
    : options;
  const visibleOptions = normalizedQuery || showAllOptions ? matchingOptions : matchingOptions.slice(0, 6);
  const hiddenOptionCount = Math.max(0, options.length - 6);
  return (
    <div className="min-w-0 space-y-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><p className="text-sm font-bold">{label}</p>{hint && <p className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</p>}</div>
        {(onPrevious || onNext) && <div className="flex shrink-0 gap-1">
          {onPrevious && <Button type="button" size="sm" variant="outline" disabled={disabled || previousDisabled} onClick={onPrevious} className="h-8 rounded-lg px-2 text-[11px]"><ChevronRight className="ml-1 size-3.5" />السابق</Button>}
          {onNext && <Button type="button" size="sm" variant="outline" disabled={disabled || nextDisabled} onClick={onNext} className="h-8 rounded-lg px-2 text-[11px]">التالي<ChevronLeft className="mr-1 size-3.5" /></Button>}
        </div>}
      </div>
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
      {!normalizedQuery && hiddenOptionCount > 0 && !showAllOptions && <Button type="button" variant="outline" size="sm" className="w-full rounded-xl text-xs" onClick={() => setShowAllOptions(true)}>إظهار باقي الخيارات ({hiddenOptionCount})</Button>}
      {!normalizedQuery && showAllOptions && hiddenOptionCount > 0 && <Button type="button" variant="ghost" size="sm" className="w-full rounded-xl text-xs" onClick={() => setShowAllOptions(false)}>عرض خيارات أقل</Button>}
      {!visibleOptions.length && <p className="rounded-xl bg-muted/30 p-3 text-center text-xs text-muted-foreground">لا توجد نتيجة مطابقة في فهرس هذا الفرع.</p>}
      {value && <button type="button" disabled={disabled} onClick={() => onChange(options.some(option => option.value === "__UNKNOWN__") ? "__UNKNOWN__" : "")}
        className="text-xs font-semibold text-muted-foreground underline underline-offset-4 disabled:opacity-50">إلغاء الاختيار</button>}
    </div>
  );
}
