import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import QueryErrorNotice from "@/components/QueryErrorNotice";
import BrandMark from "@/components/BrandMark";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { useTheme } from "@/contexts/ThemeContext";
import {
  BarChart3, BookOpenCheck, BookOpenText, BrainCircuit, CalendarDays,
  CheckSquare2, ChevronLeft, Goal, LayoutDashboard, LibraryBig, LogOut,
  Menu, Moon, Settings2, Sparkles, Sun,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ReactNode, useEffect, useState } from "react";
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
    { label: "المساعد الذكي", path: "/assistant", icon: BrainCircuit },
  ] },
  { label: "التخطيط", items: [
    { label: "الأهداف", path: "/goals", icon: Goal },
    { label: "المخطط الذكي", path: "/planner", icon: BookOpenCheck },
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
  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (authenticatedUser) => {
      trpcUtils.auth.me.setData(undefined, authenticatedUser);
      void trpcUtils.invalidate();
    },
  });
  const [location, setLocation] = useLocation();
  const [isMobileNavOpen, setMobileNavOpen] = useState(false);
  const studentProfile = trpc.studentProfile.get.useQuery(undefined, { enabled: Boolean(user) });
  const { theme, toggleTheme } = useTheme();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (user && studentProfile.isSuccess && studentProfile.data == null && location !== "/onboarding") {
      setLocation("/onboarding");
    }
  }, [location, setLocation, studentProfile.data, studentProfile.isSuccess, user]);

  if (loading) return (
    <div className="sf-auth-screen">
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
    <div className="sf-login-screen">
      <div className="sf-login-frame">
        <section className="sf-login-story">
          <div className="sf-login-brand">
            <span className="sf-login-brand-mark"><BrandMark className="size-6" /></span>
            <span><b>StudyFlow</b><small>LEARNING, WITH CLARITY</small></span>
          </div>

          <div className="sf-login-copy">
            <p className="sf-login-eyebrow">YOUR LEARNING SPACE</p>
            <h1>كل يوم أوضح.
              <span>وكل خطوة لها أثر.</span>
            </h1>
            <p className="sf-login-description">
              خطتك، مهامك، تقدمك، وموادك الدراسية في مساحة واحدة. نظرة واضحة على ما أنجزته، وما يستحق تركيزك بعد ذلك.
            </p>
            <div className="sf-login-pill-list">
              <span><CheckSquare2 /> متابعة المهام</span>
              <span><BookOpenText /> تنظيم التعلّم</span>
              <span><BarChart3 /> قياس التقدم</span>
            </div>
          </div>

          <div className="sf-login-story-footer">
            <span className="sf-login-footer-line" />
            <span>STUDYFLOW · BUILT AROUND YOUR PROGRESS</span>
          </div>
          <div className="sf-login-shape sf-login-shape-one" aria-hidden="true" />
          <div className="sf-login-shape sf-login-shape-two" aria-hidden="true" />
        </section>

        <section className="sf-login-form-side">
          <div className="sf-login-form-card">
            <div className="sf-login-form-heading">
              <p className="sf-auth-eyebrow">مساحتك في انتظارك</p>
              <h2>أهلًا بعودتك</h2>
              <p>سجّل الدخول للعودة إلى خطتك ومتابعة يومك من حيث توقفت.</p>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                loginMutation.mutate({ username: loginUsername, password: loginPassword });
              }}
              className="sf-login-form"
            >
              <div className="space-y-2">
                <Label htmlFor="studyflow-username">اسم المستخدم</Label>
                <Input
                  id="studyflow-username"
                  value={loginUsername}
                  onChange={(event) => setLoginUsername(event.target.value)}
                  autoComplete="username"
                  placeholder="اكتب اسم المستخدم"
                  required
                  dir="ltr"
                  className="sf-auth-input text-left"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="studyflow-password">كلمة المرور</Label>
                <Input
                  id="studyflow-password"
                  type="password"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  autoComplete="current-password"
                  placeholder="اكتب كلمة المرور"
                  required
                  className="sf-auth-input"
                />
              </div>
              {loginMutation.error && (
                <p role="alert" className="sf-auth-error-message">
                  {loginMutation.error.message}
                </p>
              )}
              <Button
                type="submit"
                disabled={loginMutation.isPending}
                size="lg"
                className="sf-auth-submit pressable w-full rounded-2xl font-bold"
              >
                {loginMutation.isPending ? "جارٍ تسجيل الدخول..." : "ادخل إلى مساحتك"}
                <ChevronLeft className="size-4" />
              </Button>
            </form>
            <div className="sf-login-security">
              <span className="sf-security-mark"><span /></span>
              <p>جلسة خاصة لمتابعة بياناتك الدراسية.</p>
            </div>
          </div>
          <p className="sf-login-legal">STUDYFLOW · YOUR PROGRESS, IN ONE PLACE</p>
        </section>
      </div>
    </div>
  );

  const initial = user.name?.trim().charAt(0) || "م";
  const isActive = (path: string) => path === "/" ? location === "/" : location.startsWith(path);
  const navigate = (path: string) => {
    setLocation(path);
    setMobileNavOpen(false);
  };

  const pageKey = (location.split("?")[0].split("/")[1] || "home").replace(/[^a-z0-9-]/gi, "");
  const mobileDockItems = [
    { label: "اليوم", path: "/", icon: LayoutDashboard },
    { label: "المهام", path: "/tasks", icon: CheckSquare2 },
    { label: "المذاكرة", path: "/study", icon: BookOpenText },
    { label: "المخطط", path: "/planner", icon: BrainCircuit },
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
                <button
                  key={item.path}
                  type="button"
                  onClick={() => navigate(item.path)}
                  aria-current={active ? "page" : undefined}
                  className={cn("sf-nav-item pressable", active && "is-active")}
                  aria-label={item.label}
                  title={item.label}
                >
                  <item.icon className="sf-nav-icon" />
                  <span>{item.label}</span>
                  {active && <span className="sf-nav-indicator" />}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </nav>
  );

  return (
    <div className="sf-premium-shell" data-theme={theme}>
      <div className="sf-shell-ornament sf-shell-ornament-top" aria-hidden="true" />
      <div className="sf-shell-ornament sf-shell-ornament-bottom" aria-hidden="true" />
      <div className="sf-app-frame sf-premium-frame" data-page={pageKey}>
        <header className="sf-global-nav">
          <button onClick={() => navigate("/")} className="sf-premium-brand" aria-label="العودة إلى لوحة اليوم">
            <span className="sf-premium-brand-mark"><BrandMark className="size-5" /></span>
            <span><b>StudyFlow</b><small>STUDENT WORKSPACE</small></span>
          </button>
          <nav className="sf-primary-nav" aria-label="التنقل الرئيسي">
            {[
              { label: "اليوم", path: "/", icon: LayoutDashboard },
              { label: "المهام", path: "/tasks", icon: CheckSquare2 },
              { label: "المذاكرة", path: "/study", icon: BookOpenText },
              { label: "المكتبة", path: "/books", icon: LibraryBig },
              { label: "المخطط", path: "/planner", icon: BrainCircuit },
              { label: "التحليل", path: "/analytics", icon: BarChart3 },
            ].map(item => {
              const active = isActive(item.path);
              return (
                <button key={item.path} type="button" onClick={() => navigate(item.path)} aria-current={active ? "page" : undefined} className={cn("sf-primary-link", active && "is-active")}>
                  {active && !reduceMotion && <motion.span layoutId="sf-active-link" className="sf-primary-active-bg" transition={{ type: "spring", stiffness: 430, damping: 34 }} />}
                  <item.icon aria-hidden="true" /><span>{item.label}</span>
                </button>
              );
            })}
          </nav>
          <div className="sf-global-actions">
            <Button type="button" variant="ghost" size="icon" className="sf-global-icon" onClick={() => setMobileNavOpen(true)} aria-label="عرض كل الصفحات"><Menu className="size-5" /></Button>
            <Button type="button" variant="ghost" size="icon" className="sf-global-icon" onClick={toggleTheme} aria-label={theme === "dark" ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الداكن"}>
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
            <span className="sf-global-avatar" aria-label={user.name || "ملف الطالب"}>{initial}</span>
          </div>
        </header>

        <main className={"sf-main sf-premium-main sf-main-" + pageKey}>
          <div className="sf-page-heading">
            <div className="sf-page-heading-copy">
              <p className="sf-page-overline">STUDYFLOW <span>/</span> {pageKey.replace(/-/g, " ").toUpperCase()}</p>
              <h1>{title}</h1>
              <p>{description}</p>
            </div>
            {action ? <div className="sf-page-heading-action">{action}</div> : null}
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location}
              initial={reduceMotion ? false : { opacity: 0, y: 10, filter: "blur(3px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -5 }}
              transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
              className={"sf-page sf-page-" + pageKey}
              data-page={pageKey}
            >
              {studentProfile.isError && <QueryErrorNotice onRetry={() => void studentProfile.refetch()} label="تعذّر التحقق من ملفك الدراسي. بياناتك لم تُحذف؛ أعد المحاولة." />}
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        <nav className="sf-mobile-dock" aria-label="التنقل السريع">
          {[
            { label: "اليوم", path: "/", icon: LayoutDashboard },
            { label: "المهام", path: "/tasks", icon: CheckSquare2 },
            { label: "المذاكرة", path: "/study", icon: BookOpenText },
            { label: "المخطط", path: "/planner", icon: BrainCircuit },
          ].map(item => {
            const active = isActive(item.path);
            return <button key={item.path} type="button" onClick={() => navigate(item.path)} aria-current={active ? "page" : undefined} className={cn("sf-mobile-dock-item", active && "is-active")}><item.icon /><span>{item.label}</span></button>;
          })}
          <button type="button" className="sf-mobile-dock-item" onClick={() => setMobileNavOpen(true)} aria-label="عرض باقي الصفحات"><Menu /><span>المزيد</span></button>
        </nav>
      </div>

      <Sheet open={isMobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="right" className="sf-premium-drawer w-[min(90vw,380px)] border-0 p-0 text-sidebar-foreground">
          <SheetHeader className="sf-premium-drawer-header">
            <div className="sf-premium-brand">
              <span className="sf-premium-brand-mark"><BrandMark className="size-5" /></span>
              <span><b>StudyFlow</b><small>STUDENT WORKSPACE</small></span>
            </div>
            <SheetTitle className="sr-only">كل صفحات StudyFlow</SheetTitle>
            <SheetDescription className="sr-only">اختر القسم الذي تريد فتحه.</SheetDescription>
          </SheetHeader>
          <div className="sf-premium-drawer-scroll">
            {renderNavigation(true)}
            <div className="sf-drawer-account">
              <span className="sf-global-avatar">{initial}</span>
              <div><b>{user.name || "مستخدم StudyFlow"}</b><small>مساحتك الشخصية</small></div>
              <Button variant="ghost" size="icon" onClick={() => void logout()} aria-label="تسجيل الخروج"><LogOut className="size-4" /></Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
