import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from "@shared/const";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import superjson from "superjson";
import App from "./App";
import "./index.css";
import "./experience.css";
import "./experience-dark.css";

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

const queryClient = new QueryClient();

const isExpectedAuthError = (error: unknown) =>
  error instanceof TRPCClientError && error.message === UNAUTHED_ERR_MSG;

const showQueryError = (error: unknown, queryKey: readonly unknown[]) => {
  if (isExpectedAuthError(error)) return;
  toast.error("تعذّر تحميل البيانات الآن.", {
    description: "تحقق من اتصالك ثم أعد المحاولة.",
    action: {
      label: "إعادة المحاولة",
      onClick: () => void queryClient.refetchQueries({ queryKey }),
    },
  });
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    if (isExpectedAuthError(event.query.state.error)) return;
    showQueryError(event.query.state.error, event.query.queryKey);
    console.error("[API Query Error]", event.query.state.error);
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
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
