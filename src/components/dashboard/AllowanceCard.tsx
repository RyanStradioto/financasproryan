/**
 * Daily Allowance card — answers the most important question:
 * "How much can I spend per day until end of month?"
 */

import { CalendarRange, Flame, AlertTriangle, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';
import type { AllowanceResult } from '@/lib/dashboardAnalytics';

interface Props {
  allowance: AllowanceResult;
  todaySpent?: number;
  maskCurrency: (s: string) => string;
}

export default function AllowanceCard({ allowance, todaySpent = 0, maskCurrency }: Props) {
  const { remainingDays, perDayAllowance, remainingBudget, monthBudget, monthSpent } = allowance;
  const exceededToday = todaySpent > perDayAllowance && perDayAllowance > 0;
  const noBudget = monthBudget === 0;
  const overBudget = monthSpent > monthBudget && monthBudget > 0;

  const statusColor = noBudget
    ? 'border-muted-foreground/30 bg-muted/20'
    : overBudget
      ? 'border-expense/40 bg-expense/5'
      : exceededToday
        ? 'border-warning/40 bg-warning/5'
        : 'border-income/40 bg-income/5';

  const accentText = overBudget
    ? 'text-expense'
    : exceededToday
      ? 'text-warning'
      : 'text-income';

  return (
    <div className={cn('relative overflow-hidden rounded-3xl border p-5 sm:p-6 shadow-sm', statusColor)}>
      <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full opacity-30 blur-3xl pointer-events-none"
        style={{ background: overBudget ? 'rgb(239 68 68)' : exceededToday ? 'rgb(245 158 11)' : 'rgb(16 185 129)' }} />

      <div className="relative z-10 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
              overBudget ? 'bg-expense/15 text-expense' : exceededToday ? 'bg-warning/15 text-warning' : 'bg-income/15 text-income',
            )}>
              <Flame className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground leading-none">
                Allowance Diaria
              </p>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {remainingDays} dia{remainingDays !== 1 ? 's' : ''} ate o fim do mes
              </p>
            </div>
          </div>
        </div>

        {noBudget ? (
          <div className="text-center py-3">
            <p className="text-xs text-muted-foreground mb-2">
              Defina orcamentos por categoria para ver sua allowance diaria
            </p>
            <a href="/categorias" className="text-xs text-primary font-semibold hover:underline">
              Configurar orcamentos →
            </a>
          </div>
        ) : overBudget ? (
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <p className="text-3xl sm:text-4xl font-extrabold tabular-nums text-expense">
                {maskCurrency(formatCurrency(monthSpent - monthBudget))}
              </p>
              <p className="text-xs text-muted-foreground">acima do orcamento</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-expense">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="font-semibold">Limite estourado — qualquer gasto agora e deficit</span>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <p className={cn('text-3xl sm:text-4xl font-extrabold tabular-nums', accentText)}>
                {maskCurrency(formatCurrency(perDayAllowance))}
              </p>
              <p className="text-xs text-muted-foreground">/dia</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {maskCurrency(formatCurrency(remainingBudget))} restantes ÷ {remainingDays} dias
            </p>
          </div>
        )}

        {/* Today's spent indicator */}
        {!noBudget && todaySpent > 0 && (
          <div className={cn('rounded-lg border px-3 py-2 text-xs flex items-center justify-between',
            exceededToday ? 'bg-warning/10 border-warning/30' : 'bg-background/50 border-border/40',
          )}>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <CalendarRange className="w-3 h-3" /> Gasto de hoje
            </span>
            <span className={cn('font-bold tabular-nums', exceededToday ? 'text-warning' : 'text-foreground')}>
              {maskCurrency(formatCurrency(todaySpent))}
              {exceededToday && <span className="ml-1.5 text-[10px] font-medium opacity-80">(acima do dia)</span>}
            </span>
          </div>
        )}

        {/* Budget progress bar */}
        {!noBudget && (
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{maskCurrency(formatCurrency(monthSpent))}</span>
              <span>{maskCurrency(formatCurrency(monthBudget))}</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-700',
                  overBudget ? 'bg-expense' : exceededToday ? 'bg-warning' : 'bg-income',
                )}
                style={{ width: `${Math.min(100, (monthSpent / monthBudget) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
