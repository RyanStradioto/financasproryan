import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, TrendingUp, TrendingDown, Grid3X3, Landmark, CalendarDays, Settings, LogOut, DollarSign, Moon, Sun, Upload, Brain, BarChart3, CreditCard, FileText } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/receitas', icon: TrendingUp, label: 'Receitas' },
  { to: '/despesas', icon: TrendingDown, label: 'Despesas' },
  { to: '/investimentos', icon: BarChart3, label: 'Investimentos' },
  { to: '/cartoes', icon: CreditCard, label: 'Cartões' },
  { to: '/categorias', icon: Grid3X3, label: 'Categorias' },
  { to: '/contas', icon: Landmark, label: 'Contas' },
  { to: '/calendario', icon: CalendarDays, label: 'Calendário' },
  { to: '/relatorio', icon: FileText, label: 'Relatório' },
  { to: '/insights', icon: Brain, label: 'Insights IA' },
  { to: '/importar', icon: Upload, label: 'Importar Extrato' },
  { to: '/configuracoes', icon: Settings, label: 'Configurações' },
];

export default function AppSidebar() {
  const { signOut, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-card border-r border-border h-screen sticky top-0">
      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight">FinançasPro</h1>
            <p className="text-xs text-muted-foreground truncate max-w-[160px]">{user?.email}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
              location.pathname === to
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-border space-y-0.5">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all w-full"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
        </button>
        <button
          onClick={signOut}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all w-full"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </aside>
  );
}
