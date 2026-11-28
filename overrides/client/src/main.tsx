import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from "@shared/const";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import superjson from "superjson";
import App from "./App";
import { ServerClockProvider } from "./lib/server-clock";
import "./index.css";
import "./experience.css";
import "./workspace-motion.css";
import "./unified-workspace.css";
import "./workspace-finish.css";
import "./workspace-interaction-hub.css";
import "./workspace-transitions.css";
import "./studyflow-final-theme.css";
import "./experience-refinement.css";
import "./feature-experience.css";
import "./design-quality.css";
import "./identity-system.css";

// Analytics is optional. Do not emit a broken /umami request when no endpoint is configured.
const analyticsEndpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT?.trim();
const analyticsWebsiteId = import.meta.env.VITE_ANALYTICS_WEBSITE_ID?.trim();
if (analyticsEndpoint && analyticsWebsiteId) {
  const analyticsScript = document.createElement("script");
  analyticsScript.defer = true;
  analyticsScript.src = `${analyticsEndpoint.replace(/\/+$/, "")}/umami`;
  analyticsScript.dataset.websiteId = analyticsWebsiteId;
  document.head.appendChild(analyticsScript);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Keep recently visited screens responsive without refetching every time
      // the student moves between sections. Critical queries can override this.
      staleTime: 20_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

const queryErrorToastIds = new Map<string, string>();
const queryErrorToastId = (queryKey: readonly unknown[]) => "studyflow-query:" + JSON.stringify(queryKey);

const isExpectedAuthFailure = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return false;
  return error.message === UNAUTHED_ERR_MSG
    || error.data?.code === "UNAUTHORIZED"
    || error.data?.httpStatus === 401;
};

const showQueryError = (error: unknown, queryKey: readonly unknown[]) => {
  // Protected queries can resolve with 401 while the session is being checked.
  // This is an expected anonymous state, not a recoverable application failure.
  if (isExpectedAuthFailure(error)) return;
  const id = queryErrorToastId(queryKey);
  if (!queryErrorToastIds.has(id)) queryErrorToastIds.set(id, id);
  toast.error("تعذّر تحميل جزء من البيانات.", {
    id,
    duration: 9_000,
    dismissible: true,
    description: "لم نحذف تقدمك. جرّب إعادة المحاولة؛ ولو استمر الخطأ سنعرضه بوضوح بدل اختفائه سريعًا.",
    action: {
      label: "إعادة المحاولة",
      onClick: () => void queryClient.refetchQueries({ queryKey, exact: true }),
    },
  });
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    // A stable toast id prevents the same background query from flooding the UI.
    showQueryError(event.query.state.error, event.query.queryKey);
    if (!isExpectedAuthFailure(event.query.state.error)) {
      console.error("[API Query Error]", event.query.state.error);
    }
  }
  if (event.type === "updated" && event.action.type === "success") {
    // Remove a transient error as soon as the same query succeeds again.
    const id = queryErrorToastId(event.query.queryKey);
    if (queryErrorToastIds.delete(id)) toast.dismiss(id);
  }
  if (event.type === "removed") {
    const id = queryErrorToastId(event.query.queryKey);
    if (queryErrorToastIds.delete(id)) toast.dismiss(id);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    console.error("[API Mutation Error]", event.mutation.state.error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      headers() {
        // Local StudyFlow sessions are sent as same-origin HttpOnly cookies.
        return {};
      },
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <ServerClockProvider>
        <App />
      </ServerClockProvider>
    </QueryClientProvider>
  </trpc.Provider>
);
