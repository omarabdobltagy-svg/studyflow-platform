import DashboardLayout from "@/components/DashboardLayout";
import QueryErrorNotice from "@/components/QueryErrorNotice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { ArrowRight, BookOpenText, ChevronLeft, FilePlus2, FileText, Layers3, Paperclip, Pencil, Plus, Save, Trash2, Upload, X, Search, Bookmark, Clock3, CheckCircle2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { useLocation, useRoute } from "wouter";
import { Textarea } from "@/components/ui/textarea";

const coverClass = { violet: "from-zinc-700 to-neutral-950", emerald: "from-stone-600 to-neutral-800", amber: "from-amber-400 to-yellow-700", sky: "from-stone-500 to-zinc-800", red: "from-red-600 to-rose-800", charcoal: "from-neutral-800 to-black" };

export default function Books() {
  const [, params] = useRoute("/books/:id");
  const bookId = params?.id ? Number(params.id) : null;
  return bookId ? <BookDetail bookId={bookId} /> : <BookLibrary />;
}

function BookLibrary() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [formOpen, setFormOpen] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const booksQuery = trpc.books.list.useQuery();
  const studentProfile = trpc.studentProfile.get.useQuery();
  const createBook = trpc.books.create.useMutation({
    onSuccess: () => {
      void utils.books.list.invalidate();
      void utils.dashboard.summary.invalidate();
      setFormOpen(false);
      toast.success("أُضيف الكتاب إلى مكتبتك.");
    },
    onError: error => toast.error(error.message),
  });
  const uploadAttachment = trpc.books.uploadAttachment.useMutation();
  const deleteBookRecord = trpc.books.delete.useMutation();

  const handleQuickUpload = async (file?: File | null) => {
    if (!file || uploadingFile) return;
    if (file.size <= 0 || file.size > 8 * 1024 * 1024) {
      toast.error("حجم الملف يجب أن يكون أكبر من صفر وألا يتجاوز 8 ميغابايت.");
      return;
    }
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    const mimeByExtension: Record<string, string> = {
      pdf: "application/pdf",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      txt: "text/plain",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
    };
    const mimeType = file.type || mimeByExtension[extension];
    if (!mimeType || !Object.values(mimeByExtension).includes(mimeType)) {
      toast.error("الملف غير مدعوم. استخدم PDF أو DOCX أو TXT أو JPG أو PNG أو WEBP.");
      return;
    }

    let createdBookId: number | undefined;
    setUploadingFile(true);
    try {
      const cleanTitle = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
      const title = cleanTitle || "كتاب جديد";
      const subjects = studentProfile.data?.subjects ?? [];
      const normalizeText = (value: string) => value
        .toLocaleLowerCase("ar")
        .replace(/ال/g, "")
        .replace(/[^\u0600-\u06FFa-z0-9]+/gi, " ")
        .trim();
      const fileTerms = new Set(normalizeText(title).split(/\s+/).filter(term => term.length > 2));
      const matchedSubject = subjects.find(subjectName =>
        normalizeText(subjectName).split(/\s+/).some(term => term.length > 2 && fileTerms.has(term))
      );
      const subject = matchedSubject || subjects[0] || "دراسة عامة";
      createdBookId = await createBook.mutateAsync({
        title,
        author: null,
        subject,
        totalPages: 0,
        coverColor: "amber",
      });

      const bytes = new Uint8Array(await file.arrayBuffer());
      let raw = "";
      const chunkSize = 0x8000;
      for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        raw += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
      }
      await uploadAttachment.mutateAsync({
        bookId: createdBookId,
        chapterId: null,
        fileName: file.name,
        mimeType,
        contentBase64: btoa(raw),
      });
      await Promise.all([utils.books.list.invalidate(), utils.dashboard.summary.invalidate()]);
      toast.success("تم استيراد الكتاب وإضافته للمكتبة.");
      setLocation(`/books/${createdBookId}`);
    } catch (error) {
      if (createdBookId) {
        try { await deleteBookRecord.mutateAsync({ id: createdBookId }); } catch { /* Keep the original upload error visible. */ }
      }
      toast.error(error instanceof Error ? error.message : "تعذّر استيراد الكتاب. تحقق من إعداد التخزين وحاول مرة أخرى.");
    } finally {
      setUploadingFile(false);
      setDropActive(false);
    }
  };

  const books = booksQuery.data ?? [];
  const subjectOptions = Array.from(new Set(books.map(book => book.subject))).sort((a, b) => a.localeCompare(b, "ar"));
  const visibleBooks = books.filter(book =>
    (subjectFilter === "all" || book.subject === subjectFilter) &&
    (!searchQuery.trim() || [book.title, book.author || "", book.subject].join(" ").toLowerCase().includes(searchQuery.trim().toLowerCase()))
  );
  const averageProgress = books.length ? Math.round(books.reduce((total, book) => total + book.progress, 0) / books.length) : 0;
  const inProgressCount = books.filter(book => book.status === "reading").length;

  return (
    <DashboardLayout title="المكتبة" description="مكتبتك تجمع المراجع والفصول والملاحظات، وتحوّل تقدم القراءة إلى صورة واضحة." action={<Button onClick={() => setFormOpen(true)} className="pressable rounded-xl bg-primary"><Plus className="size-4" /> إضافة كتاب</Button>}>
      {booksQuery.isError && <QueryErrorNotice onRetry={() => void booksQuery.refetch()} label="تعذّر تحميل مكتبتك." />}
      {formOpen && <BookForm onClose={() => setFormOpen(false)} loading={createBook.isPending} onSubmit={data => createBook.mutate(data)} />}

      <section className="sf-library-hero">
        <div className="sf-library-hero-copy">
          <p className="sf-library-overline">LEARNING LIBRARY / YOUR MATERIALS</p>
          <h2>كل مادة لها مكان. وكل تقدم له أثر.</h2>
          <p>احفظ الكتب والملفات والمراجع، ثم قسّم المادة إلى فصول وتابع ما أنجزته دون إدخال التقدم يدويًا في أكثر من مكان.</p>
          <div className="sf-library-hero-actions">
            <Button onClick={() => document.getElementById("studyflow-book-import")?.click()} className="rounded-xl bg-white text-[#3b214c] hover:bg-[#f1e9f6]"><Upload className="size-4" /> استيراد ملف</Button>
            <Button onClick={() => setFormOpen(true)} variant="ghost" className="rounded-xl text-white hover:bg-white/10 hover:text-white"><Plus className="size-4" /> إضافة يدويًا</Button>
          </div>
        </div>
        <div className="sf-library-summary">
          <div className="sf-library-summary-head"><span>صورة مكتبتك</span><BookOpenText /></div>
          <strong>{booksQuery.isLoading || booksQuery.isError ? "—" : books.length}</strong>
          <small>كتب ومسارات محفوظة</small>
          <div className="sf-library-summary-metrics">
            <div><b>{booksQuery.isLoading || booksQuery.isError ? "—" : averageProgress + "%"}</b><span>متوسط التقدم</span></div>
            <div><b>{booksQuery.isLoading || booksQuery.isError ? "—" : inProgressCount}</b><span>قيد القراءة</span></div>
          </div>
        </div>
        <span className="sf-library-orbit" aria-hidden="true" />
      </section>

      <section
        onDragOver={event => { event.preventDefault(); setDropActive(true); }}
        onDragLeave={() => setDropActive(false)}
        onDrop={event => { event.preventDefault(); setDropActive(false); void handleQuickUpload(event.dataTransfer.files?.[0]); }}
        className={cn("sf-library-import", dropActive && "is-drop-active", uploadingFile && "is-uploading")}
      >
        <span className="sf-library-import-icon"><Upload /></span>
        <div className="sf-library-import-copy">
          <p className="sf-library-overline">QUICK IMPORT / LOW-FRICTION SETUP</p>
          <h3>{uploadingFile ? "جارٍ استيراد الملف..." : "ابدأ من الملف الذي لديك بالفعل."}</h3>
          <p>اختيار الملف ينشئ بطاقة كتاب تلقائيًا من اسمه ويربطها بالمادة الأقرب في ملفك الدراسي، ويمكنك تعديلها لاحقًا.</p>
          <small>PDF · DOCX · TXT · JPG · PNG · WEBP · حد أقصى 8 MB</small>
        </div>
        <label htmlFor="studyflow-book-import" className={cn("sf-library-import-button", uploadingFile && "is-disabled")}>
          {uploadingFile ? <><span className="sf-import-spinner" /> جارٍ الاستيراد</> : <><Upload /> اختيار ملف</>}
        </label>
        <input id="studyflow-book-import" type="file" accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/jpeg,image/png,image/webp" className="sr-only" disabled={uploadingFile} onChange={event => { void handleQuickUpload(event.target.files?.[0]); event.currentTarget.value = ""; }} />
      </section>

      <section className="sf-library-workspace">
        <div className="sf-library-workspace-heading">
          <div><p className="sf-library-section-kicker">YOUR SHELF</p><h2>رفّ التعلّم</h2><p>افتح أي كتاب لإدارة الفصول والملاحظات والملفات المرتبطة به.</p></div>
          <span>{booksQuery.isLoading || booksQuery.isError ? "—" : visibleBooks.length + " / " + books.length} <small>مادة</small></span>
        </div>
        <div className="sf-library-controls">
          <div className="sf-library-search"><Search /><Input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="ابحث باسم الكتاب أو المؤلف أو المادة..." aria-label="البحث في المكتبة" />{searchQuery && <button type="button" onClick={() => setSearchQuery("")} aria-label="مسح البحث"><X /></button>}</div>
          <div className="sf-library-subject-filters" role="group" aria-label="تصفية حسب المادة">
            <button type="button" onClick={() => setSubjectFilter("all")} className={subjectFilter === "all" ? "is-active" : ""} aria-pressed={subjectFilter === "all"}>كل المواد</button>
            {subjectOptions.map(subject => <button type="button" key={subject} onClick={() => setSubjectFilter(subject)} className={subjectFilter === subject ? "is-active" : ""} aria-pressed={subjectFilter === subject}>{subject}</button>)}
          </div>
        </div>

        <div className="sf-library-grid">
          {booksQuery.isLoading ? [0,1,2].map(item => <div key={item} className="sf-book-card-skeleton" />)
            : booksQuery.isError ? null
            : visibleBooks.length ? visibleBooks.map((book, index) => (
              <button key={book.id} type="button" onClick={() => setLocation("/books/" + book.id)} className={cn("sf-library-book-card", "tone-" + (index % 4 + 1))}>
                <div className={cn("sf-library-book-cover", coverClass[book.coverColor as keyof typeof coverClass] || coverClass.charcoal)}>
                  <span className="sf-library-cover-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="sf-library-cover-glyph"><BookOpenText /></span>
                  <span className="sf-library-cover-status">{book.status === "completed" ? "مكتمل" : book.status === "reading" ? "قيد القراءة" : "في الانتظار"}</span>
                  <i aria-hidden="true" />
                </div>
                <div className="sf-library-book-info">
                  <div className="sf-library-book-heading"><span>{book.subject}</span><strong>{book.progress}%</strong></div>
                  <h3>{book.title}</h3>
                  <p>{book.author || "مؤلف غير محدد"}</p>
                  <div className="sf-library-book-progress"><i style={{ width: book.progress + "%" }} /></div>
                  <div className="sf-library-book-footer"><span><Layers3 /> {book.chapterCount} فصول</span><em>فتح المحتوى <ChevronLeft /></em></div>
                </div>
              </button>
            ))
            : (
              <div className="sf-library-empty">
                <span><Bookmark /></span><h3>{searchQuery || subjectFilter !== "all" ? "لا توجد مواد مطابقة." : "مكتبتك تبدأ من هنا."}</h3>
                <p>{searchQuery || subjectFilter !== "all" ? "جرّب تعديل البحث أو اختيار مادة أخرى." : "ارفع ملف الكتاب مباشرة أو أضف مادة يدويًا لتبدأ تنظيم الفصول والملاحظات."}</p>
                <div>{searchQuery || subjectFilter !== "all" ? <Button variant="outline" onClick={() => { setSearchQuery(""); setSubjectFilter("all"); }}>إعادة ضبط</Button> : <Button onClick={() => setFormOpen(true)} className="rounded-xl"><Plus /> أضف مادة</Button>}</div>
              </div>
            )
          }
        </div>
      </section>
    </DashboardLayout>
  );
}

function BookDetail({ bookId }: { bookId: number }) {
  const [, setLocation] = useLocation(); const utils = trpc.useUtils(); const [chapterForm, setChapterForm] = useState(false); const [bookEditOpen, setBookEditOpen] = useState(false); const [chapterEditId, setChapterEditId] = useState<number | null>(null); const [selectedChapterId, setSelectedChapterId] = useState<string>("book"); const detail = trpc.books.detail.useQuery({ id: bookId });
  const addChapter = trpc.books.addChapter.useMutation({ onSuccess: () => { void utils.books.detail.invalidate({ id: bookId }); void utils.books.list.invalidate(); void utils.dashboard.summary.invalidate(); setChapterForm(false); toast.success("تمت إضافة الفصل."); }, onError: error => toast.error(error.message) });
  const updateProgress = trpc.books.updateChapterProgress.useMutation({ onSuccess: () => { void utils.books.detail.invalidate({ id: bookId }); void utils.books.list.invalidate(); void utils.dashboard.summary.invalidate(); }, onError: error => toast.error(error.message) });
  const updateBook = trpc.books.update.useMutation({ onSuccess: () => { void utils.books.detail.invalidate({ id: bookId }); void utils.books.list.invalidate(); void utils.dashboard.summary.invalidate(); setBookEditOpen(false); toast.success("تم حفظ تعديلات الكتاب."); }, onError: error => toast.error(error.message) });
  const deleteBook = trpc.books.delete.useMutation({ onSuccess: () => { void utils.books.list.invalidate(); void utils.dashboard.summary.invalidate(); toast.success("حُذف الكتاب من المكتبة."); setLocation("/books"); }, onError: error => toast.error(error.message) });
  const updateChapter = trpc.books.updateChapter.useMutation({ onSuccess: () => { void utils.books.detail.invalidate({ id: bookId }); void utils.books.list.invalidate(); setChapterEditId(null); toast.success("تم حفظ الفصل."); }, onError: error => toast.error(error.message) });
  const deleteChapter = trpc.books.deleteChapter.useMutation({ onSuccess: () => { void utils.books.detail.invalidate({ id: bookId }); void utils.books.list.invalidate(); toast.success("حُذف الفصل."); }, onError: error => toast.error(error.message) });
  const uploadAttachment = trpc.books.uploadAttachment.useMutation({ onSuccess: () => { void utils.books.detail.invalidate({ id: bookId }); toast.success("تم رفع المرفق."); }, onError: error => toast.error(error.message) });
  const deleteAttachment = trpc.books.deleteAttachment.useMutation({ onSuccess: () => { void utils.books.detail.invalidate({ id: bookId }); toast.success("حُذف المرفق."); }, onError: error => toast.error(error.message) });
  const book = detail.data;
  const refreshBook = () => { void utils.books.detail.invalidate({ id: bookId }); void utils.books.list.invalidate(); void utils.dashboard.summary.invalidate(); };
  const handleFile = async (file?: File | null) => {
    if (!file) return;
    const maxSize = 8 * 1024 * 1024;
    if (file.size <= 0 || file.size > maxSize) return toast.error("حجم المرفق يجب أن يكون أكبر من صفر وألا يتجاوز 8 ميغابايت.");
    const extension = file.name.split(".").pop()?.toLowerCase();
    const mimeByExtension: Record<string, string> = {
      pdf: "application/pdf",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      txt: "text/plain",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
    };
    const mimeType = file.type || mimeByExtension[extension || ""];
    if (!mimeType || !Object.values(mimeByExtension).includes(mimeType)) {
      return toast.error("نوع الملف غير مدعوم. استخدم PDF أو DOCX أو TXT أو صورة JPG/PNG/WEBP.");
    }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let raw = "";
      const chunkSize = 0x8000;
      for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        raw += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
      }
      uploadAttachment.mutate({
        bookId,
        chapterId: selectedChapterId === "book" ? null : Number(selectedChapterId),
        fileName: file.name,
        mimeType,
        contentBase64: btoa(raw),
      });
    } catch {
      toast.error("تعذّر قراءة الملف. جرّب ملفًا آخر.");
    }
  };
  return <DashboardLayout title={book?.title || "تفاصيل الكتاب"} description="إدارة الفصول والملفات والملاحظات ومتابعة تقدم الكتاب من مساحة واحدة." action={<div className="flex gap-2"><Button onClick={() => setBookEditOpen(true)} variant="outline" className="pressable rounded-2xl"><Pencil className="size-4" />تعديل</Button><Button onClick={() => setLocation("/books")} variant="outline" className="pressable rounded-2xl"><ArrowRight className="size-4" />المكتبة</Button></div>}>
    {detail.isError && <QueryErrorNotice onRetry={() => void detail.refetch()} label="تعذّر تحميل تفاصيل الكتاب." />}
    {detail.isLoading ? <div className="app-card h-96 animate-pulse bg-muted" /> : !book ? <div className="app-card p-8 text-center"><p className="font-semibold">لم نعثر على هذا الكتاب.</p><Button onClick={() => setLocation("/books")} variant="link" className="mt-3 text-primary">العودة إلى المكتبة</Button></div> : <><section className="sf-feature-hero sf-book-detail-hero relative mb-6 overflow-hidden rounded-[1.5rem] p-6 text-primary-foreground sm:p-8"><div className="absolute -left-12 -top-16 size-56 rounded-full bg-violet-300/20 blur-2xl" /><div className="relative flex flex-col gap-6 sm:flex-row sm:items-end"><span className={cn("flex h-24 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-xl", coverClass[book.coverColor as keyof typeof coverClass] || coverClass.violet)}><BookOpenText className="size-7" /></span><div className="min-w-0 flex-1"><p className="text-sm text-primary-foreground/65">{book.subject}{book.author ? ` · ${book.author}` : ""}</p><h2 className="mt-1 text-2xl font-bold sm:text-3xl">{book.title}</h2><p className="mt-3 text-sm text-primary-foreground/70">{book.chapters.length} فصول · {book.progress}% من رحلة القراءة</p></div><div className="w-full max-w-52"><div className="mb-2 flex justify-between text-xs text-primary-foreground/65"><span>تقدم الكتاب</span><span className="num">{book.progress}%</span></div><Progress value={book.progress} className="h-2.5 bg-white/15 [&>div]:bg-amber-300" /></div></div></section>
      {bookEditOpen ? <BookEditForm book={book} onClose={() => setBookEditOpen(false)} loading={updateBook.isPending} onSubmit={data => updateBook.mutate({ id: book.id, ...data })} onDelete={() => { if (window.confirm("هل تريد حذف الكتاب بكل فصوله ومرفقاته؟")) deleteBook.mutate({ id: book.id }); }} /> : null}
      {chapterForm ? <ChapterForm onClose={() => setChapterForm(false)} loading={addChapter.isPending} onSubmit={data => addChapter.mutate({ bookId, ...data })} /> : null}
      <section className="app-card sf-book-detail-panel sf-book-notes-panel mb-6 p-5 sm:p-6"><div className="mb-3 flex items-center gap-2"><FileText className="size-4 text-primary" /><div><p className="eyebrow">ملاحظات الكتاب</p><h2 className="mt-1 font-bold">ما الذي تريد تذكره لاحقًا؟</h2></div></div><Textarea defaultValue={book.notes || ""} onBlur={event => { if (event.currentTarget.value !== (book.notes || "")) updateBook.mutate({ id: book.id, title: book.title, author: book.author, subject: book.subject, totalPages: book.totalPages, coverColor: book.coverColor, notes: event.currentTarget.value || null }); }} placeholder="ألخّص هنا الأفكار والأسئلة والمراجع المهمة…" className="min-h-28 rounded-xl bg-background leading-7" /></section>
      <section className="app-card sf-book-detail-panel sf-book-attachments-panel mb-6 p-5 sm:p-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="eyebrow">المرفقات</p><h2 className="mt-1 font-bold">ملفات ومراجع الكتاب</h2><p className="mt-1 text-xs text-muted-foreground">حتى 8 ميغابايت للملف الواحد.</p></div><div className="flex flex-wrap gap-2"><Select value={selectedChapterId} onValueChange={setSelectedChapterId}><SelectTrigger className="h-10 w-44 rounded-xl bg-background text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="book">الكتاب كاملًا</SelectItem>{book.chapters.map(chapter => <SelectItem key={chapter.id} value={String(chapter.id)}>{chapter.title}</SelectItem>)}</SelectContent></Select><label className="pressable inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"><Upload className="size-4" />رفع ملف<input type="file" accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/jpeg,image/png,image/webp" className="hidden" onChange={event => { void handleFile(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{book.attachments.length ? book.attachments.map(attachment => <div key={attachment.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-border/70 bg-secondary/35 p-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Paperclip className="size-4" /></span><a href={attachment.fileUrl} target="_blank" rel="noreferrer" className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{attachment.fileName}</p><p className="mt-0.5 text-xs text-muted-foreground">{Math.max(1, Math.round(attachment.sizeBytes / 1024))} كيلوبايت{attachment.chapterId ? " · فصل مرتبط" : ""}</p></a><Button size="icon" variant="ghost" onClick={() => { if (window.confirm("حذف هذا المرفق؟")) deleteAttachment.mutate({ attachmentId: attachment.id }); }} className="shrink-0 rounded-lg text-destructive"><Trash2 className="size-4" /></Button></div>) : <p className="rounded-xl bg-secondary/40 p-4 text-sm text-muted-foreground">لا توجد مرفقات بعد. أضف ملخصًا أو ملفًا أو مرجعًا مفيدًا.</p>}</div></section>
      <section className="app-card sf-book-detail-panel sf-book-chapters-panel overflow-hidden"><div className="flex items-center justify-between border-b border-border/65 px-5 py-5 sm:px-6"><div><p className="eyebrow">فصول الكتاب</p><h2 className="mt-1 font-bold">قسّم التقدم على أجزاء أصغر</h2></div><Button onClick={() => setChapterForm(true)} variant="outline" className="pressable rounded-xl"><FilePlus2 className="size-4" />فصل جديد</Button></div><div className="divide-y divide-border/60">{book.chapters.length ? book.chapters.map((chapter, index) => <div key={chapter.id} className="p-5 sm:px-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><span className="num flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-sm font-semibold text-primary">{index + 1}</span><div className="min-w-0 flex-1"><p className="font-semibold">{chapter.title}</p><p className="mt-1 text-xs text-muted-foreground">{chapter.completedPages} من {chapter.totalPages} صفحة</p></div><div className="flex items-center gap-2 sm:w-72"><Progress value={chapter.totalPages ? Math.round((chapter.completedPages / chapter.totalPages) * 100) : 0} className="h-2 flex-1 bg-muted" /><Input type="number" min="0" max={chapter.totalPages} defaultValue={chapter.completedPages} onBlur={event => { const pages = Number(event.target.value); if (pages !== chapter.completedPages && Number.isFinite(pages)) updateProgress.mutate({ chapterId: chapter.id, completedPages: pages }); }} className="num h-9 w-20 rounded-lg bg-background text-center text-xs" /><Button size="icon" variant="ghost" onClick={() => setChapterEditId(chapter.id)} className="rounded-lg"><Pencil className="size-4" /></Button></div></div>{chapterEditId === chapter.id ? <ChapterEditForm chapter={chapter} loading={updateChapter.isPending} onClose={() => setChapterEditId(null)} onSubmit={data => updateChapter.mutate({ chapterId: chapter.id, ...data })} onDelete={() => { if (window.confirm("حذف هذا الفصل ومرفقاته؟")) deleteChapter.mutate({ chapterId: chapter.id }); }} /> : <Textarea defaultValue={chapter.notes || ""} onBlur={event => { if (event.currentTarget.value !== (chapter.notes || "")) updateChapter.mutate({ chapterId: chapter.id, title: chapter.title, totalPages: chapter.totalPages, completedPages: chapter.completedPages, notes: event.currentTarget.value || null }); }} placeholder="ملاحظات هذا الفصل…" className="mt-4 min-h-20 rounded-xl bg-secondary/35 text-sm leading-6" />}</div>) : <div className="flex min-h-52 flex-col items-center justify-center p-6 text-center"><Layers3 className="mb-3 size-8 text-primary/35" /><p className="font-semibold">لا توجد فصول بعد</p><p className="mt-1 text-sm text-muted-foreground">أضف الفصل الأول لتبدأ تتبع تقدمك.</p></div>}</div></section></>}
  </DashboardLayout>;
}

function BookForm({ onClose, onSubmit, loading }: { onClose: () => void; loading: boolean; onSubmit: (data: { title: string; author: string | null; subject: string; totalPages: number; coverColor: string }) => void }) { const [title, setTitle] = useState(""); const [author, setAuthor] = useState(""); const [subject, setSubject] = useState("دراسة"); const [pages, setPages] = useState("0"); const [color, setColor] = useState("violet"); const submit = (event: FormEvent) => { event.preventDefault(); if (!title.trim()) return toast.error("اكتب عنوان الكتاب."); onSubmit({ title: title.trim(), author: author.trim() || null, subject: subject.trim() || "دراسة", totalPages: Math.max(0, Number(pages) || 0), coverColor: color }); }; return <section className="sf-book-form enter app-card mb-6 overflow-hidden border-primary/15"><div className="flex items-center justify-between border-b border-border/65 px-5 py-4"><div><p className="eyebrow">إضافة إلى الرف</p><h2 className="mt-1 font-bold">كتاب أو مادة جديدة</h2></div><Button variant="ghost" size="icon" className="rounded-xl" onClick={onClose}><X className="size-4" /></Button></div><form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-2"><div><label className="mb-2 block text-sm font-semibold">عنوان الكتاب</label><Input autoFocus value={title} onChange={event => setTitle(event.target.value)} placeholder="مثال: مبادئ الاقتصاد" className="h-11 rounded-xl bg-background" /></div><div><label className="mb-2 block text-sm font-semibold">المؤلف <span className="font-normal text-muted-foreground">اختياري</span></label><Input value={author} onChange={event => setAuthor(event.target.value)} className="h-11 rounded-xl bg-background" /></div><div><label className="mb-2 block text-sm font-semibold">المادة أو التصنيف</label><Input value={subject} onChange={event => setSubject(event.target.value)} className="h-11 rounded-xl bg-background" /></div><div><label className="mb-2 block text-sm font-semibold">إجمالي الصفحات</label><Input type="number" min="0" value={pages} onChange={event => setPages(event.target.value)} className="num h-11 rounded-xl bg-background" /></div><div><label className="mb-2 block text-sm font-semibold">لون الغلاف</label><Select value={color} onValueChange={setColor}><SelectTrigger className="h-11 rounded-xl bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="violet">بنفسجي</SelectItem><SelectItem value="emerald">زمردي</SelectItem><SelectItem value="amber">ذهبي</SelectItem><SelectItem value="sky">سماوي</SelectItem></SelectContent></Select></div><div className="flex items-end justify-end gap-2"><Button type="button" variant="outline" onClick={onClose} className="rounded-xl">إلغاء</Button><Button disabled={loading} className="pressable rounded-xl bg-primary">إضافة الكتاب</Button></div></form></section>; }
function BookEditForm({ book, onClose, onSubmit, onDelete, loading }: { book: { title: string; author: string | null; subject: string; totalPages: number; coverColor: string; notes: string | null }; onClose: () => void; onSubmit: (data: { title: string; author: string | null; subject: string; totalPages: number; coverColor: string; notes: string | null }) => void; onDelete: () => void; loading: boolean }) { const [title, setTitle] = useState(book.title); const [author, setAuthor] = useState(book.author || ""); const [subject, setSubject] = useState(book.subject); const [pages, setPages] = useState(String(book.totalPages)); const [color, setColor] = useState(book.coverColor); const [notes, setNotes] = useState(book.notes || ""); const submit = (event: FormEvent) => { event.preventDefault(); if (!title.trim()) return toast.error("اكتب عنوان الكتاب."); onSubmit({ title: title.trim(), author: author.trim() || null, subject: subject.trim() || "دراسة", totalPages: Math.max(0, Number(pages) || 0), coverColor: color, notes: notes.trim() || null }); }; return <section className="sf-book-form enter app-card mb-6 overflow-hidden border-primary/20"><div className="flex items-center justify-between border-b border-border/65 px-5 py-4"><div><p className="eyebrow">تعديل المحتوى</p><h2 className="mt-1 font-bold">بيانات الكتاب وملاحظاته</h2></div><Button variant="ghost" size="icon" className="rounded-xl" onClick={onClose}><X className="size-4" /></Button></div><form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-2"><div><label className="mb-2 block text-sm font-semibold">عنوان الكتاب</label><Input autoFocus value={title} onChange={event => setTitle(event.target.value)} className="h-11 rounded-xl bg-background" /></div><div><label className="mb-2 block text-sm font-semibold">المؤلف</label><Input value={author} onChange={event => setAuthor(event.target.value)} className="h-11 rounded-xl bg-background" /></div><div><label className="mb-2 block text-sm font-semibold">التصنيف</label><Input value={subject} onChange={event => setSubject(event.target.value)} className="h-11 rounded-xl bg-background" /></div><div><label className="mb-2 block text-sm font-semibold">إجمالي الصفحات</label><Input type="number" min="0" value={pages} onChange={event => setPages(event.target.value)} className="num h-11 rounded-xl bg-background" /></div><div><label className="mb-2 block text-sm font-semibold">لون الغلاف</label><Select value={color} onValueChange={setColor}><SelectTrigger className="h-11 rounded-xl bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="violet">بنفسجي</SelectItem><SelectItem value="emerald">زمردي</SelectItem><SelectItem value="amber">ذهبي</SelectItem><SelectItem value="sky">سماوي</SelectItem></SelectContent></Select></div><div className="sm:col-span-2"><label className="mb-2 block text-sm font-semibold">ملاحظات الكتاب</label><Textarea value={notes} onChange={event => setNotes(event.target.value)} className="min-h-24 rounded-xl bg-background" /></div><div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2"><Button type="button" variant="ghost" onClick={onDelete} className="rounded-xl text-destructive hover:text-destructive"><Trash2 className="size-4" />حذف الكتاب</Button><div className="flex gap-2"><Button type="button" variant="outline" onClick={onClose} className="rounded-xl">إلغاء</Button><Button disabled={loading} className="pressable rounded-xl bg-primary"><Save className="size-4" />حفظ التعديلات</Button></div></div></form></section>; }
function ChapterEditForm({ chapter, onClose, onSubmit, onDelete, loading }: { chapter: { title: string; totalPages: number; completedPages: number; notes: string | null }; onClose: () => void; onSubmit: (data: { title: string; totalPages: number; completedPages: number; notes: string | null }) => void; onDelete: () => void; loading: boolean }) { const [title, setTitle] = useState(chapter.title); const [totalPages, setTotalPages] = useState(String(chapter.totalPages)); const [completedPages, setCompletedPages] = useState(String(chapter.completedPages)); const [notes, setNotes] = useState(chapter.notes || ""); const submit = (event: FormEvent) => { event.preventDefault(); if (!title.trim()) return toast.error("اكتب عنوان الفصل."); onSubmit({ title: title.trim(), totalPages: Math.max(0, Number(totalPages) || 0), completedPages: Math.max(0, Number(completedPages) || 0), notes: notes.trim() || null }); }; return <form onSubmit={submit} className="sf-book-form enter mt-4 grid gap-3 rounded-xl border border-primary/15 bg-secondary/25 p-4 sm:grid-cols-2"><div><label className="mb-1.5 block text-xs font-semibold">عنوان الفصل</label><Input value={title} onChange={event => setTitle(event.target.value)} className="h-10 rounded-lg bg-background" /></div><div className="grid grid-cols-2 gap-2"><div><label className="mb-1.5 block text-xs font-semibold">إجمالي الصفحات</label><Input type="number" min="0" value={totalPages} onChange={event => setTotalPages(event.target.value)} className="num h-10 rounded-lg bg-background" /></div><div><label className="mb-1.5 block text-xs font-semibold">المكتمل</label><Input type="number" min="0" value={completedPages} onChange={event => setCompletedPages(event.target.value)} className="num h-10 rounded-lg bg-background" /></div></div><div className="sm:col-span-2"><label className="mb-1.5 block text-xs font-semibold">ملاحظات الفصل</label><Textarea value={notes} onChange={event => setNotes(event.target.value)} className="min-h-20 rounded-lg bg-background text-sm" /></div><div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2"><Button type="button" variant="ghost" onClick={onDelete} className="h-9 rounded-lg text-destructive hover:text-destructive"><Trash2 className="size-3.5" />حذف الفصل</Button><div className="flex gap-2"><Button type="button" size="sm" variant="outline" onClick={onClose} className="rounded-lg">إلغاء</Button><Button size="sm" disabled={loading} className="pressable rounded-lg bg-primary"><Save className="size-3.5" />حفظ</Button></div></div></form>; }
function ChapterForm({ onClose, onSubmit, loading }: { onClose: () => void; loading: boolean; onSubmit: (data: { title: string; totalPages: number }) => void }) { const [title, setTitle] = useState(""); const [pages, setPages] = useState("0"); const submit = (event: FormEvent) => { event.preventDefault(); if (!title.trim()) return toast.error("اكتب اسم الفصل."); onSubmit({ title: title.trim(), totalPages: Math.max(0, Number(pages) || 0) }); }; return <section className="enter app-card mb-6 p-5"><form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end"><div className="flex-1"><label className="mb-2 block text-sm font-semibold">اسم الفصل</label><Input autoFocus value={title} onChange={event => setTitle(event.target.value)} placeholder="مثال: الفصل الأول — المفاهيم الأساسية" className="h-11 rounded-xl bg-background" /></div><div className="sm:w-36"><label className="mb-2 block text-sm font-semibold">الصفحات</label><Input type="number" min="0" value={pages} onChange={event => setPages(event.target.value)} className="num h-11 rounded-xl bg-background" /></div><Button type="button" variant="outline" onClick={onClose} className="rounded-xl">إلغاء</Button><Button disabled={loading} className="pressable rounded-xl bg-primary">إضافة</Button></form></section>; }
