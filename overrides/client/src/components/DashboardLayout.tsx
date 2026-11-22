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
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authFormError, setAuthFormError] = useState("");
  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (authenticatedUser) => {
      trpcUtils.auth.me.setData(undefined, authenticatedUser);
      void trpcUtils.invalidate();
      setLoginPassword("");
      setConfirmPassword("");
      setAuthFormError("");
    },
  });
  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: (authenticatedUser) => {
      trpcUtils.auth.me.setData(undefined, authenticatedUser);
      void trpcUtils.invalidate();
      setLoginPassword("");
      setConfirmPassword("");
      setAuthFormError("");
    },
  });
  const [location, setLocation] = useLocation();
  const [isMobileNavOpen, setMobileNavOpen] = useState(false);
  const [isDesktopNavHidden, setDesktopNavHidden] = useState(false);
  const studentProfile = trpc.studentProfile.get.useQuery(undefined, { enabled: Boolean(user) });
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    // A failed profile request must never be mistaken for a missing profile.
    if (user && studentProfile.isSuccess && studentProfile.data == null && location !== "/onboarding") {
      setLocation("/onboarding");
    }
  }, [location, setLocation, studentProfile.data, studentProfile.isSuccess, user]);

  if (loading) return (
    <div className="min-h-screen bg-background soft-grid p-5 sm:p-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl items-center justify-center">
        <div className="app-card w-full p-7 text-center sm:p-10" role="status" aria-live="polite">
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-3xl bg-primary text-primary-foreground"><BrandMark className="size-7" /></div>
          <p className="eyebrow mb-2">مسار التعلّم</p><p className="text-lg font-bold">نجهّز مساحتك الشخصية</p>
          <p className="mt-2 text-sm text-muted-foreground">يتم تحميل بيانات مساحتك الآن.</p>
        </div>
      </div>
    </div>
  );

  if (!user && authError) return (
    <div className="min-h-screen bg-background soft-grid p-5 sm:p-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl items-center justify-center">
        <div className="app-card w-full p-6 sm:p-8">
          <QueryErrorNotice onRetry={() => void refreshAuth()} label="تعذّر التحقق من جلسة الدخول. لم يتم تسجيل خروجك؛ أعد المحاولة." />
        </div>
      </div>
    </div>
  );

  if (!user) return (
    <div className="min-h-screen bg-background soft-grid p-5 sm:p-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl items-center justify-center">
        <div className="app-card w-full overflow-hidden p-7 text-center sm:p-10">
          <div className="mx-auto mb-7 flex size-16 items-center justify-center rounded-3xl bg-primary text-primary-foreground"><BrandMark className="size-7" /></div>
          <p className="eyebrow mb-3">مسار التعلّم</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {authMode === "login" ? "مساحتك المركّزة لكل يوم" : "أنشئ حساب الطالب"}
          </h1>
          <p className="mx-auto mt-4 max-w-md leading-8 text-muted-foreground">
            {authMode === "login"
              ? "سجّل الدخول للرجوع إلى تقدمك ومسارك الدراسي."
              : "أنشئ حسابًا مستقلًا يحفظ تقدمك وبياناتك بعيدًا عن حسابات الطلاب الآخرين."}
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setAuthFormError("");
              if (authMode === "register") {
                if (loginPassword !== confirmPassword) {
                  setAuthFormError("كلمتا المرور غير متطابقتين.");
                  return;
                }
                if (loginPassword.length < 10) {
                  setAuthFormError("كلمة المرور يجب أن تكون 10 أحرف على الأقل.");
                  return;
                }
                registerMutation.mutate({ username: loginUsername, password: loginPassword });
              } else {
                loginMutation.mutate({ username: loginUsername, password: loginPassword });
              }
            }}
            className="mx-auto mt-8 max-w-sm space-y-4 text-right"
          >
            <div className="space-y-2">
              <Label htmlFor="studyflow-username">اسم المستخدم</Label>
              <Input
                id="studyflow-username"
                value={loginUsername}
                onChange={(event) => setLoginUsername(event.target.value)}
                autoComplete="username"
                placeholder={authMode === "register" ? "مثال: omar.student" : "اسم المستخدم"}
                minLength={authMode === "register" ? 4 : 1}
                maxLength={32}
                required
                dir="ltr"
                className="text-left"
              />
              {authMode === "register" && (
                <p className="text-[11px] leading-5 text-muted-foreground">
                  استخدم 4 إلى 32 حرفًا إنجليزيًا أو رقمًا، ويمكن استخدام النقطة والشرطة والشرطة السفلية.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="studyflow-password">كلمة المرور</Label>
              <Input
                id="studyflow-password"
                type="password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                autoComplete={authMode === "register" ? "new-password" : "current-password"}
                placeholder="كلمة المرور"
                minLength={authMode === "register" ? 10 : 1}
                maxLength={128}
                required
              />
              {authMode === "register" && (
                <p className="text-[11px] leading-5 text-muted-foreground">
                  10 أحرف على الأقل. تُحفظ كلمة المرور مشفّرة تجزئيًا، ولا تُخزّن كنص مقروء.
                </p>
              )}
            </div>
            {authMode === "register" && (
              <div className="space-y-2">
                <Label htmlFor="studyflow-confirm-password">تأكيد كلمة المرور</Label>
                <Input
                  id="studyflow-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  placeholder="أعد كتابة كلمة المرور"
                  minLength={10}
                  maxLength={128}
                  required
                />
              </div>
            )}
            {(authFormError || (authMode === "register" ? registerMutation.error?.message : loginMutation.error?.message)) && (
              <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {authFormError || (authMode === "register" ? registerMutation.error?.message : loginMutation.error?.message)}
              </p>
            )}
            <Button
              type="submit"
              disabled={loginMutation.isPending || registerMutation.isPending}
              size="lg"
              className="pressable mt-2 w-full rounded-2xl bg-primary px-7 font-semibold"
            >
              {loginMutation.isPending || registerMutation.isPending
                ? "جارٍ التحقق..."
                : authMode === "register" ? "إنشاء حساب الطالب" : "دخول إلى المساحة"}
              <ChevronLeft className="size-4" />
            </Button>
            <div className="border-t border-border/70 pt-4 text-center">
              <button
                type="button"
                className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
                onClick={() => {
                  setAuthMode(current => current === "login" ? "register" : "login");
                  setAuthFormError("");
                  setConfirmPassword("");
                  loginMutation.reset();
                  registerMutation.reset();
                }}
              >
                {authMode === "login" ? "ليس لديك حساب؟ أنشئ حساب طالب" : "لديك حساب بالفعل؟ سجّل الدخول"}
              </button>
              {authMode === "register" && (
                <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                  بعد إنشاء الحساب ستنتقل لإعداد ملفك الدراسي واختيار المواد والمدرسين.
                </p>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  const initial = user.name?.trim().charAt(0) || "م";
  const isActive = (path: string) => path === "/" ? location === "/" : location.startsWith(path);
  const navigate = (path: string) => { setLocation(path); setMobileNavOpen(false); };
  const renderNavigation = () => (
    <nav className="space-y-5" aria-label="التنقل الرئيسي">
      {navigation.map(group => <section key={group.label}>
        <h2 className="mb-2 px-3 text-[11px] font-semibold text-sidebar-foreground/45">{group.label}</h2>
        <div className="space-y-1">{group.items.map(item => {
          const active = isActive(item.path);
          return <button key={item.path} type="button" onClick={() => navigate(item.path)} aria-current={active ? "page" : undefined}
            className={cn("pressable flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-right text-sm font-medium transition-colors",
              active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-white/8 hover:text-sidebar-foreground")}>
            <item.icon className={cn("size-[18px] shrink-0", active && "text-sidebar-primary")} /><span>{item.label}</span>
            {active && <span className="mr-auto size-1.5 rounded-full bg-sidebar-primary" />}
          </button>;
        })}</div>
      </section>)}
    </nav>
  );

  return (
    <div className="app-shell bg-background text-foreground">
      <aside className={cn("fixed inset-y-0 right-0 z-40 hidden w-[272px] flex-col overflow-y-auto bg-sidebar px-4 py-5 text-sidebar-foreground lg:flex", isDesktopNavHidden && "lg:hidden")}>
        <button onClick={() => navigate("/")} className="pressable mb-7 flex items-center gap-3 rounded-xl px-2 text-right" aria-label="العودة إلى لوحة اليوم">
          <span className="flex size-10 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground"><BrandMark className="size-5" /></span>
          <span><span className="block text-lg font-bold tracking-tight">مسار التعلّم</span><span className="block text-xs text-sidebar-foreground/55">مساحة اليوم بوضوح</span></span>
        </button>
        {renderNavigation()}
        <div className="mt-auto border-t border-white/10 pt-4">
          <div className="mb-3 flex items-center gap-3 rounded-xl px-2 py-2"><span className="flex size-9 items-center justify-center rounded-xl bg-white/10 text-sm font-bold">{initial}</span>
            <div className="min-w-0"><p className="truncate text-sm font-semibold">{user.name || "مستخدم التطبيق"}</p><p className="truncate text-xs text-sidebar-foreground/55">مساحتك الشخصية</p></div>
          </div>
          <Button variant="ghost" onClick={() => void logout()} className="w-full justify-start gap-3 rounded-xl px-3 text-sidebar-foreground/65 hover:bg-white/8 hover:text-sidebar-foreground"><LogOut className="size-4" />تسجيل الخروج</Button>
        </div>
      </aside>

      <div className={cn(isDesktopNavHidden ? "lg:pr-0" : "lg:pr-[272px]")}>
        <header className="sticky top-0 z-30 border-b border-border/65 bg-background/90 backdrop-blur-xl">
          <div className="pointer-events-none absolute left-[16%] top-0 hidden h-[72px] w-[220px] opacity-85 xl:block"><ThreeAmbientScene /></div>
          <div className="container dashboard-header relative z-10 flex min-h-[72px] items-center justify-between gap-3 py-2">
            <div className="dashboard-header-main flex min-w-0 items-center gap-3">
              <Button variant="outline" size="icon" className="pressable rounded-xl lg:hidden" onClick={() => setMobileNavOpen(true)} aria-label="فتح التنقل"><Menu className="size-5" /></Button>
              <Button variant="outline" size="icon" className="pressable hidden rounded-xl lg:inline-flex" onClick={() => setDesktopNavHidden(current => !current)} aria-label={isDesktopNavHidden ? "إظهار شريط التنقل" : "إخفاء شريط التنقل"} title={isDesktopNavHidden ? "إظهار شريط التنقل" : "ملء الشاشة"}>{isDesktopNavHidden ? <PanelRightOpen className="size-4" /> : <PanelRightClose className="size-4" />}</Button>
              <div className="min-w-0"><p className="eyebrow mb-0.5 hidden sm:block">مساحتك الشخصية</p><h1 className="truncate text-lg font-bold tracking-tight sm:text-2xl">{title}</h1></div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {action ? <div className="dashboard-header-actions flex items-center gap-2">{action}</div> : null}
              <Button type="button" variant="outline" size="icon" className="pressable rounded-xl" onClick={toggleTheme}
                aria-label={theme === "dark" ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الداكن"} title={theme === "dark" ? "الوضع الفاتح" : "الوضع الداكن"}>
                {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </Button>
            </div>
          </div>
        </header>
        <main className="container enter py-5 sm:py-7">
          <p className="mb-5 max-w-2xl text-sm leading-7 text-muted-foreground sm:mb-6 sm:text-base">{description}</p>
          {studentProfile.isError && <QueryErrorNotice onRetry={() => void studentProfile.refetch()} label="تعذّر التحقق من ملفك الدراسي. بياناتك لم تُحذف؛ أعد المحاولة." />}
          {children}
        </main>
      </div>

      <Sheet open={isMobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="right" className="w-[min(88vw,340px)] border-l-0 bg-sidebar p-0 text-sidebar-foreground">
          <SheetHeader className="border-b border-white/10 px-5 pb-4 pt-6 text-right">
            <div className="mb-2 flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground"><BrandMark className="size-5" /></span>
              <div><SheetTitle className="text-base text-sidebar-foreground">مسار التعلّم</SheetTitle><SheetDescription className="mt-1 text-xs text-sidebar-foreground/55">التنقل في مساحتك الدراسية</SheetDescription></div>
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
