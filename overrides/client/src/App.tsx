import { Toaster } from "@/components/ui/sonner";
import WorkspaceInteractionHub from "@/components/WorkspaceInteractionHub";
import { TooltipProvider } from "@/components/ui/tooltip";
import Books from "@/pages/Books";
import Calendar from "@/pages/Calendar";
import Goals from "@/pages/Goals";
import NotFound from "@/pages/NotFound";
import Onboarding from "@/pages/Onboarding";
import Planner from "@/pages/Planner";
import Reminders from "@/pages/Reminders";
import Routines from "@/pages/Routines";
import Study from "@/pages/Study";
import Tasks from "@/pages/Tasks";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Assistant from "./pages/Assistant";
import Analytics from "./pages/Analytics";
import CurriculumMap from "./pages/CurriculumMap";
import Settings from "./pages/Settings";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/tasks"} component={Tasks} />
      <Route path={"/goals"} component={Goals} />
      <Route path={"/books/:id"} component={Books} />
      <Route path={"/books"} component={Books} />
      <Route path={"/study"} component={Study} />
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
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <Toaster />
          <WorkspaceInteractionHub />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
