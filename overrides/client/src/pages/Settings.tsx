import DashboardLayout from "@/components/DashboardLayout";
import QueryErrorNotice from "@/components/QueryErrorNotice";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, BookOpenText, Moon, Palette, ShieldCheck, Sun, UserRound } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function Settings() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const profile = trpc.studentProfile.get.useQuery();
  const utils = trpc.useUtils();
  const [showDeleteForm, setShowDeleteForm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const deleteAccount = trpc.auth.deleteAccount.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
      toast.success("تم حذف الحساب والبيانات المرتبطة به.");
      setLocation("/");
    },
    onError: error => toast.error(error.message),
  });

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
        <section className="app-card sf-danger-zone p-5 sm:p-6 xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground">إدارة الحساب</p>
              <h3 className="mt-1 text-lg font-bold">حذف الحساب</h3>
              <p className="sf-danger-copy mt-2 max-w-2xl text-sm leading-7">حذف الحساب يمسح ملفك الدراسي وخططك ومهامك وكتبك وسجلات تقدمك من قاعدة البيانات. لا يمكن التراجع عن الحذف.</p>
            </div>
            {!showDeleteForm && <Button type="button" variant="destructive" onClick={() => setShowDeleteForm(true)} className="shrink-0">حذف حسابي</Button>}
          </div>
          {showDeleteForm && <form className="mt-5 grid gap-4 border-t border-border/70 pt-5 sm:max-w-xl" onSubmit={event => {
            event.preventDefault();
            if (deleteConfirmation.trim() !== "حذف حسابي") { toast.error("اكتب «حذف حسابي» لتأكيد العملية."); return; }
            deleteAccount.mutate({ password: deletePassword, confirmation: "حذف حسابي" });
          }}>
            <div className="space-y-2">
              <label htmlFor="delete-account-password" className="text-sm font-medium">أعد إدخال كلمة المرور</label>
              <Input id="delete-account-password" type="password" autoComplete="current-password" value={deletePassword} onChange={event => setDeletePassword(event.target.value)} required className="sf-auth-input" />
            </div>
            <div className="space-y-2">
              <label htmlFor="delete-account-confirmation" className="text-sm font-medium">اكتب «حذف حسابي» للتأكيد</label>
              <Input id="delete-account-confirmation" value={deleteConfirmation} onChange={event => setDeleteConfirmation(event.target.value)} required className="sf-auth-input" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="destructive" disabled={deleteAccount.isPending || !deletePassword || deleteConfirmation.trim() !== "حذف حسابي"}>{deleteAccount.isPending ? "جارٍ حذف الحساب..." : "تأكيد حذف الحساب"}</Button>
              <Button type="button" variant="outline" onClick={() => { setShowDeleteForm(false); setDeletePassword(""); setDeleteConfirmation(""); }}>إلغاء</Button>
            </div>
            {deleteAccount.error && <p role="alert" className="text-sm text-destructive">{deleteAccount.error.message}</p>}
          </form>}
        </section>
      </div>
    </DashboardLayout>
  );
}
