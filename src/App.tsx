import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Auth from "./pages/Auth";
import AppLayout from "./components/finance/AppLayout";
import Dashboard from "./pages/Dashboard";
import IncomePage from "./pages/IncomePage";
import ExpensesPage from "./pages/ExpensesPage";
import CategoriesPage from "./pages/CategoriesPage";
import AccountsPage from "./pages/AccountsPage";
import CalendarPage from "./pages/CalendarPage";
import SettingsPage from "./pages/SettingsPage";
import ImportPage from "./pages/ImportPage";
import InsightsPage from "./pages/InsightsPage";
import InvestmentsPage from "./pages/InvestmentsPage";
import CreditCardsPage from "./pages/CreditCardsPage";
import ReportPage from "./pages/ReportPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20 animate-pulse">
            <span className="text-primary-foreground font-bold text-lg">$</span>
          </div>
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!user) return <Auth />;

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/receitas" element={<IncomePage />} />
        <Route path="/despesas" element={<ExpensesPage />} />
        <Route path="/categorias" element={<CategoriesPage />} />
        <Route path="/contas" element={<AccountsPage />} />
        <Route path="/calendario" element={<CalendarPage />} />
        <Route path="/configuracoes" element={<SettingsPage />} />
        <Route path="/importar" element={<ImportPage />} />
        <Route path="/insights" element={<InsightsPage />} />
        <Route path="/investimentos" element={<InvestmentsPage />} />
        <Route path="/cartoes" element={<CreditCardsPage />} />
        <Route path="/relatorio" element={<ReportPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
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
