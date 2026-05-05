import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, TrendingUp, TrendingDown, BarChart3, CreditCard, Grid3X3, FileText, Brain, Settings, Landmark, Trash2, CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils';

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Home' },
  { to: '/receitas', icon: TrendingUp, label: 'Receitas' },
  { to: '/despesas', icon: TrendingDown, label: 'Despesas' },
  { to: '/investimentos', icon: BarChart3, label: 'Investir' },
  { to: '/contas', icon: Landmark, label: 'Contas' },
  { to: '/planejamento', icon: CalendarClock, label: 'Plano' },
  { to: '/cartoes', icon: CreditCard, label: 'Cartões' },
  { to: '/categorias', icon: Grid3X3, label: 'Categorias' },
  { to: '/relatorio', icon: FileText, label: 'Relatório' },
  { to: '/insights', icon: Brain, label: 'IA' },
  { to: '/lixeira', icon: Trash2, label: 'Lixeira' },
  { to: '/configuracoes', icon: Settings, label: 'Config' },
];

export default function MobileNav() {
  const location = useLocation();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-card/90 backdrop-blur-xl border-t border-border/50 z-50 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
      <div className="flex overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {links.map(({ to, icon: Icon, label }) => {
          const isActive = location.pathname === to;
          return (
            <NavLink
              key={to}
              to={to}
              className={cn(
                'flex flex-col items-center gap-0.5 py-2.5 px-3 text-[10px] font-medium transition-all duration-200 flex-1 shrink-0 min-w-[54px] relative',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              {isActive && (
                <div className="absolute -top-0.5 w-8 h-0.5 rounded-full bg-primary" />
              )}
              <div className={cn(
                'w-8 h-8 rounded-xl flex items-center justify-center transition-all',
                isActive ? 'bg-primary/10 scale-105' : ''
              )}>
                <Icon className="w-4.5 h-4.5" />
              </div>
              <span className="truncate">{label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

