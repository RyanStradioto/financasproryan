import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Auth from "./pages/Auth";
import AppLayout from "./components/finance/AppLayout";

// Rotas pesadas carregadas sob demanda para reduzir o bundle inicial
const Dashboard       = lazy(() => import("./pages/Dashboard"));
const PlanningPage    = lazy(() => import("./pages/PlanningPage"));
const IncomePage      = lazy(() => import("./pages/IncomePage"));
const ExpensesPage    = lazy(() => import("./pages/ExpensesPage"));
const CategoriesPage  = lazy(() => import("./pages/CategoriesPage"));
const AccountsPage    = lazy(() => import("./pages/AccountsPage"));
const CalendarPage    = lazy(() => import("./pages/CalendarPage"));
const SettingsPage    = lazy(() => import("./pages/SettingsPage"));
const ImportPage      = lazy(() => import("./pages/ImportPage"));
const InsightsPage    = lazy(() => import("./pages/InsightsPage"));
const InvestmentsPage = lazy(() => import("./pages/InvestmentsPage"));
const CreditCardsPage = lazy(() => import("./pages/CreditCardsPage"));
const ReportPage      = lazy(() => import("./pages/ReportPage"));
const TrashPage       = lazy(() => import("./pages/TrashPage"));
const NotFound        = lazy(() => import("./pages/NotFound"));

/** Fallback visual exibido enquanto o chunk da rota está sendo carregado. */
function PageLoader() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20 animate-pulse">
          <span className="text-primary-foreground font-bold">$</span>
        </div>
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );
}

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { user, loading, isRecoveryMode } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <PageLoader />
      </div>
    );
  }

  if (!user || isRecoveryMode) return <Auth />;

  return (
    <AppLayout>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/"             element={<Dashboard />} />
          <Route path="/receitas"     element={<IncomePage />} />
          <Route path="/despesas"     element={<ExpensesPage />} />
          <Route path="/categorias"   element={<CategoriesPage />} />
          <Route path="/planejamento" element={<PlanningPage />} />
          <Route path="/contas"       element={<AccountsPage />} />
          <Route path="/calendario"   element={<CalendarPage />} />
          <Route path="/configuracoes" element={<SettingsPage />} />
          <Route path="/importar"     element={<ImportPage />} />
          <Route path="/insights"     element={<InsightsPage />} />
          <Route path="/investimentos" element={<InvestmentsPage />} />
          <Route path="/cartoes"      element={<CreditCardsPage />} />
          <Route path="/relatorio"    element={<ReportPage />} />
          <Route path="/lixeira"      element={<TrashPage />} />
          <Route path="*"             element={<NotFound />} />
        </Routes>
      </Suspense>
    </AppLayout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter>
          <ProtectedRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
