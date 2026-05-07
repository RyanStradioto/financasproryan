/**
 * Anomaly Alerts — highlights expenses that are unusually high vs the user's average.
 *
 * Helps catch typos (R$340 instead of R$34) or atypical spending.
 */

import { AlertTriangle, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Anomaly } from '@/lib/dashboardAnalytics';

interface CategoryRef {
  id: string;
  name: string;
  icon: string;
}

interface Props {
  anomalies: Anomaly[];
  categories: CategoryRef[];
  maskCurrency: (s: string) => string;
}

export default function AnomalyAlerts({ anomalies, categories, maskCurrency }: Props) {
  if (anomalies.length === 0) return null;

  const catMap: Record<string, CategoryRef> = {};
  for (const c of categories) catMap[c.id] = c;

  return (
    <div className="rounded-3xl border border-warning/30 bg-warning/5 p-5 sm:p-6 shadow-sm">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-xl bg-warning/15 flex items-center justify-center">
          <AlertTriangle className="w-4 h-4 text-warning" />
        </div>
        <div>
          <h3 className="text-sm font-bold leading-tight">Gastos atipicos</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {anomalies.length} despesa{anomalies.length !== 1 ? 's' : ''} acima do habitual
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {anomalies.map((a, i) => {
          const cat = a.category_id ? catMap[a.category_id] : null;
          return (
            <div key={i} className="rounded-xl bg-card/60 border border-border/40 px-3 py-2.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-warning/10 border border-warning/20 flex items-center justify-center text-base shrink-0">
                {cat?.icon || '⚠️'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{a.description}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {formatDate(a.date)} · {cat?.name || 'Sem categoria'} · media {maskCurrency(formatCurrency(a.averageForCategory))}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold tabular-nums text-warning">
                  {maskCurrency(formatCurrency(a.amount))}
                </p>
                <p className="text-[10px] text-warning/80 font-semibold">
                  {a.multiplier.toFixed(1)}x media
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground mt-3 italic">
        Verifique se esses lancamentos estao corretos ou se houve erro de digitacao.
      </p>
    </div>
  );
}
