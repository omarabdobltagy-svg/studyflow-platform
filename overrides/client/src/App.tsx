import { Component, lazy, Suspense, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, Router as WouterRouter } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

// Keep the initial application shell small. Heavy route modules (curriculum,
// analytics, books) are requested only when the student opens those screens.
const WorkspaceInteractionHub = lazy(() => import("@/components/WorkspaceInteractionHub"));
const TeacherClassFollowup = lazy(() => import("@/components/TeacherClassFollowup"));
const AIActivityHistory = lazy(() => import("@/pages/AIActivityHistory"));
const Books = lazy(() => import("@/pages/Books"));
const Calendar = lazy(() => import("@/pages/Calendar"));
const Goals = lazy(() => import("@/pages/Goals"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const Onboarding = lazy(() => import("@/pages/Onboarding"));
const Planner = lazy(() => import("@/pages/Planner"));
const Reminders = lazy(() => import("@/pages/Reminders"));
const Routines = lazy(() => import("@/pages/Routines"));
const Study = lazy(() => import("@/pages/Study"));
const YouTubeReviews = lazy(() => import("@/pages/YouTubeReviews"));
const SQ3R = lazy(() => import("@/pages/SQ3R"));
const Tasks = lazy(() => import("@/pages/Tasks"));
const Home = lazy(() => import("./pages/Home"));
const Assistant = lazy(() => import("./pages/Assistant"));
const Analytics = lazy(() => import("./pages/Analytics"));
const CurriculumMap = lazy(() => import("./pages/CurriculumMap"));
const Settings = lazy(() => import("./pages/Settings"));

function PageLoading() {
  return (
    <main className="sf-page-loading" role="status" aria-live="polite" aria-busy="true">
      <div className="sf-page-loading-mark"><span /></div>
      <p>بنجهّز الصفحة ومساحتك الدراسية…</p>
      <span className="sf-page-loading-track"><span /></span>
    </main>
  );
}


type PageRecoveryBoundaryState = { failed: boolean };

class PageRecoveryBoundary extends Component<{ children: ReactNode }, PageRecoveryBoundaryState> {
  state: PageRecoveryBoundaryState = { failed: false };

  static getDerivedStateFromError(): PageRecoveryBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error("[StudyFlow] Page render failed:", error);
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="min-h-[70vh] grid place-items-center p-5">
          <section className="app-card w-full max-w-lg rounded-2xl border border-border/70 p-6 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-secondary text-primary">!</div>
            <h1 className="mt-4 text-lg font-extrabold">حصلت مشكلة أثناء فتح الصفحة</h1>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">لم نفقد تقدمك المحفوظ. أعد تحميل الصفحة لإعادة تشغيل الجزء الذي تعذّر عرضه.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <button type="button" onClick={() => window.location.reload()} className="min-h-10 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground">إعادة تحميل الصفحة</button>
              <a href="/" className="inline-flex min-h-10 items-center rounded-xl border border-border px-4 text-sm font-semibold">العودة للرئيسية</a>
            </div>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

function Router() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/tasks"} component={Tasks} />
        <Route path={"/goals"} component={Goals} />
        <Route path={"/books/:id"} component={Books} />
        <Route path={"/books"} component={Books} />
        <Route path={"/study"} component={Study} />
        <Route path={"/reviews"} component={YouTubeReviews} />
        <Route path={"/sq3r"} component={SQ3R} />
        <Route path={"/learning-map"} component={CurriculumMap} />
        <Route path={"/routines"} component={Routines} />
        <Route path={"/calendar"} component={Calendar} />
        <Route path={"/planner"} component={Planner} />
        <Route path={"/ai-activity"} component={AIActivityHistory} />
        <Route path={"/reminders"} component={Reminders} />
        <Route path={"/assistant"} component={Assistant} />
        <Route path={"/analytics"} component={Analytics} />
        <Route path={"/onboarding"} component={Onboarding} />
        <Route path={"/settings/academic"} component={() => <Onboarding editMode />} />
        <Route path={"/settings"} component={Settings} />
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable>
        <TooltipProvider>
          <WouterRouter>
            <Toaster />
            <PageRecoveryBoundary><Router /></PageRecoveryBoundary>
            {/* Keep global tools lazy so they do not block the first page paint. */}
            <Suspense fallback={null}>
              <WorkspaceInteractionHub />
              <TeacherClassFollowup />
            </Suspense>
          </WouterRouter>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
