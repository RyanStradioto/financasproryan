import { NavLink, useLocation } from 'react-router-dom';
import {
  BarChart3,
  CalendarDays,
  CreditCard,
  FileText,
  Landmark,
  LayoutDashboard,
  Lightbulb,
  MoreHorizontal,
  PiggyBank,
  Settings,
  Tags,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  WalletCards,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/receitas', icon: TrendingUp, label: 'Receitas' },
  { to: '/despesas', icon: TrendingDown, label: 'Despesas' },
  { to: '/cartoes', icon: CreditCard, label: 'Cartões' },
];

const moreLinks = [
  { to: '/categorias', icon: Tags, label: 'Categorias' },
  { to: '/contas', icon: Landmark, label: 'Contas' },
  { to: '/planejamento', icon: WalletCards, label: 'Planejamento' },
  { to: '/calendario', icon: CalendarDays, label: 'Calendário' },
  { to: '/investimentos', icon: PiggyBank, label: 'Investimentos' },
  { to: '/insights', icon: Lightbulb, label: 'Insights' },
  { to: '/relatorio', icon: FileText, label: 'Relatório' },
  { to: '/importar', icon: Upload, label: 'Importar' },
  { to: '/lixeira', icon: Trash2, label: 'Lixeira' },
  { to: '/configuracoes', icon: Settings, label: 'Configurações' },
];

function isActive(pathname: string, linkTo: string) {
  return pathname === linkTo;
}

export default function MobileNav() {
  const location = useLocation();
  const moreActive = moreLinks.some((link) => isActive(location.pathname, link.to));

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-card/90 backdrop-blur-xl border-t border-border/50 z-50 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
      <div className="flex px-1">
        {links.map(({ to, icon: Icon, label }) => {
          const active = isActive(location.pathname, to);
          return (
            <NavLink
              key={to}
              to={to}
              className={cn(
                'relative flex flex-1 flex-col items-center gap-0.5 px-1 py-2.5 text-[10px] font-medium transition-all duration-200 touch-manipulation',
                active ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              {active && <div className="absolute -top-0.5 w-8 h-0.5 rounded-full bg-primary" />}
              <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center transition-all', active ? 'bg-primary/10 scale-105' : '')}>
                <Icon className="w-[18px] h-[18px]" />
              </div>
              <span className="truncate">{label}</span>
            </NavLink>
          );
        })}

        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Abrir mais abas"
              className={cn(
                'relative flex flex-1 flex-col items-center gap-0.5 px-1 py-2.5 text-[10px] font-medium transition-all duration-200 touch-manipulation',
                moreActive ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              {moreActive && <div className="absolute -top-0.5 w-8 h-0.5 rounded-full bg-primary" />}
              <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center transition-all', moreActive ? 'bg-primary/10 scale-105' : '')}>
                <MoreHorizontal className="w-[18px] h-[18px]" />
              </div>
              <span>Mais</span>
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="center" className="mb-2 w-[calc(100vw-1rem)] rounded-2xl p-2 shadow-2xl">
            <div className="mb-2 flex items-center gap-2 px-2 pt-1 text-xs font-bold text-muted-foreground">
              <BarChart3 className="h-3.5 w-3.5" />
              Todas as abas
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {moreLinks.map(({ to, icon: Icon, label }) => {
                const active = isActive(location.pathname, to);
                return (
                  <PopoverClose asChild key={to}>
                    <NavLink
                      to={to}
                      className={cn(
                        'flex min-w-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                        active ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{label}</span>
                    </NavLink>
                  </PopoverClose>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </nav>
  );
}
