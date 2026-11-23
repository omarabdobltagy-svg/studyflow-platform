import { useAuth } from "@/_core/hooks/useAuth";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft, BarChart3, BookOpenText, BrainCircuit, CalendarDays, CheckSquare2,
  Clock3, Command, Goal, LayoutDashboard, LibraryBig, ListTodo, Moon, Pause, Play,
  Plus, RotateCcw, Search, Settings2, Sparkles, Timer, WandSparkles, X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useLocation } from "wouter";

type HubCommand = { id: string; label: string; description: string; path: string; icon: LucideIcon };
const commands: HubCommand[] = [
  { id: "home", label: "لوحة اليوم", description: "نظرة عامة على يومك ومساحتك", path: "/", icon: LayoutDashboard },
  { id: "tasks", label: "المهام", description: "راجع المهام وأنجز خطواتك", path: "/tasks", icon: CheckSquare2 },
  { id: "goals", label: "الأهداف", description: "تابع أهدافك وتقدمك", path: "/goals", icon: Goal },
  { id: "routines", label: "الروتين", description: "عاداتك اليومية ومتابعتها", path: "/routines", icon: Sparkles },
  { id: "calendar", label: "التقويم", description: "الأحداث والمواعيد القادمة", path: "/calendar", icon: CalendarDays },
  { id: "books", label: "المكتبة", description: "كتبك وفصولك ومرفقاتك", path: "/books", icon: LibraryBig },
  { id: "study", label: "المذاكرة والتقدم", description: "سجّل الدروس وتابع تقدمك", path: "/study", icon: BookOpenText },
  { id: "map", label: "خريطة المنهج", description: "موضعك وفجوات المنهج المسجلة", path: "/learning-map", icon: BrainCircuit },
  { id: "assistant", label: "المساعد الذكي", description: "اسأل وراجع أفكارك الدراسية", path: "/assistant", icon: WandSparkles },
  { id: "planner", label: "المخطط الذكي", description: "حوّل المطلوب إلى خطة قابلة للتنفيذ", path: "/planner", icon: ListTodo },
  { id: "analytics", label: "تحليل الأداء", description: "راجع مؤشرات تقدمك", path: "/analytics", icon: BarChart3 },
  { id: "reminders", label: "التذكيرات", description: "افتح قائمة التنبيهات", path: "/reminders", icon: Clock3 },
  { id: "settings", label: "الإعدادات", description: "إدارة ملفك الدراسي وحسابك", path: "/settings", icon: Settings2 },
];
const quickIds = ["tasks", "planner", "map", "assistant", "books"];
const FOCUS_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;
function formatTime(seconds: number) {
  const safe = Math.max(0, seconds);
  return String(Math.floor(safe / 60)).padStart(2, "0") + ":" + String(safe % 60).padStart(2, "0");
}

export default function WorkspaceInteractionHub() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const reduceMotion = useReducedMotion();
  const [quickOpen, setQuickOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [focusOpen, setFocusOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [timerMode, setTimerMode] = useState<"focus" | "break">("focus");
  const [remaining, setRemaining] = useState(FOCUS_SECONDS);
  const [endAt, setEndAt] = useState<number | null>(null);
  const [quickMenuPosition, setQuickMenuPosition] = useState<{ left: number; bottom: number; width: number; maxHeight: number } | null>(null);
  const completedEndAt = useRef<number | null>(null);
  const hubRef = useRef<HTMLDivElement | null>(null);
  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const filteredCommands = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("ar");
    if (!term) return commands;
    return commands.filter(item => (item.label + " " + item.description + " " + item.id).toLocaleLowerCase("ar").includes(term));
  }, [query]);
  const quickCommands = useMemo(() => commands.filter(item => quickIds.includes(item.id)), []);
  const closeAll = () => { setQuickOpen(false); setPaletteOpen(false); setFocusOpen(false); };
  const navigate = (path: string) => { setLocation(path); closeAll(); setQuery(""); setActiveIndex(0); };
  const openPalette = () => { setQuickOpen(false); setFocusOpen(false); setPaletteOpen(true); setQuery(""); setActiveIndex(0); };
  const openFocus = () => { setQuickOpen(false); setPaletteOpen(false); setFocusOpen(true); };

  useEffect(() => {
    if (!user) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === "k") {
        event.preventDefault();
        setQuickOpen(false); setFocusOpen(false); setPaletteOpen(true); setQuery(""); setActiveIndex(0);
      } else if ((event.metaKey || event.ctrlKey) && event.shiftKey && key === "f") {
        event.preventDefault();
        setQuickOpen(false); setPaletteOpen(false); setFocusOpen(true);
      } else if (event.key === "Escape") {
        const restoreToolsFocus = quickOpen;
        setQuickOpen(false); setPaletteOpen(false); setFocusOpen(false);
        if (restoreToolsFocus) window.requestAnimationFrame(() => launcherRef.current?.focus());
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [quickOpen, user]);

  // Anchor the popover to the real trigger's viewport position, including mobile layouts.
  useLayoutEffect(() => {
    if (!quickOpen) {
      setQuickMenuPosition(null);
      return;
    }
    const updatePosition = () => {
      const trigger = launcherRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
      const compact = viewportWidth <= 1120;
      const width = Math.min(compact ? 310 : 330, viewportWidth - (compact ? 24 : 28));

      // The launcher is the left-most action in this RTL row. Align the popover's
      // right edge with the trigger so the panel opens inward, not away from it.
      const preferredLeft = rect.right - width;
      const left = Math.max(14, Math.min(viewportWidth - width - 14, preferredLeft));
      const maxHeight = Math.max(180, Math.min(430, rect.top - 24));

      setQuickMenuPosition({
        left,
        bottom: Math.max(14, window.innerHeight - rect.top + 12),
        width,
        maxHeight,
      });
    };

    const visualViewport = window.visualViewport;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("orientationchange", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    visualViewport?.addEventListener("resize", updatePosition);
    visualViewport?.addEventListener("scroll", updatePosition);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("orientationchange", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      visualViewport?.removeEventListener("resize", updatePosition);
      visualViewport?.removeEventListener("scroll", updatePosition);
    };
  }, [quickOpen]);

  // Close the tools panel on an outside tap; touches and mouse clicks share Pointer Events.
  useEffect(() => {
    if (!quickOpen) return;
    const onOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && hubRef.current && !hubRef.current.contains(target)) {
        setQuickOpen(false);
      }
    };
    document.addEventListener("pointerdown", onOutsidePointer);
    return () => document.removeEventListener("pointerdown", onOutsidePointer);
  }, [quickOpen]);

  useEffect(() => {
    if (endAt === null) return;
    const update = () => {
      const next = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setRemaining(next);
      if (next === 0 && completedEndAt.current !== endAt) {
        completedEndAt.current = endAt;
        setEndAt(null);
        toast.success(timerMode === "focus" ? "انتهت جلسة التركيز" : "انتهت الاستراحة", {
          description: timerMode === "focus" ? "خذ استراحة قصيرة قبل الجلسة التالية." : "ارجع إلى خطوتك التالية عندما تكون جاهزًا.",
        });
      }
    };
    update();
    const timerId = window.setInterval(update, 1000);
    return () => window.clearInterval(timerId);
  }, [endAt, timerMode]);

  useEffect(() => { if (paletteOpen) setActiveIndex(0); }, [query, paletteOpen]);
  const duration = timerMode === "focus" ? FOCUS_SECONDS : BREAK_SECONDS;
  const progress = Math.min(1, Math.max(0, 1 - remaining / duration));
  const circumference = 2 * Math.PI * 67;
  const isRunning = endAt !== null;
  const startTimer = () => { if (remaining > 0) setEndAt(Date.now() + remaining * 1000); };
  const pauseTimer = () => {
    if (endAt === null) return;
    setRemaining(Math.max(0, Math.ceil((endAt - Date.now()) / 1000)));
    setEndAt(null);
  };
  const resetTimer = () => { setEndAt(null); setRemaining(duration); };
  const changeTimerMode = (mode: "focus" | "break") => {
    setTimerMode(mode); setEndAt(null); setRemaining(mode === "focus" ? FOCUS_SECONDS : BREAK_SECONDS);
  };
  const chooseCommand = (item: HubCommand) => navigate(item.path);
  const handlePaletteKeys = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex(index => Math.min(filteredCommands.length - 1, index + 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex(index => Math.max(0, index - 1)); }
    else if (event.key === "Enter" && filteredCommands[activeIndex]) { event.preventDefault(); chooseCommand(filteredCommands[activeIndex]); }
  };

  if (!user) return null;
  return createPortal(
    <>
      <div ref={hubRef} className="sf-hub-root" dir="rtl">
        <AnimatePresence>
          {quickOpen && (
            <motion.section id="sf-hub-quick-menu" className="sf-hub-quick-menu" role="region" aria-label="الإجراءات السريعة"
              style={quickMenuPosition ? {
                position: "fixed",
                left: quickMenuPosition.left,
                bottom: quickMenuPosition.bottom,
                width: quickMenuPosition.width,
                maxHeight: quickMenuPosition.maxHeight,
                transformOrigin: "bottom right",
              } : undefined}
              initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: 10, scale: 0.96 }} transition={{ type: "spring", stiffness: 340, damping: 26 }}>
              <div className="sf-hub-menu-heading"><span><Sparkles size={15} /> اختصارات مساحتك</span><small>انتقل مباشرة</small></div>
              <div className="sf-hub-quick-grid">
                {quickCommands.map((item, index) => (
                  <motion.button key={item.id} type="button" className="sf-hub-quick-item" onClick={() => chooseCommand(item)}
                    initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: reduceMotion ? 0 : index * 0.035 }} whileHover={reduceMotion ? undefined : { y: -2 }}
                    whileTap={reduceMotion ? undefined : { scale: 0.97 }}>
                    <span className="sf-hub-quick-icon"><item.icon size={17} /></span><span>{item.label}</span><ArrowLeft size={13} className="sf-hub-quick-arrow" />
                  </motion.button>
                ))}
              </div>
              <div className="sf-hub-menu-tools">
                <button type="button" onClick={openPalette}><Search size={15} /> بحث وتنقل <kbd>Ctrl K</kbd></button>
                <button type="button" onClick={openFocus}><Timer size={15} /> جلسة تركيز <kbd>25:00</kbd></button>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        <div className="sf-hub-launcher-row">
          <motion.button type="button" className="sf-hub-search-button" onClick={openPalette} aria-label="فتح البحث والتنقل السريع"
            title="بحث وتنقل سريع — Ctrl K" whileHover={reduceMotion ? undefined : { y: -3, scale: 1.04 }} whileTap={reduceMotion ? undefined : { scale: 0.94 }}>
            <Search size={18} /><span>بحث</span><kbd>⌘ K</kbd>
          </motion.button>
          <motion.button type="button" className="sf-hub-timer-button" onClick={openFocus} aria-label="فتح مؤقت التركيز"
            title="جلسة تركيز — Ctrl Shift F" whileHover={reduceMotion ? undefined : { y: -3, scale: 1.04 }} whileTap={reduceMotion ? undefined : { scale: 0.94 }}>
            <Timer size={18} /><span>{isRunning ? formatTime(remaining) : "تركيز"}</span>{isRunning && <i aria-label="المؤقت يعمل" />}
          </motion.button>
          <motion.button ref={launcherRef} type="button" className="sf-hub-launcher" onClick={() => setQuickOpen(value => !value)}
            aria-controls="sf-hub-quick-menu" aria-expanded={quickOpen} aria-pressed={quickOpen}
            aria-label={quickOpen ? "إغلاق أدوات StudyFlow" : "فتح أدوات StudyFlow"}
            whileHover={reduceMotion ? undefined : { y: -4, rotate: -2 }} whileTap={reduceMotion ? undefined : { scale: 0.94 }}
            transition={{ type: "spring", stiffness: 360, damping: 20 }}>
            <motion.span animate={{ rotate: quickOpen ? 45 : 0 }} transition={{ type: "spring", stiffness: 300, damping: 18 }}>
              {quickOpen ? <X size={21} /> : <Plus size={21} />}
            </motion.span><span>{quickOpen ? "إغلاق" : "أدوات"}</span>
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {paletteOpen && (
          <motion.div className="sf-command-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onMouseDown={event => { if (event.target === event.currentTarget) setPaletteOpen(false); }}>
            <motion.section className="sf-command-panel" role="dialog" aria-modal="true" aria-labelledby="sf-command-title" dir="rtl"
              initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: 12, scale: 0.98 }} transition={{ type: "spring", stiffness: 320, damping: 28 }}>
              <header className="sf-command-header">
                <span className="sf-command-mark"><Command size={17} /></span>
                <div><h2 id="sf-command-title">التنقل السريع</h2><p>اكتب اسم الصفحة أو القسم الذي تريد فتحه.</p></div><kbd>ESC</kbd>
              </header>
              <div className="sf-command-search"><Search size={18} />
                <input autoFocus value={query} onChange={event => setQuery(event.target.value)} onKeyDown={handlePaletteKeys}
                  placeholder="ابحث عن المهام، المكتبة، الخريطة..." aria-label="ابحث عن صفحة"
                  aria-activedescendant={filteredCommands.length ? "sf-command-" + activeIndex : undefined} />
                <kbd>↵</kbd>
              </div>
              <div className="sf-command-list" role="listbox" aria-label="نتائج التنقل">
                {filteredCommands.length ? filteredCommands.map((item, index) => (
                  <button id={"sf-command-" + index} key={item.id} type="button" role="option" aria-selected={activeIndex === index}
                    className={"sf-command-item" + (activeIndex === index ? " is-active" : "")}
                    onMouseEnter={() => setActiveIndex(index)} onClick={() => chooseCommand(item)}>
                    <span className="sf-command-item-icon"><item.icon size={17} /></span>
                    <span className="sf-command-item-copy"><b>{item.label}</b><small>{item.description}</small></span>
                    <ArrowLeft size={15} className="sf-command-item-arrow" />
                  </button>
                )) : <div className="sf-command-empty"><Search size={19} /><b>مفيش صفحة مطابقة</b><span>جرّب كلمة أقصر أو اسم قسم مختلف.</span></div>}
              </div>
              <footer className="sf-command-footer"><span><kbd>↑</kbd><kbd>↓</kbd> للتنقل</span><span><kbd>Enter</kbd> للفتح</span><span><kbd>Esc</kbd> للإغلاق</span></footer>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {focusOpen && (
          <motion.div className="sf-focus-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onMouseDown={event => { if (event.target === event.currentTarget) setFocusOpen(false); }}>
            <motion.section className="sf-focus-panel" role="dialog" aria-modal="true" aria-labelledby="sf-focus-title" dir="rtl"
              initial={reduceMotion ? false : { opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: 12, scale: 0.98 }} transition={{ type: "spring", stiffness: 300, damping: 25 }}>
              <header className="sf-focus-header">
                <div><span className="sf-focus-kicker">STUDYFLOW / FOCUS MODE</span><h2 id="sf-focus-title">مساحة تركيز هادئة</h2><p>جلسة واضحة، ثم استراحة قصيرة.</p></div>
                <button type="button" onClick={() => setFocusOpen(false)} aria-label="إغلاق مؤقت التركيز"><X size={19} /></button>
              </header>
              <div className="sf-focus-mode-switch" role="group" aria-label="نوع الجلسة">
                <button type="button" aria-pressed={timerMode === "focus"} onClick={() => changeTimerMode("focus")}>تركيز · 25 دقيقة</button>
                <button type="button" aria-pressed={timerMode === "break"} onClick={() => changeTimerMode("break")}>استراحة · 5 دقائق</button>
              </div>
              <div className="sf-focus-clock">
                <svg viewBox="0 0 160 160" aria-hidden="true">
                  <circle cx="80" cy="80" r="67" fill="none" stroke="rgba(208,202,195,.17)" strokeWidth="5" />
                  <circle cx="80" cy="80" r="67" fill="none" stroke="#C7A98F" strokeWidth="5" strokeLinecap="round"
                    strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} transform="rotate(-90 80 80)" />
                </svg>
                <div className="sf-focus-clock-copy"><strong role="timer" aria-live="off">{formatTime(remaining)}</strong>
                  <span>{isRunning ? "الجلسة تعمل الآن" : remaining === 0 ? "انتهى الوقت" : "جاهز للبدء"}</span></div>
              </div>
              <div className="sf-focus-controls">
                {isRunning ? <button type="button" className="sf-focus-primary" onClick={pauseTimer}><Pause size={17} /> إيقاف مؤقت</button>
                  : <button type="button" className="sf-focus-primary" onClick={startTimer} disabled={remaining === 0}><Play size={17} /> ابدأ الجلسة</button>}
                <button type="button" className="sf-focus-reset" onClick={resetTimer}><RotateCcw size={16} /> إعادة ضبط</button>
              </div>
              <p className="sf-focus-footnote"><Moon size={14} /> المؤقت يستمر أثناء انتقالك بين صفحات StudyFlow.</p>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    document.body
  );
}
