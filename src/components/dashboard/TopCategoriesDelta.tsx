/**
 * Top Categories Delta — top 5 categories by absolute change vs previous month.
 *
 * Replaces the static category donut with something more actionable:
 * shows which categories are GROWING or SHRINKING the most, with %.
 */

import { TrendingUp, TrendingDown, Minus, Plus, Target, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';
import type { CategoryDelta } from '@/lib/dashboardAnalytics';

interface CategoryRef {
  id: string;
  name: string;
  icon: string;
  monthly_budget?: number | null;
}

interface Props {
  deltas: CategoryDelta[];
  categories: CategoryRef[];
  maskCurrency: (s: string) => string;
  limit?: number;
}

export default function TopCategoriesDelta({ deltas, categories, maskCurrency, limit = 5 }: Props) {
  const top = deltas.slice(0, limit);

  const catMap: Record<string, CategoryRef> = {};
  for (const c of categories) catMap[c.id] = c;

  if (top.length === 0) {
    return (
      <div className="rounded-3xl border border-border/60 bg-card/70 backdrop-blur-sm p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-info/20 to-info/5 flex items-center justify-center border border-info/15">
            <Target className="w-4 h-4 text-info" />
          </div>
          <div>
            <h3 className="text-sm font-bold leading-tight">Maiores variacoes</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Mudanca por categoria</p>
          </div>
        </div>
        <div className="text-center py-8 text-xs text-muted-foreground">
          Sem historico suficiente para comparar.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-border/60 bg-card/70 backdrop-blur-sm p-5 sm:p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-info/20 to-info/5 flex items-center justify-center border border-info/15">
            <Target className="w-4 h-4 text-info" />
          </div>
          <div>
            <h3 className="text-sm font-bold leading-tight">Maiores variacoes</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Vs mes anterior</p>
          </div>
        </div>
        <a href="/relatorio" className="text-[11px] text-primary hover:underline font-medium flex items-center gap-0.5">
          Relatorio <ChevronRight className="w-3 h-3" />
        </a>
      </div>

      <div className="space-y-2">
        {top.map(d => {
          const cat = catMap[d.category_id];
          const name = cat?.name || (d.category_id === '__uncat' ? 'Sem categoria' : 'Outros');
          const icon = cat?.icon || '📊';
          const isUp = d.trend === 'up' || d.trend === 'new';
          const isDown = d.trend === 'down';
          const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
          const sign = d.deltaAbs >= 0 ? '+' : '';

          return (
            <div key={d.category_id} className="rounded-xl bg-muted/40 hover:bg-muted/60 px-3 py-2.5 flex items-center gap-3 transition-colors">
              <div className="w-9 h-9 rounded-lg bg-card border border-border/40 flex items-center justify-center text-base shrink-0">
                {icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold truncate">{name}</p>
                  {d.trend === 'new' && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-info/15 text-info">
                      Novo
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground truncate">
                  {maskCurrency(formatCurrency(d.previous))} → {maskCurrency(formatCurrency(d.current))}
                </p>
              </div>
              <div className={cn(
                'flex flex-col items-end shrink-0',
                isUp ? 'text-expense' : isDown ? 'text-income' : 'text-muted-foreground',
              )}>
                <div className="flex items-center gap-1 text-sm font-bold tabular-nums">
                  <Icon className="w-3 h-3" />
                  {d.deltaPct !== null ? `${sign}${d.deltaPct.toFixed(0)}%` : 'Novo'}
                </div>
                <p className="text-[10px] tabular-nums opacity-80">
                  {sign}{maskCurrency(formatCurrency(d.deltaAbs))}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
