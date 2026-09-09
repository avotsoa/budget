import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';

import { isSupabaseConfigured } from '@/lib/supabase';
import { AuthProvider } from '@/contexts/AuthContext';
import { HouseholdProvider } from '@/contexts/HouseholdContext';
import { ScopeProvider } from '@/contexts/ScopeContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { useHousehold } from '@/hooks/useHousehold';
import { useTheme } from '@/hooks/useTheme';

import { AppShell } from '@/components/layout/AppShell';
import { LoadingState } from '@/components/ui/States';
import { SetupPage } from '@/pages/SetupPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { SignupPage } from '@/pages/auth/SignupPage';
import { OnboardingPage } from '@/pages/auth/OnboardingPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { IncomesPage } from '@/pages/IncomesPage';
import { ExpensesPage } from '@/pages/ExpensesPage';
import { BillsPage } from '@/pages/BillsPage';
import { SavingsPage } from '@/pages/SavingsPage';
import { InvestmentsPage } from '@/pages/InvestmentsPage';
import { SummaryPage } from '@/pages/SummaryPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { SettingsPage } from '@/pages/SettingsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Le temps réel invalide déjà le cache : un refetch au focus ne ferait
      // que doubler les requêtes sans rien apporter.
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 15_000,
    },
  },
});

export function App() {
  if (!isSupabaseConfigured) {
    return (
      <ThemeProvider>
        <SetupPage />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <HouseholdProvider>
              <ScopeProvider>
                <AppRoutes />
              </ScopeProvider>
            </HouseholdProvider>
          </AuthProvider>
        </BrowserRouter>
        <ThemedToaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

/**
 * Aiguillage en trois temps : non authentifié → écrans d'auth ;
 * authentifié sans foyer → onboarding ; authentifié avec foyer → application.
 */
function AppRoutes() {
  const { session, isLoading: isAuthLoading } = useAuth();
  const { household, isLoading: isHouseholdLoading } = useHousehold();

  if (isAuthLoading) {
    return <LoadingState label="Restauration de la session…" />;
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/connexion" element={<LoginPage />} />
        <Route path="/inscription" element={<SignupPage />} />
        <Route path="*" element={<Navigate to="/connexion" replace />} />
      </Routes>
    );
  }

  if (isHouseholdLoading) {
    return <LoadingState label="Chargement du foyer…" />;
  }

  if (!household) {
    return (
      <Routes>
        <Route path="/foyer" element={<OnboardingPage />} />
        <Route path="*" element={<Navigate to="/foyer" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/revenus" element={<IncomesPage />} />
        <Route path="/depenses" element={<ExpensesPage />} />
        <Route path="/factures" element={<BillsPage />} />
        <Route path="/epargne" element={<SavingsPage />} />
        <Route path="/investissements" element={<InvestmentsPage />} />
        <Route path="/synthese" element={<SummaryPage />} />
        <Route path="/rapports" element={<ReportsPage />} />
        <Route path="/parametres" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function ThemedToaster() {
  const { theme } = useTheme();
  return <Toaster theme={theme} position="bottom-right" richColors closeButton />;
}
