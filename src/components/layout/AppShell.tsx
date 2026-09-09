import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PiggyBank,
  Receipt,
  Settings,
  Sun,
  TrendingUp,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { MonthPicker } from './MonthPicker';
import { ScopeSwitcher } from './ScopeSwitcher';
import { AlertCenter } from './AlertCenter';
import { InstallButton } from './InstallButton';
import { RotateButton } from './RotateButton';
import { useAuth } from '@/hooks/useAuth';
import { useHousehold } from '@/hooks/useHousehold';
import { useTheme } from '@/hooks/useTheme';
import { useFinanceData } from '@/hooks/useFinanceData';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { initials } from '@/lib/format';
import { OWNER_SERIES_SLOT } from '@/lib/constants';

/**
 * `hidden` masque l'entrée du menu sans supprimer la route : les pages
 * restent accessibles par URL et les données intactes. Repasser à `false`
 * suffit à les réafficher.
 */
const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true, hidden: false },
  { to: '/revenus', label: 'Revenus', icon: ArrowUpCircle, end: false, hidden: false },
  { to: '/depenses', label: 'Dépenses', icon: ArrowDownCircle, end: false, hidden: false },
  { to: '/factures', label: 'Factures', icon: Receipt, end: false, hidden: true },
  { to: '/epargne', label: 'Épargne', icon: PiggyBank, end: false, hidden: false },
  { to: '/investissements', label: 'Investissements', icon: TrendingUp, end: false, hidden: true },
  { to: '/synthese', label: 'Synthèse', icon: FileText, end: false, hidden: false },
  { to: '/rapports', label: 'Rapports', icon: BarChart3, end: false, hidden: false },
  { to: '/parametres', label: 'Paramètres', icon: Settings, end: false, hidden: false },
] as const;

const VISIBLE_NAV_ITEMS = NAV_ITEMS.filter((item) => !item.hidden);

export function AppShell() {
  const [isNavOpen, setIsNavOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { signOut, user } = useAuth();
  const { household, mySlot, ownerLabel } = useHousehold();
  const { alerts } = useFinanceData();
  const realtimeStatus = useRealtimeSync();

  const displayName = mySlot ? ownerLabel(mySlot) : (user?.email ?? '');

  return (
    <div className="flex min-h-full">
      {/* Voile mobile : ferme la navigation d'un clic hors panneau. */}
      {isNavOpen ? (
        <button
          type="button"
          aria-label="Fermer la navigation"
          onClick={() => setIsNavOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
        />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-surface',
          'transition-transform lg:static lg:translate-x-0',
          isNavOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-line px-4">
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{household?.name ?? 'Budget Couple'}</p>
            <p className="text-xs text-ink-muted">Gestion de budget en couple</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setIsNavOpen(false)}
            aria-label="Fermer la navigation"
          >
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>

        <nav className="scrollbar-slim flex-1 space-y-0.5 overflow-y-auto p-3">
          {VISIBLE_NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setIsNavOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand/10 text-brand'
                    : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0" aria-hidden />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-line p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <span
              aria-hidden
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
              style={{
                backgroundColor: mySlot
                  ? `var(--series-${OWNER_SERIES_SLOT[mySlot]})`
                  : 'var(--ink-muted)',
              }}
            >
              {initials(displayName)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{displayName}</p>
              <p className="truncate text-xs text-ink-muted">{user?.email}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void signOut()}
              aria-label="Se déconnecter"
            >
              <LogOut className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          data-app-header
          className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur"
        >
          <div className="flex h-16 items-center gap-3 px-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setIsNavOpen(true)}
              aria-label="Ouvrir la navigation"
            >
              <Menu className="h-4 w-4" aria-hidden />
            </Button>

            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto scrollbar-slim">
              <MonthPicker />
              <ScopeSwitcher />
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <InstallButton />
              <RotateButton />
              <RealtimeIndicator status={realtimeStatus} />
              <AlertCenter alerts={alerts} />
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre'}
              >
                {theme === 'dark' ? (
                  <Sun className="h-4 w-4" aria-hidden />
                ) : (
                  <Moon className="h-4 w-4" aria-hidden />
                )}
              </Button>
            </div>
          </div>
        </header>

        <main data-app-main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/**
 * État de la connexion temps réel. Rendu visible parce que la promesse
 * « la modification de l'autre apparaît toute seule » doit être vérifiable :
 * si le canal tombe, l'utilisateur doit le savoir plutôt que de croire à
 * une donnée à jour.
 */
function RealtimeIndicator({ status }: { status: 'connecting' | 'live' | 'error' | 'idle' }) {
  if (status === 'idle') return null;

  const config = {
    live: { label: 'Synchronisation active', className: 'text-good', Icon: Wifi },
    connecting: { label: 'Connexion en cours…', className: 'text-ink-muted', Icon: Wifi },
    error: { label: 'Synchronisation interrompue', className: 'text-critical', Icon: WifiOff },
  }[status];

  return (
    <span
      title={config.label}
      className={cn('hidden items-center px-2 sm:inline-flex', config.className)}
    >
      <config.Icon
        className={cn('h-4 w-4', status === 'connecting' && 'animate-pulse')}
        aria-hidden
      />
      <span className="sr-only">{config.label}</span>
    </span>
  );
}
