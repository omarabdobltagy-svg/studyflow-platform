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
import ThreeAmbientScene from "@/components/ThreeAmbientScene";
import {
  BarChart3, BellRing, BookOpenCheck, BookOpenText, BrainCircuit, CalendarDays,
  CheckSquare2, ChevronLeft, Goal, LayoutDashboard, LibraryBig, LogOut, Menu,
  Moon, Settings2, Sparkles, Sun, PanelRightClose, PanelRightOpen,
} from "lucide-react";
import { ReactNode, useEffect, useState } from "react";
import { useLocation } from "wouter";

type NavigationGroup = {
  label: string;
  items: { label: string; path: string; icon: typeof LayoutDashboard }[];
};

const navigation: NavigationGroup[] = [
  { label: "اليوم", items: [
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
  { label: "التخطيط والمتابعة", items: [
    { label: "الأهداف", path: "/goals", icon: Goal },
    { label: "المخطط الذكي", path: "/planner", icon: BookOpenCheck },
    { label: "لوحة التقدم", path: "/analytics", icon: BarChart3 },
    { label: "التذكيرات", path: "/reminders", icon: BellRing },
  ] },
  { label: "الإعدادات", items: [{ label: "الملف الدراسي", path: "/settings", icon: Settings2 }] },
];

type DashboardLayoutProps = { title: string; description: string; children: ReactNode; action?: ReactNode };

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
  const [isDesktopNavHidden, setDesktopNavHidden] = useState(false);
  const studentProfile = trpc.studentProfile.get.useQuery(undefined, { enabled: Boolean(user) });
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    if (user && studentProfile.isSuccess && studentProfile.data == null && location !== "/onboarding") {
      setLocation("/onboarding");
    }
  }, [location, setLocation, studentProfile.data, studentProfile.isSuccess, user]);

  if (loading) return (
    <div className="sf-auth-screen min-h-screen p-4 sm:p-8">
      <div className="sf-auth-frame mx-auto flex min-h-[calc(100vh-2rem)] max-w-5xl items-center justify-center p-8">
        <div className="sf-auth-card w-full max-w-xl p-8 text-center" role="status" aria-live="polite">
          <div className="sf-auth-brand mx-auto mb-6 flex size-16 items-center justify-center rounded-3xl"><BrandMark className="size-7" /></div>
          <p className="eyebrow mb-2">STUDYFLOW / SYSTEM</p>
          <p className="text-xl font-black">نجهّز مساحتك الشخصية</p>
          <p className="mt-2 text-sm text-muted-foreground">يتم تحميل بيانات مساحتك الآن.</p>
          <div className="sf-loading-line mx-auto mt-6 h-1.5 w-40 overflow-hidden rounded-full" />
        </div>
      </div>
    </div>
  );

  if (!user && authError) return (
    <div className="sf-auth-screen min-h-screen p-4 sm:p-8">
      <div className="sf-auth-frame mx-auto flex min-h-[calc(100vh-2rem)] max-w-5xl items-center justify-center p-8">
        <div className="sf-auth-card w-full max-w-xl p-7 sm:p-10">
          <QueryErrorNotice onRetry={() => void refreshAuth()} label="تعذّر التحقق من جلسة الدخول. لم يتم تسجيل خروجك؛ أعد المحاولة." />
        </div>
      </div>
    </div>
  );

  if (!user) return (
    <div className="sf-auth-screen min-h-screen p-3 sm:p-6 lg:p-8">
      <div className="sf-auth-frame mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[1500px] grid-cols-1 overflow-hidden lg:grid-cols-[1.08fr_.92fr]">
        <section className="sf-auth-showcase relative flex min-h-[360px] flex-col justify-between overflow-hidden p-7 sm:p-10 lg:min-h-[760px] lg:p-14">
          <div className="relative z-10 flex items-center gap-3">
            <span className="sf-auth-logo flex size-12 items-center justify-center rounded-2xl"><BrandMark className="size-6" /></span>
            <div><p className="text-lg font-black tracking-tight text-white">StudyFlow</p><p className="text-[10px] font-bold tracking-[.22em] text-violet-200/70">LEARN / LEVEL UP</p></div>
          </div>

          <div className="sf-auth-art pointer-events-none absolute inset-0" aria-hidden="true">
            <ThreeAmbientScene />
          </div>
          <div className="sf-auth-orbit-label sf-orbit-label-one" aria-hidden="true"><span className="sf-orbit-dot" /> FOCUS MODE</div>
          <div className="sf-auth-orbit-label sf-orbit-label-two" aria-hidden="true"><span className="sf-orbit-dot sf-orbit-dot-cyan" /> YOUR NEXT LEVEL</div>

          <div className="relative z-10 mt-16 max-w-2xl lg:mt-0">
            <p className="mb-4 text-xs font-black tracking-[.28em] text-violet-200">YOUR LEARNING UNIVERSE</p>
            <h1 className="max-w-xl text-4xl font-black leading-[1.2] tracking-tight text-white sm:text-5xl xl:text-7xl">
              تعلّم بذكاء.
              <span className="sf-gradient-text block">اتقدّم بطريقتك.</span>
            </h1>
            <p className="mt-6 max-w-lg text-sm leading-8 text-violet-100/75 sm:text-base">
              مساحة واحدة تجمع مذاكرتك، أهدافك، تقدمك، ومساعدك الذكي — في تجربة تتحرك معك خطوة بخطوة.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <span className="sf-auth-feature-chip"><Sparkles className="size-4" /> تخطيط ذكي</span>
              <span className="sf-auth-feature-chip"><BookOpenText className="size-4" /> مكتبة متصلة</span>
              <span className="sf-auth-feature-chip"><BarChart3 className="size-4" /> تقدم مرئي</span>
            </div>
          </div>
          <p className="relative z-10 mt-12 text-[10px] font-semibold tracking-[.2em] text-violet-200/45">BUILT AROUND YOUR MOMENTUM · 2026</p>
        </section>

        <section className="sf-auth-form-wrap flex items-center justify-center p-5 sm:p-10 lg:p-14">
          <div className="sf-auth-card w-full max-w-lg p-7 sm:p-10">
            <div className="mb-8 flex items-center justify-between gap-3">
              <div><p className="eyebrow mb-2">مساحتك في انتظارك</p><h2 className="text-3xl font-black tracking-tight sm:text-4xl">أهلاً بعودتك</h2></div>
              <span className="sf-auth-step-mark"><Sparkles className="size-5" /></span>
            </div>
            <p className="mb-8 text-sm leading-7 text-muted-foreground">سجّل دخولك للعودة إلى خطتك، ومهامك، وكل ما أنجزته حتى الآن.</p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                loginMutation.mutate({ username: loginUsername, password: loginPassword });
              }}
              className="space-y-5 text-right"
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
                <p role="alert" className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {loginMutation.error.message}
                </p>
              )}
              <Button type="submit" disabled={loginMutation.isPending} size="lg" className="sf-auth-submit pressable mt-2 w-full rounded-2xl px-7 font-bold">
                {loginMutation.isPending ? "جارٍ تسجيل الدخول..." : "ادخل إلى مساحتك"}
                <ChevronLeft className="size-4" />
              </Button>
            </form>
            <div className="sf-auth-security mt-8 flex items-center gap-3 rounded-2xl px-4 py-3">
              <span className="sf-security-pulse" />
              <p className="text-xs leading-6 text-muted-foreground">جلسة خاصة وآمنة لمتابعة رحلتك التعليمية.</p>
            </div>
            <p className="mt-8 text-center text-[10px] font-bold tracking-[.2em] text-muted-foreground">STUDYFLOW · YOUR MOMENTUM, VISUALIZED</p>
          </div>
        </section>
      </div>
    </div>
  );

  const initial = user.name?.trim().charAt(0) || "م";
  const isActive = (path: string) => path === "/" ? location === "/" : location.startsWith(path);
  const navigate = (path: string) => { setLocation(path); setMobileNavOpen(false); };
  const renderNavigation = () => (
    <nav className="sf-nav-list space-y-5" aria-label="التنقل الرئيسي">
      {navigation.map(group => <section key={group.label} className="sf-nav-group">
        <h2 className="mb-2 px-3 text-[11px] font-semibold text-sidebar-foreground/45">{group.label}</h2>
        <div className="space-y-1">{group.items.map(item => {
          const active = isActive(item.path);
          return <button key={item.path} type="button" onClick={() => navigate(item.path)} aria-current={active ? "page" : undefined}
            className={cn("sf-nav-item pressable flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-right text-sm font-medium transition-colors", active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-white/8 hover:text-sidebar-foreground")}
            aria-label={item.label} title={item.label}>
            <item.icon className={cn("size-[18px] shrink-0", active && "text-sidebar-primary")} />
            <span>{item.label}</span>
            {active && <span className="sf-active-dot mr-auto size-1.5 rounded-full bg-sidebar-primary" />}
          </button>;
        })}</div>
      </section>)}
    </nav>
  );

  return (
    <div className="app-shell bg-background text-foreground">
      <aside className={cn("sf-sidebar fixed inset-y-0 right-0 z-40 hidden w-[272px] flex-col overflow-y-auto bg-sidebar px-4 py-5 text-sidebar-foreground lg:flex", isDesktopNavHidden && "lg:hidden")}>
        <button onClick={() => navigate("/")} className="sf-sidebar-brand pressable mb-7 flex items-center gap-3 rounded-xl px-2 text-right" aria-label="العودة إلى لوحة اليوم">
          <span className="sf-sidebar-mark flex size-10 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground"><BrandMark className="size-5" /></span>
          <span><span className="block text-lg font-bold tracking-tight">StudyFlow</span><span className="block text-[9px] font-bold tracking-[.18em] text-sidebar-foreground/55">LEARN / LEVEL UP</span></span>
        </button>
        {renderNavigation()}
        <div className="sf-sidebar-account mt-auto border-t border-white/10 pt-4">
          <div className="mb-3 flex items-center gap-3 rounded-xl px-2 py-2"><span className="sf-avatar flex size-9 items-center justify-center rounded-xl bg-white/10 text-sm font-bold">{initial}</span>
            <div className="min-w-0"><p className="truncate text-sm font-semibold">{user.name || "مستخدم التطبيق"}</p><p className="truncate text-xs text-sidebar-foreground/55">مساحتك الشخصية</p></div>
          </div>
          <Button variant="ghost" onClick={() => void logout()} className="sf-logout w-full justify-start gap-3 rounded-xl px-3 text-sidebar-foreground/65 hover:bg-white/8 hover:text-sidebar-foreground"><LogOut className="size-4" /><span>خروج</span></Button>
        </div>
      </aside>

      <div className="sf-app-content">
        <header className="sf-topbar sticky top-0 z-30 border-b border-border/65 bg-background/90 backdrop-blur-xl">
          <div className="sf-topbar-visual pointer-events-none absolute left-[16%] top-0 hidden h-[72px] w-[220px] opacity-85 xl:block" aria-hidden="true"><ThreeAmbientScene /></div>
          <div className="container dashboard-header relative z-10 flex min-h-[72px] items-center justify-between gap-3 py-2">
            <div className="dashboard-header-main flex min-w-0 items-center gap-3">
              <Button variant="outline" size="icon" className="sf-header-button pressable rounded-xl lg:hidden" onClick={() => setMobileNavOpen(true)} aria-label="فتح التنقل"><Menu className="size-5" /></Button>
              <Button variant="outline" size="icon" className="sf-header-button pressable hidden rounded-xl lg:inline-flex" onClick={() => setDesktopNavHidden(current => !current)} aria-label={isDesktopNavHidden ? "إظهار شريط التنقل" : "إخفاء شريط التنقل"} title={isDesktopNavHidden ? "إظهار شريط التنقل" : "ملء الشاشة"}>{isDesktopNavHidden ? <PanelRightOpen className="size-4" /> : <PanelRightClose className="size-4" />}</Button>
              <div className="min-w-0"><p className="sf-topbar-kicker mb-1 hidden sm:block">YOUR LEARNING SPACE</p><h1 className="truncate text-lg font-bold tracking-tight sm:text-3xl">{title}</h1><p className="sf-page-intro mt-2 hidden max-w-2xl text-sm leading-7 sm:block">{description}</p></div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {action ? <div className="dashboard-header-actions flex items-center gap-2">{action}</div> : null}
              <Button type="button" variant="outline" size="icon" className="sf-header-button pressable rounded-xl" onClick={toggleTheme}
                aria-label={theme === "dark" ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الداكن"} title={theme === "dark" ? "الوضع الفاتح" : "الوضع الداكن"}>
                {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </Button>
            </div>
          </div>
        </header>
        <main className="sf-main container enter py-5 sm:py-7">
          <p className="sf-main-description mb-5 max-w-2xl text-sm leading-7 text-muted-foreground sm:mb-6 sm:text-base">{description}</p>
          {studentProfile.isError && <QueryErrorNotice onRetry={() => void studentProfile.refetch()} label="تعذّر التحقق من ملفك الدراسي. بياناتك لم تُحذف؛ أعد المحاولة." />}
          {children}
        </main>
      </div>

      <Sheet open={isMobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="right" className="sf-mobile-sheet w-[min(88vw,340px)] border-l-0 bg-sidebar p-0 text-sidebar-foreground">
          <SheetHeader className="border-b border-white/10 px-5 pb-4 pt-6 text-right">
            <div className="mb-2 flex items-center gap-3"><span className="sf-sidebar-mark flex size-10 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground"><BrandMark className="size-5" /></span>
              <div><SheetTitle className="text-base text-sidebar-foreground">StudyFlow</SheetTitle><SheetDescription className="mt-1 text-xs text-sidebar-foreground/55">التنقل في مساحتك الدراسية</SheetDescription></div>
            </div>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4">{renderNavigation()}</div>
          <div className="border-t border-white/10 p-4">
            <div className="mb-3 flex items-center gap-3 px-2"><span className="flex size-9 items-center justify-center rounded-xl bg-white/10 text-sm font-bold">{initial}</span>
              <div className="min-w-0"><p className="truncate text-sm font-semibold">{user.name || "مستخدم التطبيق"}</p><p className="text-xs text-sidebar-foreground/55">مساحتك الشخصية</p></div>
            </div>
            <Button variant="ghost" onClick={() => { setMobileNavOpen(false); void logout(); }} className="w-full justify-start gap-3 rounded-xl text-sidebar-foreground/75 hover:bg-white/8 hover:text-white"><LogOut className="size-4" />تسجيل الخروج</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
