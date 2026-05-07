/**
 * Six-month stacked overview — shows last 6 months as horizontal bars
 * (income vs expense vs sobra) for at-a-glance trend reading.
 */

import { useMemo } from 'react';
import { CalendarRange } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';

export interface MonthSummary {
  month: string;        // YYYY-MM
  label: string;        // Jan/26
  income: number;
  expenses: number;
  sobra: number;
}

interface Props {
  months: MonthSummary[];
  maskCurrency: (s: string) => string;
}

export default function SixMonthStack({ months, maskCurrency }: Props) {
  const maxValue = useMemo(() => {
    let max = 0;
    for (const m of months) {
      max = Math.max(max, m.income, m.expenses);
    }
    return max || 1;
  }, [months]);

  return (
    <div className="rounded-3xl border border-border/60 bg-card/70 backdrop-blur-sm p-5 sm:p-6 shadow-sm">
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-info/20 to-info/5 flex items-center justify-center border border-info/15">
          <CalendarRange className="w-4 h-4 text-info" />
        </div>
        <div>
          <h3 className="text-sm font-bold leading-tight">Ultimos 6 meses</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">Receita · Despesa · Sobra</p>
        </div>
      </div>

      <div className="space-y-3">
        {months.map(m => {
          const incomePct = (m.income / maxValue) * 100;
          const expensePct = (m.expenses / maxValue) * 100;
          const sobraPositive = m.sobra >= 0;
          return (
            <div key={m.month} className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold w-12 shrink-0">{m.label}</span>
                <span className={cn('text-[10px] font-semibold tabular-nums',
                  sobraPositive ? 'text-income' : 'text-expense',
                )}>
                  {sobraPositive ? '+' : ''}{maskCurrency(formatCurrency(m.sobra))}
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
                    <div className="h-full bg-income rounded-full transition-all duration-700" style={{ width: `${incomePct}%` }} />
                  </div>
                  <span className="text-[9px] tabular-nums text-muted-foreground w-16 text-right">
                    {maskCurrency(formatCurrency(m.income))}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
                    <div className="h-full bg-expense rounded-full transition-all duration-700" style={{ width: `${expensePct}%` }} />
                  </div>
                  <span className="text-[9px] tabular-nums text-muted-foreground w-16 text-right">
                    {maskCurrency(formatCurrency(m.expenses))}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 mt-4 pt-3 border-t border-border/40 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-income" /> Receita</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-expense" /> Despesa</span>
      </div>
    </div>
  );
}
