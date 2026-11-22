import DashboardLayout from "@/components/DashboardLayout";
import QueryErrorNotice from "@/components/QueryErrorNotice";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, BookOpenText, Moon, Palette, ShieldCheck, Sun, UserRound } from "lucide-react";
import { useLocation } from "wouter";

export default function Settings() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const profile = trpc.studentProfile.get.useQuery();

  return (
    <DashboardLayout
      title="الإعدادات"
      description="تحكم في مظهر مساحتك، وراجع بيانات ملفك الدراسي، وعدّل اختياراتك عند الحاجة."
    >
      {profile.isError && <QueryErrorNotice onRetry={() => void profile.refetch()} label="تعذّر تحميل ملخص ملفك الدراسي." />}
      <section className="sf-settings-intro mb-6">
        <div>
          <p className="sf-settings-kicker">مساحتك · تفضيلاتك</p>
          <h2>خلّي StudyFlow مناسب لطريقتك.</h2>
          <p>إعدادات واضحة ومباشرة، من غير خيارات مخفية أو تغييرات غير متوقعة.</p>
        </div>
        <span className="sf-settings-emblem" aria-hidden="true"><Palette className="size-7" /></span>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="app-card sf-settings-card p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="sf-settings-icon"><UserRound className="size-5" /></span>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold">الحساب والملف الدراسي</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">بيانات حسابك واختياراتك التعليمية محفوظة في ملف واحد.</p>
            </div>
          </div>
          <div className="mt-5 rounded-2xl bg-muted/55 p-4">
            <p className="text-xs text-muted-foreground">اسم الحساب</p>
            <p className="mt-1 font-bold">{user?.name || "حساب StudyFlow"}</p>
            <div className="my-4 h-px bg-border" />
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-sm text-muted-foreground"><BookOpenText className="size-4" /> المواد الدراسية</span>
              <span className="num rounded-lg bg-background px-3 py-1.5 text-sm font-bold">{profile.isLoading ? "—" : profile.data?.subjects?.length ?? 0}</span>
            </div>
          </div>
          <Button type="button" onClick={() => setLocation("/settings/academic")} className="mt-4 h-11 w-full justify-between rounded-xl bg-primary px-4">
            تعديل الملف الدراسي <ArrowLeft className="size-4" />
          </Button>
        </section>

        <section className="app-card sf-settings-card p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="sf-settings-icon"><Palette className="size-5" /></span>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold">مظهر مساحة العمل</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">اختَر المظهر الذي يناسب وقتك وبيئة العمل. اختيارك يُحفظ على هذا الجهاز.</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button type="button" onClick={() => theme === "dark" && toggleTheme?.()} aria-pressed={theme === "light"} className={"sf-theme-choice " + (theme === "light" ? "is-selected" : "")}>
              <Sun className="size-5" /><span>فاتح</span><small>مساحة مشرقة</small>
            </button>
            <button type="button" onClick={() => theme === "light" && toggleTheme?.()} aria-pressed={theme === "dark"} className={"sf-theme-choice " + (theme === "dark" ? "is-selected" : "")}>
              <Moon className="size-5" /><span>داكن</span><small>إضاءة منخفضة</small>
            </button>
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-border/70 bg-muted/25 p-3 text-xs leading-5 text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
            <p>تغيير المظهر لا يغيّر بياناتك الدراسية أو تقدمك أو جلسة تسجيل الدخول.</p>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
