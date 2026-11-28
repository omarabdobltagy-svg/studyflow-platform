import DashboardLayout from "@/components/DashboardLayout";
import { AIChatBox } from "@/components/AIChatBox";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { BookOpen, CalendarClock, CheckCircle2, ClipboardList, FileText, MessageSquare, Paperclip, Plus, RefreshCw, ShieldCheck, Sparkles, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type ChatMessage = { role: "user" | "assistant"; content: string };
type AssistantTextAttachment = { id: string; name: string; content: string; size: number };
type ChatThread = { id: string; title: string; messages: ChatMessage[]; updatedAt: number };
const STORAGE_KEY = "studyflow.assistant.conversations.v2";
const suggestions = [
  "اشرح لي درسًا من منهج المادة التي أدرسها خطوة بخطوة.",
  "وضّح لي فكرة في آخر درس وصلت إليه، واربطها بشرح المدرس.",
  "فسّر لي سبب ترتيب الخطوة التالية في خطتي.",
  "هل يوجد التزام أو موعد يحتاج أن أراعيه قبل المحاضرة القادمة؟",
  "ما الفرق بين المفاهيم الأساسية في هذا الموضوع؟",
];

function newThread(): ChatThread {
  return { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), title: "محادثة جديدة", messages: [], updatedAt: Date.now() };
}

function loadThreads(): ChatThread[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    const valid = parsed.filter((item: unknown) => {
      if (!item || typeof item !== "object") return false;
      const record = item as Record<string, unknown>;
      return typeof record.id === "string" && typeof record.title === "string"
        && Array.isArray(record.messages) && typeof record.updatedAt === "number";
    }).map((item: unknown) => {
      const record = item as Record<string, unknown>;
      const messages = (record.messages as unknown[]).filter((message: unknown) => {
        if (!message || typeof message !== "object") return false;
        const entry = message as Record<string, unknown>;
        return ["user", "assistant"].includes(String(entry.role))
          && typeof entry.content === "string"
          && (entry.content as string).length <= 6_000;
      }) as ChatMessage[];
      return {
        id: String(record.id),
        title: String(record.title).slice(0, 80),
        updatedAt: Number(record.updatedAt),
        messages: messages.slice(-40),
      };
    }).slice(0, 30);
    return valid;
  } catch {
    return [];
  }
}

function updateThreadMessage(
  current: ChatThread[],
  threadId: string,
  content: string,
  removeEmptyPlaceholder = false,
): ChatThread[] {
  return current.map(thread => {
    if (thread.id !== threadId) return thread;
    const messages = [...thread.messages];
    const last = messages[messages.length - 1];
    if (last?.role === "assistant" && (last.content === "" || !removeEmptyPlaceholder)) {
      if (removeEmptyPlaceholder && !content) messages.pop();
      else messages[messages.length - 1] = { role: "assistant", content };
    }
    return { ...thread, messages: messages.slice(-40), updatedAt: Date.now() };
  });
}

export default function Assistant() {
  const [initialThreads] = useState<ChatThread[]>(() => {
    const local = loadThreads();
    return local.length ? local : [newThread()];
  });
  const [threads, setThreads] = useState<ChatThread[]>(initialThreads);
  const [selectedId, setSelectedId] = useState(initialThreads[0]?.id ?? "");
  const [historyMode, setHistoryMode] = useState<"loading" | "remote" | "local">("loading");
  const historyHydrationRef = useRef(false);
  const [streamingThreadId, setStreamingThreadId] = useState<string | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<AssistantTextAttachment[]>([]);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const assistantThreadsQuery = trpc.assistant.threads.list.useQuery(undefined, {
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const saveAssistantThread = trpc.assistant.threads.save.useMutation();
  const deleteAssistantThread = trpc.assistant.threads.delete.useMutation();
  const activeThread = useMemo(
    () => threads.find(thread => thread.id === selectedId) || threads[0],
    [threads, selectedId],
  );
  const profile = trpc.studentProfile.get.useQuery();
  const dailyPlan = trpc.plans.currentDaily.useQuery(undefined, {
    enabled: !profile.isLoading && !profile.isError && Boolean(profile.data?.subjectIds?.length),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    refetchInterval: query => query.state.data?.needsRefresh ? 900 : query.state.data?.plan ? 15_000 : false,
  });
  const dashboardSummary = trpc.dashboard.summary.useQuery({ timeZone: "Africa/Cairo" }, {
    enabled: Boolean(profile.data),
    staleTime: 20_000,
  });
  const assistantContextReady = Boolean(profile.data && !profile.isError && !dailyPlan.isLoading && !dailyPlan.isError && !dashboardSummary.isLoading && !dashboardSummary.isError);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingThreadRef = useRef<string | null>(null);

  useEffect(() => {
    if (historyHydrationRef.current) return;
    if (assistantThreadsQuery.isError) {
      historyHydrationRef.current = true;
      setHistoryMode("local");
      toast.error("تعذّر تحميل سجل المحادثات من الحساب؛ سيظل السجل المحلي محفوظًا على هذا الجهاز.");
      return;
    }
    if (!assistantThreadsQuery.isSuccess) return;

    historyHydrationRef.current = true;
    let cancelled = false;
    void (async () => {
      const serverThreads: ChatThread[] = assistantThreadsQuery.data.map(thread => ({
        id: thread.clientId,
        title: thread.title,
        messages: thread.messages,
        updatedAt: thread.updatedAt instanceof Date
          ? thread.updatedAt.getTime()
          : new Date(thread.updatedAt).getTime(),
      }));
      const localThreads = loadThreads();
      const merged = new Map(serverThreads.map(thread => [thread.id, thread]));
      const threadsToMigrate: ChatThread[] = [];
      for (const localThread of localThreads) {
        const serverVersion = merged.get(localThread.id);
        if (!serverVersion || localThread.updatedAt > serverVersion.updatedAt) {
          merged.set(localThread.id, localThread);
          threadsToMigrate.push(localThread);
        }
      }
      const nextThreads = [...merged.values()]
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 30);
      const resolvedThreads = nextThreads.length ? nextThreads : [newThread()];
      if (cancelled) return;
      setThreads(resolvedThreads);
      setSelectedId(current => resolvedThreads.some(thread => thread.id === current)
        ? current : resolvedThreads[0].id);

      try {
        for (const thread of threadsToMigrate) {
          await saveAssistantThread.mutateAsync({
            clientId: thread.id,
            title: thread.title,
            messages: thread.messages.filter(message => message.content.trim()).slice(-40),
          });
        }
        if (cancelled) return;
        setHistoryMode("remote");
        try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* server copy is authoritative */ }
      } catch {
        if (cancelled) return;
        setHistoryMode("local");
        toast.error("لم يكتمل نقل بعض المحادثات إلى الحساب؛ احتفظنا بالنسخة المحلية ولم نحذفها.");
      }
    })();

    return () => { cancelled = true; };
  }, [assistantThreadsQuery.data, assistantThreadsQuery.isError, assistantThreadsQuery.isSuccess]);

  const persistThread = async (thread: ChatThread) => {
    if (historyMode !== "remote") return;
    try {
      await saveAssistantThread.mutateAsync({
        clientId: thread.id,
        title: thread.title,
        messages: thread.messages.filter(message => message.content.trim()).slice(-40),
      });
    } catch {
      setHistoryMode("local");
      toast.error("تعذّر مزامنة هذه المحادثة مع الحساب؛ احتفظنا بها محليًا على هذا الجهاز.");
    }
  };

  const stopCurrentStream = (preservePartial = true) => {
    const threadId = streamingThreadRef.current;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    streamingThreadRef.current = null;
    setStreamingThreadId(null);
    // An empty placeholder is never a message; preserve real partial text only.
    if (threadId) {
      setThreads(current => updateThreadMessage(current, threadId, "", true));
    }
  };

  useEffect(() => () => {
    abortControllerRef.current?.abort();
  }, []);

  useEffect(() => {
    if (historyMode === "remote") {
      try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* remote history is authoritative */ }
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(threads.slice(0, 30)));
    } catch {
      toast.error("تعذّر حفظ النسخة المحلية من المحادثات.");
    }
  }, [threads, activeThread?.id, historyMode]);

  const createConversation = () => {
    stopCurrentStream(true);
    const thread = newThread();
    setThreads(current => [thread, ...current].slice(0, 30));
    setSelectedId(thread.id);
    void persistThread(thread);
  };

  const chooseConversation = (threadId: string) => {
    if (streamingThreadRef.current && streamingThreadRef.current !== threadId) {
      stopCurrentStream(true);
    }
    setSelectedId(threadId);
  };

  const deleteConversation = async () => {
    if (!activeThread) return;
    const deletedThread = activeThread;
    if (streamingThreadRef.current === deletedThread.id) stopCurrentStream(false);
    const remaining = threads.filter(thread => thread.id !== deletedThread.id);
    const next = remaining.length ? remaining : [newThread()];
    setThreads(next);
    setSelectedId(next[0].id);
    if (historyMode === "remote") {
      try {
        await deleteAssistantThread.mutateAsync({ clientId: deletedThread.id });
      } catch {
        setThreads(current => [deletedThread, ...current.filter(thread => thread.id !== deletedThread.id)].slice(0, 30));
        setSelectedId(deletedThread.id);
        toast.error("تعذّر حذف المحادثة من الحساب؛ أُعيدت إلى السجل.");
        return;
      }
    }
    toast.success("تم حذف المحادثة من سجل الحساب.");
  };

  const sendMessage = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || !activeThread) return;

    stopCurrentStream(true);
    const threadId = activeThread.id;
    const attachments = pendingAttachments.slice(0, 3);
    const attachmentContext = attachments.map(file =>
      "اسم الملف: " + file.name + "\nمحتوى الملف:\n" + file.content
    ).join("\n\n--- ملف آخر ---\n\n").slice(0, 7_500);
    const userMessage: ChatMessage = {
      role: "user",
      content: trimmed + (attachments.length ? "\n\n📎 مرفقات: " + attachments.map(file => file.name).join("، ") : ""),
    };
    const requestMessages = [...activeThread.messages, userMessage].slice(-20);
    const visibleMessages = [...activeThread.messages, userMessage, { role: "assistant" as const, content: "" }].slice(-40);

    setThreads(current => current.map(thread => thread.id === threadId
      ? {
          ...thread,
          title: thread.messages.length ? thread.title : trimmed.slice(0, 42),
          messages: visibleMessages,
          updatedAt: Date.now(),
        }
      : thread
    ));

    if (attachments.length) setPendingAttachments([]);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    streamingThreadRef.current = threadId;
    setStreamingThreadId(threadId);
    let streamedText = "";
    let buffer = "";

    const appendToken = (token: string) => {
      if (!token) return;
      streamedText += token;
      setThreads(current => updateThreadMessage(current, threadId, streamedText));
    };

    const consumeEvent = (eventBlock: string) => {
      const lines = eventBlock.split(/\r?\n/);
      const eventName = lines.find(line => line.startsWith("event:"))?.slice(6).trim();
      const data = lines.filter(line => line.startsWith("data:"))
        .map(line => line.slice(5).trim()).join("\n");
      if (!data || data === "[DONE]") return;
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(data) as Record<string, unknown>;
      } catch {
        return;
      }
      if (eventName === "error" || typeof payload.error === "string") {
        throw new Error(typeof payload.error === "string" ? payload.error : "تعذّر إكمال الرد.");
      }
      if (typeof payload.token === "string") appendToken(payload.token);
    };

    try {
      const response = await fetch("/api/assistant/stream", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          messages: requestMessages,
          context: attachmentContext || undefined,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        let message = "تعذّر الاتصال بالمساعد الدراسي.";
        try {
          const payload = await response.json() as { error?: string; message?: string };
          message = payload.message || payload.error || message;
        } catch {
          // Keep the safe generic message if the server does not return JSON.
        }
        throw new Error(message);
      }
      if (!response.body) throw new Error("المتصفح لم يتمكن من استقبال تدفق الرد.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() ?? "";
        for (const eventBlock of events) consumeEvent(eventBlock);
      }
      buffer += decoder.decode();
      if (buffer.trim()) consumeEvent(buffer);
      if (!streamedText.trim()) throw new Error("وصلت استجابة فارغة. جرّب السؤال مرة أخرى.");
      const completedMessages: ChatMessage[] = [
        ...activeThread.messages,
        userMessage,
        { role: "assistant", content: streamedText },
      ].slice(-40);
      const completedThread = {
        ...activeThread,
        title: activeThread.messages.length ? activeThread.title : trimmed.slice(0, 42),
        messages: completedMessages,
        updatedAt: Date.now(),
      };
      setThreads(current => current.map(thread => thread.id === threadId ? completedThread : thread));
      await persistThread(completedThread);
    } catch (error) {
      const finalMessages: ChatMessage[] = [
        ...activeThread.messages,
        userMessage,
        ...(streamedText.trim() ? [{ role: "assistant" as const, content: streamedText }] : []),
      ].slice(-40);
      const finalThread = {
        ...activeThread,
        title: activeThread.messages.length ? activeThread.title : trimmed.slice(0, 42),
        messages: finalMessages,
        updatedAt: Date.now(),
      };
      setThreads(current => current.map(thread => thread.id === threadId ? finalThread : thread));
      void persistThread(finalThread);
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        toast.error(error instanceof Error ? error.message : "تعذّر الرد الآن. حاول مرة أخرى.");
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
        streamingThreadRef.current = null;
        setStreamingThreadId(null);
      }
    }
  };

  const activeIsStreaming = Boolean(activeThread && streamingThreadId === activeThread.id);

  return (
    <DashboardLayout title="المساعد الدراسي الذكي" description="ذكاء دراسي متصل بسياق مساحتك، وأنشطتك، والمهام والروتين والتقويم والتقدم المنهجي.">
      <section className="sf-assistant-shell mb-5 overflow-hidden rounded-[1.5rem] border border-border/70 bg-card">
        <div className="flex flex-col gap-4 border-b border-border/70 bg-gradient-to-l from-secondary/75 via-card to-card p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg"><Sparkles className="size-5" /></span>
            <div>
              <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold">مساعد StudyFlow</h2><span className="sf-assistant-live-state"><i/>{assistantContextReady?"السياق الدراسي جاهز":profile.isError?"تعذّر تحميل الملف الدراسي":"يربط بيانات مساحتك"}</span></div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">المساعد يقرأ سياقك الحالي قبل الرد: المنهج، الخطة، المهام، التقدم، المواعيد والنشاط المسجل.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-muted px-3 py-2"><BookOpen className="size-3.5"/>{profile.data?.subjectIds?.length ?? 0} مواد في ملفك</span>
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-muted px-3 py-2"><ShieldCheck className="size-3.5"/>تفضيلاتك الدراسية محفوظة</span>
          </div>
        </div>
        <section className="sf-assistant-context-strip" data-testid="assistant-live-context">
          <header>
            <div><span>سياق المساعد</span><strong>البيانات التي يعتمد عليها في هذه الجلسة</strong></div>
            <div className="sf-assistant-context-actions">
              <span>{assistantContextReady?"آخر مزامنة مكتملة":dailyPlan.isError||dashboardSummary.isError?"بعض البيانات غير متاحة":"جارٍ ربط البيانات"}</span>
              <Button type="button" variant="outline" size="sm" onClick={()=>void Promise.all([profile.refetch(),dailyPlan.refetch(),dashboardSummary.refetch()])} disabled={profile.isFetching||dailyPlan.isFetching||dashboardSummary.isFetching}>
                <RefreshCw className={"size-3.5"+(profile.isFetching||dailyPlan.isFetching||dashboardSummary.isFetching?" animate-spin":"")}/> تحديث السياق
              </Button>
            </div>
          </header>
          <div className="sf-assistant-context-grid">
            <article><span><BookOpen className="size-4"/>ملف المنهج</span><strong>{profile.isLoading?"…":profile.data?.subjectIds?.length??0}</strong><small>مواد محددة</small></article>
            <article><span><CalendarClock className="size-4"/>الخطة اليومية</span><strong>{dailyPlan.isLoading?"…":dailyPlan.data?.needsRefresh?"تحديث":dailyPlan.data?.plan?"مرتبطة":"غير منشأة"}</strong><small>{dailyPlan.data?.plan?.steps?.length??0} خطوة حالية</small></article>
            <article><span><ClipboardList className="size-4"/>المهام</span><strong>{dashboardSummary.isLoading?"…":dashboardSummary.data?.taskStats?.remaining??"—"}</strong><small>مهمة مفتوحة</small></article>
            <article><span><CheckCircle2 className="size-4"/>الإنجاز المسجل</span><strong>{dashboardSummary.isLoading?"…":dashboardSummary.data?.taskStats?.completed??"—"}</strong><small>مهمة مكتملة</small></article>
          </div>
          <p>هذه ليست بيانات تخمينية: إذا فشل تحميل مصدر ما، يظهر ذلك هنا ولا يتعامل المساعد معه على أنه صفر أو إنجاز مكتمل.</p>
        </section>
        <div className="grid gap-4 p-3 sm:p-4 lg:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="sf-assistant-sidebar flex min-w-0 flex-col rounded-2xl border border-border/70 bg-muted/20 p-3">
            <Button type="button" onClick={createConversation} className="mb-3 h-11 w-full justify-center gap-2 rounded-xl bg-primary">
              <Plus className="size-4" />محادثة جديدة
            </Button>
            <div className="mb-2 flex items-center justify-between px-1 text-xs font-semibold text-muted-foreground">
              <span>محادثاتك</span><span>{threads.length}</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 lg:max-h-[520px] lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden">
              {threads.slice().sort((left, right) => right.updatedAt - left.updatedAt).map(thread => (
                <button
                  type="button"
                  key={thread.id}
                  onClick={() => chooseConversation(thread.id)}
                  className={"min-w-40 rounded-xl border px-3 py-3 text-right transition-colors lg:w-full " + (activeThread?.id === thread.id ? "border-primary/30 bg-primary/10 text-foreground" : "border-transparent bg-background hover:border-border")}
                >
                  <span className="flex items-center gap-2"><MessageSquare className="size-3.5 shrink-0 text-primary" /><span className="truncate text-sm font-semibold">{thread.title}</span></span>
                  <span className="mt-2 block truncate text-[11px] text-muted-foreground">{thread.messages[0]?.content || "ابدأ محادثة جديدة"}</span>
                </button>
              ))}
            </div>
            <p className="mt-3 hidden text-[11px] leading-5 text-muted-foreground lg:block">سجل هذه المحادثات محفوظ على هذا الجهاز. تفضيلات الذاكرة الدراسية المختارة محفوظة ضمن ملف حسابك.</p>
          </aside>
          <div className="sf-assistant-workspace min-w-0">
            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{activeThread?.title || "محادثة جديدة"}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{activeIsStreaming ? "المساعد بيكتب الرد الآن..." : "يمكنك تعديل نص الإملاء الصوتي قبل إرساله."}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {activeIsStreaming && <Button type="button" variant="outline" size="sm" onClick={() => stopCurrentStream(true)} className="h-9 rounded-xl text-xs">إيقاف الرد</Button>}
                <Button type="button" variant="ghost" size="sm" disabled={!activeThread?.messages.length} onClick={deleteConversation} className="gap-2 rounded-xl text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" />حذف</Button>
              </div>
            </div>
            <div className="sf-assistant-chat-panel">
              <AIChatBox
                key={activeThread?.id}
                messages={activeThread?.messages || []}
                onSendMessage={sendMessage}
                isLoading={activeIsStreaming}
                height="min(72vh, 760px)"
                placeholder="اسأل عن درس أو مفهوم في منهجك..."
                emptyStateMessage="ابدأ بسؤال عن درس أو مفهوم، أو اطلب توضيحًا لشرح المدرس."
                suggestedPrompts={suggestions}
                inputAccessory={pendingAttachments.length > 0 ? (
                  <div className="sf-assistant-attachment-list w-full" aria-label="الملفات المرفقة">
                    {pendingAttachments.map(file => (
                      <span className="sf-assistant-attachment-chip" key={file.id}>
                        <FileText className="size-4" />
                        <span>{file.name}</span>
                        <button type="button" onClick={() => setPendingAttachments(current => current.filter(item => item.id !== file.id))} aria-label={"إزالة " + file.name}><X className="size-3.5" /></button>
                      </span>
                    ))}
                  </div>
                ) : null}
                inputActions={
                  <>
                    <input
                      ref={attachmentInputRef}
                      type="file"
                      hidden
                      multiple
                      accept=".txt,.md,.csv,.json,.html,.css,.js,.ts,.tsx,.jsx,text/plain,text/markdown,text/csv,application/json,text/html,text/css"
                      onChange={async event => {
                        const selected = Array.from(event.currentTarget.files ?? []);
                        event.currentTarget.value = "";
                        const supported = /\.(txt|md|csv|json|html|css|js|ts|tsx|jsx)$/i;
                        const additions: AssistantTextAttachment[] = [];
                        for (const file of selected.slice(0, 3 - pendingAttachments.length)) {
                          if (!supported.test(file.name)) {
                            toast.error(file.name + " غير مدعوم حاليًا. استخدم TXT أو MD أو CSV أو JSON أو HTML أو ملفات الكود.");
                            continue;
                          }
                          if (file.size > 1_500_000) {
                            toast.error(file.name + " أكبر من الحد المسموح (1.5 MB).");
                            continue;
                          }
                          try {
                            const content = await file.text();
                            if (!content.trim()) {
                              toast.error(file.name + " لا يحتوي على نص قابل للقراءة.");
                              continue;
                            }
                            additions.push({
                              id: file.name + "-" + file.lastModified + "-" + Math.random().toString(36).slice(2, 7),
                              name: file.name,
                              content: content.slice(0, 7_000),
                              size: file.size,
                            });
                          } catch {
                            toast.error("تعذرت قراءة الملف " + file.name + ".");
                          }
                        }
                        if (additions.length) setPendingAttachments(current => [...current, ...additions].slice(0, 3));
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => attachmentInputRef.current?.click()}
                      disabled={activeIsStreaming || pendingAttachments.length >= 3}
                      aria-label="إرفاق ملف نصي"
                      title="إرفاق ملف نصي"
                      className="h-[38px] w-[38px] shrink-0 rounded-xl"
                    >
                      <Paperclip className="size-4" />
                    </Button>
                  </>
                }
              />
            </div>
          </div>
        </div>
      </section>
      <p className="sf-assistant-disclosure px-1 text-xs leading-6 text-muted-foreground">المساعد يستطيع قراءة محتوى الملفات النصية المرفقة هنا. ملفات PDF وWord والصور غير مدعومة في هذا المسار بعد؛ لا تُرسل كأنها قُرئت بالفعل. فهرسة الكتب المرفوعة وربطها ببحث معرفي دائم مرحلة منفصلة.</p>
    </DashboardLayout>
  );
}
