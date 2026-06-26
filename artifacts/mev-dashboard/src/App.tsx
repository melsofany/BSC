import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { LanguageProvider } from "@/lib/i18n";
import { AuthProvider, useAuth, triggerSessionExpired } from "@/lib/auth";

import { Layout } from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import Opportunities from "@/pages/opportunities";
import Trades from "@/pages/trades";
import Analytics from "@/pages/analytics";
import Mempool from "@/pages/mempool";
import Settings from "@/pages/settings";
import Login from "@/pages/login";
import { type ReactNode } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, err: any) => {
        // Stop retrying on 401 — session was superseded from another device
        if (err?.status === 401 || err?.response?.status === 401) return false;
        return count < 2;
      },
    },
  },
});

// When any API call returns 401, clear cache and force re-login
queryClient.getQueryCache().subscribe((event) => {
  if (event.type === "updated" && event.query.state.error) {
    const err = event.query.state.error as any;
    const status = err?.status ?? err?.response?.status;
    if (status === 401) {
      queryClient.clear();
      triggerSessionExpired();
    }
  }
});

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const [location] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route>
        <ProtectedRoute>
          <Layout>
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/opportunities" component={Opportunities} />
              <Route path="/trades" component={Trades} />
              <Route path="/analytics" component={Analytics} />
              <Route path="/mempool" component={Mempool} />
              <Route path="/settings" component={Settings} />
              <Route component={NotFound} />
            </Switch>
          </Layout>
        </ProtectedRoute>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <TooltipProvider>
          <AuthProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
          </AuthProvider>
          <Toaster />
        </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
