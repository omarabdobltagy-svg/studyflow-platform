import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, Router as WouterRouter } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

// Keep the initial application shell small. Heavy route modules (curriculum,
// analytics, books) are requested only when the student opens those screens.
const WorkspaceInteractionHub = lazy(() => import("@/components/WorkspaceInteractionHub"));
const TeacherClassFollowup = lazy(() => import("@/components/TeacherClassFollowup"));
const AIActivityCenter = lazy(() => import("@/components/AIActivityCenter"));
const Books = lazy(() => import("@/pages/Books"));
const Calendar = lazy(() => import("@/pages/Calendar"));
const Goals = lazy(() => import("@/pages/Goals"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const Onboarding = lazy(() => import("@/pages/Onboarding"));
const Planner = lazy(() => import("@/pages/Planner"));
const Reminders = lazy(() => import("@/pages/Reminders"));
const Routines = lazy(() => import("@/pages/Routines"));
const Study = lazy(() => import("@/pages/Study"));
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
      <p>بنجهز الصفحة…</p>
      <span className="sf-page-loading-track"><span /></span>
    </main>
  );
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
        <Route path={"/sq3r"} component={SQ3R} />
        <Route path={"/learning-map"} component={CurriculumMap} />
        <Route path={"/routines"} component={Routines} />
        <Route path={"/calendar"} component={Calendar} />
        <Route path={"/planner"} component={Planner} />
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
            <Router />
            {/* Keep global tools lazy so they do not block the first page paint. */}
            <Suspense fallback={null}>
              <WorkspaceInteractionHub />
              <AIActivityCenter />
              <TeacherClassFollowup />
            </Suspense>
          </WouterRouter>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
