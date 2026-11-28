import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Loader2, Play, Search, ShieldCheck, Youtube } from "lucide-react";

type Resource = {
  title: string;
  url: string;
  teacherName?: string;
  reason: string;
};

type Candidate = {
  title: string;
  url: string;
  teacherName?: string;
  verificationState?: string;
  isSelectedTeacher?: boolean;
  relevance?: string;
  description?: string;
};

function getVideoId(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    if (url.hostname === "youtu.be" || url.hostname === "www.youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0] ?? "";
      return /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null;
    }
    if (!["youtube.com", "www.youtube.com", "m.youtube.com", "www.youtube-nocookie.com"].includes(url.hostname)) return null;
    const id = url.searchParams.get("v") ?? url.pathname.match(/^\/(?:embed|shorts)\/([A-Za-z0-9_-]{6,20})/)?.[1] ?? "";
    return /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

function InlineVideo({ title, url }: { title: string; url: string }) {
  const [playing, setPlaying] = useState(false);
  const id = getVideoId(url);
  if (!id) {
    return <a className="sf-plan-video-external" href={url} target="_blank" rel="noreferrer">افتح الفيديو على YouTube <ArrowUpRight className="size-3.5"/></a>;
  }
  return playing ? (
    <div className="sf-plan-video-player">
      <iframe title={title} src={"https://www.youtube-nocookie.com/embed/" + id + "?rel=0"}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen loading="lazy"/>
    </div>
  ) : (
    <button type="button" className="sf-plan-video-preview" onClick={() => setPlaying(true)} aria-label={"تشغيل " + title}>
      <img src={"https://i.ytimg.com/vi/" + id + "/hqdefault.jpg"} alt="" loading="lazy"/>
      <span><Play className="size-5 fill-current"/> شغّل المراجعة داخل المهمة</span>
    </button>
  );
}

export default function TaskReviewResourcePanel({
  resource,
  subjectId,
  branchId,
  nodeId,
  teacherId,
}: {
  resource?: Resource;
  subjectId?: string;
  branchId?: string;
  nodeId?: string;
  teacherId?: string;
}) {
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [note, setNote] = useState("");
  const utils = trpc.useUtils();
  const search = trpc.teachers.recommendReviews.useMutation({
    onSuccess: async result => {
      const items = result.items as Candidate[];
      setCandidate(items.find(item => item.isSelectedTeacher) ?? items[0] ?? null);
      setNote(result.note ?? "");
      await Promise.all([utils.studentProfile.get.invalidate(), utils.ai.activity.invalidate()]);
    },
    onError: error => setNote(error.message || "تعذّر البحث عن مراجعة الآن."),
  });

  if (resource) {
    return (
      <section className="sf-plan-video-spotlight" data-testid="planner-video-recommendation">
        <header>
          <div>
            <span className="sf-plan-video-eyebrow"><Youtube className="size-3.5"/> ترشيح موثّق من الذكاء الاصطناعي</span>
            <strong>{resource.title}</strong>
            <small>{resource.teacherName ? "مدرسك المختار · " + resource.teacherName : "مصدر مرتبط بالمنهج"}</small>
          </div>
          <span className="sf-plan-video-verified"><ShieldCheck className="size-3.5"/> مطابق للمحتوى</span>
        </header>
        <p>{resource.reason}</p>
        <InlineVideo title={resource.title} url={resource.url}/>
      </section>
    );
  }

  if (!subjectId || !branchId || !nodeId) return null;
  const verified = candidate?.verificationState === "content_verified" || candidate?.verificationState === "description_verified";
  return (
    <section className="sf-plan-video-discovery" data-testid="planner-video-discovery">
      <div>
        <span>مراجعة هذا الدرس من مدرسك</span>
        <strong>{candidate?.title ?? "لم يتم العثور على مراجعة موثقة بعد"}</strong>
        <p>{candidate
          ? verified
            ? "وجد StudyFlow دليلًا من وصف الفيديو أو تحليل محتواه يطابق هذا الدرس."
            : "تم العثور على مصدر محتمل، لكن تطابقه مع الدرس لم يُثبت بعد. لن نعتبره مراجعة مطابقة حتى يكتمل التحقق."
          : "ابحث في قناة المدرس المختار عن هذا الدرس تحديدًا. لن نعتمد على عنوان الفيديو وحده."}</p>
      </div>
      {candidate?.url && (
        <div className="sf-plan-video-discovery-result">
          {verified ? (
            <InlineVideo title={candidate.title} url={candidate.url}/>
          ) : (
            <a href={candidate.url} target="_blank" rel="noreferrer">معاينة المصدر المحتمل <ArrowUpRight className="size-3.5"/></a>
          )}
        </div>
      )}
      <Button type="button" size="sm" variant="outline" disabled={search.isPending}
        onClick={() => search.mutate({ subjectId, branchId, nodeId, teacherId })}>
        {search.isPending
          ? <><Loader2 className="size-4 animate-spin"/> يبحث في قناة المدرس ويحلّل المحتوى</>
          : <><Search className="size-4"/> ابحث عن مراجعة لهذا الدرس</>}
      </Button>
      {note && <small>{note}</small>}
    </section>
  );
}
