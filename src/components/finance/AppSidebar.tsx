import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, TrendingUp, TrendingDown, Grid3X3, Landmark, CalendarDays,
  Settings, LogOut, Wallet, Moon, Sun, Upload, Brain, BarChart3, CreditCard,
  FileText, Trash2, Eye, EyeOff, Sparkles, ChevronRight, MessageSquarePlus, Inbox,
  PanelLeftClose, PanelLeftOpen, ChevronsLeft,
} from 'lucide-react';
import type { SidebarMode } from './AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useTrashCount } from '@/hooks/useTrash';
import { useFeedbackUnreadCount } from '@/hooks/useFeedback';
import { cn } from '@/lib/utils';
import { isAdminEmail } from '@/lib/admin';
import { useSensitiveData } from './SensitiveData';

type LinkItem = {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  accent?: string; // Tailwind text/bg color for the active state accent
};

const mainLinks: LinkItem[] = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', accent: 'primary' },
  { to: '/receitas', icon: TrendingUp, label: 'Receitas', accent: 'income' },
  { to: '/despesas', icon: TrendingDown, label: 'Despesas', accent: 'expense' },
  { to: '/investimentos', icon: BarChart3, label: 'Investimentos', accent: 'info' },
  { to: '/cartoes', icon: CreditCard, label: 'Cartões', accent: 'primary' },
];

const toolLinks: LinkItem[] = [
  { to: '/categorias', icon: Grid3X3, label: 'Categorias' },
  { to: '/contas', icon: Landmark, label: 'Contas' },
  { to: '/calendario', icon: CalendarDays, label: 'Calendário' },
  { to: '/relatorio', icon: FileText, label: 'Relatório' },
  { to: '/insights', icon: Brain, label: 'Insights IA' },
  { to: '/importar', icon: Upload, label: 'Importar' },
  { to: '/feedback', icon: MessageSquarePlus, label: 'Feedback' },
  { to: '/lixeira', icon: Trash2, label: 'Lixeira' },
  { to: '/configuracoes', icon: Settings, label: 'Configurações' },
];

function isLinkActive(pathname: string, to: string) {
  return pathname === to;
}

type AppSidebarProps = {
  mode: SidebarMode;
  onCollapse: () => void; // → trilho de ícones
  onExpand: () => void;   // → expandido
  onHide: () => void;     // → escondido
};

export default function AppSidebar({ mode, onCollapse, onExpand, onHide }: AppSidebarProps) {
  const collapsed = mode === 'rail';
  const { signOut, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isVisible, toggleVisibility } = useSensitiveData();
  const location = useLocation();
  const trashCount = useTrashCount();
  const feedbackUnread = useFeedbackUnreadCount();

  const renderLink = ({ to, icon: Icon, label, accent }: LinkItem) => {
    const active = isLinkActive(location.pathname, to);

    // Map accent name → tailwind classes for active background and side bar
    const accentMap: Record<string, { bg: string; bar: string; text: string; iconBg: string }> = {
      primary: { bg: 'bg-primary/10', bar: 'bg-primary', text: 'text-primary', iconBg: 'bg-primary/20' },
      income: { bg: 'bg-income/10', bar: 'bg-income', text: 'text-income', iconBg: 'bg-income/20' },
      expense: { bg: 'bg-expense/10', bar: 'bg-expense', text: 'text-expense', iconBg: 'bg-expense/20' },
      info: { bg: 'bg-info/10', bar: 'bg-info', text: 'text-info', iconBg: 'bg-info/20' },
    };
    const ac = accentMap[accent || 'primary'];

    const hasTrashBadge = to === '/lixeira' && trashCount > 0;
    const hasFeedbackBadge = to === '/feedback' && feedbackUnread > 0;

    return (
      <NavLink
        key={to}
        to={to}
        title={collapsed ? label : undefined}
        className={cn(
          'group/link relative flex items-center rounded-xl text-sm font-medium transition-all duration-200',
          collapsed ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-3 py-2.5',
          active
            ? `${ac.bg} ${ac.text} shadow-sm`
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
        )}
      >
        {/* Active accent bar */}
        {active && (
          <span className={cn('absolute -left-1 top-2 bottom-2 w-1 rounded-r-full', ac.bar)} />
        )}
        {/* Icon container */}
        <span className={cn(
          'w-7 h-7 rounded-lg flex items-center justify-center transition-all shrink-0',
          active ? ac.iconBg : 'bg-transparent group-hover/link:bg-muted',
        )}>
          <Icon className="w-3.5 h-3.5" />
        </span>
        {!collapsed && <span className="flex-1 truncate">{label}</span>}
        {!collapsed && hasTrashBadge && (
          <span className="text-[10px] bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded-full font-bold min-w-[18px] text-center shadow-sm shadow-destructive/30">
            {trashCount}
          </span>
        )}
        {!collapsed && hasFeedbackBadge && (
          <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full font-bold min-w-[18px] text-center shadow-sm shadow-primary/30">
            {feedbackUnread}
          </span>
        )}
        {!collapsed && active && !hasTrashBadge && !hasFeedbackBadge && (
          <ChevronRight className="w-3.5 h-3.5 opacity-50" />
        )}
        {/* Collapsed: small dot to signal pending count without the number */}
        {collapsed && (hasTrashBadge || hasFeedbackBadge) && (
          <span className={cn(
            'absolute top-1 right-1 w-2 h-2 rounded-full border border-card',
            hasTrashBadge ? 'bg-destructive' : 'bg-primary',
          )} />
        )}
      </NavLink>
    );
  };

  const renderSectionLabel = (label: string, extraTopPadding?: boolean) => {
    if (collapsed) {
      // Divisor sutil centralizado no lugar do rótulo da seção.
      return <div className={cn('mx-auto h-px w-8 rounded-full bg-border/60', extraTopPadding ? 'mt-5 mb-2' : 'mt-2 mb-2')} />;
    }
    return (
      <p className={cn('text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60 px-3 pb-2', extraTopPadding ? 'pt-5' : 'pt-2')}>
        {label}
      </p>
    );
  };

  return (
    <aside className={cn(
      'hidden lg:flex flex-col fixed left-0 top-0 bottom-0 z-30 border-r border-border/60 bg-gradient-to-b from-card via-card to-card/85 backdrop-blur-xl shadow-sm overflow-hidden transition-[width,transform] duration-300 ease-in-out',
      mode === 'hidden' ? 'w-[260px] -translate-x-full' : collapsed ? 'w-[76px] translate-x-0' : 'w-[260px] translate-x-0',
    )}
    aria-hidden={mode === 'hidden'}
    >
      {/* Decorative gradient blob */}
      <div className="pointer-events-none absolute -top-24 -left-12 w-56 h-56 rounded-full bg-primary/[0.07] blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -right-12 w-48 h-48 rounded-full bg-income/[0.04] blur-3xl" />

      {/* Brand header */}
      <div className={cn('relative z-10 border-b border-border/40', collapsed ? 'p-3' : 'p-5')}>
        <div className={cn('flex items-center', collapsed ? 'flex-col gap-2' : 'gap-3')}>
          <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/30 shrink-0">
            <Wallet className="w-5 h-5 text-primary-foreground" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-income border-2 border-card animate-pulse" />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <h1 className="font-extrabold text-sm tracking-tight flex items-center gap-1">
                FinancasPro
                <Sparkles className="w-3 h-3 text-primary opacity-70" />
              </h1>
              <p className="text-[10px] text-muted-foreground truncate max-w-[160px]">{user?.email}</p>
            </div>
          )}
          <div className={cn('flex items-center gap-1 shrink-0', collapsed && 'flex-col')}>
            <button
              onClick={collapsed ? onExpand : onCollapse}
              title={collapsed ? 'Expandir menu' : 'Recolher menu'}
              aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
            <button
              onClick={onHide}
              title="Esconder menu"
              aria-label="Esconder menu"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className={cn('relative z-10 flex-1 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden scrollbar-thin', collapsed ? 'px-2' : 'px-3')}>
        {renderSectionLabel('Principal')}
        {mainLinks.map(renderLink)}

        {renderSectionLabel('Ferramentas', true)}
        {toolLinks.map(renderLink)}

        {isAdminEmail(user?.email) && (
          <>
            {renderSectionLabel('Administração', true)}
            {renderLink({ to: '/admin/feedback', icon: Inbox, label: 'Central de Feedback', accent: 'primary' })}
          </>
        )}
      </nav>

      {/* Footer actions */}
      <div className={cn('relative z-10 border-t border-border/40 space-y-0.5 bg-card/50', collapsed ? 'p-2' : 'p-3')}>
        <button
          onClick={toggleVisibility}
          title={collapsed ? (isVisible ? 'Ocultar valores' : 'Mostrar valores') : undefined}
          className={cn(
            'group/btn flex items-center rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-200 w-full',
            collapsed ? 'justify-center px-0 py-2' : 'gap-2.5 px-3 py-2',
          )}
        >
          <span className="w-7 h-7 rounded-lg flex items-center justify-center bg-muted/40 group-hover/btn:bg-muted transition-colors shrink-0">
            {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </span>
          {!collapsed && <span className="flex-1 text-left">{isVisible ? 'Ocultar valores' : 'Mostrar valores'}</span>}
        </button>
        <button
          onClick={toggleTheme}
          title={collapsed ? (theme === 'dark' ? 'Modo claro' : 'Modo escuro') : undefined}
          className={cn(
            'group/btn flex items-center rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-200 w-full',
            collapsed ? 'justify-center px-0 py-2' : 'gap-2.5 px-3 py-2',
          )}
        >
          <span className="w-7 h-7 rounded-lg flex items-center justify-center bg-muted/40 group-hover/btn:bg-muted transition-colors shrink-0">
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-warning" /> : <Moon className="w-3.5 h-3.5" />}
          </span>
          {!collapsed && <span className="flex-1 text-left">{theme === 'dark' ? 'Modo claro' : 'Modo escuro'}</span>}
        </button>
        <button
          onClick={signOut}
          title={collapsed ? 'Sair' : undefined}
          className={cn(
            'group/btn flex items-center rounded-xl text-xs font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all duration-200 w-full',
            collapsed ? 'justify-center px-0 py-2' : 'gap-2.5 px-3 py-2',
          )}
        >
          <span className="w-7 h-7 rounded-lg flex items-center justify-center bg-muted/40 group-hover/btn:bg-destructive/10 transition-colors shrink-0">
            <LogOut className="w-3.5 h-3.5" />
          </span>
          {!collapsed && <span className="flex-1 text-left">Sair</span>}
        </button>
      </div>
    </aside>
  );
}
