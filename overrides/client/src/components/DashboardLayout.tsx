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
      <div className="sf-login-frame sf-login-frame-v4">
        <section className="sf-login-form-side">
          <div className="sf-login-form-card">
            <div className="sf-login-brand-v4">
              <span className="sf-login-brand-mark-v4"><BrandMark className="size-5" /></span>
              <span><b>StudyFlow</b><small>مساحة التعلّم</small></span>
            </div>
            <div className="sf-login-form-heading">
              <p className="sf-auth-eyebrow">الدخول إلى مساحة العمل</p>
              <h2>أهلًا بعودتك</h2>
              <p>استخدم بيانات الدخول المعتمدة للوصول إلى مساحة StudyFlow.</p>
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
                {loginMutation.isPending ? "جارٍ تسجيل الدخول..." : "دخول"}
                <ChevronLeft className="size-4" />
              </Button>
            </form>
            <div className="sf-login-security">
              <span className="sf-security-mark"><span /></span>
              <p>دخول خاص إلى مساحة العمل الحالية.</p>
            </div>
          </div>
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

  const account = (
    <div className="sf-account">
      <span className="sf-account-avatar">{initial}</span>
      <div className="sf-account-copy">
        <b>{user.name || "مستخدم التطبيق"}</b>
        <span>مساحتك الشخصية</span>
      </div>
      <Button variant="ghost" size="icon" onClick={() => void logout()} className="sf-account-logout" aria-label="تسجيل الخروج" title="تسجيل الخروج">
        <LogOut className="size-4" />
      </Button>
    </div>
  );

  return (
    <div className="sf-app-shell sf-shell-v3">
      <div className="sf-app-frame" data-page={pageKey}>
        <aside className="sf-sidebar" aria-label="القائمة الرئيسية">
          <button onClick={() => navigate("/")} className="sf-brand" aria-label="العودة إلى لوحة اليوم">
            <span className="sf-brand-mark"><BrandMark className="size-5" /></span>
            <span className="sf-brand-copy"><b>StudyFlow</b><small>STUDENT WORKSPACE</small></span>
          </button>

          <div className="sf-sidebar-caption">مساحة التعلّم</div>
          {renderNavigation()}

          <div className="sf-sidebar-bottom">
            <div className="sf-sidebar-note">
              <span className="sf-sidebar-note-icon"><Sparkles className="size-4" /></span>
              <div><b>تقدمك يبدأ بخطوة</b><span>تابع ما عليك، واحتفل بما أنجزت.</span></div>
            </div>
            {account}
          </div>
        </aside>

        <div className="sf-app-main">
          <header className="sf-topbar">
            <div className="sf-topbar-title">
              <Button variant="outline" size="icon" className="sf-mobile-menu pressable" onClick={() => setMobileNavOpen(true)} aria-label="فتح التنقل">
                <Menu className="size-5" />
              </Button>
              <div className="sf-heading-copy">
                <p className="sf-topbar-kicker">مساحة الدراسة <span>/</span> STUDYFLOW</p>
                <h1>{title}</h1>
                <p className="sf-page-description">{description}</p>
              </div>
            </div>
            <div className="sf-topbar-actions">
              {action ? <div className="dashboard-header-actions">{action}</div> : null}
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
          </header>

          <main className={`sf-main sf-main-${pageKey}`}>
            <div className={`sf-page sf-page-${pageKey}`} data-page={pageKey}>
            {studentProfile.isError && (
              <QueryErrorNotice onRetry={() => void studentProfile.refetch()} label="تعذّر التحقق من ملفك الدراسي. بياناتك لم تُحذف؛ أعد المحاولة." />
            )}
            {children}
            </div>
          </main>
        </div>
      </div>

      <nav className="sf-mobile-dock" aria-label="التنقل السريع">
        {mobileDockItems.map(item => {
          const active = item.path === "/" ? location === "/" : location.startsWith(item.path);
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
        <button type="button" className="sf-mobile-dock-item" onClick={() => setMobileNavOpen(true)} aria-label="عرض باقي الصفحات">
          <Menu className="size-[18px]" />
          <span>المزيد</span>
        </button>
      </nav>

      <Sheet open={isMobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="right" className="sf-mobile-sheet w-[min(88vw,340px)] border-l-0 p-0 text-sidebar-foreground">
          <SheetHeader className="sf-mobile-sheet-header">
            <div className="sf-brand">
              <span className="sf-brand-mark"><BrandMark className="size-5" /></span>
              <span className="sf-brand-copy"><b>StudyFlow</b><small>STUDENT WORKSPACE</small></span>
            </div>
            <SheetTitle className="sr-only">التنقل الرئيسي</SheetTitle>
            <SheetDescription className="sr-only">اختر الصفحة التي تريد فتحها.</SheetDescription>
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
