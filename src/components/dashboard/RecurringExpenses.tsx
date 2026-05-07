/**
 * Recurring Expenses Detector — clusters detected recurring expenses,
 * shows monthly cost summary so user can spot subscriptions and fixed costs.
 */

import { useState } from 'react';
import { Repeat, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/lib/format';
import type { RecurringExpense } from '@/lib/dashboardAnalytics';

interface CategoryRef {
  id: string;
  name: string;
  icon: string;
}

interface Props {
  recurring: RecurringExpense[];
  categories: CategoryRef[];
  maskCurrency: (s: string) => string;
  limit?: number;
}

export default function RecurringExpenses({ recurring, categories, maskCurrency, limit = 6 }: Props) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? recurring : recurring.slice(0, limit);
  const totalMonthly = recurring.reduce((s, r) => s + r.monthlyCost, 0);

  const catMap: Record<string, CategoryRef> = {};
  for (const c of categories) catMap[c.id] = c;

  if (recurring.length === 0) {
    return (
      <div className="rounded-3xl border border-border/60 bg-card/70 backdrop-blur-sm p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-warning/20 to-warning/5 flex items-center justify-center border border-warning/15">
            <Repeat className="w-4 h-4 text-warning" />
          </div>
          <div>
            <h3 className="text-sm font-bold leading-tight">Despesas recorrentes</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Detectadas automaticamente</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground text-center py-6">
          Nenhuma despesa recorrente detectada ainda.
          <br />
          <span className="text-[10px]">(Precisa de pelo menos 3 ocorrencias com mesma descricao)</span>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-border/60 bg-card/70 backdrop-blur-sm p-5 sm:p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-warning/20 to-warning/5 flex items-center justify-center border border-warning/15">
            <Repeat className="w-4 h-4 text-warning" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold leading-tight">Despesas recorrentes</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
              {recurring.length} detectadas · {maskCurrency(formatCurrency(totalMonthly))}/mes
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        {visible.map(r => {
          const cat = r.category_id ? catMap[r.category_id] : null;
          return (
            <div key={r.signature} className="rounded-lg bg-muted/30 hover:bg-muted/50 px-3 py-2 flex items-center gap-2.5 transition-colors">
              <div className="w-7 h-7 rounded-lg bg-card border border-border/40 flex items-center justify-center text-sm shrink-0">
                {cat?.icon || '🔁'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate">{r.description}</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {r.occurrences}x · ult. {formatDate(r.lastDate)}{cat ? ` · ${cat.name}` : ''}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-bold tabular-nums">{maskCurrency(formatCurrency(r.averageAmount))}</p>
                <p className="text-[9px] text-muted-foreground tabular-nums">{maskCurrency(formatCurrency(r.monthlyCost))}/mes</p>
              </div>
            </div>
          );
        })}
      </div>

      {recurring.length > limit && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="mt-3 w-full text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 py-1.5 rounded-lg hover:bg-muted/40 transition-colors"
        >
          {expanded ? <>Mostrar menos <ChevronUp className="w-3 h-3" /></> : <>Ver mais {recurring.length - limit} <ChevronDown className="w-3 h-3" /></>}
        </button>
      )}
    </div>
  );
}
