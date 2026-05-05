import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  Landmark,
  CalendarDays,
  Settings,
  LogOut,
  Wallet,
  Moon,
  Sun,
  Upload,
  Brain,
  BarChart3,
  CreditCard,
  FileText,
  Trash2,
  Eye,
  EyeOff,
  Target,
  Grid3X3,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useTrashCount } from '@/hooks/useTrash';
import { cn } from '@/lib/utils';
import { useSensitiveData } from './SensitiveData';

const mainLinks = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/planejamento', icon: Target, label: 'Planejamento' },
  { to: '/receitas', icon: TrendingUp, label: 'Receitas' },
  { to: '/despesas', icon: TrendingDown, label: 'Despesas' },
  { to: '/investimentos', icon: BarChart3, label: 'Investimentos' },
  { to: '/cartoes', icon: CreditCard, label: 'Cartoes' },
];

const toolLinks = [
  { to: '/categorias', icon: Grid3X3, label: 'Categorias' },
  { to: '/contas', icon: Landmark, label: 'Contas' },
  { to: '/calendario', icon: CalendarDays, label: 'Calendario' },
  { to: '/relatorio', icon: FileText, label: 'Relatorio' },
  { to: '/insights', icon: Brain, label: 'Insights IA' },
  { to: '/importar', icon: Upload, label: 'Importar' },
  { to: '/lixeira', icon: Trash2, label: 'Lixeira' },
  { to: '/configuracoes', icon: Settings, label: 'Configuracoes' },
];

function isLinkActive(pathname: string, to: string) {
  if (pathname === to) return true;
  return false;
}

export default function AppSidebar() {
  const { signOut, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isVisible, toggleVisibility } = useSensitiveData();
  const location = useLocation();
  const trashCount = useTrashCount();

  const renderLink = ({ to, icon: Icon, label }: { to: string; icon: typeof LayoutDashboard; label: string }) => {
    const active = isLinkActive(location.pathname, to);

    return (
      <NavLink
        key={to}
        to={to}
        className={cn(
          'flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
          active
            ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted',
        )}
      >
        <Icon className="w-4 h-4" />
        {label}
        {to === '/lixeira' && trashCount > 0 && (
          <span className="ml-auto text-[10px] bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded-full font-bold min-w-[18px] text-center">
            {trashCount}
          </span>
        )}
      </NavLink>
    );
  };

  return (
    <aside className="hidden lg:flex flex-col w-[260px] bg-card/50 backdrop-blur-sm border-r border-border/50 h-screen sticky top-0">
      <div className="p-5 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
            <Wallet className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight">FinancasPro</h1>
            <p className="text-[11px] text-muted-foreground truncate max-w-[160px]">{user?.email}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 px-3 pt-2 pb-1">Principal</p>
        {mainLinks.map(renderLink)}

        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 px-3 pt-4 pb-1">Ferramentas</p>
        {toolLinks.map(renderLink)}
      </nav>

      <div className="p-3 border-t border-border/50 space-y-0.5">
        <button
          onClick={toggleVisibility}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200 w-full"
        >
          {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {isVisible ? 'Ocultar Valores' : 'Mostrar Valores'}
        </button>
        <button
          onClick={toggleTheme}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200 w-full"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
        </button>
        <button
          onClick={signOut}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all duration-200 w-full"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </aside>
  );
}
