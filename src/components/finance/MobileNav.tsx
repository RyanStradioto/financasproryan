import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, TrendingUp, TrendingDown, Grid3X3, Landmark, Settings, Upload, Brain, BarChart3, CreditCard, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Home' },
  { to: '/receitas', icon: TrendingUp, label: 'Receitas' },
  { to: '/despesas', icon: TrendingDown, label: 'Despesas' },
  { to: '/investimentos', icon: BarChart3, label: 'Investir' },
  { to: '/cartoes', icon: CreditCard, label: 'Cartões' },
  { to: '/relatorio', icon: FileText, label: 'Relatório' },
  { to: '/insights', icon: Brain, label: 'IA' },
  { to: '/configuracoes', icon: Settings, label: 'Config' },
];

export default function MobileNav() {
  const location = useLocation();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-t border-border z-50 px-2 pb-[env(safe-area-inset-bottom)]">
      <div className="flex justify-around">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={cn(
              'flex flex-col items-center gap-0.5 py-2 px-2 text-[10px] font-medium transition-colors min-w-0',
              location.pathname === to ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <Icon className="w-5 h-5" />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
