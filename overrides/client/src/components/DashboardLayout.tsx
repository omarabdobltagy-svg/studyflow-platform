import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import QueryErrorNotice from "@/components/QueryErrorNotice";
import BrandMark from "@/components/BrandMark";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import StudyOrbScene from "@/components/StudyOrbScene";
import { gsap } from "gsap";
import { useTheme } from "@/contexts/ThemeContext";
import {
  BarChart3, BookOpenCheck, BookOpenText, BrainCircuit, CalendarDays, CalendarRange, MessageCircle, Network, X as XIcon,
  CheckSquare2, ChevronLeft, Goal, LayoutDashboard, LibraryBig, LogOut,
  Menu, Moon, Settings2, Sparkles, Sun,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

type NavigationGroup = {
  label: string;
  items: { label: string; path: string; icon: typeof LayoutDashboard }[];
};

const navigation: NavigationGroup[] = [
  { label: "مساحة اليوم", items: [
    { label: "لوحة اليوم", path: "/", icon: LayoutDashboard },
    { label: "المهام", path: "/tasks", icon: CheckSquare2 },
    { label: "روتيني", path: "/routines", icon: Sparkles },
    { label: "التقويم", path: "/calendar", icon: CalendarDays },
  ] },
  { label: "التعلّم", items: [
    { label: "المكتبة", path: "/books", icon: LibraryBig },
    { label: "المذاكرة والتقدم", path: "/study", icon: BookOpenText },
    { label: "جلسة SQ3R", path: "/sq3r", icon: BookOpenCheck },
    { label: "خريطة المنهج", path: "/learning-map", icon: Network },
    { label: "المساعد الدراسي الذكي", path: "/assistant", icon: MessageCircle },
  ] },
  { label: "التخطيط", items: [
    { label: "الأهداف", path: "/goals", icon: Goal },
    { label: "المخطط الذكي", path: "/planner", icon: CalendarRange },
    { label: "تحليل الأداء", path: "/analytics", icon: BarChart3 },
  ] },
  { label: "إدارة المساحة", items: [
    { label: "التذكيرات", path: "/reminders", icon: CalendarDays },
    { label: "الملف الدراسي", path: "/settings", icon: Settings2 },
  ] },
];

type DashboardLayoutProps = {
  title: string;
  description: string;
  children: ReactNode;
  action?: ReactNode;
};

export default function DashboardLayout({ title, description, children, action }: DashboardLayoutProps) {
  const { user, loading, logout, error: authError, refresh: refreshAuth } = useAuth();
  const trpcUtils = trpc.useUtils();
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [registerName, setRegisterName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authFormError, setAuthFormError] = useState("");
  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (authenticatedUser) => {
      trpcUtils.auth.me.setData(undefined, authenticatedUser);
      void trpcUtils.invalidate();
    },
  });
  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: (authenticatedUser) => {
      trpcUtils.auth.me.setData(undefined, authenticatedUser);
      void trpcUtils.invalidate();
    },
  });
  const [location, setLocation] = useLocation();
  const [isMobileNavOpen, setMobileNavOpen] = useState(false);
  const [showLogoutConfirm,setShowLogoutConfirm]=useState(false);
  const pageContentRef = useRef<HTMLDivElement>(null);
  // Keep the top dock focused on the few destinations students use every day.
  // The full navigation remains available in the sidebar and the mobile "sections" sheet.
  const desktopDockItems = [
    { label: "اليوم", path: "/", icon: LayoutDashboard, group: "مساحة اليوم" },
    { label: "المهام", path: "/tasks", icon: CheckSquare2, group: "مساحة اليوم" },
    { label: "المذاكرة", path: "/study", icon: BookOpenText, group: "التعلّم" },
    { label: "المساعد", path: "/assistant", icon: MessageCircle, group: "التعلّم" },
    { label: "الخطة", path: "/planner", icon: CalendarRange, group: "التخطيط" },
  ];
  const studentProfile = trpc.studentProfile.get.useQuery(undefined, { enabled: Boolean(user) });
  const { theme, toggleTheme } = useTheme();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion || !pageContentRef.current) return;
    const context = gsap.context(() => {
      const headings = gsap.utils.toArray<HTMLElement>(".sf-main h1, .sf-main h2, .sf-main .eyebrow");
      const cards = gsap.utils.toArray<HTMLElement>(".sf-main .app-card");
      if (headings.length) gsap.fromTo(headings, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.035, ease: "power3.out", clearProps: "transform,opacity" });
      if (cards.length) gsap.fromTo(cards, { y: 17, opacity: 0 }, { y: 0, opacity: 1, duration: 0.58, stagger: 0.055, ease: "power3.out", delay: 0.04, clearProps: "transform,opacity" });
    }, pageContentRef);
    return () => context.revert();
  }, [location, reduceMotion]);

  useEffect(() => {
    if (user && studentProfile.isSuccess && studentProfile.data == null && location !== "/onboarding") {
      setLocation("/onboarding");
    }
  }, [location, setLocation, studentProfile.data, studentProfile.isSuccess, user]);

  if (loading) return (
    <div className="sf-auth-screen sf-shell-v3">
      <div className="sf-auth-frame sf-auth-loading" role="status" aria-live="polite">
        <div className="sf-auth-logo"><BrandMark className="size-7" /></div>
        <p className="sf-auth-eyebrow">STUDYFLOW / YOUR SPACE</p>
        <h1>نجهّز مساحتك الدراسية</h1>
        <p>يتم تحميل بيانات مساحتك الآن.</p>
        <div className="sf-loading-line" />
      </div>
    </div>
  );

  if (!user && authError) return (
    <div className="sf-auth-screen">
      <div className="sf-auth-frame sf-auth-error">
        <div className="sf-auth-logo"><BrandMark className="size-7" /></div>
        <QueryErrorNotice onRetry={() => void refreshAuth()} label="تعذّر التحقق من جلسة الدخول. لم يتم تسجيل خروجك؛ أعد المحاولة." />
      </div>
    </div>
  );

  if (!user) return (
    <div className="sf-login-screen sf-shell-v3">
      <div className="sf-login-graphic-fallback" aria-hidden="true">
        <svg className="sf-login-graphic-svg" viewBox="0 0 760 760" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="sfOrbCore" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(380 370) rotate(90) scale(170)">
              <stop offset="0" stopColor="#F2F0D9"/>
              <stop offset=".18" stopColor="#D9EF8C"/>
              <stop offset=".52" stopColor="#A8C84E"/>
              <stop offset=".82" stopColor="#536B32"/>
              <stop offset="1" stopColor="#1D2A18" stopOpacity=".2"/>
            </radialGradient>
            <radialGradient id="sfOrbGlow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(380 370) rotate(90) scale(220)">
              <stop stopColor="#C9ED62" stopOpacity=".22"/>
              <stop offset="1" stopColor="#C9ED62" stopOpacity="0"/>
            </radialGradient>
            <linearGradient id="sfOrbRing" x1="95" y1="300" x2="670" y2="475" gradientUnits="userSpaceOnUse">
              <stop stopColor="#D1B77B" stopOpacity="0"/>
              <stop offset=".32" stopColor="#D1B77B" stopOpacity=".8"/>
              <stop offset=".68" stopColor="#C9ED62" stopOpacity=".65"/>
              <stop offset="1" stopColor="#C9ED62" stopOpacity="0"/>
            </linearGradient>
            <filter id="sfOrbBlur" x="30" y="20" width="700" height="700" filterUnits="userSpaceOnUse">
              <feGaussianBlur stdDeviation="28"/>
            </filter>
          </defs>
          <circle cx="380" cy="370" r="238" fill="url(#sfOrbGlow)" filter="url(#sfOrbBlur)"/>
          <g data-sf-orbit>
            <ellipse cx="380" cy="370" rx="286" ry="104" transform="rotate(-27 380 370)" stroke="url(#sfOrbRing)" strokeWidth="1.5"/>
            <ellipse cx="380" cy="370" rx="250" ry="76" transform="rotate(43 380 370)" stroke="#D1B77B" strokeOpacity=".44" strokeWidth="1"/>
            <path d="M120 476C230 350 464 282 650 328" stroke="#C9ED62" strokeOpacity=".38" strokeWidth="1"/>
            <path d="M126 258C296 143 531 202 657 391" stroke="#E8E3D1" strokeOpacity=".24" strokeWidth="1"/>
          </g>
          <g data-sf-float>
            <circle cx="380" cy="370" r="150" fill="url(#sfOrbCore)" stroke="#E8F4B9" strokeOpacity=".48"/>
            <path d="M286 296C321 236 397 215 455 245" stroke="#FFFFFF" strokeOpacity=".58" strokeWidth="7" strokeLinecap="round"/>
            <path d="M254 393C286 480 379 531 467 489" stroke="#314422" strokeOpacity=".58" strokeWidth="16" strokeLinecap="round"/>
            <path d="M380 220L430 285L380 370L315 300Z" fill="#F5F4DD" fillOpacity=".12"/>
            <path d="M380 370L430 285L505 345L468 449Z" fill="#13200F" fillOpacity=".25"/>
            <path d="M380 370L315 300L258 385L334 468Z" fill="#EAF3CC" fillOpacity=".08"/>
            <circle cx="332" cy="278" r="5" fill="#FFFFFF" fillOpacity=".7"/>
            <circle cx="476" cy="435" r="3" fill="#D1B77B"/>
          </g>
          <g fill="#DCE8B7">
            <circle cx="139" cy="343" r="3"/><circle cx="178" cy="517" r="2"/>
            <circle cx="584" cy="238" r="3"/><circle cx="626" cy="489" r="2.5"/>
            <circle cx="524" cy="580" r="2"/><circle cx="258" cy="153" r="2"/>
            <circle cx="680" cy="355" r="1.8"/><circle cx="85" cy="407" r="1.8"/>
          </g>
        </svg>
      </div>
      <StudyOrbScene className="sf-login-3d" />
      <div className="sf-login-frame sf-login-frame-v4">
        <section className="sf-login-form-side">
          <div className="sf-login-form-card">
            <div className="sf-login-brand-v4">
              <span className="sf-login-brand-mark-v4"><BrandMark className="size-5" /></span>
              <span><b>StudyFlow</b><small>مساحة التعلّم</small></span>
            </div>
            <div className="sf-login-form-heading">
              <p className="sf-auth-eyebrow">{authMode === "register" ? "إنشاء حساب جديد" : "الدخول إلى مساحة العمل"}</p>
              <h2>{authMode === "register" ? "ابدأ مساحتك الدراسية" : "أهلًا بعودتك"}</h2>
              <p>{authMode === "register" ? "أنشئ حسابًا مستقلًا لحفظ خطتك وبياناتك وتقدمك." : "سجّل الدخول للوصول إلى مساحتك الدراسية وبياناتك المحفوظة."}</p>
            </div>
            <div className="sf-auth-mode-tabs" role="tablist" aria-label="نوع الدخول">
              <button type="button" role="tab" aria-selected={authMode === "login"} aria-pressed={authMode === "login"} onClick={() => { setAuthMode("login"); setAuthFormError(""); }}>تسجيل الدخول</button>
              <button type="button" role="tab" aria-selected={authMode === "register"} aria-pressed={authMode === "register"} onClick={() => { setAuthMode("register"); setAuthFormError(""); }}>إنشاء حساب</button>
            </div>
            <form onSubmit={(event) => {
              event.preventDefault(); setAuthFormError("");
              if (authMode === "register") {
                if (loginPassword.length < 10) { setAuthFormError("كلمة المرور يجب ألا تقل عن 10 أحرف."); return; }
                if (loginPassword !== confirmPassword) { setAuthFormError("كلمتا المرور غير متطابقتين."); return; }
                registerMutation.mutate({ name: registerName, username: loginUsername, password: loginPassword }); return;
              }
              loginMutation.mutate({ username: loginUsername, password: loginPassword });
            }} className="sf-login-form">
              {authMode === "register" && <div className="space-y-2">
                <Label htmlFor="studyflow-register-name">الاسم الظاهر</Label>
                <Input id="studyflow-register-name" value={registerName} onChange={event => setRegisterName(event.target.value)} autoComplete="name" placeholder="اكتب اسمك" required maxLength={80} className="sf-auth-input" />
              </div>}
              <div className="space-y-2">
                <Label htmlFor="studyflow-username">اسم المستخدم</Label>
                <Input id="studyflow-username" value={loginUsername} onChange={event => setLoginUsername(event.target.value)} autoComplete="username" placeholder="مثال: omar_2026" required minLength={3} maxLength={32} pattern="[A-Za-z0-9._-]{3,32}" title="استخدم أحرفًا إنجليزية أو أرقامًا أو نقطة أو شرطة سفلية." dir="ltr" className="sf-auth-input text-left" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="studyflow-password">كلمة المرور</Label>
                <Input id="studyflow-password" type="password" value={loginPassword} onChange={event => setLoginPassword(event.target.value)} autoComplete={authMode === "register" ? "new-password" : "current-password"} placeholder={authMode === "register" ? "10 أحرف على الأقل" : "اكتب كلمة المرور"} required minLength={authMode === "register" ? 10 : 1} className="sf-auth-input" />
              </div>
              {authMode === "register" && <div className="space-y-2">
                <Label htmlFor="studyflow-confirm-password">تأكيد كلمة المرور</Label>
                <Input id="studyflow-confirm-password" type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} autoComplete="new-password" placeholder="أعد كتابة كلمة المرور" required minLength={10} className="sf-auth-input" />
              </div>}
              {(authFormError || (authMode === "register" ? registerMutation.error?.message : loginMutation.error?.message)) && <p role="alert" className="sf-auth-error-message">{authFormError || (authMode === "register" ? registerMutation.error?.message : loginMutation.error?.message)}</p>}
              <Button type="submit" disabled={loginMutation.isPending || registerMutation.isPending} size="lg" className="sf-auth-submit pressable w-full rounded-2xl font-bold">
                {registerMutation.isPending ? "جارٍ إنشاء الحساب..." : loginMutation.isPending ? "جارٍ تسجيل الدخول..." : authMode === "register" ? "إنشاء حساب" : "دخول"}
                <ChevronLeft className="size-4" />
              </Button>
            </form>
            <button type="button" className="sf-auth-mode-switch" onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setAuthFormError(""); }}>
              {authMode === "login" ? "ليس لديك حساب؟ أنشئ حسابًا جديدًا" : "لديك حساب بالفعل؟ سجّل الدخول"}
            </button>
            <div className="sf-login-security"><span className="sf-security-mark"><span /></span><p>بيانات حسابك وملفك الدراسي محفوظة بشكل مستقل.</p></div>
          </div>
        </section>
      </div>
    </div>
  );

  const initial = user.name?.trim().charAt(0) || "م";
  const currentPath = location.split("?")[0];
  const isActive = (path: string) => path === "/" ? currentPath === "/" : currentPath === path || currentPath.startsWith(path + "/");
  const navigate = (path: string) => {
    setLocation(path);
    setMobileNavOpen(false);
  };

  const pageKey = (location.split("?")[0].split("/")[1] || "home").replace(/[^a-z0-9-]/gi, "");
  const mobileDockItems = [
    { label: "اليوم", path: "/", icon: LayoutDashboard },
    { label: "المهام", path: "/tasks", icon: CheckSquare2 },
    { label: "المذاكرة", path: "/study", icon: BookOpenText },
    { label: "الخريطة", path: "/learning-map", icon: BrainCircuit },
  ];

  const renderNavigation = (mobile = false) => (
    <nav className={cn("sf-nav-list", mobile && "sf-nav-list-mobile")} aria-label="التنقل الرئيسي">
      {navigation.map(group => (
        <section key={group.label} className="sf-nav-group">
          <h2>{group.label}</h2>
          <div className="sf-nav-items">
            {group.items.map(item => {
              const active = isActive(item.path);
              return (
                <motion.button
                  key={item.path}
                  type="button"
                  onClick={() => navigate(item.path)}
                  aria-current={active ? "page" : undefined}
                  className={cn("sf-nav-item pressable", active && "is-active")}
                  aria-label={item.label}
                  title={item.label}
                  whileHover={{ x: -3 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <item.icon className="sf-nav-icon" />
                  <span>{item.label}</span>
                  {active && <motion.span layoutId="sf-sheet-active" className="sf-nav-indicator" />}
                </motion.button>
              );
            })}
          </div>
        </section>
      ))}
    </nav>
  );

  const account = (
    <div className="sf-account">
      <span className="sf-account-avatar">{initial}</span>
      <div className="sf-account-copy">
        <b>{user.name || "مستخدم التطبيق"}</b>
        <span>مساحتك الشخصية</span>
      </div>
      <Button variant="ghost" size="icon" onClick={() => setShowLogoutConfirm(true)} className="sf-account-logout" aria-label="تسجيل الخروج" title="تسجيل الخروج">
        <LogOut className="size-4" />
      </Button>
    </div>
  );

  return (
    <div className="sf-app-shell sf-shell-v3">
      <div className="sf-app-frame" data-page={pageKey}>
        <StudyOrbScene className="sf-workspace-3d" />
        <div className="sf-app-main">
          <motion.header
            className="sf-topbar sf-topbar-editorial"
            initial={reduceMotion ? false : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 25 }}
          >
            <div className="sf-header-start">
              <button onClick={() => navigate("/")} className="sf-brand" aria-label="العودة إلى لوحة اليوم">
                <span className="sf-brand-mark"><BrandMark className="size-5" /></span>
                <span className="sf-brand-copy"><b>StudyFlow</b><small>STUDENT WORKSPACE</small></span>
              </button>
              <span className="sf-header-divider" />
              <div className="sf-heading-copy">
                <p className="sf-topbar-kicker">مساحة الدراسة <span>/</span> STUDYFLOW</p>
                <h1>{title}</h1>
                <p className="sf-page-description">{description}</p>
              </div>
            </div>

            <nav className="sf-desktop-dock" aria-label="التنقل السريع">
              {desktopDockItems.map(item => {
                const active = isActive(item.path);
                return (
                  <motion.button
                    key={item.path}
                    type="button"
                    className={cn("sf-dock-item", active && "is-active")}
                    onClick={() => navigate(item.path)}
                    aria-label={item.label}
                    aria-current={active ? "page" : undefined}
                    whileHover={{ y: -5, scale: 1.05 }}
                    whileTap={{ scale: 0.92 }}
                    transition={{ type: "spring", stiffness: 340, damping: 18 }}
                  >
                    <span className="sf-dock-icon"><item.icon size={18} strokeWidth={1.8} /></span>
                    <span className="sf-dock-tooltip"><b>{item.label}</b><small>{item.group}</small></span>
                    {active && <motion.i layoutId="sf-active-dock" className="sf-dock-active" transition={{ type: "spring", stiffness: 380, damping: 28 }} />}
                  </motion.button>
                );
              })}
            </nav>

            <div className="sf-topbar-actions">
              {action ? <div className="dashboard-header-actions">{action}</div> : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="sf-sections-trigger hidden md:inline-flex"
                onClick={() => setMobileNavOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={isMobileNavOpen}
                aria-label="عرض كل أقسام StudyFlow"
              >
                <Menu className="size-4" />
                <span>كل الأقسام</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="sf-theme-button pressable"
                onClick={toggleTheme}
                aria-label={theme === "dark" ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الداكن"}
                title={theme === "dark" ? "الوضع الفاتح" : "الوضع الداكن"}
              >
                {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </Button>
              <span className="sf-topbar-avatar" aria-label={user.name || "ملف الطالب"}>{initial}</span>
            </div>
          </motion.header>

          <AnimatePresence mode="wait" initial={false}>
            <motion.main
              key={location}
              className={"sf-main sf-main-" + pageKey}
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: reduceMotion ? 0 : 0.34, ease: [0.22, 1, 0.36, 1] }}
            >
              <div ref={pageContentRef} className={"sf-page sf-page-" + pageKey} data-page={pageKey}>
                {studentProfile.isError && (
                  <QueryErrorNotice onRetry={() => void studentProfile.refetch()} label="تعذّر التحقق من ملفك الدراسي. بياناتك لم تُحذف؛ أعد المحاولة." />
                )}
                {children}
              </div>
            </motion.main>
          </AnimatePresence>
        </div>
      </div>

      <nav className="sf-mobile-dock" aria-label="التنقل السريع">
        {mobileDockItems.map(item => {
          const active = isActive(item.path);
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => navigate(item.path)}
              aria-current={active ? "page" : undefined}
              className={cn("sf-mobile-dock-item", active && "is-active")}
            >
              <item.icon className="size-[18px]" />
              <span>{item.label}</span>
            </button>
          );
        })}
        <button type="button" className="sf-mobile-dock-item" onClick={() => setMobileNavOpen(true)} aria-label="عرض كل الأقسام">
          <Menu className="size-[18px]" />
          <span>الأقسام</span>
        </button>
      </nav>

      {showLogoutConfirm&&<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setShowLogoutConfirm(false);}}>
        <section role="alertdialog" aria-modal="true" aria-labelledby="sf-logout-title" className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-3"><div><p className="eyebrow">STUDYFLOW / ACCOUNT</p><h2 id="sf-logout-title" className="mt-1 text-lg font-bold">تسجيل الخروج</h2></div><Button type="button" variant="ghost" size="icon" onClick={()=>setShowLogoutConfirm(false)} aria-label="إغلاق"><XIcon className="size-4"/></Button></div>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">متأكد إنك عايز تسجل خروج؟ بياناتك وخطتك هتفضل محفوظة، وتقدر ترجع لها لما تسجل الدخول تاني.</p>
          <div className="mt-5 flex gap-2"><Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={()=>setShowLogoutConfirm(false)}>إلغاء</Button><Button type="button" className="flex-1 rounded-xl" onClick={()=>{setShowLogoutConfirm(false);void logout();}}>تأكيد الخروج</Button></div>
        </section>
      </div>}
            <Sheet open={isMobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="bottom" className="sf-mobile-sheet rounded-t-3xl border-x-0 border-b-0 p-0 text-sidebar-foreground">
          <SheetHeader className="sf-mobile-sheet-header">
            <SheetTitle>كل أقسام StudyFlow</SheetTitle>
            <SheetDescription>اختر المساحة التي تريد الانتقال إليها.</SheetDescription>
          </SheetHeader>
          <div className="sf-mobile-sheet-body">
            {renderNavigation(true)}
            {account}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
