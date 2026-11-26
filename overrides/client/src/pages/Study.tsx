import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { trpc } from "@/lib/trpc";
import {
  getSIECheckpointProgressBranches,
  getSIEStudentVisibleBranches,
  getSIECheckpointProgressOptions,
  getSIECheckpointUnits,
  getSIESubject,
  normalizeSIECheckpointFrontier,
} from "@shared/sie-catalog";
import { calculateLearningGap, getNextLearningTarget } from "@shared/sie-learning-progress";
import {
  getEffectiveStudentLessonState,
  getStudentLessonStateLabel,
  summarizeStudentLessonStates,
  type StudentLessonState,
} from "@shared/sie-lesson-state";
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
  const [studyViewMode, setStudyViewMode] = useState<"units" | "lessons">(
    initialStudyParams?.get("branch") ? "lessons" : "units"
  );
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
  const allBranches = useMemo(() => getSIECheckpointProgressBranches(subjectId), [subjectId]);
  const branches = useMemo(() => getSIEStudentVisibleBranches(subjectId), [subjectId]);
  const units = useMemo(() => getSIECheckpointUnits(subjectId), [subjectId]);
  const [branchTransition, setBranchTransition] = useState<{ from: string; to: string } | null>(null);
  useEffect(() => {
    if (!branchTransition) return;
    const timer = window.setTimeout(() => setBranchTransition(null), 3_200);
    return () => window.clearTimeout(timer);
  }, [branchTransition]);
  const currentBranch = branches.find(branch => branch.branchId === branchId)
    ?? allBranches.find(branch => branch.branchId === branchId)
    ?? branches[0];
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
  const isEnglishSkillBranch = subjectId === "ENG1_G2_BAC"
    && (currentBranchId === "ENG_VOCABULARY" || currentBranchId === "ENG_GRAMMAR");
  const visibleBranchAnchor = isEnglishSkillBranch ? "ENG_TEXTBOOK" : currentBranchId;
  const visibleBranchIndex = branches.findIndex(branch => branch.branchId === visibleBranchAnchor);
  const visibleBranchPosition = visibleBranchIndex >= 0 ? visibleBranchIndex + 1 : 0;
  const nextVisibleBranch = !isEnglishSkillBranch && visibleBranchIndex >= 0
    ? branches[visibleBranchIndex + 1]
    : undefined;
  const branchDisplayTitle = subjectId === "ARB_G2_BAC" && currentBranchId === "ARB_READING"
    ? "نصوص الوحدة"
    : currentBranch?.branchTitle || "الفرع الحالي";
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
  const savedStudentFrontierId = normalizeSIECheckpointFrontier(subjectId, currentBranchId, resolveSavedFrontier(
    "lastCompletedLessonId", "studentFrontierConfirmedAt", legacyStudentFrontier,
  ));
  const savedTeacherFrontierId = normalizeSIECheckpointFrontier(subjectId, currentBranchId, resolveSavedFrontier(
    "teacherTeachingFrontierId", "teacherFrontierConfirmedAt", currentCourseProgress.teacherTeachingFrontierId,
  ));
  const teacherTeachingFrontierId = Object.prototype.hasOwnProperty.call(teacherFrontierDrafts, studentFrontierDraftKey)
    ? teacherFrontierDrafts[studentFrontierDraftKey] : savedTeacherFrontierId;
  const savedSchoolFrontierId = normalizeSIECheckpointFrontier(subjectId, currentBranchId, resolveSavedFrontier(
    "schoolClassFrontierId", "schoolFrontierConfirmedAt", currentCourseProgress.schoolClassFrontierId,
  ));
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
  const branchChoiceOptions = getSIECheckpointProgressOptions(subjectId, currentBranchId);
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
  const savedLessonStates = (currentBranchProgress.lessonStates ?? {}) as Record<string, { state?: StudentLessonState; updatedAt?: string }>;
  const lessonStateModelVersion = Number(currentBranchProgress.lessonStateModelVersion ?? 0);
  const getLessonState = (nodeId: string) => getEffectiveStudentLessonState({
    choices: branchChoices,
    nodeId,
    studentFrontierId: lastCompletedLessonId,
    lessonStateModelVersion,
    saved: savedLessonStates[nodeId],
  });
  const lessonStateSummary = summarizeStudentLessonStates(branchChoices.map(choice => getLessonState(choice.nodeId)));
  const teacherCoveredChoices = currentGap.referencePosition === null
    ? []
    : branchChoices.slice(0, currentGap.referencePosition);
  const teacherCoveredStates = teacherCoveredChoices.map(choice => getLessonState(choice.nodeId));
  const notStudiedAfterTeacher = teacherCoveredStates.filter(state => state === "not_watched" || state === "watched_only").length;
  const needsReviewAfterTeacher = teacherCoveredStates.filter(state => state === "needs_review").length;
  const studentFrontierIndex = lastCompletedLessonId === "__NOT_STARTED__"
    ? -1
    : branchChoices.findIndex(choice => choice.nodeId === lastCompletedLessonId);
  const nextStudentLesson = typeof currentGap.studentPosition === "number"
    ? branchChoices[currentGap.studentPosition]
    : undefined;
  const studentFrontierDisplayLabel = branchChoiceOptions.find(option => option.value === lastCompletedLessonId)?.label
    ?? currentGap.studentFrontierTitle;
  const teacherFrontierDisplayLabel = branchChoiceOptions.find(option => option.value === teacherTeachingFrontierId)?.label
    ?? currentGap.referenceFrontierTitle;
  const isStudentDoneWithBranch = currentGap.studentPosition === branchChoices.length && branchChoices.length > 0;


  useEffect(() => {
    if (!subjectId && subjects.length) setSubjectId(subjects[0]);
  }, [subjects, subjectId]);

  useEffect(() => {
    if (!allBranches.length) {
      setBranchId("");
      return;
    }
    // Hidden legacy ARB_READING is still reachable through a unit's lesson detail view,
    // but it is intentionally absent from the standalone branch selector.
    if (!allBranches.some(branch => branch.branchId === branchId)) {
      setBranchId(branches[0]?.branchId ?? allBranches[0].branchId);
    }
  }, [subjectId, branches, allBranches, branchId]);

  const saveBranchFrontier = trpc.learning.updateBranchFrontier.useMutation({
    onSuccess: async (result, variables) => {
      await Promise.all([
        utils.studentProfile.get.invalidate(),
        utils.learning.get.invalidate(),
        utils.plans.currentDaily.invalidate(),
        utils.dashboard.summary.invalidate(),
      ]);
      const savedDraftKey = variables.subjectId + "::" + variables.branchId;
      const clearSavedDraft = (drafts: Record<string, string>) => {
        const next = { ...drafts };
        if (Object.prototype.hasOwnProperty.call(variables, "studentFrontierId")) delete next[savedDraftKey];
        return next;
      };
      const clearTeacherDraft = (drafts: Record<string, string>) => {
        const next = { ...drafts };
        if (Object.prototype.hasOwnProperty.call(variables, "teacherTeachingFrontierId")) delete next[savedDraftKey];
        return next;
      };
      const clearSchoolDraft = (drafts: Record<string, string>) => {
        const next = { ...drafts };
        if (Object.prototype.hasOwnProperty.call(variables, "schoolClassFrontierId")) delete next[savedDraftKey];
        return next;
      };
      setStudentFrontierDrafts(clearSavedDraft);
      setTeacherFrontierDrafts(clearTeacherDraft);
      setSchoolFrontierDrafts(clearSchoolDraft);
      if (result.savedStudent && variables.subjectId === "ARB_G2_BAC"
        && Object.prototype.hasOwnProperty.call(variables, "studentFrontierId")) {
        const savedBranchIndex = allBranches.findIndex(item => item.branchId === variables.branchId);
        const nextBranch = savedBranchIndex >= 0
          ? allBranches.slice(savedBranchIndex + 1).find(candidate =>
              branches.some(visible => visible.branchId === candidate.branchId)
            )
          : branches[0];
        if (nextBranch) {
          const fromLabel = variables.branchId === "ARB_READING"
            ? "نصوص الوحدة"
            : allBranches[savedBranchIndex]?.branchTitle ?? "الفرع الحالي";
          const toLabel = nextBranch.branchTitle;
          setBranchTransition({ from: fromLabel, to: toLabel });
          setBranchId(nextBranch.branchId);
          toast.success("تم حفظ موضعك — ننتقل الآن إلى " + toLabel + ".");
          return;
        }
        const nextTarget = getNextLearningTarget(subjects, subjectId, branches, currentBranchId);
        if (nextTarget) {
          setSubjectId(nextTarget.subjectId);
          setBranchId(nextTarget.branchId || "");
          toast.success("اكتملت فروع العربي؛ انتقلنا إلى المادة التالية.");
          return;
        }
        toast.success("تم حفظ آخر موضع في جميع فروع العربي.");
      } else if (result.savedStudent && result.learningGap?.studentPosition === branchChoices.length && branchChoices.length > 0) {
        if (isEnglishSkillBranch) {
          toast.success(currentBranchId === "ENG_VOCABULARY"
            ? "أنهيت دروس Vocabulary المفهرسة داخل الوحدات."
            : "أنهيت دروس Grammar المفهرسة داخل الوحدات.");
          return;
        }
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
  const updateLessonLearningState = trpc.learning.updateLessonLearningState.useMutation({
    onSuccess: async (_result, variables) => {
      await Promise.all([
        utils.studentProfile.get.invalidate(),
        utils.learning.get.invalidate(),
        utils.plans.currentDaily.invalidate(),
        utils.dashboard.summary.invalidate(),
      ]);
      toast.success("تم تحديث حالة الدرس؛ الخطة هتراعي إنك شاهدته أو ذاكرته فعلًا.");
    },
    onError: error => toast.error(error.message || "تعذّر تحديث حالة الدرس."),
  });
  const saveUnitFrontier = trpc.learning.updateBranchFrontier.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.studentProfile.get.invalidate(),
        utils.learning.get.invalidate(),
        utils.plans.currentDaily.invalidate(),
        utils.dashboard.summary.invalidate(),
      ]);
    },
  });
  const completeUnit = async (unit: ReturnType<typeof getSIECheckpointUnits>[number]) => {
    if (saveUnitFrontier.isPending) return;
    try {
      for (const unitBranch of unit.branches) {
        const branch = allBranches.find(item => item.branchId === unitBranch.branchId);
        if (!branch || !unitBranch.choices.length) continue;
        const finalNode = unitBranch.choices[unitBranch.choices.length - 1];
        const targetIndex = branch.choices.findIndex(item => item.nodeId === finalNode.nodeId);
        const savedValue = branchProgressMap[branch.branchId]?.lastCompletedLessonId;
        const normalizedSaved = typeof savedValue === "string"
          ? normalizeSIECheckpointFrontier(subjectId, branch.branchId, savedValue)
          : "__UNKNOWN__";
        const savedIndex = normalizedSaved === "__NOT_STARTED__" ? -1 : branch.choices.findIndex(item => item.nodeId === normalizedSaved);
        if (targetIndex < 0 || savedIndex >= targetIndex) continue;
        await saveUnitFrontier.mutateAsync({
          subjectId,
          branchId: branch.branchId,
          studentFrontierId: finalNode.nodeId,
        });
      }
      await Promise.all([utils.studentProfile.get.invalidate(), utils.learning.get.invalidate()]);
      const currentUnitIndex = units.findIndex(item => item.unitId === unit.unitId);
      const nextUnit = currentUnitIndex >= 0 ? units[currentUnitIndex + 1] : undefined;
      if (nextUnit) {
        openUnitLessons(nextUnit);
        toast.success("تم إكمال " + unit.title + " — انتقلنا إلى " + nextUnit.title + " مباشرةً.");
      } else {
        setStudyViewMode("units");
        toast.success("تم تسجيل إكمال " + unit.title + ". انتهيت من الوحدات المفهرسة لهذه المادة.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر تسجيل إكمال الوحدة.");
    }
  };
  const openUnitLessons = (unit: ReturnType<typeof getSIECheckpointUnits>[number]) => {
    const nextBranch = unit.branches.find(unitBranch => {
      const branch = allBranches.find(item => item.branchId === unitBranch.branchId);
      if (!branch || !unitBranch.choices.length) return false;
      const last = unitBranch.choices[unitBranch.choices.length - 1];
      const saved = branchProgressMap[branch.branchId]?.lastCompletedLessonId;
      const normalized = typeof saved === "string" ? normalizeSIECheckpointFrontier(subjectId, branch.branchId, saved) : "__UNKNOWN__";
      const savedIndex = normalized === "__NOT_STARTED__" ? -1 : branch.choices.findIndex(item => item.nodeId === normalized);
      const targetIndex = branch.choices.findIndex(item => item.nodeId === last.nodeId);
      return savedIndex < targetIndex;
    }) ?? unit.branches[0];
    if (nextBranch) setBranchId(nextBranch.branchId);
    setStudyViewMode("lessons");
  };

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
  const frontierIndex = (value: string) => branchChoiceOptions.findIndex(option => option.value === value);
  const stepFrontier = (value: string, direction: "previous" | "next") => {
    const index = frontierIndex(value);
    if (index < 0) return direction === "next" && value === "__NOT_STARTED__"
      ? branchChoiceOptions[0]?.value ?? value
      : value;
    return branchChoiceOptions[index + (direction === "next" ? 1 : -1)]?.value ?? value;
  };
  const canMovePrevious = (value: string) => frontierIndex(value) > 0;
  const canMoveNext = (value: string) => {
    const index = frontierIndex(value);
    return index >= 0
      ? index < branchChoiceOptions.length - 1
      : value === "__NOT_STARTED__" && branchChoiceOptions.length > 0;
  };
  useEffect(() => {
    // Each frontier is an independent student-owned fact. Saving the student's
    // last completed lesson must not wait for a teacher or school position.
    const studentDrafted = Object.prototype.hasOwnProperty.call(studentFrontierDrafts, studentFrontierDraftKey);
    const teacherDrafted = Object.prototype.hasOwnProperty.call(teacherFrontierDrafts, studentFrontierDraftKey);
    const schoolDrafted = courseMode === "center"
      && Object.prototype.hasOwnProperty.call(schoolFrontierDrafts, studentFrontierDraftKey);
    if ((!studentDrafted && !teacherDrafted && !schoolDrafted)
      || !subjectId || !currentBranchId || !branchChoices.length
      || saveBranchFrontier.isPending || profile.isLoading) return;

    const input = {
      subjectId,
      branchId: currentBranchId,
      ...(studentDrafted ? { studentFrontierId: lastCompletedLessonId } : {}),
      ...(teacherDrafted ? { teacherTeachingFrontierId } : {}),
      ...(schoolDrafted ? { schoolClassFrontierId } : {}),
    };
    const fingerprint = JSON.stringify(input);
    if (autoSaveFingerprintRef.current === fingerprint) return;
    autoSaveFingerprintRef.current = fingerprint;
    saveBranchFrontier.mutate(input);
  }, [
    subjectId, currentBranchId, branchChoices.length, lastCompletedLessonId,
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
        <article className="sf-study-subject-selector app-card min-w-0 overflow-hidden rounded-2xl">
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

      <AnimatePresence>
        {branchTransition && subjectId === "ARB_G2_BAC" && (
          <motion.div
            key={branchTransition.to}
            initial={{ opacity: 0, y: -12, scale: .97, filter: "blur(5px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, scale: .985, filter: "blur(4px)" }}
            transition={{ duration: .42, ease: [.22, 1, .36, 1] }}
            className="relative mb-4 overflow-hidden rounded-2xl border border-primary/25 bg-primary/[0.045] p-4 text-foreground shadow-sm"
          >
            <div className="relative flex items-center gap-3">
              <motion.span initial={{ rotate: -30, scale: .65 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: "spring", stiffness: 240, damping: 16 }}
                className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Check className="size-5" /></motion.span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold tracking-[.12em] text-primary">تم حفظ موضعك بنجاح</p>
                <p className="mt-1 text-sm font-bold">الانتقال إلى الفرع التالي</p>
                <p className="mt-1 text-xs text-muted-foreground">{branchTransition.from} <span className="mx-1 text-primary">←</span> {branchTransition.to}</p>
              </div>
              <button type="button" className="rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted" onClick={() => setBranchTransition(null)}>إخفاء</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <section className="app-card mb-5 overflow-hidden rounded-[1.7rem]">
        <header className="border-b border-border/70 bg-card p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold tracking-[0.14em] text-primary">اختيار التقدم</p>
              <h2 className="mt-1 text-xl font-bold">ابدأ من الوحدة، أو افتح الدروس</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{subjectId === "ENG1_G2_BAC" ? "كل الوحدات العشر داخل فرع Units، وداخل كل وحدة دروس Vocabulary وGrammar بأرقامها، ثم موضوعات الكتاب." : "ابدأ بالوحدات الرسمية من الكتاب. فروع التعبير والإملاء والأدب والقصة تظهر كمسارات كورس المدرس بشكل مستقل. تقدر تسجل اكتمال وحدة أو تضغط «إظهار باقي الدروس» للتفصيل."}</p>
            </div>
            <div className="inline-flex rounded-xl border border-border bg-muted/40 p-1">
              <button type="button" onClick={() => setStudyViewMode("units")} aria-pressed={studyViewMode === "units"}
                className={"rounded-lg px-4 py-2 text-xs font-bold transition " + (studyViewMode === "units" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>الوحدات</button>
              <button type="button" onClick={() => setStudyViewMode("lessons")} aria-pressed={studyViewMode === "lessons"}
                className={"rounded-lg px-4 py-2 text-xs font-bold transition " + (studyViewMode === "lessons" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>إظهار باقي الدروس</button>
            </div>
          </div>
        </header>
        {studyViewMode === "units" ? (
          <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
            {units.map((unit, unitIndex) => {
              const unitChoices = unit.branches.flatMap(unitBranch => unitBranch.choices.map(choice => ({
                ...choice,
                displayBranchId: unitBranch.branchId,
              })));
              const unitSkillLessons = unitChoices
                .filter(choice => choice.lessonType === "vocabulary" || choice.lessonType === "grammar")
                .sort((left, right) => {
                  const unitSequence = Number(left.lessonNumber ?? 0) - Number(right.lessonNumber ?? 0);
                  if (unitSequence) return unitSequence;
                  return left.lessonType === "vocabulary" ? -1 : right.lessonType === "vocabulary" ? 1 : 0;
                });
              const unitTextbookTopics = unitChoices
                .filter(choice => choice.lessonType === "topic")
                .sort((left, right) => String(left.lessonNumber || "").localeCompare(String(right.lessonNumber || ""), "en", { numeric: true }));
              const unitBranchState = unit.branches.map(unitBranch => {
                const branch = allBranches.find(item => item.branchId === unitBranch.branchId);
                const saved = branchProgressMap[unitBranch.branchId]?.lastCompletedLessonId;
                const normalized = typeof saved === "string" && branch
                  ? normalizeSIECheckpointFrontier(subjectId, unitBranch.branchId, saved)
                  : "__UNKNOWN__";
                const savedIndex = normalized === "__NOT_STARTED__" ? -1 : branch?.choices.findIndex(item => item.nodeId === normalized) ?? -1;
                const completed = unitBranch.choices.filter(choice => {
                  const index = branch?.choices.findIndex(item => item.nodeId === choice.nodeId) ?? -1;
                  return index >= 0 && savedIndex >= index;
                }).length;
                return { branchId: unitBranch.branchId, branchTitle: unitBranch.branchTitle, completed, total: unitBranch.choices.length };
              });
              const totalTopics = unitBranchState.reduce((sum, item) => sum + item.total, 0);
              const completedTopics = unitBranchState.reduce((sum, item) => sum + item.completed, 0);
              const complete = totalTopics > 0 && completedTopics === totalTopics;
              const percent = totalTopics ? Math.round(completedTopics / totalTopics * 100) : 0;
              return (
                <article key={unit.unitId} className={"sf-study-unit-card group relative overflow-hidden rounded-2xl border p-4 transition-all duration-300 " + (complete ? "border-primary/30 bg-primary/[0.045]" : "border-border/75 bg-card hover:-translate-y-1 hover:border-primary/35 hover:shadow-xl")}>
                  <div className="pointer-events-none absolute -left-14 -top-14 size-36 rounded-full bg-primary/10 blur-3xl transition-opacity group-hover:opacity-100" />
                  <div className="relative">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold tracking-[.12em] text-primary">{unit.isOfficialUnit ? "وحدة الكتاب الرسمي" : unit.unitId.startsWith("TOPICS_ARB_") ? "كورس المدرس" : "مسار إضافي"}</p>
                        <h3 className="mt-1 font-bold leading-7">{unit.title}</h3>
                      </div>
                      <span className={"flex size-9 shrink-0 items-center justify-center rounded-xl " + (complete ? "bg-primary text-primary-foreground" : "bg-secondary text-primary")}>
                        {complete ? <Check className="size-4" /> : <span className="text-xs font-bold">{unitIndex + 1}</span>}
                      </span>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{completedTopics} من {totalTopics} {subjectId === "ENG1_G2_BAC" ? "درس / موضوع" : "موضوع"}</span>
                      <span className="font-bold text-primary">{percent}٪</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                      <motion.div className="h-full rounded-full bg-primary" initial={false} animate={{ width: percent + "%" }} transition={{ duration: .55, ease: "easeOut" }} />
                    </div>
                    {subjectId === "ENG1_G2_BAC" && unit.isOfficialUnit ? (
                      <div className="sf-english-unit-map mt-4 rounded-2xl border border-border/70 bg-background/70 p-3.5" data-english-unit={unit.unitNumber}>
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-xs font-extrabold text-foreground">دروس الوحدة</p>
                            <p className="mt-1 text-[10px] text-muted-foreground">كل درس برقمه ونوعه حسب محتوى الوحدة</p>
                          </div>
                          <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">{unitSkillLessons.length} Lessons</span>
                        </div>

                        <div className="sf-english-unit-lessons grid gap-2">
                          {unitSkillLessons.map(choice => {
                            const lessonKind = choice.lessonType === "vocabulary" ? "Vocabulary" : "Grammar";
                            const lessonLabel = `Lesson ${choice.lessonNumber} · ${lessonKind}`;
                            const helperText = choice.lessonType === "vocabulary"
                              ? "مفردات وتعبيرات الوحدة"
                              : choice.title;
                            return (
                              <button key={choice.nodeId} type="button" onClick={() => {
                                setBranchTransition(null);
                                setBranchId(choice.displayBranchId);
                                setStudyViewMode("lessons");
                              }} className="sf-english-lesson-row flex w-full min-w-0 items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2.5 text-right transition-colors hover:border-primary/40 hover:bg-accent/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                                <span className="sf-english-lesson-type shrink-0 rounded-lg bg-secondary px-2.5 py-1 text-[10px] font-extrabold text-secondary-foreground">{lessonLabel}</span>
                                <span className="min-w-0 flex-1 text-xs font-semibold leading-6 text-foreground">{helperText}</span>
                                <span className="shrink-0 text-[10px] font-semibold text-primary">متابعة</span>
                              </button>
                            );
                          })}
                        </div>

                        <div className="mt-4 border-t border-border/70 pt-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-[11px] font-bold text-muted-foreground">موضوعات الكتاب</p>
                            <span className="text-[10px] text-muted-foreground">{unitTextbookTopics.length} Topics</span>
                          </div>
                          <div className="grid gap-2">
                            {unitTextbookTopics.map(choice => {
                              const sectionLabel = choice.nodeId.includes("_SEC_A_") ? "Section A"
                                : choice.nodeId.includes("_SEC_B_") ? "Section B" : "";
                              return (
                                <button key={choice.nodeId} type="button" onClick={() => {
                                  setBranchTransition(null);
                                  setBranchId(choice.displayBranchId);
                                  setStudyViewMode("lessons");
                                }} className="sf-english-lesson-row flex w-full min-w-0 items-start gap-2 rounded-xl border border-border/60 bg-card px-3 py-2 text-right transition-colors hover:border-primary/40 hover:bg-accent/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                                  <span className="sf-english-section-tag shrink-0 rounded-md border border-border bg-muted px-2 py-1 text-[9px] font-semibold text-muted-foreground">{"Topic " + choice.lessonNumber}</span>
                                  <span className="min-w-0 flex-1 text-xs leading-6 text-foreground">{choice.title}</span>
                                  {sectionLabel && <span className="sf-english-section-tag shrink-0 rounded-md border border-border bg-muted px-2 py-1 text-[9px] font-semibold text-muted-foreground">{sectionLabel}</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {unitBranchState.map(item => <span key={item.branchId} className="rounded-lg border border-border/70 bg-background/70 px-2 py-1 text-[10px] text-muted-foreground">{item.branchTitle}</span>)}
                      </div>
                    )}
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <Button type="button" variant="outline" className="rounded-xl text-xs" onClick={() => openUnitLessons(unit)}>فتح الدروس</Button>
                      <Button type="button" className="rounded-xl text-xs" disabled={complete || saveUnitFrontier.isPending}
                        onClick={() => void completeUnit(unit)}>
                        {complete ? "مكتملة" : saveUnitFrontier.isPending ? "جارٍ الحفظ…" : "أنهيت الوحدة"}
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
            {!units.length && <p className="col-span-full rounded-xl bg-muted/30 p-4 text-center text-sm text-muted-foreground">لم يتم ربط وحدات معتمدة لهذه المادة حتى الآن.</p>}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
            <p className="text-xs leading-6 text-muted-foreground">عرض الدروس التفصيلية. اختيار آخر درس مكتمل يحدّث الموضوع التالي عليك مباشرةً.</p>
            <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => setStudyViewMode("units")}>العودة إلى الوحدات</Button>
          </div>
        )}
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
              {studyViewMode === "lessons" && branches.length > 1 && (
                <div className="rounded-2xl border border-border/70 bg-muted/15 p-3 sm:p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold">فروع {subjectName}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">اختَر الفرع الذي تريد تسجيل التقدم فيه.</p>
                    </div>
                    <span className="shrink-0 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-bold tabular-nums">{visibleBranchPosition} / {branches.length}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                    {branches.map((branch, index) => {
                      const rawSavedPosition = branchProgressMap[branch.branchId]?.lastCompletedLessonId;
                      const savedPosition = typeof rawSavedPosition === "string"
                        ? normalizeSIECheckpointFrontier(subjectId, branch.branchId, rawSavedPosition)
                        : rawSavedPosition;
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
                            setBranchTransition(null);
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
              {studyViewMode === "lessons" && <AnimatePresence mode="wait" initial={false}>
                <motion.div key={subjectId + "::" + currentBranchId}
                  initial={{ opacity: 0, x: 24, y: 10, scale: 0.975, filter: "blur(6px)" }} animate={{ opacity: 1, x: 0, y: 0, scale: 1, filter: "blur(0px)" }} exit={{ opacity: 0, x: -18, y: -5, scale: 0.985, filter: "blur(5px)" }}
                  transition={{ duration: 0.42, ease: [.22, 1, .36, 1] }} className="space-y-4">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold tracking-[0.12em] text-primary">الفرع الحالي · {visibleBranchPosition}</p>
                      <h3 className="mt-1 text-lg font-bold">{branchDisplayTitle}</h3>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{branchChoiceOptions.length} {currentBranchPointLabel} في فهرس هذا الفرع.</p>
                    </div>
                    <span className="rounded-lg border border-border bg-background px-3 py-2 text-[11px] font-semibold text-muted-foreground">
                      {isEnglishSkillBranch ? "متابعة داخل فرع الوحدات" : nextVisibleBranch ? "التالي: " + nextVisibleBranch.branchTitle : currentBranchId === "ARB_READING" ? "نصوص الوحدة داخل وحداتها" : "آخر فرع في المادة"}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <motion.div className="h-full rounded-full bg-primary" initial={false}
                      animate={{ width: (visibleBranchPosition / Math.max(branches.length, 1) * 100) + "%" }}
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
                        <h4 className="mt-1 break-words text-sm font-bold sm:text-base">آخر درس وصلت له في شرح المدرس</h4>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">النقطة المختارة تحدد آخر درس شاهدت شرحه أو حضرت حصته. ده لا يعني إنك ذاكرت الدرس أو فهمته؛ حالة المذاكرة والفهم هتتسجل لكل درس بشكل مستقل تحت.</p>
                      </div>
                      <div className="mt-4 grid gap-6 md:grid-cols-2">
                        <div className="min-w-0 rounded-xl border border-border/70 bg-background/70 p-3">
                          <SearchableFrontierPicker label="آخر درس وصلت له في الشرح" hint="اختَر آخر محاضرة حضرتها أو درس وصل له شرح المدرس. هنعرض الدروس السابقة بعلامة مشاهدة، لكن المذاكرة والفهم حالة منفصلة."
                            value={hasStudentFrontierSelection ? lastCompletedLessonId : ""} onChange={setLastCompletedLessonId} disabled={saveBranchFrontier.isPending}
                            onPrevious={() => setLastCompletedLessonId(stepFrontier(lastCompletedLessonId, "previous"))}
                            onNext={() => setLastCompletedLessonId(stepFrontier(lastCompletedLessonId || "__UNKNOWN__", "next"))}
                            previousDisabled={!canMovePrevious(lastCompletedLessonId)} nextDisabled={!canMoveNext(lastCompletedLessonId)}
                            options={[{ value: "__NOT_STARTED__", label: "لم أبدأ هذا الفرع" },{ value: "__UNKNOWN__", label: "موضعي غير معروف" },...branchChoiceOptions]} visibleOptionLimit={subjectId === "ARB_G2_BAC" && currentBranchId === "ARB_SPELLING" ? 8 : 6} />
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
                            options={[{ value: "__UNKNOWN__", label: "لا أعرف / غير متاح" },{ value: "__NOT_STARTED__", label: "لم يبدأ التدريس بعد" },...branchChoiceOptions]} visibleOptionLimit={subjectId === "ARB_G2_BAC" && currentBranchId === "ARB_SPELLING" ? 8 : 6} />
                        </div>
                        {courseMode === "center" ? (
                          <div className="min-w-0 rounded-xl border border-border/70 bg-background/70 p-3 md:col-span-2">
                            <SearchableFrontierPicker label="موضع السنتر / المجموعة (اختياري)" hint="يمكنك تسجيل موضع المجموعة عند الحاجة."
                              value={schoolClassFrontierId} onChange={setSchoolFrontier} disabled={saveBranchFrontier.isPending}
                              onPrevious={() => setSchoolFrontier(stepFrontier(schoolClassFrontierId, "previous"))}
                              onNext={() => setSchoolFrontier(stepFrontier(schoolClassFrontierId, "next"))}
                              previousDisabled={!canMovePrevious(schoolClassFrontierId)} nextDisabled={!canMoveNext(schoolClassFrontierId)}
                              options={[{ value: "__UNKNOWN__", label: "لا أعرف حتى الآن" },{ value: "__NOT_STARTED__", label: "لم يبدأ السنتر / المجموعة" },...branchChoiceOptions]} visibleOptionLimit={subjectId === "ARB_G2_BAC" && currentBranchId === "ARB_SPELLING" ? 8 : 6} />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )}
                  {branchChoices.length > 0 && (
                    <section className="sf-lesson-state-panel mt-4 overflow-hidden rounded-2xl border border-border/80 bg-background">
                      <header className="border-b border-border/70 bg-muted/15 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-[10px] font-bold tracking-[.12em] text-primary">مشاهدة ≠ مذاكرة</p>
                            <h4 className="mt-1 text-sm font-bold">حالة كل درس في الفرع</h4>
                          </div>
                          <span className="rounded-full border border-border bg-card px-3 py-1.5 text-[10px] font-semibold text-muted-foreground">{lessonStateSummary.studied} من {lessonStateSummary.total} تمت مذاكرتها</span>
                        </div>
                        <p className="mt-2 text-xs leading-6 text-muted-foreground">علامة الصح تعني إنك وصلت للدرس في الشرح. اختار حالة كل درس بنفسك: شاهدته فقط، ذاكرته وفهمته، أو محتاج تراجعه. ولو فوت درسًا في المنتصف، علّمه «لم أشاهد» حتى لو كملت اللي بعده.</p>
                        {currentGap.referencePosition !== null && (
                          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                            <div className="rounded-xl border border-border/70 bg-card p-2.5">
                              <p className="text-[10px] text-muted-foreground">شاهد ولم يذاكر</p>
                              <p className="mt-1 text-sm font-bold tabular-nums">{notStudiedAfterTeacher.toLocaleString("ar-EG")}</p>
                            </div>
                            <div className="rounded-xl border border-border/70 bg-card p-2.5">
                              <p className="text-[10px] text-muted-foreground">يحتاج مراجعة</p>
                              <p className="mt-1 text-sm font-bold tabular-nums">{needsReviewAfterTeacher.toLocaleString("ar-EG")}</p>
                            </div>
                            <div className="col-span-2 rounded-xl border border-border/70 bg-card p-2.5 sm:col-span-1">
                              <p className="text-[10px] text-muted-foreground">ذاكر وفهم</p>
                              <p className="mt-1 text-sm font-bold tabular-nums">{teacherCoveredStates.filter(state => state === "studied").length.toLocaleString("ar-EG")}</p>
                            </div>
                          </div>
                        )}
                      </header>
                      <div className="max-h-[640px] divide-y divide-border/60 overflow-y-auto">
                        {branchChoices.map((choice, index) => {
                          const state = getLessonState(choice.nodeId);
                          const isFrontier = choice.nodeId === lastCompletedLessonId;
                          const reachedInLecture = index <= studentFrontierIndex && studentFrontierIndex >= 0 && state !== "not_watched";
                          const pending = updateLessonLearningState.isPending
                            && updateLessonLearningState.variables?.nodeId === choice.nodeId;
                          return (
                            <article key={choice.nodeId} className={"sf-lesson-state-row flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:gap-4 sm:px-4 " + (isFrontier ? "is-frontier" : "") + (state === "not_watched" ? " is-missed" : "")}>
                              <div className="flex min-w-0 items-center gap-3 sm:flex-1">
                                <span className={"sf-lesson-state-marker flex size-8 shrink-0 items-center justify-center rounded-xl border text-xs font-bold " + (state === "not_watched" ? "border-border bg-muted text-muted-foreground" : isFrontier ? "border-primary/40 bg-primary/15 text-primary" : "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300")}>
                                  {state === "not_watched" ? (index + 1).toLocaleString("ar-EG") : <Check className="size-4" />}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="break-words text-xs font-bold leading-6">{choice.title}</p>
                                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                    <span className={"rounded-md px-2 py-1 text-[10px] font-semibold " + (state === "studied" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" : state === "watched_only" ? "bg-primary/10 text-primary" : state === "needs_review" ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-muted text-muted-foreground")}>{getStudentLessonStateLabel(state)}</span>
                                    {isFrontier && <span className="sf-lesson-frontier-badge rounded-md border border-primary/25 bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">آخر نقطة وصلت لها</span>}
                                    {!reachedInLecture && state === "not_watched" && <span className="text-[10px] text-muted-foreground">لم يصل إليه الشرح بعد أو فاتتك محاضرته</span>}
                                  </div>
                                </div>
                              </div>
                              <label className="block w-full sm:w-[230px]">
                                <span className="sr-only">حالة مذاكرتك: {choice.title}</span>
                                <select
                                  value={state}
                                  disabled={pending}
                                  onChange={event => updateLessonLearningState.mutate({
                                    subjectId,
                                    branchId: currentBranchId,
                                    nodeId: choice.nodeId,
                                    state: event.target.value as StudentLessonState,
                                  })}
                                  className="h-10 w-full rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60"
                                >
                                  <option value="not_watched">لم أشاهد الشرح / فاتتني الحصة</option>
                                  <option value="watched_only">شاهدت المحاضرة فقط — لم أذاكرها</option>
                                  <option value="studied">ذاكرت الدرس وفهمته</option>
                                  <option value="needs_review">ذاكرت، لكن أحتاج مراجعة</option>
                                </select>
                              </label>
                            </article>
                          );
                        })}
                      </div>
                    </section>
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
                              ? isEnglishSkillBranch ? "اكتمل هذا المسار داخل الوحدات. يمكنك متابعة نوع الدرس الآخر أو العودة إلى الوحدات."
                                : nextVisibleBranch ? "اكتمل الفرع؛ يتم الانتقال تلقائيًا إلى الفرع التالي." : "اكتملت الفروع الظاهرة في هذه المادة."
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
              </AnimatePresence>}
            </>
          )}
        </div>
      </section>

      {studyViewMode === "lessons" && <section className="app-card mb-5 overflow-hidden rounded-2xl">
        <header className="border-b border-border/70 bg-card p-5 sm:p-6">
          <p className="text-[10px] font-bold tracking-[0.12em] text-primary">التراكم الدراسي</p>
          <h2 className="mt-1 text-xl font-bold">التراكم الدراسي</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">قراءة مستقلة للفجوة داخل الفرع الحالي. يظهر المرجع المحفوظ في ملف حسابك تلقائيًا دون الحاجة لاختياره هنا.</p>
        </header>
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4 sm:p-6">
          <div className="rounded-xl border border-border/70 bg-background p-4">
            <p className="text-xs text-muted-foreground">موضعك أنت</p>
            <p className="mt-2 font-semibold">{studentFrontierDisplayLabel || (lastCompletedLessonId === "__NOT_STARTED__" ? "لم تبدأ الفرع" : "غير محدد")}</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-background p-4">
            <p className="text-xs text-muted-foreground">المرجع المقارن</p>
            <p className="mt-2 font-semibold">{teacherFrontierDisplayLabel || (currentGap.referenceSource === "teacher" ? "موضع المدرس" : currentGap.referenceSource === "school" ? "موضع المجموعة" : "غير محدد")}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{currentGap.referenceSource === "teacher" ? "المدرس" : currentGap.referenceSource === "school" ? "السنتر / المجموعة" : "لا يوجد مرجع محفوظ"}</p>
          </div>
          <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
            <p className="text-xs text-muted-foreground">فجوة شرح المدرس</p>
            <p className="mt-2 text-xl font-bold text-primary">
              {currentGap.status !== "calculated" ? "غير محسوبة" : currentGap.gapCount! > 0 ? currentGap.gapCount + " " + currentBranchPointLabel : currentGap.aheadCount! > 0 ? "متقدم بـ " + currentGap.aheadCount + " " + currentBranchPointLabel : "لا يوجد تراكم"}
            </p>
          </div>
          <div className="rounded-xl border border-primary/20 bg-primary/[0.045] p-4">
            <p className="text-xs text-muted-foreground">التالي بعد آخر موضوع مكتمل</p>
            <p className="mt-2 font-bold text-foreground">{nextStudentLesson?.title || (isStudentDoneWithBranch ? "اكتملت موضوعات هذا الفرع" : "حدد آخر موضوع أنهيته")}</p>
            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">ده موضع وصولك في شرح المدرس فقط. حالة المذاكرة والفهم لكل درس محسوبة منفصلة في قائمة الدروس.</p>
          </div>
          <p className="text-xs leading-6 text-muted-foreground sm:col-span-2 lg:col-span-4">
            {currentGap.status === "student_position_missing" ? "حدد موضعك أنت أولًا." : currentGap.status === "reference_missing" ? "لا يوجد مرجع محفوظ للمقارنة حتى الآن؛ يمكنك متابعة تقدمك دون إعداد إضافي هنا." : "الحساب يستخدم عدد نقاط الفهرس داخل هذا الفرع فقط؛ لا يعمم الرقم على بقية فروع المادة."}
          </p>
        </div>
      </section>}

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
  label, hint, value, onChange, options, disabled = false, visibleOptionLimit = 6,
  onPrevious, onNext, previousDisabled = false, nextDisabled = false,
}: {
  label: string; hint?: string; value: string; onChange: (value: string) => void;
  options: ChoiceButtonOption[]; disabled?: boolean; visibleOptionLimit?: number;
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
  const isStatusOption = (option: ChoiceButtonOption) =>
    option.value === "__UNKNOWN__" || option.value === "__NOT_STARTED__";
  const statusOptions = options.filter(isStatusOption);
  const curriculumOptions = options.filter(option => !isStatusOption(option));
  const visibleOptions = normalizedQuery
    ? options.filter(option => normalizeFrontierSearch(option.label + " " + (option.description ?? "")).includes(normalizedQuery))
    : [
        ...statusOptions,
        ...(showAllOptions ? curriculumOptions : curriculumOptions.slice(0, visibleOptionLimit)),
      ];
  const hiddenOptionCount = Math.max(0, curriculumOptions.length - visibleOptionLimit);
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
      {!normalizedQuery && hiddenOptionCount > 0 && !showAllOptions && <Button type="button" variant="outline" size="sm" className="w-full rounded-xl text-xs" onClick={() => setShowAllOptions(true)}>إظهار باقي الدروس ({hiddenOptionCount})</Button>}
      {!normalizedQuery && showAllOptions && hiddenOptionCount > 0 && <Button type="button" variant="ghost" size="sm" className="w-full rounded-xl text-xs" onClick={() => setShowAllOptions(false)}>عرض خيارات أقل</Button>}
      {!visibleOptions.length && <p className="rounded-xl bg-muted/30 p-3 text-center text-xs text-muted-foreground">لا توجد نتيجة مطابقة في فهرس هذا الفرع.</p>}
      {value && <button type="button" disabled={disabled} onClick={() => onChange(options.some(option => option.value === "__UNKNOWN__") ? "__UNKNOWN__" : "")}
        className="text-xs font-semibold text-muted-foreground underline underline-offset-4 disabled:opacity-50">إلغاء الاختيار</button>}
    </div>
  );
}
