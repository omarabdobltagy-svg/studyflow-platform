import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import {
  SIE_CATALOG_META,
  SIE_SYSTEMS,
  getSIEElectiveGroups,
  getSIECheckpointChoices,
  getSIECheckpointChoicesForTeacher,
  getSIEPublicSegments,
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
};

const steps = ["بياناتك", "النظام الدراسي", "المسار", "المواد", "المدرسون", "نقطة البداية"];
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
  const complete = trpc.studentProfile.complete.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.auth.me.invalidate(), utils.studentProfile.get.invalidate()]);
      toast.success(editMode ? "تم تحديث اختيارات ملفك الدراسي." : "اكتمل إعداد حسابك الدراسي.");
      setRefreshCheckpointMode(false);
      setLocation("/");
    },
    onError: error => toast.error(error.message || "تعذر حفظ بيانات الحساب."),
  });

  const [step, setStep] = useState(0);
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

  const hasCheckpointStep = selectedSubjects.some(subject => {
    const teacherId = form.teacherSelections[subject.subjectId];
    const teacher = teacherId && teacherId !== SKIP_TEACHER ? getSIETeacher(teacherId) : undefined;
    return teacher?.studentInputRequired === true;
  });
  const requiresCheckpoint = selectedSubjects.some(subject => {
    const teacherId = form.teacherSelections[subject.subjectId];
    const teacher = teacherId && teacherId !== SKIP_TEACHER ? getSIETeacher(teacherId) : undefined;
    return teacher?.studentInputRequired === true && (refreshCheckpointMode || form.checkpointSelections[subject.subjectId] === undefined);
  });
  const activeSteps = hasCheckpointStep ? steps : steps.slice(0, 5);

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
          : true;

  const next = () => {
    if (!stepValid) {
      if (step === 0) toast.error("اكتب اسمك ورقم هاتف صحيحًا أولًا.");
      else if (step === 1) toast.error("اختر النظام الدراسي.");
      else if (step === 2) toast.error("اختر المسار أو الشعبة.");
      else if (step === 3) toast.error("اختر المادة التخصصية المطلوبة لمسارك.");
      return;
    }
    if (step === 4 && !requiresCheckpoint) {
      save();
      return;
    }
    setStep(current => Math.min(activeSteps.length - 1, current + 1));
  };

  const previous = () => setStep(current => Math.max(0, current - 1));

  const chooseSystem = (systemId: SIESystemId) => {
    setForm(current => ({
      ...current,
      systemId,
      trackId: "",
      electiveSubjectId: "",
      teacherSelections: {},
      checkpointSelections: {},
    }));
  };

  const chooseTrack = (trackId: string) => {
    setForm(current => ({
      ...current,
      trackId,
      electiveSubjectId: "",
      teacherSelections: {},
      checkpointSelections: {},
    }));
  };

  const save = () => {
    if (!track || selectedSubjects.length === 0 || !isIdentityValid) {
      toast.error("راجع بياناتك واختياراتك قبل الحفظ.");
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
      skippedTeacherSubjectIds: selectedSubjects
        .filter(subject => !teacherSelections[subject.subjectId])
        .map(subject => subject.subjectId),
      teacherFrontierReports: Object.fromEntries(Object.entries(form.checkpointSelections).filter(([subjectId]) => Boolean(teacherSelections[subjectId]))),
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
            <Progress value={((step + 1) / activeSteps.length) * 100} className="relative mt-7 h-2 bg-white/15 [&>div]:bg-violet-200" />
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

              {step === 4 && (
                <div className="space-y-5">
                  <div className="flex items-start gap-3 rounded-2xl border border-primary/15 bg-secondary/25 p-4">
                    <CircleHelp className="mt-0.5 size-5 shrink-0 text-primary" />
                    <p className="text-sm leading-7 text-muted-foreground">
                      تظهر الترشيحات التي يوجد لها دليل في الحزمة للنظام والصف والسنة والمادة المختارة فقط. هذه ترشيحات أولية وليست ترتيبًا لجودة المدرسين أو ادعاءً بأنها أشهر ثلاثة على مستوى مصر. يمكنك تأجيل اختيار أي مدرس.
                    </p>
                  </div>

                  {selectedSubjects.length === 0 ? (
                    <p className="text-sm text-muted-foreground">اختر موادك أولًا.</p>
                  ) : selectedSubjects.map(subject => {
                    const candidates = form.systemId
                      ? getSIETeachersForSubject(subject.subjectId, form.systemId)
                      : [];
                    const selectedTeacher = form.teacherSelections[subject.subjectId] || "";
                    return (
                      <section key={subject.subjectId} className="rounded-2xl border border-border p-4 sm:p-5">
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-bold">مدرس {subject.nameAr}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {candidates.length ? "اختَر اسم المدرس" : "لا توجد أسماء متاحة لهذه المادة حاليًا"}
                            </p>
                          </div>
                          {selectedTeacher && <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                            {selectedTeacher === SKIP_TEACHER ? "مؤجل" : "تم الاختيار"}
                          </span>}
                        </div>

                        {candidates.length ? (
                          <div className="grid gap-3 md:grid-cols-2">
                            {candidates.map(teacher => {
                              return (
                                <button
                                  key={teacher.teacherId}
                                  type="button"
                                  onClick={() => setForm(current => ({
                                    ...current,
                                    teacherSelections: { ...current.teacherSelections, [subject.subjectId]: teacher.teacherId },
                                    checkpointSelections: (() => {
                                      const next = { ...current.checkpointSelections };
                                      delete next[subject.subjectId];
                                      return next;
                                    })(),
                                  }))}
                                  aria-pressed={selectedTeacher === teacher.teacherId}
                                  className={"teacher-choice-card flex min-h-[76px] w-full items-center justify-between gap-3 rounded-2xl border px-5 py-4 text-right transition " + (selectedTeacher === teacher.teacherId
                                    ? "border-primary bg-secondary/55 ring-1 ring-primary/20"
                                    : "border-border bg-card hover:border-primary/40")}
                                >
                                  <span className="text-base font-bold">{teacher.nameAr}</span>
                                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/75">
                                    {selectedTeacher === teacher.teacherId ? <Check className="size-4 text-primary" /> : <span className="size-1.5 rounded-full bg-muted-foreground/35" />}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-sm leading-7 text-muted-foreground">
                            لا نعرض أسماء غير متحقق منها. بيانات المدرسين لهذا النظام/المادة لم تكتمل بعد، ويمكن إكمال الإعداد دون اختيار مدرس.
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => setForm(current => ({
                            ...current,
                            teacherSelections: { ...current.teacherSelections, [subject.subjectId]: SKIP_TEACHER },
                          }))}
                          aria-pressed={selectedTeacher === SKIP_TEACHER}
                          className={"mt-3 rounded-xl border px-3 py-2 text-xs font-semibold transition " + (selectedTeacher === SKIP_TEACHER
                            ? "border-primary bg-secondary text-primary"
                            : "border-border text-muted-foreground hover:border-primary/30")}
                        >
                          لا أختار مدرسًا الآن
                        </button>
                      </section>
                    );
                  })}
                </div>
              )}
              {step === 4 && editMode && hasCheckpointStep && (
                <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">موضعك الحالي محفوظ</p>
                    <p className="mt-1 text-xs leading-6 text-muted-foreground">يمكنك تحديث آخر موضوع أنجزته مع المدرس دون إعادة إعداد المواد.</p>
                  </div>
                  <Button type="button" variant="outline" className="rounded-xl" onClick={() => { setRefreshCheckpointMode(true); setStep(5); }}>
                    تحديث موضعك الدراسي
                  </Button>
                </div>
              )}
              {step === 5 && (
                <div className="space-y-5">
                  <div className="flex items-start gap-3 rounded-2xl border border-primary/15 bg-secondary/25 p-4">
                    <CircleHelp className="mt-0.5 size-5 shrink-0 text-primary" />
                    <p className="text-sm leading-7 text-muted-foreground">
                      دي خطوة اختيارية بتظهر فقط لما نحتاج نحدد نقطة بدايتك. مش مطلوب رقم محاضرة ولا كتابة حرة. لو عندنا مقاطع عامة موثقة هنعرضها أولًا، وإلا هنبدأ من 3–5 موضوعات من فهرس المنهج. اختيارك تقرير منك فقط، ومش بيتسجل كإنجاز دراسي.
                    </p>
                  </div>
                  {selectedSubjects.filter(subject => {
                    const teacherId = form.teacherSelections[subject.subjectId];
                    const teacher = teacherId && teacherId !== SKIP_TEACHER ? getSIETeacher(teacherId) : undefined;
                    return teacher?.studentInputRequired === true && (refreshCheckpointMode || form.checkpointSelections[subject.subjectId] === undefined);
                  }).length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-5 text-sm leading-7 text-muted-foreground">
                      لا توجد مادة تحتاج تحديد نقطة بداية الآن. تقدر تكمل إعداد حسابك.
                    </div>
                  ) : selectedSubjects.filter(subject => {
                    const teacherId = form.teacherSelections[subject.subjectId];
                    const teacher = teacherId && teacherId !== SKIP_TEACHER ? getSIETeacher(teacherId) : undefined;
                    return teacher?.studentInputRequired === true && (refreshCheckpointMode || form.checkpointSelections[subject.subjectId] === undefined);
                  }).map(subject => {
                    const teacherId = form.teacherSelections[subject.subjectId] ?? "";
                    const teacher = getSIETeacher(teacherId);
                    const allChoices = getSIECheckpointChoices(subject.subjectId);
                    const initialChoices = getSIECheckpointChoicesForTeacher(teacherId);
                    const extraCount = expandedCheckpointChoices[subject.subjectId] ?? 0;
                    const visibleChoices = [
                      ...initialChoices,
                      ...allChoices.filter(choice => !initialChoices.some(initial => initial.nodeId === choice.nodeId)).slice(0, extraCount),
                    ];
                    const hasMoreChoices = visibleChoices.length < allChoices.length;
                    const publicSegments = getSIEPublicSegments(teacherId);
                    const selected = form.checkpointSelections[subject.subjectId] ?? "";
                    return (
                      <section key={subject.subjectId} className="rounded-2xl border border-border p-4 sm:p-5">
                        <div className="mb-4">
                          <p className="font-bold">{subject.nameAr} · {teacher?.nameAr ?? "المدرس المختار"}</p>
                          <p className="mt-1 text-xs leading-6 text-muted-foreground">
                            إيه آخر موضوع خلصته فعلًا مع المدرس ده؟ اختر أقرب عنوان تعرفه. مش هنفترض إن آخر فيديو منشور هو آخر حاجة درستها.
                          </p>
                        </div>
                        {teacher?.conflictOptions && teacher.conflictOptions.length > 0 && (
                          <div className="mb-4 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
                            <p className="text-xs font-semibold">فيه تعارض في مصادر الكورس؛ مش هنختار رقم نيابة عنك.</p>
                            {teacher.conflictOptions.map(option => (
                              <p key={option.sourceLabel} className="mt-2 text-xs leading-6 text-muted-foreground">
                                {option.label} · {option.sourceLabel} · {option.sourceDate}
                              </p>
                            ))}
                            <p className="mt-2 text-xs text-muted-foreground">لو مش متأكد، اختار «مش متأكد» أو «تخطي دلوقتي».</p>
                          </div>
                        )}
                        {(teacher?.latestPublicCheckpoint || teacher?.paidCourseCatalogFrontier) && (
                          <div className="mb-4 grid gap-3 md:grid-cols-2">
                            <div className="rounded-2xl border border-border/70 bg-card/70 p-4">
                              <p className="text-xs font-semibold text-muted-foreground">آخر محتوى عام مثبت للمدرس</p>
                              <p className="mt-2 text-sm leading-6">{teacher?.latestPublicCheckpoint || "لا توجد نقطة محتوى عامة محددة في المصادر الحالية."}</p>
                              <p className="mt-2 text-[11px] text-muted-foreground">هذا يثبت ما نُشر علنًا فقط، وليس ترتيب الكورس المدفوع.</p>
                            </div>
                            <div className="rounded-2xl border border-border/70 bg-card/70 p-4">
                              <p className="text-xs font-semibold text-muted-foreground">فهرس الكورس المدفوع</p>
                              <p className="mt-2 text-sm leading-6">{teacher?.paidCourseCatalogFrontier?.courseTitle || "لا يوجد فهرس مدفوع موثق."}</p>
                              <p className="mt-2 text-[11px] text-muted-foreground">{teacher?.paidCourseCatalogFrontier?.note || "لن نخمن آخر عنصر مدفوع من فيديو عام أو اسم الباقة."}</p>
                            </div>
                          </div>
                        )}
                        {publicSegments.length > 0 && (
                          <div className="mb-4 rounded-xl bg-muted/25 p-3">
                            <p className="text-xs font-semibold">مقاطع عامة تم التحقق منها — ليست ترتيبًا للكورس المدفوع</p>
                            {publicSegments.slice(0, 5).map((segment, index) => (
                              <p key={segment.title + index} className="mt-1 text-xs leading-6 text-muted-foreground">
                                {(segment.timestamp ? segment.timestamp + " · " : "") + segment.title}
                              </p>
                            ))}
                            {publicSegments.length > 5 && (
                              <p className="mt-1 text-[11px] text-muted-foreground">وتوجد مقاطع إضافية في المصدر.</p>
                            )}
                          </div>
                        )}
                        {visibleChoices.length > 0 ? (
                          <div className="grid gap-2 sm:grid-cols-2">
                            {visibleChoices.map(choice => (
                              <ChoiceCard
                                key={choice.nodeId}
                                selected={selected === choice.nodeId}
                                onClick={() => setForm(current => ({
                                  ...current,
                                  checkpointSelections: { ...current.checkpointSelections, [subject.subjectId]: choice.nodeId },
                                }))}
                                icon={<BookOpen className="size-5" />}
                                title={choice.title}
                                subtitle={choice.unitTitle}
                                note={choice.note}
                              />
                            ))}
                          </div>
                        ) : (
                          <p className="rounded-xl bg-muted/25 p-3 text-xs leading-6 text-muted-foreground">
                            فهرس المادة غير متاح في الحزمة الحالية. يمكنك تخطي تحديد نقطة البداية؛ لن نخمن موضعك.
                          </p>
                        )}
                        {hasMoreChoices && (
                          <button
                            type="button"
                            onClick={() => setExpandedCheckpointChoices(current => ({
                              ...current,
                              [subject.subjectId]: (current[subject.subjectId] ?? 0) + 5,
                            }))}
                            className="mt-3 rounded-xl border border-dashed border-primary/40 px-3 py-2 text-xs font-semibold text-primary hover:bg-secondary/30"
                          >
                            موضوع تاني / اعرض اختيارات إضافية
                          </button>
                        )}
                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                          <button type="button" aria-pressed={selected === CHECKPOINT_NOT_STARTED}
                            onClick={() => setForm(current => ({ ...current, checkpointSelections: { ...current.checkpointSelections, [subject.subjectId]: CHECKPOINT_NOT_STARTED } }))}
                            className={"rounded-xl border px-3 py-3 text-sm font-semibold transition " + (selected === CHECKPOINT_NOT_STARTED ? "border-primary bg-secondary text-primary" : "border-border text-muted-foreground hover:border-primary/30")}>
                            لسه ما بدأتش مع المدرس ده
                          </button>
                          <button type="button" aria-pressed={selected === CHECKPOINT_UNKNOWN}
                            onClick={() => setForm(current => ({ ...current, checkpointSelections: { ...current.checkpointSelections, [subject.subjectId]: CHECKPOINT_UNKNOWN } }))}
                            className={"rounded-xl border px-3 py-3 text-sm font-semibold transition " + (selected === CHECKPOINT_UNKNOWN ? "border-primary bg-secondary text-primary" : "border-border text-muted-foreground hover:border-primary/30")}>
                            مش متأكد
                          </button>
                          <button type="button" aria-pressed={selected === CHECKPOINT_DEFERRED}
                            onClick={() => setForm(current => ({ ...current, checkpointSelections: { ...current.checkpointSelections, [subject.subjectId]: CHECKPOINT_DEFERRED } }))}
                            className={"rounded-xl border px-3 py-3 text-sm font-semibold transition " + (selected === CHECKPOINT_DEFERRED ? "border-primary bg-secondary text-primary" : "border-border text-muted-foreground hover:border-primary/30")}>
                            تخطي دلوقتي
                          </button>
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}

            </div>

            <footer className="flex flex-col-reverse gap-3 border-t border-border/70 bg-muted/15 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <Button type="button" variant="ghost" onClick={previous} disabled={step === 0 || complete.isPending} className="rounded-xl">
                <ArrowRight className="size-4" /> رجوع
              </Button>
              {step < activeSteps.length - 1 ? (
                <Button type="button" onClick={next} disabled={!stepValid || complete.isPending} className="rounded-xl bg-primary">
                  {step === 4 && !requiresCheckpoint ? "إكمال الإعداد" : "التالي"} <ArrowLeft className="size-4" />
                </Button>
              ) : (
                <Button type="button" onClick={save} disabled={complete.isPending || !track || selectedSubjects.length === 0} className="rounded-xl bg-primary">
                  {complete.isPending ? <><Loader2 className="size-4 animate-spin" /> نحفظ اختياراتك…</> : <><Check className="size-4" /> إكمال إعداد الحساب</>}
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
