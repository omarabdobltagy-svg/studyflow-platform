import DashboardLayout from "@/components/DashboardLayout";
import { AIChatBox, type Message } from "@/components/AIChatBox";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { BookOpen, MessageSquare, Plus, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type ChatThread = { id: string; title: string; messages: Message[]; updatedAt: number };
const STORAGE_KEY = "studyflow.assistant.conversations.v2";
const SELECTED_KEY = "studyflow.assistant.selected.v2";
const suggestions = [
  "اشرح لي درسًا من منهج المادة التي أدرسها خطوة بخطوة.",
  "اختبر فهمي في آخر درس وصلت إليه، ولا تعرض الإجابة قبل محاولتي.",
  "ما الفرق بين المفاهيم الأساسية في هذا الموضوع؟",
];

function newThread(): ChatThread {
  return { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), title: "محادثة جديدة", messages: [], updatedAt: Date.now() };
}
function loadThreads(): ChatThread[] {
  if (typeof window === "undefined") return [newThread()];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [newThread()];
    const valid = parsed.filter((item: any) =>
      item && typeof item.id === "string" && typeof item.title === "string" &&
      Array.isArray(item.messages) && typeof item.updatedAt === "number"
    ).map((item: any) => ({
      id: item.id,
      title: item.title.slice(0, 80),
      updatedAt: item.updatedAt,
      messages: item.messages.filter((message: any) =>
        message && ["user", "assistant"].includes(message.role) &&
        typeof message.content === "string" && message.content.length <= 6_000
      ).slice(-40),
    })).slice(0, 30);
    return valid.length ? valid : [newThread()];
  } catch {
    return [newThread()];
  }
}

export default function Assistant() {
  const [threads, setThreads] = useState<ChatThread[]>(loadThreads);
  const [selectedId, setSelectedId] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(SELECTED_KEY) || "";
  });
  const activeThread = useMemo(
    () => threads.find(thread => thread.id === selectedId) || threads[0],
    [threads, selectedId]
  );
  const profile = trpc.studentProfile.get.useQuery();
  const chat = trpc.ai.chat.useMutation({
    onSuccess: result => {
      setThreads(current => current.map(thread =>
        thread.id === activeThread.id
          ? { ...thread, messages: [...thread.messages, { role: "assistant" as const, content: result.content }].slice(-40), updatedAt: Date.now() }
          : thread
      ));
    },
    onError: error => toast.error(error.message || "تعذّر الرد الآن. حاول مرة أخرى."),
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(threads.slice(0, 30)));
      if (activeThread && activeThread.id) window.localStorage.setItem(SELECTED_KEY, activeThread.id);
    } catch {
      toast.error("تعذّر حفظ المحادثات على هذا الجهاز.");
    }
  }, [threads, activeThread && activeThread.id]);

  const createConversation = () => {
    if (chat.isPending) return;
    const thread = newThread();
    setThreads(current => [thread, ...current].slice(0, 30));
    setSelectedId(thread.id);
  };

  const deleteConversation = () => {
    if (!activeThread || chat.isPending) return;
    const remaining = threads.filter(thread => thread.id !== activeThread.id);
    const next = remaining.length ? remaining : [newThread()];
    setThreads(next);
    setSelectedId(next[0].id);
    toast.success("تم حذف المحادثة من هذا الجهاز.");
  };

  const sendMessage = (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || chat.isPending || !activeThread) return;
    const userMessage: Message = { role: "user", content: trimmed };
    const nextMessages = [...activeThread.messages, userMessage].slice(-40);
    setThreads(current => current.map(thread => thread.id === activeThread.id
      ? { ...thread, title: thread.messages.length ? thread.title : trimmed.slice(0, 42), messages: nextMessages, updatedAt: Date.now() }
      : thread
    ));
    chat.mutate({ messages: nextMessages.filter(message => message.role !== "system").slice(-20) });
  };

  return (
    <DashboardLayout title="المساعد الدراسي" description="محادثة مستقلة لكل موضوع، مع سياق ملفك الدراسي ومواضعك المسجلة في المنهج.">
      <section className="mb-5 overflow-hidden rounded-[1.5rem] border border-border/70 bg-card">
        <div className="flex flex-col gap-4 border-b border-border/70 bg-gradient-to-l from-secondary/75 via-card to-card p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg"><Sparkles className="size-5" /></span>
            <div>
              <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold">مساعد StudyFlow</h2><span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">متصل بالمخطط الدراسي</span></div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">اسأل عن الدرس، اطلب شرحًا أو تدريبًا، وارجع لأي محادثة سابقة.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-muted px-3 py-2"><BookOpen className="size-3.5" />{profile.data?.subjects?.length || 0} مواد في ملفك</span>
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-muted px-3 py-2"><ShieldCheck className="size-3.5" />محادثات خاصة بهذا الجهاز</span>
          </div>
        </div>
        <div className="grid gap-4 p-3 sm:p-4 lg:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="flex min-w-0 flex-col rounded-2xl border border-border/70 bg-muted/20 p-3">
            <Button type="button" onClick={createConversation} disabled={chat.isPending} className="mb-3 h-11 w-full justify-center gap-2 rounded-xl bg-primary">
              <Plus className="size-4" />محادثة جديدة
            </Button>
            <div className="mb-2 flex items-center justify-between px-1 text-xs font-semibold text-muted-foreground">
              <span>محادثاتك</span><span>{threads.length}</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 lg:max-h-[520px] lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden">
              {threads.slice().sort((a, b) => b.updatedAt - a.updatedAt).map(thread => (
                <button
                  type="button"
                  key={thread.id}
                  disabled={chat.isPending}
                  onClick={() => setSelectedId(thread.id)}
                  className={"min-w-40 rounded-xl border px-3 py-3 text-right transition-colors disabled:opacity-60 lg:w-full " + (activeThread && activeThread.id === thread.id ? "border-primary/30 bg-primary/10 text-foreground" : "border-transparent bg-background hover:border-border")}
                >
                  <span className="flex items-center gap-2"><MessageSquare className="size-3.5 shrink-0 text-primary" /><span className="truncate text-sm font-semibold">{thread.title}</span></span>
                  <span className="mt-2 block truncate text-[11px] text-muted-foreground">{thread.messages[0]?.content || "ابدأ محادثة جديدة"}</span>
                </button>
              ))}
            </div>
            <p className="mt-3 hidden text-[11px] leading-5 text-muted-foreground lg:block">تُحفظ المحادثات على هذا المتصفح. لن تنتقل تلقائيًا إلى جهاز آخر.</p>
          </aside>
          <div className="min-w-0">
            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <div className="min-w-0"><p className="truncate text-sm font-bold">{(activeThread && activeThread.title) || "محادثة جديدة"}</p><p className="mt-1 text-[11px] text-muted-foreground">يمكنك تعديل نص الإملاء الصوتي قبل إرساله.</p></div>
              <Button type="button" variant="ghost" size="sm" disabled={!activeThread || !activeThread.messages.length || chat.isPending} onClick={deleteConversation} className="shrink-0 gap-2 rounded-xl text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" />حذف</Button>
            </div>
            <AIChatBox
              key={activeThread && activeThread.id}
              messages={(activeThread && activeThread.messages) || []}
              onSendMessage={sendMessage}
              isLoading={chat.isPending}
              height="min(72vh, 760px)"
              placeholder="اسأل عن درس أو مفهوم في منهجك..."
              emptyStateMessage="ابدأ بسؤال عن أي درس أو اطلب اختبارًا سريعًا."
              suggestedPrompts={suggestions}
            />
          </div>
        </div>
      </section>
      <p className="px-1 text-xs leading-6 text-muted-foreground">يعتمد الرد على ملفك الدراسي وفهارس المنهج ومواضع المدرسين المتاحة في النظام. فهرسة النص الكامل للكتب المرفوعة وربطه بالبحث المعرفي مرحلة منفصلة؛ لا أعتبر اسم الكتاب وحده دليلًا على أن محتواه أصبح متاحًا للمساعد.</p>
    </DashboardLayout>
  );
}
