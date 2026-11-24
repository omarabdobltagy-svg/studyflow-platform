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
  getSIECheckpointChoices,
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
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useLocation, type RouteComponentProps } from "wouter";
import { toast } from "sonner";

type TeacherChoiceMap = Record<string, string>;
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
};

const steps = ["بياناتك", "النظام الدراسي", "المسار", "المواد", "طريقة الدراسة لكل مادة"];
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

  const [step, setStep] = useState(0);
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
  });

  useEffect(() => {
    const saved = (profile.data as any)?.selection ?? null;
    setForm(current => ({
      ...current,
      studentName: current.studentName || (profile.data as any)?.studentName || "",
      phone: current.phone || auth.data?.phone || "",
      systemId: current.systemId || saved?.systemId || "",
      trackId: current.trackId || saved?.trackId || "",
      electiveSubjectId: current.electiveSubjectId || saved?.electiveSubjectId || "",
      teacherSelections: Object.keys(current.teacherSelections).length
        ? current.teacherSelections
        : (saved?.teacherChoices ?? {}),
      checkpointSelections: Object.keys(current.checkpointSelections).length
        ? current.checkpointSelections
        : (saved?.teacherFrontiers ?? {}),
      courseModes: Object.keys(current.courseModes).length ? current.courseModes : (saved?.courseModes ?? {}),
      customTeacherNames: Object.keys(current.customTeacherNames).length ? current.customTeacherNames : (saved?.customTeacherNames ?? {}),
    }));
  }, [auth.data, profile.data]);

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

  const activeSteps = steps;
  const currentSetupSubject = selectedSubjects[subjectSetupIndex] ?? selectedSubjects[0];
  const currentSetupSubjectId = currentSetupSubject?.subjectId ?? "";
  const setupTeacherOptions = currentSetupSubjectId && form.systemId ? getSIETeachersForSubject(currentSetupSubjectId, form.systemId) : [];

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
          ? Boolean(track && (track.fixedSubjectIds || (firstElectiveGroup.length > 0 && firstElectiveGroup.some(item => item.subjectId === form.electiveSubjectId))))
          : Boolean(currentSetupSubject && form.courseModes[currentSetupSubject.subjectId]);

  const next = () => {
    if (!stepValid) {
      if (step === 0) toast.error("اكتب اسمك ورقم هاتف صحيحًا أولًا.");
      else if (step === 1) toast.error("اختر النظام الدراسي.");
      else if (step === 2) toast.error("اختر المسار أو الشعبة.");
      else if (step === 3) toast.error("اختر المادة التخصصية المطلوبة لمسارك.");
      return;
    }
    if (step === 4) {
      if (subjectSetupIndex < selectedSubjects.length - 1) setSubjectSetupIndex(index => index + 1);
      else save();
      return;
    }
    setStep(current => Math.min(activeSteps.length - 1, current + 1));
  };

  const previous = () => {
    if (step === 4 && subjectSetupIndex > 0) { setSubjectSetupIndex(index => Math.max(0, index - 1)); return; }
    setStep(current => Math.max(0, current - 1));
  };

  const chooseSystem = (systemId: SIESystemId) => {
    setSubjectSetupIndex(0);
    setForm(current => ({
      ...current, systemId, trackId: "", electiveSubjectId: "", teacherSelections: {}, checkpointSelections: {}, courseModes: {}, customTeacherNames: {},
    }));
  };

  const chooseTrack = (trackId: string) => {
    setSubjectSetupIndex(0);
    setForm(current => ({
      ...current, trackId, electiveSubjectId: "", teacherSelections: {}, checkpointSelections: {}, courseModes: {}, customTeacherNames: {},
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
      teacherFrontierReports: {},
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
        <div className="mx-auto max-w-4xl">
          <section className="relative overflow-hidden rounded-[2rem] bg-primary p-6 text-primary-foreground shadow-xl sm:p-9">
            <div className="pointer-events-none absolute -left-10 -top-16 size-56 rounded-full bg-white/10 blur-3xl" />
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow text-primary-foreground/65">STUDENT SETUP · {SIE_CATALOG_META.academicYear}</p>
                <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{editMode ? "اختياراتك الدراسية." : "خلّينا نضبط مسارك."}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-primary-foreground/75">
                  الاسم ورقم الهاتف فقط كمدخلات. باقي الإعداد يتم بالاختيار من النظام والمسار والمواد والمدرسين المتاحين في قاعدة البيانات.
                </p>
              </div>
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                <GraduationCap className="size-6" />
              </span>
            </div>
            <div className="relative mt-7 flex items-center justify-between gap-3 text-xs text-primary-foreground/75">
              <span>{editMode ? "تعديل ملفك الدراسي" : "إعداد حسابك الدراسي"}</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 font-bold tabular-nums">الخطوة {step + 1} من {activeSteps.length}</span>
            </div>
            <Progress value={((step + 1) / activeSteps.length) * 100} className="relative mt-3 h-2 bg-white/15 [&>div]:bg-amber-300" />
            <div className="relative mt-3 flex justify-between gap-2 text-[10px] text-primary-foreground/60 sm:text-xs">
              {activeSteps.map((label, index) => (
                <span key={label} className={index <= step ? "font-bold text-white" : ""}>{label}</span>
              ))}
            </div>
          </section>

          <section className="app-card mt-5 overflow-hidden">
            <header className="border-b border-border/70 bg-muted/20 px-5 py-5 sm:px-7">
              <p className="eyebrow">الخطوة {step + 1} من {activeSteps.length}</p>
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
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
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
                        <p className="mb-3 text-sm font-semibold">المواد الأساسية المضافة تلقائيًا</p>
                        <div className="grid gap-3 sm:grid-cols-3">
                          {track.requiredSubjectIds.map(id => {
                            const subject = getSIESubject(id);
                            if (!subject) return null;
                            return <div key={id} className="rounded-2xl border border-primary/20 bg-secondary/35 p-4">
                              <Check className="mb-2 size-4 text-primary" />
                              <p className="font-semibold">{subject.nameAr}</p>
                              <p className="mt-1 text-xs text-muted-foreground">مادة أساسية</p>
                            </div>;
                          })}
                        </div>
                      </div>
                      {firstElectiveGroup.length > 0 && (
                        <div>
                          <p className="mb-3 text-sm font-semibold">اختر مادة تخصصية واحدة</p>
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
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">المادة {subjectSetupIndex + 1} من {selectedSubjects.length}. هنحفظ طريقة دراستك والمدرس، وبعدها ننتقل للمادة التالية.</p>
                    </div>
                    <span className="rounded-full border border-border bg-background px-3 py-2 text-xs font-semibold">{subjectSetupIndex + 1} / {selectedSubjects.length}</span>
                  </div>
                  <div>
                    <p className="mb-3 text-sm font-bold">بتدرس {currentSetupSubject.nameAr} إزاي؟</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button type="button" aria-pressed={form.courseModes[currentSetupSubjectId] === "center"}
                        onClick={() => setForm(current => ({ ...current, courseModes: { ...current.courseModes, [currentSetupSubjectId]: "center" }, teacherSelections: { ...current.teacherSelections, [currentSetupSubjectId]: SKIP_TEACHER }, customTeacherNames: { ...current.customTeacherNames, [currentSetupSubjectId]: "" } }))}
                        className={"rounded-2xl border p-5 text-right transition " + (form.courseModes[currentSetupSubjectId] === "center" ? "border-primary bg-secondary/45 ring-1 ring-primary/20" : "border-border bg-card hover:border-primary/40")}>
                        <span className="block text-lg font-bold">سنتر / مجموعة</span><span className="mt-1 block text-xs leading-6 text-muted-foreground">بتحضر شرح المادة مع مدرس في مكان أو مجموعة.</span>
                      </button>
                      <button type="button" aria-pressed={form.courseModes[currentSetupSubjectId] === "online"}
                        onClick={() => setForm(current => ({ ...current, courseModes: { ...current.courseModes, [currentSetupSubjectId]: "online" }, teacherSelections: { ...current.teacherSelections, [currentSetupSubjectId]: "" }, customTeacherNames: { ...current.customTeacherNames, [currentSetupSubjectId]: "" } }))}
                        className={"rounded-2xl border p-5 text-right transition " + (form.courseModes[currentSetupSubjectId] === "online" ? "border-primary bg-secondary/45 ring-1 ring-primary/20" : "border-border bg-card hover:border-primary/40")}>
                        <span className="block text-lg font-bold">أونلاين</span><span className="mt-1 block text-xs leading-6 text-muted-foreground">بتتابع الشرح من منصة أو فيديوهات على الإنترنت.</span>
                      </button>
                    </div>
                  </div>
                  {form.courseModes[currentSetupSubjectId] === "center" && (
                    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                      <p className="font-bold">اسم مدرس السنتر (اختياري)</p><p className="mt-1 text-xs leading-6 text-muted-foreground">اكتب اسم المدرس الذي تحضر معه. بيانات السنتر والفصل ستظهر لاحقًا لهذه المادة فقط.</p>
                      <Input value={form.customTeacherNames[currentSetupSubjectId] ?? ""} onChange={event => setForm(current => ({ ...current, customTeacherNames: { ...current.customTeacherNames, [currentSetupSubjectId]: event.target.value } }))} placeholder="اسم مدرس السنتر" maxLength={120} className="mt-3 h-12 rounded-xl bg-background" />
                    </div>
                  )}
                  {form.courseModes[currentSetupSubjectId] === "online" && (
                    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                      <div className="mb-4"><p className="font-bold">مين المدرس اللي بتتابعه أونلاين؟</p><p className="mt-1 text-xs leading-6 text-muted-foreground">اختار من الأسماء المتاحة، أو اكتب اسم مدرسك لو مش موجود في القائمة.</p></div>
                      {setupTeacherOptions.length ? (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {setupTeacherOptions.map(teacher => {
                            const selected = form.teacherSelections[currentSetupSubjectId] === teacher.teacherId;
                            return <button key={teacher.teacherId} type="button" aria-pressed={selected} onClick={() => setForm(current => ({ ...current, teacherSelections: { ...current.teacherSelections, [currentSetupSubjectId]: teacher.teacherId }, customTeacherNames: { ...current.customTeacherNames, [currentSetupSubjectId]: "" } }))} className={"flex items-center justify-between gap-3 rounded-xl border p-4 text-right transition " + (selected ? "border-primary bg-secondary/45 ring-1 ring-primary/20" : "border-border hover:border-primary/35")}>
                              <span className="font-semibold">{teacher.nameAr}</span>{selected && <Check className="size-4 shrink-0 text-primary" />}
                            </button>;
                          })}
                        </div>
                      ) : <p className="rounded-xl border border-dashed border-border bg-muted/20 p-3 text-xs leading-6 text-muted-foreground">لا توجد أسماء موثقة لهذه المادة في القائمة حاليًا. اكتب اسم المدرس يدويًا أو اتركه فارغًا.</p>}
                      <label className="mt-4 block text-sm font-semibold">مدرس آخر (اختياري)
                        <Input value={form.customTeacherNames[currentSetupSubjectId] ?? ""} onChange={event => setForm(current => ({ ...current, customTeacherNames: { ...current.customTeacherNames, [currentSetupSubjectId]: event.target.value }, teacherSelections: { ...current.teacherSelections, [currentSetupSubjectId]: event.target.value.trim() ? SKIP_TEACHER : current.teacherSelections[currentSetupSubjectId] ?? "" } }))} placeholder="اكتب اسم المدرس لو مش موجود فوق" maxLength={120} className="mt-2 h-12 rounded-xl bg-background" />
                      </label>
                      <button type="button" onClick={() => setForm(current => ({ ...current, teacherSelections: { ...current.teacherSelections, [currentSetupSubjectId]: SKIP_TEACHER }, customTeacherNames: { ...current.customTeacherNames, [currentSetupSubjectId]: "" } }))} className="mt-3 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:border-primary/30">لم أحدد مدرسًا للمادة دي</button>
                    </div>
                  )}
                  {!form.courseModes[currentSetupSubjectId] && <p className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-sm text-muted-foreground">اختار «سنتر» أو «أونلاين» عشان نعرف نعرض لك الأسئلة المناسبة بعد كده.</p>}
                </div>
              )}

            </div>

            <footer className="flex flex-col-reverse gap-3 border-t border-border/70 bg-muted/15 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <Button type="button" variant="ghost" onClick={previous} disabled={step === 0 || complete.isPending} className="rounded-xl">
                <ArrowRight className="size-4" /> رجوع
              </Button>
              {step < activeSteps.length - 1 ? (
                <Button type="button" onClick={next} disabled={!stepValid || complete.isPending} className="rounded-xl bg-primary">
                  {step === 4 ? (subjectSetupIndex < selectedSubjects.length - 1 ? `التالي: ${selectedSubjects[subjectSetupIndex + 1]?.nameAr ?? "المادة التالية"}` : "حفظ اختيارات المواد") : "التالي"} <ArrowLeft className="size-4" />
                </Button>
              ) : (
                <Button type="button" onClick={save} disabled={complete.isPending || !track || selectedSubjects.length === 0} className="rounded-xl bg-primary">
                  {complete.isPending ? <><Loader2 className="size-4 animate-spin" /> نحفظ اختياراتك…</> : <><Check className="size-4" /> {editMode ? "حفظ تعديلات الملف" : "إكمال إعداد الحساب"}</>}
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
                    const reference = gap?.referenceSource === "teacher" ? "المدرس"
                      : gap?.referenceSource === "school" ? "المدرسة" : "لا يوجد مرجع";
                    const result = gap?.status === "calculated"
                      ? (gap.gapCount > 0 ? `متأخر بـ ${gap.gapCount} درس`
                        : gap.aheadCount > 0 ? `متقدم بـ ${gap.aheadCount} درس` : "مواكب للمرجع")
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
