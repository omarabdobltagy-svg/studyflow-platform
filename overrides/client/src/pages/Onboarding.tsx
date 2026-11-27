import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import {
  SIE_CATALOG_META,
  SIE_SYSTEMS,
  getSIEElectiveGroups,
  getSIECheckpointBranches,
  getSIECheckpointProgressOptions,
  getSIECheckpointChoicesForTeacher,
  getSIETeacher,
  getSIESubject,
  getSIESubjectsForTrack,
  getSIETeachersForSubject,
  getSIETrack,
  getSIETracks,
  type SIESystemId,
} from "@shared/sie-catalog";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CircleHelp,
  ExternalLink,
  GraduationCap,
  Loader2,
  Pencil,
  ShieldCheck,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useLocation, type RouteComponentProps } from "wouter";
import { toast } from "sonner";

type TeacherChoiceMap = Record<string, string>;
type TeacherScheduleSlot = { dayOfWeek: number; startTime: string };
type TeacherScheduleMap = Record<string, TeacherScheduleSlot[]>;
type CustomTeacherProfile = { nameAr: string; brandName: string; sourceUrl: string; availableModes: Array<"center" | "online">; confidence: "low" | "medium" | "high"; evidence: Array<{ title: string; url: string; source: string }>; notes?: string };
type TeacherRequirementState = "yes" | "no" | "varies" | "unknown";
const WEEK_DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
type FormState = {
  studentName: string;
  phone: string;
  systemId: SIESystemId | "";
  trackId: string;
  electiveSubjectId: string;
  teacherSelections: TeacherChoiceMap;
  checkpointSelections: Record<string, string>;
  courseModes: Record<string, "center" | "online">;
  customTeacherNames: Record<string, string>;
  customTeacherProfiles: Record<string, CustomTeacherProfile>;
  teacherSchedules: TeacherScheduleMap;
  teacherScheduleUnfixed: Record<string, boolean>;
  teacherAccessRequirements: Record<string, "homework_and_exam" | "homework_only" | "exam_only" | "none" | "unknown">;
  teacherHomeworkPolicy: Record<string, TeacherRequirementState>;
  teacherHomeworkRequiredBeforeNextLecture: Record<string, TeacherRequirementState>;
  teacherPreLectureExamRequired: Record<string, TeacherRequirementState>;
};

function withoutSubject<T>(map: Record<string, T>, subjectId: string): Record<string, T> {
  const { [subjectId]: _removed, ...remaining } = map;
  return remaining;
}

function resetTeacherSpecificChoices(current: FormState, subjectId: string): FormState {
  return {
    ...current,
    checkpointSelections: withoutSubject(current.checkpointSelections, subjectId),
    customTeacherProfiles: withoutSubject(current.customTeacherProfiles, subjectId),
    courseModes: withoutSubject(current.courseModes, subjectId),
    teacherSchedules: withoutSubject(current.teacherSchedules, subjectId),
    teacherScheduleUnfixed: withoutSubject(current.teacherScheduleUnfixed, subjectId),
    teacherAccessRequirements: withoutSubject(current.teacherAccessRequirements, subjectId),
    teacherHomeworkPolicy: withoutSubject(current.teacherHomeworkPolicy, subjectId),
    teacherHomeworkRequiredBeforeNextLecture: withoutSubject(current.teacherHomeworkRequiredBeforeNextLecture, subjectId),
    teacherPreLectureExamRequired: withoutSubject(current.teacherPreLectureExamRequired, subjectId),
  };
}

const steps = ["بياناتك", "النظام الدراسي", "المسار", "المواد", "المدرس ومواعيد المحاضرات"];
const SKIP_TEACHER = "__SKIP__";
const CHECKPOINT_NOT_STARTED = "__NOT_STARTED__";
const CHECKPOINT_UNKNOWN = "__UNKNOWN__";
const CHECKPOINT_DEFERRED = "__DEFERRED__";

function normalizeEgyptianPhone(value: string) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/[^\d]/g, "");
  if (!digits) return "";
  if (trimmed.startsWith("+")) return "+" + digits;
  if (digits.startsWith("0020")) return "+" + digits.slice(2);
  if (digits.startsWith("20")) return "+" + digits;
  if (digits.startsWith("0")) return "+20" + digits.slice(1);
  return "+" + digits;
}

function isValidPhone(value: string) {
  const normalized = normalizeEgyptianPhone(value);
  return /^\+[1-9]\d{7,14}$/.test(normalized);
}

function daysSince(dateString: string) {
  const date = new Date(dateString + "T12:00:00Z");
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((Date.now() - date.getTime()) / 86_400_000);
}

export default function Onboarding({ editMode = false }: Partial<RouteComponentProps> & { editMode?: boolean }) {
  const [, setLocation] = useLocation();
  const auth = trpc.auth.me.useQuery(undefined, { retry: false });
  const profile = trpc.studentProfile.get.useQuery(undefined, { enabled: Boolean(auth.data) });
  const utils = trpc.useUtils();
  const [isEditingProfile, setIsEditingProfile] = useState(!editMode);
  const complete = trpc.studentProfile.complete.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.auth.me.invalidate(), utils.studentProfile.get.invalidate()]);
      toast.success(editMode ? "تم تحديث اختيارات ملفك الدراسي." : "اكتمل إعداد حسابك الدراسي.");
      if (editMode) {
        setIsEditingProfile(false);
        setStep(0);
      } else {
        setLocation("/");
      }
    },
    onError: error => toast.error(error.message || "تعذر حفظ بيانات الحساب."),
  });

  const [step, setStep] = useState(editMode ? 0 : 1);
  const [subjectSetupIndex, setSubjectSetupIndex] = useState(0);
  const [expandedCheckpointChoices, setExpandedCheckpointChoices] = useState<Record<string, number>>({});
  const [refreshCheckpointMode, setRefreshCheckpointMode] = useState(false);
  const [form, setForm] = useState<FormState>({
    studentName: "",
    phone: "",
    systemId: "",
    trackId: "",
    electiveSubjectId: "",
    teacherSelections: {},
    checkpointSelections: {},
    courseModes: {},
    customTeacherNames: {},
    customTeacherProfiles: {},
    teacherSchedules: {},
    teacherScheduleUnfixed: {},
    teacherAccessRequirements: {},
    teacherHomeworkPolicy: {},
    teacherHomeworkRequiredBeforeNextLecture: {},
    teacherPreLectureExamRequired: {},
  });

  useEffect(() => {
    const saved = (profile.data as any)?.selection ?? null;
    const teacherSelections: Record<string, string> = { ...((saved?.teacherChoices as Record<string, string> | undefined) ?? {}), ...form.teacherSelections };
    const teacherScheduleUnfixed: Record<string, boolean> = {
      ...Object.fromEntries((saved?.teacherScheduleUnfixedSubjectIds ?? []).map((subjectId: string) => [subjectId, true])),
      ...(saved?.teacherScheduleUnfixed ?? {}),
      ...form.teacherScheduleUnfixed,
    };
    const teacherSchedules: TeacherScheduleMap = { ...((saved?.teacherSchedules as TeacherScheduleMap | undefined) ?? {}), ...form.teacherSchedules };
    // Fill only empty slots; existing student edits always win over the suggested defaults.
    for (const [subjectId, teacherId] of Object.entries(teacherSelections)) {
      if (teacherScheduleUnfixed[subjectId]) continue;
      if (Array.isArray(teacherSchedules[subjectId]) && teacherSchedules[subjectId].length > 0) continue;
      const suggested = getSIETeacher(teacherId)?.suggestedDefaultSchedule;
      if (suggested?.length) teacherSchedules[subjectId] = suggested.map(slot => ({ ...slot }));
    }
    setForm(current => ({
      ...current,
      studentName: current.studentName || (profile.data as any)?.studentName || auth.data?.name || "",
      phone: current.phone || auth.data?.phone || "",
      systemId: current.systemId || saved?.systemId || "",
      trackId: current.trackId || saved?.trackId || "",
      electiveSubjectId: current.electiveSubjectId || saved?.electiveSubjectId || "",
      teacherSelections,
      checkpointSelections: { ...(saved?.teacherFrontiers ?? {}), ...current.checkpointSelections },
      courseModes: { ...(saved?.courseModes ?? {}), ...current.courseModes },
      customTeacherNames: { ...(saved?.customTeacherNames ?? {}), ...current.customTeacherNames },
      customTeacherProfiles: { ...(saved?.customTeacherProfiles ?? {}), ...current.customTeacherProfiles },
      teacherSchedules,
      teacherScheduleUnfixed,
      teacherAccessRequirements: { ...(saved?.teacherAccessRequirements ?? {}), ...current.teacherAccessRequirements },
      teacherHomeworkPolicy: { ...(saved?.teacherHomeworkPolicy ?? {}), ...current.teacherHomeworkPolicy },
      teacherHomeworkRequiredBeforeNextLecture: { ...(saved?.teacherHomeworkRequiredBeforeNextLecture ?? {}), ...current.teacherHomeworkRequiredBeforeNextLecture },
      teacherPreLectureExamRequired: { ...(saved?.teacherPreLectureExamRequired ?? {}), ...current.teacherPreLectureExamRequired },
    }));
  }, [auth.data, profile.data]);

  const hasAccountIdentity = Boolean(auth.data?.name?.trim() && isValidPhone(auth.data?.phone ?? ""));
  useEffect(() => {
    if (!editMode && auth.isSuccess) setStep(hasAccountIdentity ? 1 : 0);
  }, [editMode, auth.isSuccess, hasAccountIdentity]);

  const system = SIE_SYSTEMS.find(item => item.systemId === form.systemId);
  const tracks = form.systemId ? getSIETracks(form.systemId) : [];
  const track = form.trackId ? getSIETrack(form.trackId) : undefined;
  const electiveGroups = track ? getSIEElectiveGroups(track.trackId) : [];
  const firstElectiveGroup = electiveGroups[0] ?? [];
  const fixedSubjects = track ? getSIESubjectsForTrack(track.trackId) : [];
  const selectedSubjects = useMemo(() => {
    if (!track) return [];
    if (track.fixedSubjectIds) return fixedSubjects;
    const elective = firstElectiveGroup.find(item => item.subjectId === form.electiveSubjectId);
    return [
      ...track.requiredSubjectIds.map(getSIESubject).filter((item): item is NonNullable<typeof item> => Boolean(item)),
      ...(elective ? [elective] : []),
    ];
  }, [track, fixedSubjects, firstElectiveGroup, form.electiveSubjectId]);

  const identityStepRequired = editMode || !hasAccountIdentity;
  const activeSteps = identityStepRequired ? steps : steps.slice(1);
  const progressStep = identityStepRequired ? step + 1 : step;
  const activeStepIndex = progressStep - 1;
  const currentSetupSubject = selectedSubjects[subjectSetupIndex] ?? selectedSubjects[0];
  const currentSetupSubjectId = currentSetupSubject?.subjectId ?? "";
  const setupTeacherOptions = currentSetupSubjectId && form.systemId ? getSIETeachersForSubject(currentSetupSubjectId, form.systemId) : [];
  const selectedSetupTeacherId = form.teacherSelections[currentSetupSubjectId] && form.teacherSelections[currentSetupSubjectId] !== SKIP_TEACHER
    ? form.teacherSelections[currentSetupSubjectId] : "";
  const selectedSetupTeacher = selectedSetupTeacherId
    ? setupTeacherOptions.find(teacher => teacher.teacherId === selectedSetupTeacherId) ?? getSIETeacher(selectedSetupTeacherId) ?? null
    : null;
  const teacherFacts = trpc.teacherDirectory.facts.useQuery({
    teacherId: selectedSetupTeacherId || "__none__",
    subjectId: currentSetupSubjectId || "__none__",
    systemId: (form.systemId || "EG_BACCALAUREATE") as "EG_BACCALAUREATE" | "EG_GENERAL_SECONDARY",
    gradeYear: SIE_CATALOG_META.gradeYear,
  }, {
    enabled: Boolean(selectedSetupTeacherId && currentSetupSubjectId && form.systemId),
    refetchInterval: query => query.state.data?.state === "researching" ? 4_000 : false,
    staleTime: 60_000,
  });

  const discoverTeacher = trpc.teacherDirectory.discover.useMutation({
    onSuccess: (result, variables) => {
      if (!result.found) {
        toast.error("ملقيناش مصدرًا عامًا كافيًا يحدد المدرس ده. تقدر تحتفظ بالاسم وتختار طريقة متابعتك بنفسك.");
        return;
      }
      const profile: CustomTeacherProfile = {
        nameAr: variables.teacherName.trim(),
        brandName: result.brandName || variables.teacherName.trim(),
        sourceUrl: result.sourceUrl,
        availableModes: result.availableModes,
        confidence: result.confidence,
        evidence: result.evidence,
        notes: result.notes,
      };
      setForm(current => ({
        ...current,
        teacherSelections: { ...current.teacherSelections, [variables.subjectId]: SKIP_TEACHER },
        customTeacherNames: { ...current.customTeacherNames, [variables.subjectId]: profile.nameAr },
        customTeacherProfiles: { ...current.customTeacherProfiles, [variables.subjectId]: profile },
        courseModes: profile.availableModes.length === 1
          ? { ...current.courseModes, [variables.subjectId]: profile.availableModes[0] }
          : current.courseModes,
      }));
      toast.success("لقينا مصدرًا عامًا مرتبطًا بالاسم وأضفناه لاختيارات المادة. راجع المنصة قبل المتابعة.");
    },
    onError: error => toast.error(error.message || "تعذر البحث عن المدرس الآن."),
  });
  const customTeacherProfile = form.customTeacherProfiles[currentSetupSubjectId];
  const researchedModes = customTeacherProfile
    ? (customTeacherProfile.confidence === "low" ? [] : customTeacherProfile.availableModes)
    : ((teacherFacts.data?.state === "verified" || teacherFacts.data?.state === "partial")
      ? teacherFacts.data.facts.availableModes
      : []);
  const modeResearchConfirmed = researchedModes.length > 0;

  useEffect(() => {
    const result = teacherFacts.data;
    if (!result || result.state === "researching" || result.state === "insufficient_evidence" || result.facts.isStale || !currentSetupSubjectId) return;
    setForm(current => {
      const subjectId = currentSetupSubjectId;
      const next = { ...current };
      if ((result.state === "verified" || result.state === "partial") && result.facts.availableModes.length === 1 && current.courseModes[subjectId] !== result.facts.availableModes[0]) {
        next.courseModes = { ...current.courseModes, [subjectId]: result.facts.availableModes[0] };
      }
      const updateWhenUnknown = (map: Record<string, TeacherRequirementState>, value: TeacherRequirementState) =>
        (!map[subjectId] || map[subjectId] === "unknown") ? { ...map, [subjectId]: value } : map;
      next.teacherHomeworkPolicy = updateWhenUnknown(current.teacherHomeworkPolicy, result.facts.homeworkPolicy);
      next.teacherHomeworkRequiredBeforeNextLecture = updateWhenUnknown(current.teacherHomeworkRequiredBeforeNextLecture, result.facts.homeworkRequiredBeforeNextLecture);
      next.teacherPreLectureExamRequired = updateWhenUnknown(current.teacherPreLectureExamRequired, result.facts.preLectureExamRequired);
      return next;
    });
  }, [teacherFacts.data, currentSetupSubjectId]);

  useEffect(() => {
    if (step !== 3 || firstElectiveGroup.length !== 1) return;
    const onlyElectiveId = firstElectiveGroup[0].subjectId;
    if (form.electiveSubjectId !== onlyElectiveId) {
      setForm(current => ({ ...current, electiveSubjectId: onlyElectiveId }));
    }
  }, [step, firstElectiveGroup, form.electiveSubjectId]);

  const isIdentityValid =
    form.studentName.trim().length >= 2 &&
    form.studentName.trim().length <= 120 &&
    isValidPhone(form.phone);
  const stepValid = step === 0
    ? isIdentityValid
    : step === 1
      ? Boolean(form.systemId)
      : step === 2
        ? Boolean(form.trackId)
        : step === 3
          ? Boolean(track && (track.fixedSubjectIds || firstElectiveGroup.length === 0 || firstElectiveGroup.some(item => item.subjectId === form.electiveSubjectId)))
          : Boolean(currentSetupSubject && form.courseModes[currentSetupSubject.subjectId]
            && (form.teacherScheduleUnfixed[currentSetupSubject.subjectId]
              || (form.teacherSchedules[currentSetupSubject.subjectId] ?? []).length > 0)
            );

  const next = () => {
    if (!stepValid) {
      if (step === 0) toast.error("اكتب اسمك ورقم هاتف صحيحًا أولًا.");
      else if (step === 1) toast.error("اختر النظام الدراسي.");
      else if (step === 2) toast.error("اختر المسار أو الشعبة.");
      else if (step === 3) toast.error("اختر المادة التخصصية المطلوبة لمسارك.");
      else if (step === 4) toast.error("أضف موعد محاضرة واحدًا على الأقل لهذه المادة، أو حدّد أن مواعيدها غير ثابتة حاليًا.");
      return;
    }
    if (step === 4) {
      if (subjectSetupIndex < selectedSubjects.length - 1) setSubjectSetupIndex(index => index + 1);
      else save();
      return;
    }
    setStep(current => Math.min(steps.length - 1, current + 1));
  };

  const previous = () => {
    if (step === 4 && subjectSetupIndex > 0) { setSubjectSetupIndex(index => Math.max(0, index - 1)); return; }
    setStep(current => Math.max(identityStepRequired ? 0 : 1, current - 1));
  };

  const chooseSystem = (systemId: SIESystemId) => {
    setSubjectSetupIndex(0);
    setForm(current => ({
      ...current, systemId, trackId: "", electiveSubjectId: "", teacherSelections: {}, checkpointSelections: {}, courseModes: {}, customTeacherNames: {}, teacherSchedules: {}, teacherScheduleUnfixed: {},
      teacherAccessRequirements: {}, teacherHomeworkPolicy: {}, teacherHomeworkRequiredBeforeNextLecture: {}, teacherPreLectureExamRequired: {},
    }));
  };

  const chooseTrack = (trackId: string) => {
    setSubjectSetupIndex(0);
    setForm(current => ({
      ...current, trackId, electiveSubjectId: "", teacherSelections: {}, checkpointSelections: {}, courseModes: {}, customTeacherNames: {}, teacherSchedules: {}, teacherScheduleUnfixed: {},
      teacherAccessRequirements: {},
    }));
  };

  const save = () => {
    if (!track || selectedSubjects.length === 0 || !isIdentityValid) {
      toast.error("راجع بياناتك واختياراتك قبل الحفظ.");
      return;
    }
    const missingCourseMode = selectedSubjects.find(subject => !form.courseModes[subject.subjectId]);
    if (missingCourseMode) {
      setSubjectSetupIndex(selectedSubjects.findIndex(subject => subject.subjectId === missingCourseMode.subjectId));
      toast.error(`حدد طريقة دراسة مادة ${missingCourseMode.nameAr} أولًا.`);
      return;
    }
    const teacherSelections = Object.fromEntries(
      Object.entries(form.teacherSelections).filter(([, teacherId]) => teacherId && teacherId !== SKIP_TEACHER)
    );
    const missingSchedule = selectedSubjects.find(subject =>
      !(form.teacherSchedules[subject.subjectId] ?? []).length
      && !form.teacherScheduleUnfixed[subject.subjectId]
    );
    if (missingSchedule) {
      setSubjectSetupIndex(selectedSubjects.findIndex(subject => subject.subjectId === missingSchedule.subjectId));
      toast.error("سجّل موعد المحاضرة لمادة " + missingSchedule.nameAr + " أو حدّد أن مواعيدها غير ثابتة حاليًا.");
      return;
    }
    complete.mutate({
      studentName: form.studentName.trim(),
      phone: normalizeEgyptianPhone(form.phone),
      systemId: form.systemId as SIESystemId,
      trackId: track.trackId,
      subjectIds: selectedSubjects.map(subject => subject.subjectId),
      teacherSelections,
      skippedTeacherSubjectIds: selectedSubjects.filter(subject => !teacherSelections[subject.subjectId]).map(subject => subject.subjectId),
      courseModes: Object.fromEntries(selectedSubjects.map(subject => [subject.subjectId, form.courseModes[subject.subjectId] ?? "online"])),
      customTeacherNames: Object.fromEntries(Object.entries(form.customTeacherNames).filter(([id, name]) => selectedSubjects.some(subject => subject.subjectId === id) && name.trim()).map(([id, name]) => [id, name.trim()])),
      customTeacherProfiles: Object.fromEntries(Object.entries(form.customTeacherProfiles).filter(([id]) => selectedSubjects.some(subject => subject.subjectId === id))),
      teacherSchedules: Object.fromEntries(selectedSubjects.map(subject => [
        subject.subjectId,
        (form.teacherSchedules[subject.subjectId] ?? []).map(slot => ({
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
        })),
      ])),
      teacherScheduleUnfixedSubjectIds: selectedSubjects
        .filter(subject => form.teacherScheduleUnfixed[subject.subjectId])
        .map(subject => subject.subjectId),
      teacherAccessRequirements: Object.fromEntries(selectedSubjects.map(subject => [subject.subjectId, form.teacherAccessRequirements[subject.subjectId] ?? "unknown"])),
      teacherHomeworkPolicy: Object.fromEntries(selectedSubjects.map(subject => [subject.subjectId, form.teacherHomeworkPolicy[subject.subjectId] ?? "unknown"])),
      teacherHomeworkRequiredBeforeNextLecture: Object.fromEntries(selectedSubjects.map(subject => [subject.subjectId, form.teacherHomeworkRequiredBeforeNextLecture[subject.subjectId] ?? "unknown"])),
      teacherPreLectureExamRequired: Object.fromEntries(selectedSubjects.map(subject => [subject.subjectId, form.teacherPreLectureExamRequired[subject.subjectId] ?? "unknown"])),
      teacherFrontierReports: Object.fromEntries(
        selectedSubjects
          .map(subject => [subject.subjectId, form.checkpointSelections[subject.subjectId] ?? ""] as const)
          .filter(([, report]) => Boolean(report)),
      ),
    });
  };

  return (
    <DashboardLayout
      title={editMode ? "ملفك الدراسي" : "إعداد حسابك"}
      description={editMode ? "راجع النظام والمسار والمواد والمدرسين المرتبطين بحسابك." : "بيانات أساسية قليلة، وبعدها تختار من قوائم جاهزة بدل كتابة تفاصيل دراستك يدويًا."}
    >
      {auth.isLoading || (Boolean(auth.data) && profile.isLoading) ? (
        <div className="app-card mx-auto max-w-3xl p-10 text-center text-sm text-muted-foreground" role="status">
          <Loader2 className="mx-auto mb-3 size-5 animate-spin" />
          نحمّل حسابك واختياراتك…
        </div>
      ) : editMode && !isEditingProfile ? (
        <StudentProfileOverview
          profile={profile.data as any}
          onEdit={() => { setIsEditingProfile(true); setStep(0); }}
          onOpenStudy={() => setLocation("/study")}
        />
      ) : (
        <div className="sf-onboarding-shell mx-auto max-w-4xl">
          <section className="sf-onboarding-hero relative overflow-hidden rounded-[2rem] bg-primary p-6 text-primary-foreground shadow-xl sm:p-9">
            <div className="pointer-events-none absolute -left-10 -top-16 size-56 rounded-full bg-white/10 blur-3xl" />
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow text-primary-foreground/65">STUDENT SETUP · {SIE_CATALOG_META.academicYear}</p>
                <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{editMode ? "اختياراتك الدراسية." : "خلّينا نضبط مسارك."}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-primary-foreground/75">
                  {identityStepRequired
                    ? "بياناتك الأساسية لربط الحساب بالمسار الدراسي. بعد حفظها لن تحتاج إلى إدخالها مرة أخرى."
                    : "بيانات الاسم ورقم الهاتف محفوظة في حسابك بالفعل. أكمل إعداد مسارك وموادك ومدرسيك."}
                </p>
              </div>
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                <GraduationCap className="size-6" />
              </span>
            </div>
            <div className="relative mt-7 flex items-center justify-between gap-3 text-xs text-primary-foreground/75">
              <span>{editMode ? "تعديل ملفك الدراسي" : "إعداد حسابك الدراسي"}</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 font-bold tabular-nums">الخطوة {progressStep} من {activeSteps.length}</span>
            </div>
            <Progress value={(progressStep / activeSteps.length) * 100} className="relative mt-3 h-2 bg-white/15 [&>div]:bg-amber-300" />
            <div className="relative mt-3 flex justify-between gap-2 text-[10px] text-primary-foreground/60 sm:text-xs">
              {activeSteps.map((label, index) => (
                <span key={label} className={index <= activeStepIndex ? "font-bold text-white" : ""}>{label}</span>
              ))}
            </div>
          </section>

          <section className="sf-onboarding-panel app-card mt-5 overflow-hidden">
            <header className="border-b border-border/70 bg-muted/20 px-5 py-5 sm:px-7">
              <p className="eyebrow">الخطوة {progressStep} من {activeSteps.length}</p>
              <h2 className="mt-1 text-xl font-bold">{steps[step]}</h2>
            </header>

            <div className="min-h-[380px] p-5 sm:p-7">
              {step === 0 && (
                <div className="mx-auto max-w-2xl space-y-5">
                  <div className="flex items-center gap-3 rounded-2xl border border-primary/15 bg-secondary/30 p-4">
                    <ShieldCheck className="size-5 shrink-0 text-primary" />
                    <p className="text-sm leading-7 text-muted-foreground">
                      بياناتك الأساسية لربط حسابك بالمسار الدراسي. تسجيل الدخول يتم من داخل StudyFlow.
                    </p>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold">اسمك</label>
                    <Input
                      autoFocus
                      name="name"
                      type="text"
                      inputMode="text"
                      autoComplete="name"
                      autoCapitalize="words"
                      enterKeyHint="next"
                      value={form.studentName}
                      onChange={event => setForm(current => ({ ...current, studentName: event.target.value }))}
                      placeholder="اكتب اسمك"
                      maxLength={120}
                      className="h-12 rounded-xl bg-background"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold">رقم هاتفك</label>
                    <Input
                      value={form.phone}
                      onChange={event => setForm(current => ({ ...current, phone: event.target.value }))}
                      placeholder="01xxxxxxxxx أو +20xxxxxxxxxx"
                      name="tel"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      enterKeyHint="next"
                      className="h-12 rounded-xl bg-background"
                    />
                    <p className="mt-2 text-xs leading-6 text-muted-foreground">
                      يُحفظ الرقم كما أدخلته بعد توحيده للصيغة الدولية. لا نرسل رمز تحقق ولا نطلب البريد أو بيانات إضافية.
                    </p>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {SIE_SYSTEMS.map(item => (
                    <ChoiceCard
                      key={item.systemId}
                      selected={form.systemId === item.systemId}
                      onClick={() => chooseSystem(item.systemId)}
                      icon={<GraduationCap className="size-6" />}
                      title={item.nameAr}
                      subtitle={item.description}
                      note={item.verificationNote}
                    />
                  ))}
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <p className="text-sm leading-7 text-muted-foreground">اختر المسار المرتبط بنظامك. ستظهر لك المواد المناسبة له تلقائيًا.</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {tracks.map(item => (
                      <ChoiceCard
                        key={item.trackId}
                        selected={form.trackId === item.trackId}
                        onClick={() => chooseTrack(item.trackId)}
                        icon={<BookOpen className="size-5" />}
                        title={item.nameAr}
                        subtitle={item.note || "مسار دراسي"}
                      />
                    ))}
                  </div>
                </div>
              )}

              {step === 3 && track && (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-border bg-muted/20 p-4">
                    <p className="text-sm font-semibold">{system?.nameAr} · {track.nameAr}</p>
                    <p className="mt-1 text-xs leading-6 text-muted-foreground">
                      {track.fixedSubjectIds
                        ? "المواد التالية مرتبطة بالشعبة المختارة، ولا تحتاج إلى إدخالها واحدةً واحدة."
                        : firstElectiveGroup.length === 0
                          ? "المواد المطلوبة لمسارك محددة مسبقًا، ولا توجد مادة تخصصية أخرى للاختيار."
                          : "المواد الأساسية تُضاف تلقائيًا. اختر مادة تخصصية واحدة من الاختيارات المتاحة لمسارك."}
                    </p>
                  </div>

                  {track.fixedSubjectIds ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {fixedSubjects.map(subject => (
                        <div key={subject.subjectId} className="rounded-2xl border border-border bg-card p-4">
                          <p className="font-semibold">{subject.nameAr}</p>
                          <span className="mt-2 inline-flex rounded-full bg-amber-500/10 px-2.5 py-1 text-xs text-amber-700 dark:text-amber-300">
                            فهرس المنهج لم يُحمّل بعد
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      <div>
                        <p className="mb-3 text-sm font-semibold">{track.trackId === "BAC_ARTS_HUM" ? "المواد الأساسية والمادة التخصصية المقررة" : "المواد الأساسية المضافة تلقائيًا"}</p>
                        <div className="grid gap-3 sm:grid-cols-3">
                          {track.requiredSubjectIds.map(id => {
                            const subject = getSIESubject(id);
                            if (!subject) return null;
                            return <div key={id} className="rounded-2xl border border-primary/20 bg-secondary/35 p-4">
                              <Check className="mb-2 size-4 text-primary" />
                              <p className="font-semibold">{subject.nameAr}</p>
                              <p className="mt-1 text-xs text-muted-foreground">{id === "PSYCHOLOGY_G2_BAC_PENDING" ? "المادة التخصصية المقررة" : "مادة أساسية"}</p>
                            </div>;
                          })}
                        </div>
                      </div>
                      {firstElectiveGroup.length > 0 && (
                        <div>
                          <p className="mb-3 text-sm font-semibold">{firstElectiveGroup.length === 1 ? "المادة التخصصية لهذا المسار" : "اختر مادة تخصصية واحدة"}</p>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {firstElectiveGroup.map(subject => (
                              <ChoiceCard
                                key={subject.subjectId}
                                selected={form.electiveSubjectId === subject.subjectId}
                                onClick={() => setForm(current => ({
                                  ...current,
                                  electiveSubjectId: subject.subjectId,
                                  teacherSelections: {},
                                  checkpointSelections: {},
                                }))}
                                icon={<BookOpen className="size-5" />}
                                title={subject.nameAr}
                                note={subject.curriculumAvailable ? subject.note : "اختيارها متاح، لكن فهرسها التفصيلي لم يُحمّل في الحزمة بعد."}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {step === 4 && currentSetupSubject && (
                <div className="space-y-6">
                  <div className="flex flex-col gap-3 rounded-2xl border border-primary/15 bg-secondary/25 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="eyebrow">إعداد مادة واحدة في كل مرة</p>
                      <h3 className="mt-1 text-xl font-bold">{currentSetupSubject.nameAr}</h3>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">المادة {subjectSetupIndex + 1} من {selectedSubjects.length}. هنحفظ طريقة الدراسة هنا؛ مواضع تقدمك وموضع الشرح تُسجل بشكل مستقل لكل فرع في صفحة المذاكرة بعد الإعداد.</p>
                    </div>
                    <span className="rounded-full border border-border bg-background px-3 py-2 text-xs font-semibold">{subjectSetupIndex + 1} / {selectedSubjects.length}</span>
                  </div>
                  <div className="sf-teacher-selection-panel space-y-5">
                    <div className="sf-teacher-selection-title">
                      <div className="sf-teacher-selection-icon"><GraduationCap className="size-5" /></div>
                      <div>
                        <p className="eyebrow">ملف المدرس</p>
                        <h3>مين المدرس اللي بتتابع معاه {currentSetupSubject.nameAr}؟</h3>
                        <p>حدد مدرسك مرة واحدة. هنربط به بيانات المواعيد والمصادر وتحديثات الشرح، من غير ما نخلط بياناته بموادك التانية.</p>
                      </div>
                      <span className="sf-teacher-subject-tag">{currentSetupSubject.nameAr}</span>
                    </div>
                    <div>
                      <p className="mb-3 text-sm font-bold">اختر المدرس من دليل المادة</p>
                      <p className="mb-3 text-xs leading-6 text-muted-foreground">اختيار المدرس أولًا. بعده حدد هل بتتابعه في سنتر أو أونلاين؛ تغيير طريقة الدراسة لن يمسح المدرس المحدد.</p>
                      {setupTeacherOptions.length ? (
                        <div className="sf-teacher-choice-grid grid gap-3 sm:grid-cols-2">
                          {setupTeacherOptions.map(teacher => {
                            const selected = form.teacherSelections[currentSetupSubjectId] === teacher.teacherId;
                            return (
                              <button key={teacher.teacherId} type="button" aria-pressed={selected}
                                onClick={() => setForm(current => {
                                  if (current.teacherSelections[currentSetupSubjectId] === teacher.teacherId) return current;
                                  const next = resetTeacherSpecificChoices(current, currentSetupSubjectId);
                                  const suggestedSchedule = teacher.suggestedDefaultSchedule ?? [];
                                  return {
                                    ...next,
                                    teacherSelections: { ...current.teacherSelections, [currentSetupSubjectId]: teacher.teacherId },
                                    customTeacherNames: { ...current.customTeacherNames, [currentSetupSubjectId]: "" },
                                    customTeacherProfiles: withoutSubject(current.customTeacherProfiles, currentSetupSubjectId),
                                    teacherSchedules: suggestedSchedule.length
                                      ? { ...next.teacherSchedules, [currentSetupSubjectId]: suggestedSchedule.map(slot => ({ ...slot })) }
                                      : next.teacherSchedules,
                                  };
                                })}
                                className={"sf-teacher-choice flex min-h-16 items-center justify-between gap-3 rounded-2xl border p-4 text-right transition " + (selected ? "is-selected border-primary bg-secondary/45 ring-1 ring-primary/20" : "border-border bg-card hover:border-primary/40")}>
                                <span className="sf-teacher-choice-copy min-w-0">
                                  <b>{teacher.nameAr}</b>
                                  {teacher.brandName && teacher.brandName.trim() !== teacher.nameAr.trim() && <small className="sf-teacher-brand">{teacher.brandName}</small>}
                                  <small>{selected ? "تم اختيار المدرس" : "اضغط لاختيار المدرس"}</small>
                                </span>
                                <span className="sf-teacher-choice-check">{selected ? <Check className="size-4" /> : <span />}</span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="rounded-xl border border-dashed border-border bg-muted/20 p-3 text-xs leading-6 text-muted-foreground">لا توجد أسماء مدرسين مُدرجة لهذه المادة في القائمة حاليًا. يمكنك كتابة الاسم يدويًا؛ فهرس المنهج يظل المرجع للمحتوى.</p>
                      )}
                      {customTeacherProfile && (
                        <button type="button" aria-pressed="true"
                          onClick={() => setForm(current => ({
                            ...current,
                            teacherSelections: { ...current.teacherSelections, [currentSetupSubjectId]: SKIP_TEACHER },
                            customTeacherNames: { ...current.customTeacherNames, [currentSetupSubjectId]: customTeacherProfile.nameAr },
                          }))}
                          className="sf-teacher-choice sf-teacher-discovered-choice mt-3 flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-right is-selected">
                          <span className="sf-teacher-choice-copy min-w-0">
                            <b>{customTeacherProfile.nameAr}</b>
                            {customTeacherProfile.brandName !== customTeacherProfile.nameAr && <small className="sf-teacher-brand">{customTeacherProfile.brandName}</small>}
                            <small>تم العثور عليه وإضافته لاختيارات هذه المادة</small>
                          </span>
                          <span className="sf-teacher-choice-check"><Check className="size-4" /></span>
                        </button>
                      )}
                    </div>

                    <div className="sf-teacher-custom-field">
                      <label htmlFor="sf-custom-teacher-name" className="block text-sm font-semibold">مش لاقي المدرس؟ اكتب اسمه</label>
                      <Input id="sf-custom-teacher-name" name="teacherName" type="text" inputMode="text" autoComplete="off" autoCapitalize="words" enterKeyHint="search"
                        value={form.customTeacherNames[currentSetupSubjectId] ?? ""}
                        onChange={event => setForm(current => ({
                          ...resetTeacherSpecificChoices(current, currentSetupSubjectId),
                          customTeacherNames: { ...current.customTeacherNames, [currentSetupSubjectId]: event.target.value },
                          teacherSelections: { ...current.teacherSelections, [currentSetupSubjectId]: event.target.value.trim() ? SKIP_TEACHER : (current.teacherSelections[currentSetupSubjectId] ?? "") },
                        }))}
                        placeholder="اكتب الاسم المعروف بيه" maxLength={120}
                        className="sf-teacher-custom-input mt-2 h-12 rounded-xl bg-background" />
                      <Button type="button" variant="outline" className={"sf-teacher-discover-button mt-3 w-full rounded-xl " + ((form.customTeacherNames[currentSetupSubjectId] ?? "").trim().length >= 2 && !discoverTeacher.isPending ? "is-ready" : "")}
                        disabled={discoverTeacher.isPending || (form.customTeacherNames[currentSetupSubjectId] ?? "").trim().length < 2}
                        onClick={() => discoverTeacher.mutate({
                          teacherName: (form.customTeacherNames[currentSetupSubjectId] ?? "").trim(),
                          subjectId: currentSetupSubjectId,
                          systemId: form.systemId as "EG_BACCALAUREATE" | "EG_GENERAL_SECONDARY",
                          gradeYear: SIE_CATALOG_META.gradeYear,
                        })}>
                        {discoverTeacher.isPending ? <Loader2 className="ml-2 size-4 animate-spin" /> : <CircleHelp className="ml-2 size-4" />}
                        {discoverTeacher.isPending ? "بنبحث عن المدرس..." : "ابحث عنه بالذكاء الاصطناعي"}
                      </Button>
                      {customTeacherProfile && (
                        <div className="sf-teacher-discovery-result" role="status" aria-live="polite">
                          <span className="sf-teacher-discovery-icon"><Check className="size-4" /></span>
                          <div className="min-w-0 flex-1">
                            <b>{customTeacherProfile.nameAr}</b>
                            <small>{customTeacherProfile.brandName !== customTeacherProfile.nameAr ? customTeacherProfile.brandName : "قناة أو مصدر مرتبط بالمدرس"}</small>
                            <small>{customTeacherProfile.confidence === "high" ? "ثقة عالية" : customTeacherProfile.confidence === "medium" ? "ثقة متوسطة" : "مطابقة أولية تحتاج تأكيدك"}</small>
                            {customTeacherProfile.evidence[0]?.url && <a href={customTeacherProfile.evidence[0].url} target="_blank" rel="noreferrer">راجع المصدر الذي عثرنا عليه</a>}
                          </div>
                        </div>
                      )}
                    </div>

                    {selectedSetupTeacher && (
                      <section className="sf-teacher-frontier" aria-label={"آخر محتوى عام للمدرس " + selectedSetupTeacher.nameAr}>
                        <div className="sf-teacher-frontier-heading">
                          <span className="eyebrow">تقدم المدرس — من المصادر العامة</span>
                          <span className="sf-teacher-frontier-date">{selectedSetupTeacher.latestCheckpointDate || "تاريخ غير محدد"}</span>
                        </div>
                        <strong>{selectedSetupTeacher.latestPublicCheckpoint || "لم يُعثر على نقطة تقدم عامة موثوقة حتى الآن."}</strong>
                        <p>{selectedSetupTeacher.evidenceNote || "هذا ملخص محتوى عام، وليس سجلًا لما شاهدته أنت أو ترتيبًا مضمونًا للكورس المدفوع."}</p>
                        <div className="sf-teacher-frontier-links">
                          <a href={selectedSetupTeacher.profileUrl} target="_blank" rel="noreferrer">افتح قناة أو منصة المدرس <ExternalLink className="size-3" /></a>
                          {(selectedSetupTeacher.socialProfiles ?? []).map((item, index) => (
                            <a key={item.url + index} href={item.url} target="_blank" rel="noreferrer">متابعة {item.platform} <ExternalLink className="size-3" /></a>
                          ))}
                          {selectedSetupTeacher.paidCourseCatalogFrontier?.courseUrl && (
                            <a href={selectedSetupTeacher.paidCourseCatalogFrontier.courseUrl} target="_blank" rel="noreferrer">افتح فهرس الكورس <ExternalLink className="size-3" /></a>
                          )}
                        </div>
                        <small>لا نعتبر المراجعة العامة درسًا شاهدته، ولا نحدد آخر عنصر مدفوع ما لم يظهر فهرسه بوضوح.</small>
                      </section>
                    )}

                    <button type="button"
                      aria-pressed={form.teacherSelections[currentSetupSubjectId] === SKIP_TEACHER && !form.customTeacherNames[currentSetupSubjectId]?.trim()}
                      onClick={() => setForm(current => ({
                        ...resetTeacherSpecificChoices(current, currentSetupSubjectId),
                        teacherSelections: { ...current.teacherSelections, [currentSetupSubjectId]: SKIP_TEACHER },
                        customTeacherNames: { ...current.customTeacherNames, [currentSetupSubjectId]: "" },
                      }))}
                      className={"sf-teacher-skip-choice rounded-xl border px-3 py-3 text-xs font-semibold transition " + (form.teacherSelections[currentSetupSubjectId] === SKIP_TEACHER && !form.customTeacherNames[currentSetupSubjectId]?.trim() ? "is-selected border-primary bg-secondary/40 text-foreground" : "border-border text-muted-foreground hover:border-primary/30")}>
                      لم أحدد مدرسًا لهذه المادة بعد
                    </button>
                  </div>

                  <section className="sf-method-panel" aria-labelledby="sf-method-heading">
                    <div className="sf-method-heading">
                      <p className="eyebrow">اختيار واحد واضح</p>
                      <h4 id="sf-method-heading">طريقة متابعتك للمادة</h4>
                      <p>اختَر الطريقة اللي بتحضر أو بتشاهد بيها شرح المدرس.</p>
                    </div>
                    {modeResearchConfirmed && researchedModes.length === 1 ? (
                      <div className="sf-method-fixed" role="status">
                        <Check className="size-5" />
                        <div>
                          <b>{researchedModes[0] === "online" ? "أونلاين فقط" : "سنتر / حضور فقط"}</b>
                          <span>{researchedModes[0] === "online" ? "المصادر التي راجعناها تؤكد أن المتابعة أونلاين." : "المصادر التي راجعناها تؤكد أن المتابعة حضورية."}</span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="sf-method-guidance">
                          {modeResearchConfirmed
                            ? "المصادر تشير إلى أن المدرس يوفّر الطريقتين. اختَر الطريقة التي تستخدمها أنت."
                            : teacherFacts.isFetching || teacherFacts.data?.state === "researching"
                              ? "بنفحص المصادر العامة. لحد ما نتأكد، اختَر طريقة متابعتك الفعلية."
                              : "لسه ما عندناش دليل كافٍ يحدد طريقة تقديم المدرس. اختَر طريقة متابعتك أنت؛ مش هنفترض إنه بيوفر الطريقتين."}
                        </p>
                        <div className="sf-teacher-mode-grid" role="group" aria-label="طريقة متابعة المادة">
                          {(modeResearchConfirmed ? researchedModes : ["online", "center"] as Array<"online" | "center">).map(mode => {
                            const selected = form.courseModes[currentSetupSubjectId] === mode;
                            return (
                              <button key={mode} type="button" aria-pressed={selected}
                                onClick={() => setForm(current => ({ ...current, courseModes: { ...current.courseModes, [currentSetupSubjectId]: mode } }))}
                                className={"sf-teacher-mode-choice " + (selected ? "is-selected" : "")}>
                                <span className="sf-mode-choice-mark">{selected ? <Check className="size-4" /> : <span />}</span>
                                <span className="sf-teacher-mode-title">{mode === "center" ? "سنتر / حضور" : "أونلاين"}</span>
                                <span className="sf-mode-choice-note">{mode === "center" ? "محاضرات في مجموعة أو مكان" : "كورس أو محاضرات عبر الإنترنت"}</span>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                    {!form.courseModes[currentSetupSubjectId] && <p className="sf-method-required">اختَر طريقة المتابعة للانتقال للخطوة التالية.</p>}
                    {customTeacherProfile?.evidence?.length ? (
                      <details className="sf-method-evidence"><summary>مصادر البحث عن المدرس</summary>
                        <ul>{customTeacherProfile.evidence.slice(0, 4).map((source, index) => <li key={index}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>)}</ul>
                      </details>
                    ) : teacherFacts.data?.facts.evidence?.length ? (
                      <details className="sf-method-evidence"><summary>مصادر التحقق</summary>
                        <ul>{teacherFacts.data.facts.evidence.slice(0, 4).map((source, index) => <li key={index}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>)}</ul>
                      </details>
                    ) : null}
                  </section>

                                    <section className="sf-schedule-panel" aria-labelledby="sf-schedule-heading">
                    <div className="sf-schedule-header">
                      <div>
                        <p className="eyebrow">موعد الحصص الأسبوعي</p>
                        <h4 id="sf-schedule-heading">مواعيد محاضرات {currentSetupSubject.nameAr}</h4>
                        <p>أضف اليوم ووقت بداية كل محاضرة متكررة. تقدر تضيف أكتر من موعد.</p>
                      </div>
                      <span className="sf-schedule-count">{(form.teacherSchedules[currentSetupSubjectId] ?? []).length} مواعيد</span>
                    </div>
                    <button type="button" aria-pressed={Boolean(form.teacherScheduleUnfixed[currentSetupSubjectId])}
                      className={"sf-schedule-unfixed " + (form.teacherScheduleUnfixed[currentSetupSubjectId] ? "is-selected" : "")}
                      onClick={() => setForm(current => {
                        const next = !current.teacherScheduleUnfixed[currentSetupSubjectId];
                        return {
                          ...current,
                          teacherScheduleUnfixed: { ...current.teacherScheduleUnfixed, [currentSetupSubjectId]: next },
                          teacherSchedules: next ? { ...current.teacherSchedules, [currentSetupSubjectId]: [] } : current.teacherSchedules,
                        };
                      })}>
                      <span className="sf-schedule-checkbox">{form.teacherScheduleUnfixed[currentSetupSubjectId] ? <Check className="size-4" /> : null}</span>
                      <span><b>مواعيد المحاضرات غير ثابتة</b><small>اختَر ده لو المدرس بيعلن مواعيد كل محاضرة بشكل منفصل.</small></span>
                    </button>
                    {!form.teacherScheduleUnfixed[currentSetupSubjectId] && (
                      <div className="sf-schedule-slots">
                        {(form.teacherSchedules[currentSetupSubjectId] ?? []).map((slot, slotIndex) => (
                          <div key={slotIndex} className="sf-schedule-slot">
                            <div className="sf-schedule-slot-top">
                              <b>الموعد {slotIndex + 1}</b>
                              <Button type="button" size="sm" variant="ghost" className="sf-schedule-remove" aria-label={"حذف الموعد " + (slotIndex + 1)}
                                onClick={() => setForm(current => ({
                                  ...current,
                                  teacherSchedules: {
                                    ...current.teacherSchedules,
                                    [currentSetupSubjectId]: (current.teacherSchedules[currentSetupSubjectId] ?? []).filter((_, index) => index !== slotIndex),
                                  },
                                }))}>
                                <X className="size-4" /> حذف
                              </Button>
                            </div>
                            <div className="sf-schedule-day-grid" role="group" aria-label={"اختيار يوم الموعد " + (slotIndex + 1)}>
                              {WEEK_DAYS.map((day, dayIndex) => (
                                <button key={day} type="button" aria-pressed={slot.dayOfWeek === dayIndex}
                                  onClick={() => setForm(current => ({
                                    ...current,
                                    teacherSchedules: {
                                      ...current.teacherSchedules,
                                      [currentSetupSubjectId]: (current.teacherSchedules[currentSetupSubjectId] ?? []).map((item, index) => index === slotIndex ? { ...item, dayOfWeek: dayIndex } : item),
                                    },
                                  }))}>
                                  {day}
                                </button>
                              ))}
                            </div>
                            <label className="sf-schedule-time">
                              <span>وقت بداية المحاضرة</span>
                              <input type="time" inputMode="numeric" dir="ltr" step={900} value={slot.startTime}
                                onChange={event => setForm(current => ({
                                  ...current,
                                  teacherSchedules: {
                                    ...current.teacherSchedules,
                                    [currentSetupSubjectId]: (current.teacherSchedules[currentSetupSubjectId] ?? []).map((item, index) => index === slotIndex ? { ...item, startTime: event.target.value } : item),
                                  },
                                }))} />
                            </label>
                          </div>
                        ))}
                        {!form.teacherSchedules[currentSetupSubjectId]?.length && (
                          <p className="sf-schedule-empty">لسه ما أضفتش مواعيد. اضغط «إضافة موعد» وابدأ باختيار اليوم.</p>
                        )}
                        <Button type="button" variant="outline" className="sf-schedule-add w-full rounded-xl"
                          onClick={() => setForm(current => ({
                            ...current,
                            teacherSchedules: {
                              ...current.teacherSchedules,
                              [currentSetupSubjectId]: [...(current.teacherSchedules[currentSetupSubjectId] ?? []), { dayOfWeek: 0, startTime: "18:00" }],
                            },
                          }))}>
                          <span className="text-lg leading-none">+</span> إضافة موعد محاضرة
                        </Button>
                      </div>
                    )}
                    <p className="sf-schedule-footnote">المواعيد دي بتتكرر كل أسبوع. لو جدول المدرس اتغير، تقدر تعدّله من ملفك الدراسي.</p>
                  </section>

                   <section className="rounded-2xl border border-primary/20 bg-primary/[.035] p-4 sm:p-5">
                    <p className="text-sm font-bold">نظام الواجب والامتحان عند المدرس</p>
                    <p className="mt-1 text-xs leading-6 text-muted-foreground">دي 3 معلومات منفصلة. هنستخدم بيانات المدرس الموثقة أولًا، وتقدر تصححها حسب اللي بيحصل معاكم في المادة.</p>
                    {teacherFacts.data?.state === "verified" && (
                      <p className="mt-2 text-[11px] text-emerald-700">تم جلب بيانات محفوظة للمدرس؛ أي معلومة غير مؤكدة ستظل ظاهرة كغير معروفة.</p>
                    )}
                    {([
                      {
                        key: "teacherHomeworkPolicy",
                        title: "هل المدرس بيحدد واجب على المحاضرات؟",
                        description: "المقصود وجود واجب من المدرس، مش هل حله إجباري.",
                      },
                      {
                        key: "teacherHomeworkRequiredBeforeNextLecture",
                        title: "هل حل الواجب شرط قبل المحاضرة التالية؟",
                        description: "ممكن يكون فيه واجب، لكنه مش شرط لدخول المحاضرة اللي بعدها.",
                      },
                      {
                        key: "teacherPreLectureExamRequired",
                        title: "هل فيه امتحان إلزامي قبل المحاضرة التالية؟",
                        description: "امتحان يحدده المدرس ويشترط أداءه قبل الحصة القادمة.",
                      },
                    ] as const).map(field => (
                      <div key={field.key} className="mt-4 border-t border-border/60 pt-4">
                        <p className="text-xs font-bold">{field.title}</p>
                        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{field.description}</p>
                        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {([
                            ["yes", "نعم"],
                            ["no", "لا"],
                            ["varies", "حسب المحاضرة"],
                            ["unknown", "مش متأكد"],
                          ] as const).map(([value, label]) => {
                            const selected = form[field.key][currentSetupSubjectId] === value;
                            return <button key={value} type="button" aria-pressed={selected}
                              onClick={() => setForm(current => ({ ...current, [field.key]: { ...current[field.key], [currentSetupSubjectId]: value } }))}
                              className={"rounded-lg border px-2.5 py-2 text-xs font-semibold transition " + (selected ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/20" : "border-border bg-card hover:border-primary/35")}>{label}</button>;
                          })}
                        </div>
                      </div>
                    ))}
                  </section>

                </div>
              )}

            </div>

            <footer className="flex flex-col-reverse gap-3 border-t border-border/70 bg-muted/15 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <Button type="button" variant="ghost" onClick={previous} disabled={step <= (identityStepRequired ? 0 : 1) || complete.isPending} className="rounded-xl">
                <ArrowRight className="size-4" /> رجوع
              </Button>
              {step < steps.length - 1 ? (
                <Button type="button" onClick={next} disabled={!stepValid || complete.isPending} className="rounded-xl bg-primary">
                  التالي <ArrowLeft className="size-4" />
                </Button>
              ) : (
                <Button type="button" onClick={next} disabled={!stepValid || complete.isPending || !track || selectedSubjects.length === 0} className="rounded-xl bg-primary">
                  {complete.isPending ? <><Loader2 className="size-4 animate-spin" /> نحفظ اختياراتك…</> : subjectSetupIndex < selectedSubjects.length - 1
                    ? <>التالي: {selectedSubjects[subjectSetupIndex + 1]?.nameAr ?? "المادة التالية"} <ArrowLeft className="size-4" /></>
                    : <><Check className="size-4" /> {editMode ? "حفظ تعديلات الملف" : "إكمال إعداد الحساب"}</>}
                </Button>
              )}
            </footer>
          </section>
          <p className="mx-auto mt-4 flex max-w-3xl items-center justify-center gap-2 text-center text-xs leading-6 text-muted-foreground">
            <ShieldCheck className="size-4 shrink-0" />
            لا نطلب OTP أو كلمة مرور SIE. ولا نعتبر المحتوى المنشور للمدرس دليلًا على أنك شاهدته.
          </p>
        </div>
      )}
    </DashboardLayout>
  );
}

function StudentProfileOverview({
  profile,
  onEdit,
  onOpenStudy,
}: {
  profile: any;
  onEdit: () => void;
  onOpenStudy: () => void;
}) {
  const selection = (profile?.selection ?? {}) as Record<string, any>;
  const teacherChoices = (selection.teacherChoices ?? {}) as Record<string, string>;
  const courseModes = (selection.courseModes ?? {}) as Record<string, "center" | "online">;
  const customTeacherNames = (selection.customTeacherNames ?? {}) as Record<string, string>;
  const subjectIds = Array.isArray(selection.subjectIds) && selection.subjectIds.length
    ? selection.subjectIds as string[]
    : Object.keys(teacherChoices);
  const system = SIE_SYSTEMS.find(item => item.systemId === selection.systemId);
  const track = selection.trackId ? getSIETrack(selection.trackId) : undefined;
  const subjectNames = subjectIds.map(id => getSIESubject(id)?.nameAr ?? id);
  const learning = trpc.learning.get.useQuery(undefined, { staleTime: 30_000 });
  const gapBySubject = ((learning.data as any)?.gapByBranch ?? {}) as Record<string, Record<string, any>>;

  return (
    <div className="mx-auto max-w-5xl space-y-5 enter">
      <section className="relative overflow-hidden rounded-[2rem] border border-primary/20 bg-card p-6 shadow-xl sm:p-8">
        <div className="pointer-events-none absolute -left-10 -top-14 size-52 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div>
            <p className="eyebrow">ملفك الدراسي الحالي</p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">{profile?.studentName || "بيانات الطالب"}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{system?.nameAr ?? profile?.educationSystem ?? "النظام الدراسي غير محدد"} · {track?.nameAr ?? profile?.track ?? "المسار غير محدد"}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {subjectNames.map(name => <span key={name} className="rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-xs font-semibold">{name}</span>)}
            </div>
          </div>
          <Button onClick={onEdit} className="pressable rounded-xl bg-primary"><Pencil className="size-4" />تعديل بيانات الملف</Button>
        </div>
        <div className="relative mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-border/70 bg-background/70 p-4"><p className="eyebrow">المواد المحددة</p><p className="mt-2 text-2xl font-bold num">{subjectIds.length}</p></div>
          <div className="rounded-2xl border border-border/70 bg-background/70 p-4"><p className="eyebrow">المدرسون المختارون</p><p className="mt-2 text-2xl font-bold num">{Object.values(teacherChoices).filter(id => id && id !== "__SKIP__").length}</p></div>
          <div className="rounded-2xl border border-border/70 bg-background/70 p-4"><p className="eyebrow">تاريخ إنشاء الملف</p><p className="mt-2 text-sm font-semibold">{profile?.completedAt ? new Date(profile.completedAt).toLocaleDateString("ar-EG") : "محفوظ"}</p></div>
        </div>
      </section>

      <section className="app-card overflow-hidden">
        <div className="border-b border-border/70 p-5 sm:p-6">
          <p className="eyebrow">المدرسون</p>
          <h3 className="mt-1 text-lg font-bold">المدرس المختار لكل مادة</h3>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">هنا تظهر أسماء المدرسين المرتبطين بموادك فقط، من غير تفاصيل محتوى عام أو بيانات تسويقية عن الكورسات.</p>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
          {subjectIds.map(subjectId => {
            const subject = getSIESubject(subjectId);
            const teacherId = teacherChoices[subjectId];
            const teacher = teacherId && teacherId !== "__SKIP__" ? getSIETeacher(teacherId) : undefined;
            const modeLabel = courseModes[subjectId] === "center" ? "سنتر" : courseModes[subjectId] === "online" ? "أونلاين" : "طريقة الدراسة غير محددة";
            const teacherName = customTeacherNames[subjectId]?.trim() || teacher?.nameAr || "لم يتم اختيار مدرس";
            return (
              <div key={subjectId} className="flex flex-col gap-2 rounded-xl border border-border/70 bg-background/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm font-semibold">{subject?.nameAr ?? subjectId}</span>
                <span className="text-xs text-muted-foreground">{modeLabel} · {teacherName}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="app-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border/70 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <p className="eyebrow">قياس التقدم</p>
            <h3 className="mt-1 text-lg font-bold">التراكم المحسوب حسب فروع المنهج</h3>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">الفجوة تُحسب داخل كل وحدة أو فرع مستقل: تقدم المدرس أولًا، ثم تقدم الفصل في المدرسة عند عدم توفر موضع المدرس. لا نجمع الفروع المختلفة في رقم إجمالي مضلل. البيانات تعتمد على مواضع التقدم التي تسجلها، وليست قراءة تلقائية من منصات المدرسين.</p>
          </div>
          <Button onClick={onOpenStudy} className="pressable shrink-0 rounded-xl bg-primary"><BookOpen className="size-4" />إدارة التقدم</Button>
        </div>
        <div className="space-y-4 p-5 sm:p-6">
          {learning.isLoading ? (
            <p className="text-sm text-muted-foreground">جارٍ تحميل بيانات التقدم...</p>
          ) : learning.error ? (
            <p className="text-sm text-destructive">تعذر تحميل قياس التراكم. افتح صفحة المذاكرة والتقدم وأعد المحاولة.</p>
          ) : subjectIds.map(subjectId => {
            const subject = getSIESubject(subjectId);
            const branches = getSIECheckpointBranches(subjectId);
            const subjectGaps = gapBySubject[subjectId] ?? {};
            return (
              <div key={subjectId} className="rounded-xl border border-border/70 p-4">
                <h4 className="text-sm font-bold">{subject?.nameAr ?? subjectId}</h4>
                <div className="mt-3 space-y-2">
                  {branches.length ? branches.map(branch => {
                    const gap = subjectGaps[branch.branchId];
                    const options = getSIECheckpointProgressOptions(subjectId, branch.branchId);
                    const visiblePosition = (position: number | null | undefined) => position == null
                      ? null
                      : options.filter(option => {
                          const rawIndex = branch.choices.findIndex(choice => choice.nodeId === option.value);
                          return rawIndex >= 0 && rawIndex < position;
                        }).length;
                    const studentPosition = visiblePosition(gap?.studentPosition);
                    const referencePosition = visiblePosition(gap?.referencePosition);
                    const visibleGap = studentPosition === null || referencePosition === null
                      ? null : Math.max(0, referencePosition - studentPosition);
                    const visibleAhead = studentPosition === null || referencePosition === null
                      ? null : Math.max(0, studentPosition - referencePosition);
                    const pointLabel = branch.branchType === "official_section" ? "موضوع" : "درس";
                    const reference = gap?.referenceSource === "teacher" ? "المدرس"
                      : gap?.referenceSource === "school" ? "المدرسة" : "لا يوجد مرجع";
                    const result = gap?.status === "calculated"
                      ? (visibleGap! > 0 ? `متأخر بـ ${visibleGap} ${pointLabel}`
                        : visibleAhead! > 0 ? `متقدم بـ ${visibleAhead} ${pointLabel}` : "مواكب للمرجع")
                      : gap?.status === "student_position_missing"
                        ? "موضعك الدراسي غير محدد"
                        : "موضع المدرس والمدرسة غير مكتمل";
                    return (
                      <div key={branch.branchId} className="flex flex-col gap-1 rounded-lg bg-muted/30 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-sm">{branch.branchTitle}</span>
                        <span className="text-xs font-semibold text-muted-foreground">{result} · المرجع: {reference}</span>
                      </div>
                    );
                  }) : (
                    <p className="text-xs text-muted-foreground">لا توجد فروع منهج متاحة لهذه المادة بعد.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function ChoiceCard({
  selected,
  onClick,
  icon,
  title,
  subtitle,
  note,
}: {
  selected: boolean;
  onClick: () => void;
  icon: ReactNode;
  title: string;
  subtitle?: string;
  note?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={"rounded-2xl border p-5 text-right transition " + (selected
        ? "border-primary bg-secondary/35 ring-1 ring-primary/20"
        : "border-border bg-card hover:border-primary/35")}
    >
      <div className="flex items-start gap-3">
        <span className={"flex size-11 shrink-0 items-center justify-center rounded-xl " + (selected ? "bg-primary text-primary-foreground" : "bg-muted text-primary")}>
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2 font-bold">
            {title}
            {selected && <Check className="size-4 shrink-0 text-primary" />}
          </span>
          {subtitle && <span className="mt-1 block text-xs leading-6 text-muted-foreground">{subtitle}</span>}
          {note && <span className="mt-2 block text-[11px] leading-5 text-muted-foreground">{note}</span>}
        </span>
      </div>
    </button>
  );
}
