import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { getSIECheckpointProgressBranches } from "@shared/sie-catalog";
import { getMonthlyExamScopeRecord } from "@shared/monthly-exam-scope";
import { Button } from "@/components/ui/button";
import { Check, ChevronDown, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";

type Props = {
  subjectId: string;
  examDate: string;
  selection?: Record<string, any> | null;
};

export default function MonthlyExamScopeManager({ subjectId, examDate, selection }: Props) {
  const utils = trpc.useUtils();
  const savedScope = getMonthlyExamScopeRecord(
    (selection?.monthlyExamScopes ?? {}) as Record<string, unknown>,
    subjectId,
    examDate,
  );
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [includedIds, setIncludedIds] = useState<string[]>(savedScope?.includedNodeIds ?? []);
  const [excludedIds, setExcludedIds] = useState<string[]>(savedScope?.excludedNodeIds ?? []);

  useEffect(() => {
    setIncludedIds(savedScope?.includedNodeIds ?? []);
    setExcludedIds(savedScope?.excludedNodeIds ?? []);
  }, [subjectId, examDate, savedScope?.savedAt]);

  const choices = useMemo(() => getSIECheckpointProgressBranches(subjectId).flatMap(branch =>
    branch.choices.map(choice => ({
      ...choice,
      branchId: branch.branchId,
      branchTitle: branch.branchTitle,
      searchText: [branch.branchTitle, choice.title, choice.unitTitle, choice.lessonNumber].filter(Boolean).join(" "),
    })),
  ), [subjectId]);

  const filteredChoices = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ar");
    if (!normalized) return choices;
    return choices.filter(choice => choice.searchText.toLocaleLowerCase("ar").includes(normalized));
  }, [choices, query]);

  const saveScope = trpc.studentProfile.saveMonthlyExamScope.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.studentProfile.get.invalidate(),
        utils.plans.currentDaily.invalidate(),
        utils.plans.list.invalidate(),
      ]);
      setOpen(false);
      toast.success("تم حفظ نطاق الامتحان كتقرير ذاتي، وسيُستخدم لترتيب المراجعة.");
    },
    onError: error => toast.error(error.message || "تعذّر حفظ نطاق الامتحان."),
  });

  const setChoiceState = (nodeId: string, state: "included" | "excluded" | "unset") => {
    setIncludedIds(current => state === "included"
      ? [...new Set([...current.filter(id => id !== nodeId), nodeId])]
      : current.filter(id => id !== nodeId));
    setExcludedIds(current => state === "excluded"
      ? [...new Set([...current.filter(id => id !== nodeId), nodeId])]
      : current.filter(id => id !== nodeId));
  };

  const submit = () => {
    if (!includedIds.length) {
      toast.error("حدّد درسًا واحدًا على الأقل داخل الامتحان.");
      return;
    }
    saveScope.mutate({ subjectId, date: examDate, includedNodeIds: includedIds, excludedNodeIds: excludedIds });
  };

  const dateLabel = new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "long" }).format(new Date(examDate + "T12:00:00"));
  const sourceLabel = savedScope?.source === "school_confirmed" ? "تأكيد المدرسة" : "تقريرك أنت";

  return (
    <section className="sf-monthly-scope-manager" data-testid={"monthly-scope-" + subjectId}>
      <header className="sf-monthly-scope-summary">
        <div>
          <span className="sf-monthly-scope-eyebrow">نطاق امتحان {dateLabel}</span>
          <strong>{savedScope ? "نطاق محفوظ — " + sourceLabel : "لم يُحدَّد نطاق الامتحان بعد"}</strong>
          <p>{savedScope
            ? includedIds.length.toLocaleString("ar-EG") + " درس داخل النطاق · " + excludedIds.length.toLocaleString("ar-EG") + " مستبعد"
            : "موضع المدرس يوضح ما شرحه، لكنه لا يثبت ما سيدخل الامتحان."}</p>
        </div>
        <Button type="button" variant="outline" size="sm" className="sf-monthly-scope-toggle" onClick={() => setOpen(value => !value)} aria-expanded={open}>
          {open ? "إغلاق" : savedScope ? "تعديل النطاق" : "حدّد النطاق"} <ChevronDown className={"size-4 " + (open ? "rotate-180" : "")}/>
        </Button>
      </header>

      {savedScope && !open && (
        <div className="sf-monthly-scope-chips">
          {savedScope.includedNodeIds.slice(0, 6).map(id => {
            const choice = choices.find(item => item.nodeId === id);
            return choice ? <span key={id} className="is-included"><Check className="size-3"/> {choice.title}</span> : null;
          })}
          {savedScope.excludedNodeIds.slice(0, 4).map(id => {
            const choice = choices.find(item => item.nodeId === id);
            return choice ? <span key={id} className="is-excluded"><X className="size-3"/> {choice.title}</span> : null;
          })}
        </div>
      )}

      {open && (
        <div className="sf-monthly-scope-editor">
          <label className="sf-monthly-scope-search">
            <Search className="size-4"/>
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="ابحث باسم الدرس أو الفرع..."/>
          </label>
          <div className="sf-monthly-scope-legend">
            <span><i className="is-included"/> داخل الامتحان</span>
            <span><i className="is-excluded"/> خارج الامتحان</span>
            <span><i/> غير محدد</span>
          </div>
          <div className="sf-monthly-scope-choice-list">
            {filteredChoices.map(choice => {
              const included = includedIds.includes(choice.nodeId);
              const excluded = excludedIds.includes(choice.nodeId);
              return (
                <article key={choice.nodeId} className={"sf-monthly-scope-choice" + (included ? " is-included" : excluded ? " is-excluded" : "")}>
                  <div><strong>{choice.title}</strong><small>{choice.branchTitle}{choice.unitTitle ? " · " + choice.unitTitle : ""}{choice.lessonNumber ? " · " + choice.lessonNumber : ""}</small></div>
                  <div className="sf-monthly-scope-choice-actions">
                    <button type="button" className={included ? "is-active" : ""} aria-pressed={included} onClick={() => setChoiceState(choice.nodeId, included ? "unset" : "included")}>داخل</button>
                    <button type="button" className={excluded ? "is-active" : ""} aria-pressed={excluded} onClick={() => setChoiceState(choice.nodeId, excluded ? "unset" : "excluded")}>خارج</button>
                  </div>
                </article>
              );
            })}
            {!filteredChoices.length && <p className="sf-monthly-scope-empty">لا توجد دروس مطابقة لبحثك.</p>}
          </div>
          <footer>
            <span>المحدد: {includedIds.length.toLocaleString("ar-EG")} داخل · {excludedIds.length.toLocaleString("ar-EG")} خارج</span>
            <Button type="button" disabled={saveScope.isPending || includedIds.length === 0} onClick={submit}>
              {saveScope.isPending ? <Loader2 className="size-4 animate-spin"/> : <Check className="size-4"/>}
              حفظ نطاق الامتحان
            </Button>
          </footer>
          <p className="sf-monthly-scope-disclaimer">سيُحفظ هذا النطاق كتقرير ذاتي منك، وليس كتأكيد رسمي من المدرسة. يمكنك تعديله في أي وقت.</p>
        </div>
      )}
    </section>
  );
}
