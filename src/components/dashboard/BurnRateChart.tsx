/**
 * Burn Rate chart — cumulative spending vs ideal pace, with projection.
 *
 * Shows: actual spending curve up to today + projected line for rest of month.
 * Highlights overrun risk with a banner.
 */

import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, TrendingUp } from 'lucide-react';
import { Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceLine, Tooltip as RechartsTooltip, Area, ComposedChart } from 'recharts';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { BurnRatePoint } from '@/lib/dashboardAnalytics';

/**
 * Hook hyper-light para saber se está em viewport mobile.
 * Não usa context — apenas window.matchMedia.
 */
function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < breakpoint);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    setIsMobile(mq.matches);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);
  return isMobile;
}

interface Props {
  points: BurnRatePoint[];
  projectedTotal: number;
  willOverrun: boolean;
  monthBudget: number;
  todaySpent: number;
  dayOfMonth: number;
  maskCurrency: (s: string) => string;
}

export default function BurnRateChart({
  points, projectedTotal, willOverrun, monthBudget, todaySpent, dayOfMonth, maskCurrency,
}: Props) {
  const isMobile = useIsMobile(640);
  const chartData = useMemo(() => {
    // Find the last "real" point (today) so projection line connects from there
    const lastRealIdx = points.findIndex(p => p.isProjection) - 1;
    const todayValue = lastRealIdx >= 0 ? points[lastRealIdx].cumulativeActual : 0;
    return points.map((p, i) => ({
      day: p.day,
      real: p.isProjection ? null : p.cumulativeActual,
      // projected starts from "today" point so the line connects visually
      projected: p.isProjection ? p.cumulativeActual : (i === lastRealIdx ? todayValue : null),
      ideal: p.cumulativeIdeal,
    }));
  }, [points]);

  if (monthBudget === 0) {
    return (
      <div className="rounded-3xl border border-border/60 bg-card/70 backdrop-blur-sm p-5 sm:p-6 shadow-sm flex flex-col">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/15">
            <Activity className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold leading-tight">Burn Rate</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Ritmo de gasto vs orcamento</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center text-center py-10 text-muted-foreground">
          <Activity className="w-10 h-10 opacity-20 mb-3" />
          <p className="text-sm">Sem orcamento configurado</p>
          <p className="text-xs mt-1">
            Configure orcamento mensal nas <a href="/categorias" className="text-primary hover:underline">categorias</a>
          </p>
        </div>
      </div>
    );
  }

  const overrunPct = monthBudget > 0 ? ((projectedTotal - monthBudget) / monthBudget) * 100 : 0;

  return (
    <div className="rounded-3xl border border-border/60 bg-card/70 backdrop-blur-sm p-3 sm:p-6 shadow-sm overflow-hidden">
      <div className="flex flex-col gap-3 mb-4 min-[480px]:flex-row min-[480px]:items-start min-[480px]:justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/25 to-primary/5 flex items-center justify-center border border-primary/15 shrink-0">
            <Activity className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-black tracking-tight leading-tight">Burn Rate</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">Gasto cumulativo vs ritmo ideal</p>
          </div>
        </div>
        <div className={cn('inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border max-w-full',
          willOverrun ? 'bg-expense/10 text-expense border-expense/20' : 'bg-income/10 text-income border-income/20',
        )}>
          {willOverrun ? <AlertTriangle className="w-3 h-3 shrink-0" /> : <TrendingUp className="w-3 h-3 shrink-0" />}
          <span className="truncate">
            Previsão: {maskCurrency(formatCurrency(projectedTotal))}
            {monthBudget > 0 && (
              <span className="opacity-80 ml-1">({overrunPct >= 0 ? '+' : ''}{overrunPct.toFixed(0)}%)</span>
            )}
          </span>
        </div>
      </div>

      <div className="w-full h-[200px] sm:h-[260px] lg:h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: isMobile ? 4 : 12, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="burnReal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} vertical={false} />
            <XAxis
              dataKey="day"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={isMobile ? 16 : 8}
            />
            <YAxis
              tickFormatter={v => `${Math.round(Number(v) / 1000)}k`}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              width={isMobile ? 28 : 38}
            />
            <RechartsTooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="rounded-xl border border-border/70 bg-card/95 backdrop-blur-sm px-3 py-2 shadow-lg space-y-1">
                    <p className="text-[11px] font-bold mb-1">Dia {label}</p>
                    {payload.map((p, i) => p.value !== null && (
                      <p key={i} className="text-[10px] flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                        <span className="text-muted-foreground">{p.dataKey === 'real' ? 'Real' : p.dataKey === 'projected' ? 'Projeção' : 'Ideal'}:</span>
                        <span className="font-semibold tabular-nums">{maskCurrency(formatCurrency(Number(p.value)))}</span>
                      </p>
                    ))}
                  </div>
                );
              }}
            />
            <ReferenceLine
              y={monthBudget}
              stroke="hsl(0, 72%, 51%)"
              strokeDasharray="4 4"
              strokeOpacity={0.6}
              label={isMobile ? undefined : { value: 'Orçamento', position: 'right', fill: 'hsl(0, 72%, 51%)', fontSize: 9 }}
            />
            <Area
              type="monotone"
              dataKey="real"
              stroke="hsl(var(--primary))"
              strokeWidth={2.5}
              fill="url(#burnReal)"
              connectNulls={false}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="projected"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              strokeDasharray="6 4"
              connectNulls={false}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="ideal"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={1.5}
              strokeOpacity={0.5}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-3 pt-3 border-t border-border/40 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-primary rounded" /> Real (dia {dayOfMonth})</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 border-t-2 border-dashed border-primary" /> Projeção</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-muted-foreground/50 rounded" /> Ritmo ideal</span>
        {monthBudget > 0 && (
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 border-t-2 border-dashed border-expense" /> Orçamento</span>
        )}
      </div>
    </div>
  );
}
