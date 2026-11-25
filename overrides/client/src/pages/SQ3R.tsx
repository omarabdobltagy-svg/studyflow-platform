import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { getSIEStudentVisibleBranches, getSIESubject } from "@shared/sie-catalog";
import { BookOpenText, Check, CircleHelp, Eye, Mic2, RefreshCcw, Search, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const steps = [
  { id: "survey", title: "المسح", hint: "تصفّح عنوان الدرس وعناوينه الفرعية وأفكاره الرئيسية قبل القراءة.", icon: Eye },
  { id: "question", title: "التساؤل", hint: "حوّل العناوين إلى أسئلة واضحة تريد الوصول إلى إجاباتها.", icon: CircleHelp },
  { id: "read", title: "القراءة والفهم", hint: "اقرأ بتركيز، وابحث عن إجابات أسئلتك داخل المحتوى.", icon: BookOpenText },
  { id: "recite", title: "التسميع", hint: "استرجع الأفكار من ذاكرتك دون النظر إلى المصدر.", icon: Mic2 },
  { id: "review", title: "المراجعة", hint: "راجع إجاباتك وثبّت النقاط التي تحتاج إلى تكرار لاحق.", icon: RefreshCcw },
] as const;

type StepId = typeof steps[number]["id"];
type LessonProgress = {
  completedSteps?: StepId[];
  difficulty?: "unknown" | "easy" | "medium" | "hard";
  notes?: string;
  updatedAt?: string;
};
type ChoiceOption = { value: string; label: string; description?: string };

function normalizeSearch(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي")
    .replace(/ـ/g, "").replace(/\s+/g, " ").trim();
}

function SearchableChoices({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ChoiceOption[];
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = normalizeSearch(query);
  const visibleOptions = normalizedQuery
    ? options.filter(option => normalizeSearch(option.label + " " + (option.description || "")).includes(normalizedQuery))
    : options;
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={event => setQuery(event.target.value)}
          placeholder={"ابحث في " + label + "..."} aria-label={"البحث في " + label}
          className="h-11 rounded-xl pr-9 pl-9" />
        {query && <button type="button" aria-label="مسح البحث" onClick={() => setQuery("")}
          className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted">
          <X className="size-3.5" />
        </button>}
      </div>
      <div className="grid max-h-[430px] gap-2 overflow-y-auto overscroll-contain pr-1 sm:grid-cols-2">
        {visibleOptions.map(option => {
          const selected = value === option.value;
          return <button key={option.value} type="button" aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={"flex min-h-14 min-w-0 items-center justify-between gap-3 rounded-xl border p-3 text-right transition " +
              (selected ? "border-primary bg-primary/10 ring-2 ring-primary/10" : "border-border bg-background hover:border-primary/35")}>
            <span className="min-w-0">
              <span className="block break-words text-sm font-semibold leading-6">{option.label}</span>
              {option.description && <span className="mt-1 block text-[10px] leading-5 text-muted-foreground">{option.description}</span>}
            </span>
            {selected && <Check className="size-4 shrink-0 text-primary" />}
          </button>;
        })}
      </div>
      {!visibleOptions.length && <p className="rounded-xl bg-muted/30 p-4 text-center text-xs text-muted-foreground">لا توجد نتيجة مطابقة.</p>}
    </div>
  );
}

export default function SQ3R() {
  const utils = trpc.useUtils();
  const profile = trpc.studentProfile.get.useQuery();
  const selection = (profile.data?.selection || {}) as Record<string, any>;
  const subjects = profile.data?.subjectIds || [];
  // New records live in their own namespace; fall back to the old key for existing accounts.
  const sq3rMap = (selection.sq3rProgress ?? selection.subjectLessonProgress ?? {}) as Record<string, Record<string, LessonProgress>>;
  const initialParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const [subjectId, setSubjectId] = useState(initialParams?.get("subject") || "");
  const [branchId, setBranchId] = useState(initialParams?.get("branch") || "");
  const [lessonId, setLessonId] = useState(initialParams?.get("lesson") || "");
  const [subjectSearch, setSubjectSearch] = useState("");
  const [completedSteps, setCompletedSteps] = useState<StepId[]>([]);
  const [difficulty, setDifficulty] = useState<"unknown" | "easy" | "medium" | "hard">("unknown");
  const [notes, setNotes] = useState("");

  const branches = useMemo(() => getSIEStudentVisibleBranches(subjectId), [subjectId]);
  const currentBranch = branches.find(branch => branch.branchId === branchId) ?? branches[0];
  const branchChoices = currentBranch?.choices ?? [];
  const currentBranchId = currentBranch?.branchId ?? "";
  const subjectRecords = sq3rMap[subjectId] || {};
  const currentProgress = subjectRecords[lessonId];
  const selectedLesson = branchChoices.find(item => item.nodeId === lessonId);
  const subjectName = getSIESubject(subjectId)?.nameAr || subjectId;
  const visibleSubjects = subjects.filter(id =>
    normalizeSearch(getSIESubject(id)?.nameAr || id).includes(normalizeSearch(subjectSearch))
  );
  const lessonOptions = branchChoices.map((lesson, index) => ({
    value: lesson.nodeId,
    label: lesson.title,
    description: lesson.lessonNumber
      ? (lesson.unitTitle ? lesson.unitTitle + " · " : "") + "الدرس " + lesson.lessonNumber
      : lesson.unitTitle || "درس " + (index + 1),
  }));

  useEffect(() => {
    if (!subjectId && subjects.length) setSubjectId(subjects[0]);
  }, [subjectId, subjects]);

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
    if (!branchChoices.some(lesson => lesson.nodeId === lessonId)) setLessonId("");
  }, [subjectId, currentBranchId, branchChoices, lessonId]);

  useEffect(() => {
    setCompletedSteps(currentProgress?.completedSteps || []);
    setDifficulty(currentProgress?.difficulty || "unknown");
    setNotes(currentProgress?.notes || "");
  }, [subjectId, lessonId, currentProgress?.updatedAt]);

  const saveSQ3R = trpc.study.saveSubjectLessonProgress.useMutation({
    onSuccess: async () => {
      await utils.studentProfile.get.invalidate();
      toast.success("تم حفظ تقدم جلسة SQ3R.");
    },
    onError: error => toast.error(error.message || "تعذّر حفظ جلسة SQ3R."),
  });

  const updateProgress = (nextSteps: StepId[], nextDifficulty = difficulty, nextNotes = notes) => {
    if (!subjectId || !lessonId) return;
    setCompletedSteps(nextSteps);
    setDifficulty(nextDifficulty);
    setNotes(nextNotes);
    saveSQ3R.mutate({
      subjectId, lessonId, completedSteps: nextSteps,
      difficulty: nextDifficulty, notes: nextNotes,
    });
  };

  const completion = Math.round((completedSteps.length / steps.length) * 100);

  return (
    <DashboardLayout title="جلسة SQ3R" description="طريقة مستقلة لفهم الدرس واسترجاعه ومراجعته. لا تغيّر تقدمك في المنهج.">
      <section className="app-card mb-5 overflow-hidden rounded-2xl">
        <header className="border-b border-border/70 bg-gradient-to-l from-secondary/60 to-card p-5 sm:p-6">
          <p className="text-[10px] font-bold tracking-[0.12em] text-primary">اختيار المادة</p>
          <h2 className="mt-1 text-xl font-bold">المادة الدراسية</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">حدد المادة والفرع والدرس الذي ستطبّق عليه خطوات SQ3R.</p>
        </header>
        <div className="space-y-4 p-5 sm:p-6">
          <div className="space-y-2">
            <p className="text-sm font-bold">المادة</p>
            <div className="relative">
              <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={subjectSearch} onChange={event => setSubjectSearch(event.target.value)}
                placeholder="ابحث عن مادة..." className="h-11 rounded-xl pr-9" />
              {subjectSearch && <button type="button" aria-label="مسح البحث" onClick={() => setSubjectSearch("")}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted"><X className="size-3.5" /></button>}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {visibleSubjects.map(id => {
                const active = id === subjectId;
                return <button key={id} type="button" aria-pressed={active}
                  onClick={() => { setSubjectId(id); setBranchId(""); setLessonId(""); }}
                  className={"min-h-12 rounded-xl border px-3 py-3 text-sm font-semibold transition " +
                    (active ? "border-primary bg-primary/10 ring-2 ring-primary/10" : "border-border bg-background hover:border-primary/35")}>
                  {getSIESubject(id)?.nameAr || id}
                </button>;
              })}
            </div>
            {!visibleSubjects.length && <p className="text-xs text-muted-foreground">لا توجد مادة مطابقة.</p>}
          </div>
          {branches.length > 1 && (
            <div className="space-y-2">
              <p className="text-sm font-bold">فرع المنهج</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {branches.map(branch => {
                  const active = branch.branchId === currentBranchId;
                  return <button key={branch.branchId} type="button" aria-pressed={active}
                    onClick={() => { setBranchId(branch.branchId); setLessonId(""); }}
                    className={"min-h-12 rounded-xl border px-3 py-2 text-xs font-semibold transition " +
                      (active ? "border-primary bg-primary/10 text-foreground" : "border-border bg-background text-muted-foreground hover:border-primary/35")}>
                    {branch.branchTitle}
                  </button>;
                })}
              </div>
            </div>
          )}
          {branchChoices.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-bold">الدرس</p>
              <SearchableChoices label="الدروس" value={lessonId} onChange={setLessonId} options={lessonOptions} />
            </div>
          ) : (
            <p className="rounded-xl bg-muted/30 p-4 text-xs leading-6 text-muted-foreground">فهرس الدروس غير متاح لهذا الفرع حاليًا.</p>
          )}
        </div>
      </section>

      {selectedLesson ? (
        <>
          <section className="app-card mb-5 overflow-hidden rounded-2xl">
            <div className="flex flex-col gap-4 bg-gradient-to-l from-secondary/65 to-card p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-primary">{subjectName} · {selectedLesson.unitTitle}</p>
                <h2 className="mt-1 text-xl font-bold">{selectedLesson.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">تقدمك في خطوات SQ3R لهذا الدرس فقط.</p>
              </div>
              <div className="min-w-28 rounded-2xl border border-border/70 bg-background/80 p-3 text-center">
                <p className="text-2xl font-bold tabular-nums text-primary">{completion}%</p>
                <p className="text-[11px] text-muted-foreground">{completedSteps.length} من 5 خطوات</p>
              </div>
            </div>
            <div className="h-1.5 bg-muted"><div className="h-full bg-primary transition-all" style={{ width: completion + "%" }} /></div>
          </section>
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-3">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const done = completedSteps.includes(step.id);
                return <button type="button" key={step.id} aria-pressed={done}
                  onClick={() => updateProgress(done ? completedSteps.filter(item => item !== step.id) : [...completedSteps, step.id])}
                  disabled={saveSQ3R.isPending}
                  className={"app-card flex w-full items-center gap-4 p-4 text-right transition-colors sm:p-5 " +
                    (done ? "border-emerald-500/30 bg-emerald-500/5" : "hover:border-primary/25")}>
                  <span className={"flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold " +
                    (done ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground")}>
                    {done ? <Check className="size-4" /> : index + 1}
                  </span>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary"><Icon className="size-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{step.title}</span>
                    <span className="mt-1 block text-sm leading-6 text-muted-foreground">{step.hint}</span>
                  </span>
                  <span className={"shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold " +
                    (done ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground")}>
                    {done ? "تمت" : "تسجيل"}
                  </span>
                </button>;
              })}
            </div>
            <aside className="app-card h-fit p-5">
              <h3 className="font-bold">صعوبة الدرس</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">تساعدك على تذكّر مقدار الجهد الذي احتاجه الدرس.</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[
                  { value: "unknown", label: "لم أحدد" },
                  { value: "easy", label: "سهل" },
                  { value: "medium", label: "متوسط" },
                  { value: "hard", label: "صعب" },
                ].map(option => {
                  const active = difficulty === option.value;
                  return <button key={option.value} type="button" aria-pressed={active}
                    onClick={() => updateProgress(completedSteps, option.value as typeof difficulty)}
                    disabled={saveSQ3R.isPending}
                    className={"rounded-xl border px-2 py-3 text-xs font-semibold transition " +
                      (active ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:border-primary/35")}>
                    {option.label}
                  </button>;
                })}
              </div>
              <h3 className="mt-6 font-bold">ملاحظاتك</h3>
              <Textarea value={notes} onChange={event => setNotes(event.target.value)}
                placeholder="سجّل سؤالًا أو فكرة تريد الرجوع إليها..."
                className="mt-2 min-h-28 rounded-xl bg-background leading-7" maxLength={2_000} />
              <Button type="button" onClick={() => updateProgress(completedSteps, difficulty, notes)}
                disabled={saveSQ3R.isPending} className="mt-3 w-full rounded-xl bg-primary">
                {saveSQ3R.isPending ? "جارٍ الحفظ..." : "حفظ الملاحظة والتقدم"}
              </Button>
              <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
                {currentProgress?.updatedAt
                  ? "آخر حفظ: " + new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(currentProgress.updatedAt))
                  : "لم يُسجّل تقدم لهذه الجلسة بعد."}
              </p>
            </aside>
          </section>
        </>
      ) : (
        <section className="app-card soft-grid flex min-h-52 flex-col items-center justify-center p-6 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-secondary text-primary"><Sparkles className="size-6" /></span>
          <h2 className="mt-4 text-lg font-bold">اختر درسًا لبدء جلسة SQ3R</h2>
          <p className="mt-2 max-w-md text-sm leading-7 text-muted-foreground">اختَر المادة والفرع والدرس، ثم ابدأ خطوات المسح والتساؤل والقراءة والتسميع والمراجعة.</p>
        </section>
      )}
    </DashboardLayout>
  );
}
