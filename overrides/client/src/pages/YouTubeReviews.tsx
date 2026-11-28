import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  getSIEStudentVisibleBranches,
  getSIECheckpointProgressBranches,
  getSIESubject,
} from "@shared/sie-catalog";
import { ArrowUpRight, Check, ExternalLink, Loader2, RefreshCw, Search, Youtube } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type ReviewCandidate = {
  externalId: string;
  teacherId: string;
  teacherName: string;
  teacherBrand: string;
  title: string;
  channelTitle: string;
  url: string;
  publishedAt: string;
  description: string;
  matchedSignals: number;
  matchedTopics?: string[];
  isSelectedTeacher?: boolean;
  analysisStatus?: string;
  accepted: boolean;
  verificationState: string;
  relevance: string;
};

function getYouTubeId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^youtube:([A-Za-z0-9_-]{6,20})$/.exec(value);
  return match?.[1] ?? null;
}

export default function YouTubeReviews() {
  const utils = trpc.useUtils();
  const profile = trpc.studentProfile.get.useQuery(undefined, { retry: 1, refetchOnWindowFocus: true });
  const subjects = useMemo(
    () => (profile.data?.subjectIds ?? []).filter(id => /_G2_BAC$/.test(id)),
    [profile.data?.subjectIds],
  );
  const [initialSearch] = useState(() => typeof window === "undefined" ? "" : window.location.search);
  const initialParams = new URLSearchParams(initialSearch);
  const requestedNodeId = initialParams.get("nodeId") || undefined;
  const [subjectId, setSubjectId] = useState(initialParams.get("subjectId") || "");
  const [branchId, setBranchId] = useState(initialParams.get("branchId") || "");
  const [items, setItems] = useState<ReviewCandidate[]>([]);
  const [note, setNote] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const branchOptions = useMemo(
    () => subjectId ? getSIEStudentVisibleBranches(subjectId) : [],
    [subjectId],
  );
  const selection = (profile.data?.selection ?? {}) as Record<string, any>;
  const selectedTeacherId = selection.teacherChoices?.[subjectId]
    ?? profile.data?.teacherSelections?.[subjectId]
    ?? undefined;
  const currentSubjectName = getSIESubject(subjectId)?.nameAr ?? "";
  const currentBranch = branchOptions.find(branch => branch.branchId === branchId);

  useEffect(() => {
    if (!subjects.length) {
      setSubjectId("");
      return;
    }
    if (!subjects.includes(subjectId)) setSubjectId(subjects[0]);
  }, [subjects, subjectId]);

  useEffect(() => {
    if (!branchOptions.length) {
      setBranchId("");
      return;
    }
    if (!branchOptions.some(branch => branch.branchId === branchId)) {
      setBranchId(branchOptions[0].branchId);
    }
  }, [branchOptions, branchId]);

  useEffect(() => {
    setItems([]);
    setNote("");
    setHasSearched(false);
  }, [subjectId, branchId]);

  const searchReviews = trpc.teachers.recommendReviews.useMutation({
    onSuccess: result => {
      setItems(result.items as ReviewCandidate[]);
      setNote(result.note);
      setHasSearched(true);
    },
    onError: error => {
      setNote(error.message || "تعذّر الوصول إلى البحث الآن. تقدر تعيد المحاولة دون التأثير على تقدمك.");
      setHasSearched(true);
    },
  });

  const acceptReview = trpc.teachers.acceptAlternativeReview.useMutation({
    onSuccess: async (result, variables) => {
      setItems(current => current.map(item =>
        item.externalId === variables.externalId
          ? { ...item, accepted: true, analysisStatus: "processing" }
          : item
      ));
      await Promise.all([
        utils.studentProfile.get.invalidate(),
        utils.ai.activity.invalidate(),
      ]);
      toast.success(result.message);
    },
    onError: error => toast.error(error.message || "تعذّر قبول المراجعة."),
  });

  const declineReview = trpc.teachers.declineAlternativeReview.useMutation({
    onSuccess: async (_result, variables) => {
      setItems(current => current.filter(item => item.externalId !== variables.externalId));
      await utils.studentProfile.get.invalidate();
      toast.success("تم إخفاء هذه المراجعة.");
    },
    onError: error => toast.error(error.message || "تعذّر إخفاء المراجعة."),
  });

  const runSearch = () => {
    if (profile.isLoading || !subjectId || !branchId || searchReviews.isPending) return;
    setHasSearched(false);
    setNote("");
    searchReviews.mutate({ subjectId, branchId, ...(requestedNodeId ? { nodeId: requestedNodeId } : {}), teacherId: selectedTeacherId });
  };

  const canSearch = !profile.isLoading && !profile.isError
    && profile.data?.educationSystem === "baccalaureate"
    && Boolean(subjectId && branchId && currentBranch)
    && !searchReviews.isPending;

  return (
    <DashboardLayout
      title="مراجعات YouTube"
      description="مساحة مستقلة للعثور على مراجعات مرتبطة بدروس منهجك، بعيدًا عن تحديد موضع التقدم."
    >
      <div className="space-y-5 pb-6">
        <section className="app-card overflow-hidden rounded-2xl">
          <header className="border-b border-border/70 bg-card p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Youtube className="size-5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-bold">ابحث حسب المادة والفرع</h2>
                <p className="mt-1 text-xs leading-6 text-muted-foreground">
                  نبدأ بمراجعات مدرسك المختار، ثم نعرض بدائل معروفة للمادة. لا يُربط فيديو بمنهجك اعتمادًا على العنوان وحده؛ يلزم تطابق وصفه أو تحليل محتواه.
                </p>
              </div>
            </div>
          </header>
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
            <label className="grid min-w-0 gap-2">
              <span className="text-xs font-bold">المادة</span>
              <select
                data-testid="youtube-review-subject"
                value={subjectId}
                disabled={profile.isLoading || subjects.length === 0}
                onChange={event => {
                  setSubjectId(event.target.value);
                  setBranchId("");
                }}
                className="h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
              >
                {subjects.map(id => <option key={id} value={id}>{getSIESubject(id)?.nameAr ?? id}</option>)}
              </select>
            </label>
            <label className="grid min-w-0 gap-2">
              <span className="text-xs font-bold">الفرع</span>
              <select
                data-testid="youtube-review-branch"
                value={branchId}
                disabled={!branchOptions.length}
                onChange={event => setBranchId(event.target.value)}
                className="h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
              >
                {branchOptions.map(branch => <option key={branch.branchId} value={branch.branchId}>{branch.branchTitle}</option>)}
              </select>
            </label>
            <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
              <Button
                type="button"
                data-testid="youtube-review-search"
                disabled={!canSearch}
                onClick={runSearch}
                className="min-h-11 rounded-xl"
              >
                {searchReviews.isPending
                  ? <><Loader2 className="size-4 animate-spin" /> جارٍ البحث والتحقق</>
                  : <><Search className="size-4" /> {requestedNodeId ? "ابحث عن مراجعة لهذا الدرس" : "ابحث عن مراجعات هذا الفرع"}</>}
              </Button>
              {hasSearched && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={!canSearch}
                  onClick={runSearch}
                  className="min-h-11 rounded-xl"
                >
                  <RefreshCw className="size-4" /> إعادة المحاولة
                </Button>
              )}
              <span className="text-[11px] text-muted-foreground">
                {currentSubjectName}{currentBranch ? " · " + currentBranch.branchTitle : ""}
                {requestedNodeId ? " · " + (getSIECheckpointProgressBranches(subjectId).flatMap(branch => branch.choices).find(choice => choice.nodeId === requestedNodeId)?.title ?? "درس محدد") : ""}
              </span>
            </div>
          </div>
        </section>

        {profile.isLoading && (
          <section className="app-card rounded-2xl p-5 text-sm text-muted-foreground" role="status">
            <Loader2 className="mr-2 inline size-4 animate-spin" /> جارٍ تحميل ملفك الدراسي.
          </section>
        )}
        {profile.isError && (
          <section className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4 text-sm">
            تعذّر تحميل ملفك الدراسي.
            <Button type="button" variant="outline" size="sm" className="mr-2 rounded-lg" onClick={() => void profile.refetch()}>
              إعادة تحميل الملف
            </Button>
          </section>
        )}
        {!profile.isLoading && !profile.isError && profile.data?.educationSystem !== "baccalaureate" && (
          <section className="app-card rounded-2xl p-5 text-sm text-muted-foreground">
            مركز مراجعات YouTube الحالي مفعّل لمسار البكالوريا المسجل في المنصة.
          </section>
        )}
        {!profile.isLoading && !profile.isError && profile.data?.educationSystem === "baccalaureate" && subjects.length === 0 && (
          <section className="app-card rounded-2xl p-5 text-sm text-muted-foreground">
            لا توجد مادة بكالوريا مدعومة في ملفك الدراسي حتى الآن.
          </section>
        )}
        {searchReviews.isPending && (
          <section className="app-card rounded-2xl p-5 text-sm text-muted-foreground" role="status" aria-live="polite">
            <Loader2 className="mr-2 inline size-4 animate-spin" /> نبحث عن مراجعات مناسبة ونطابقها مع دروس هذا الفرع.
          </section>
        )}
        {hasSearched && !searchReviews.isPending && note && (
          <section className="rounded-2xl border border-border bg-card p-4 text-sm leading-6" role="status" aria-live="polite">
            {note}
          </section>
        )}
        {hasSearched && !searchReviews.isPending && items.length === 0 && (
          <section className="app-card rounded-2xl p-5">
            <h3 className="text-sm font-bold">لا توجد نتائج مؤكدة حاليًا</h3>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">
              قد يكون البحث الخارجي متوقفًا أو لم نعثر على فيديو يطابق هذا الفرع. جرّب البحث مجددًا، أو غيّر الفرع؛ لن نعرض فيديوهات غير متحققة على أنها مراجعة مناسبة.
            </p>
            <Button type="button" variant="outline" size="sm" disabled={!canSearch} onClick={runSearch} className="mt-3 rounded-lg">
              إعادة البحث <RefreshCw className="size-3.5" />
            </Button>
          </section>
        )}
        {items.length > 0 && (
          <section className="space-y-3" aria-label="نتائج مراجعات YouTube">
            <header className="flex flex-wrap items-center justify-between gap-2 px-1">
              <h2 className="text-sm font-bold">النتائج المرتبطة بالفرع</h2>
              <span className="text-[11px] text-muted-foreground">{items.length.toLocaleString("ar-EG")} فيديو</span>
            </header>
            {items.map(item => {
              const videoId = getYouTubeId(item.externalId);
              if (!videoId) return null;
              const videoUrl = "https://www.youtube.com/watch?v=" + videoId;
              const canAccept = !item.accepted && !item.isSelectedTeacher;
              return (
                <article key={item.externalId} className="sf-youtube-review-card">
                  <div className="sf-youtube-review-thumb">
                    <img src={"https://i.ytimg.com/vi/" + videoId + "/hqdefault.jpg"} alt="" loading="lazy" />
                    <span>YouTube</span>
                  </div>
                  <div className="sf-youtube-review-content">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">
                        {item.isSelectedTeacher ? "مدرسك المختار" : "مدرس بديل"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{item.teacherName} · {item.teacherBrand}</span>
                      {item.verificationState === "content_verified" && <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">مطابقة بعد تحليل المحتوى</span>}
                      {item.verificationState === "description_verified" && <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">مطابقة موثقة من الوصف</span>}
                      {item.analysisStatus === "processing" && <span className="rounded-md bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-700 dark:text-amber-300">جارٍ تحليل الفيديو</span>}
                      {item.analysisStatus === "analysis_unavailable" && <span className="rounded-md bg-muted px-2 py-1 text-[10px] font-bold text-muted-foreground">التحليل غير متاح حاليًا</span>}
                      {item.analysisStatus === "awaiting_consent" && <span className="rounded-md bg-muted px-2 py-1 text-[10px] font-bold text-muted-foreground">ينتظر موافقتك على التحليل</span>}
                      {item.analysisStatus === "failed" && <span className="rounded-md bg-destructive/10 px-2 py-1 text-[10px] font-bold text-destructive">تعذر تحليل الفيديو</span>}
                    </div>
                    <h3 className="mt-2 break-words text-sm font-bold leading-6">{item.title}</h3>
                    <p className="mt-1 text-[11px] text-muted-foreground">القناة: {item.channelTitle}</p>
                    {item.description && <p className="mt-2 line-clamp-3 break-words text-xs leading-5 text-muted-foreground">{item.description}</p>}
                    {item.matchedTopics?.length ? (
                      <p className="mt-2 text-[10px] leading-5 text-emerald-700 dark:text-emerald-300">
                        موضوعات طابقت المنهج: {item.matchedTopics.join("، ")}
                      </p>
                    ) : null}
                    <p className="mt-2 text-[10px] leading-5 text-muted-foreground">{item.relevance}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-border px-3 text-xs font-semibold text-foreground hover:border-primary/40">
                        فتح الفيديو <ExternalLink className="size-3.5" />
                      </a>
                      {canAccept && (
                        <Button type="button" size="sm" disabled={acceptReview.isPending || declineReview.isPending}
                          onClick={() => acceptReview.mutate({ subjectId, branchId, externalId: item.externalId })} className="rounded-lg">
                          حلّل الفيديو وطابقه مع المنهج
                        </Button>
                      )}
                      {canAccept && (
                        <Button type="button" size="sm" variant="ghost" disabled={acceptReview.isPending || declineReview.isPending}
                          onClick={() => declineReview.mutate({ externalId: item.externalId })} className="rounded-lg">
                          إخفاء
                        </Button>
                      )}
                      {item.accepted && <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300"><Check className="mr-1 inline size-3.5" />تم قبول التحليل أو المصدر</span>}
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}
