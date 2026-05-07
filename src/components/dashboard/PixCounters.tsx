/**
 * Pix Counterparties — top 5 people you send to / receive from.
 *
 * Aggregates Pix transactions by counterparty name.
 * Shows net balance (positive = receives more than sends).
 */

import { Users, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';
import type { PixCounterparty } from '@/lib/dashboardAnalytics';

interface Props {
  counterparties: PixCounterparty[];
  maskCurrency: (s: string) => string;
  maskText: (s: string) => string;
  isVisible: boolean;
  limit?: number;
}

export default function PixCounters({ counterparties, maskCurrency, maskText, isVisible, limit = 5 }: Props) {
  const top = counterparties.slice(0, limit);

  if (top.length === 0) return null;

  return (
    <div className="rounded-3xl border border-border/60 bg-card/70 backdrop-blur-sm p-5 sm:p-6 shadow-sm">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/15">
          <Users className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-bold leading-tight">Top contatos Pix</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">Saldo liquido por pessoa</p>
        </div>
      </div>

      <div className="space-y-1.5">
        {top.map(p => {
          const isPositive = p.net >= 0;
          const initial = p.name.slice(0, 1).toUpperCase();
          return (
            <div key={p.name} className="rounded-lg bg-muted/30 hover:bg-muted/50 px-3 py-2.5 flex items-center gap-3 transition-colors">
              <div className={cn(
                'w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0',
                isPositive ? 'bg-income/15 text-income' : 'bg-expense/15 text-expense',
              )}>
                {initial}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate">
                  {isVisible ? p.name : maskText(p.name)}
                </p>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  {p.totalIn > 0 && (
                    <span className="flex items-center gap-0.5 text-income">
                      <ArrowDownRight className="w-2.5 h-2.5" />
                      {maskCurrency(formatCurrency(p.totalIn))}
                    </span>
                  )}
                  {p.totalOut > 0 && (
                    <span className="flex items-center gap-0.5 text-expense">
                      <ArrowUpRight className="w-2.5 h-2.5" />
                      {maskCurrency(formatCurrency(p.totalOut))}
                    </span>
                  )}
                  <span className="text-muted-foreground/60">· {p.transactions}x</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className={cn('text-sm font-bold tabular-nums', isPositive ? 'text-income' : 'text-expense')}>
                  {isPositive ? '+' : ''}{maskCurrency(formatCurrency(p.net))}
                </p>
                <p className="text-[9px] text-muted-foreground">saldo</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
