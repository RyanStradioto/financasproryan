/**
 * DailyFlowChart — income and expenses by day of month.
 *
 * Shows bars for each day (income up, expenses down style),
 * with a running balance line and today highlighted.
 */

import { useMemo } from 'react';
import { CalendarDays, TrendingUp } from 'lucide-react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, ReferenceLine, Cell, defs, linearGradient,
} from 'recharts';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Transaction {
  date: string;
  amount: number;
}

interface Props {
  income: Transaction[];
  expenses: Transaction[];
  month: string; // YYYY-MM
  maskCurrency: (s: string) => string;
}

const CustomTooltip = ({
  active, payload, label, maskCurrency,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color?: string }>;
  label?: number;
  maskCurrency: (s: string) => string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/15 bg-[#0d1420]/95 backdrop-blur-md px-3.5 py-2.5 shadow-2xl shadow-black/50 min-w-[160px]">
      <p className="text-[11px] font-black text-slate-300 mb-2">Dia {label}</p>
      <div className="space-y-1.5">
        {payload.map((p, i) => {
          if (p.name === 'Saldo' && p.value === 0) return null;
          return (
            <div key={i} className="flex items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                <span className="text-slate-400 font-semibold">{p.name}</span>
              </div>
              <span className="font-black tabular-nums" style={{ color: p.color }}>
                {maskCurrency(formatCurrency(Math.abs(p.value)))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function DailyFlowChart({ income, expenses, month, maskCurrency }: Props) {
  const today = new Date();
  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const isCurrentMonth = today.getFullYear() === y && (today.getMonth() + 1) === m;
  const todayDay = isCurrentMonth ? today.getDate() : null;

  const data = useMemo(() => {
    const incomeByDay: Record<number, number> = {};
    const expensesByDay: Record<number, number> = {};

    for (const tx of income) {
      if (!tx.date?.startsWith(month)) continue;
      const day = parseInt(tx.date.slice(8, 10), 10);
      incomeByDay[day] = (incomeByDay[day] || 0) + tx.amount;
    }
    for (const tx of expenses) {
      if (!tx.date?.startsWith(month)) continue;
      const day = parseInt(tx.date.slice(8, 10), 10);
      expensesByDay[day] = (expensesByDay[day] || 0) + tx.amount;
    }

    let runningBalance = 0;
    return Array.from({ length: lastDay }, (_, i) => {
      const day = i + 1;
      const inc = incomeByDay[day] || 0;
      const exp = expensesByDay[day] || 0;
      runningBalance += inc - exp;
      return {
        day,
        income: inc,
        expenses: exp,
        balance: runningBalance,
        isToday: day === todayDay,
        isFuture: todayDay !== null && day > todayDay,
      };
    });
  }, [income, expenses, month, lastDay, todayDay]);

  const totalIncome = data.reduce((s, d) => s + d.income, 0);
  const totalExpenses = data.reduce((s, d) => s + d.expenses, 0);
  const peakDay = data.reduce((peak, d) => d.expenses > peak.expenses ? d : peak, data[0]);

  const hasData = totalIncome > 0 || totalExpenses > 0;

  return (
    <div className="rounded-3xl border border-white/10 bg-[#0b101a]/90 shadow-2xl shadow-black/20 backdrop-blur-xl p-4 sm:p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-500/5 border border-violet-400/15 flex items-center justify-center">
            <CalendarDays className="w-4 h-4 text-violet-300" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white leading-tight">Gastos e receitas por dia</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Fluxo diário do mês</p>
          </div>
        </div>

        {hasData && (
          <div className="flex flex-wrap gap-2">
            <div className="rounded-xl border border-emerald-300/15 bg-emerald-400/[0.07] px-2.5 py-1.5">
              <p className="text-[9px] font-black uppercase tracking-widest text-emerald-200/60">Receitas</p>
              <p className="text-xs font-black text-emerald-200 tabular-nums">{maskCurrency(formatCurrency(totalIncome))}</p>
            </div>
            <div className="rounded-xl border border-rose-300/15 bg-rose-400/[0.07] px-2.5 py-1.5">
              <p className="text-[9px] font-black uppercase tracking-widest text-rose-200/60">Despesas</p>
              <p className="text-xs font-black text-rose-200 tabular-nums">{maskCurrency(formatCurrency(totalExpenses))}</p>
            </div>
            {peakDay && peakDay.expenses > 0 && (
              <div className="rounded-xl border border-amber-300/15 bg-amber-400/[0.07] px-2.5 py-1.5">
                <p className="text-[9px] font-black uppercase tracking-widest text-amber-200/60">Dia mais pesado</p>
                <p className="text-xs font-black text-amber-200">Dia {peakDay.day} · {maskCurrency(formatCurrency(peakDay.expenses))}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {!hasData ? (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <TrendingUp className="w-10 h-10 text-slate-700 mb-3" />
          <p className="text-sm font-semibold text-slate-500">Nenhuma movimentação neste mês</p>
          <p className="text-xs text-slate-600 mt-1">Lance receitas e despesas para ver o fluxo diário</p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-white/[0.06] bg-[#070b12]/70 p-3 shadow-inner shadow-black/30 overflow-hidden">
            <defs>
              <linearGradient id="dailyIncomeGrad" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#059669" stopOpacity={0.5} />
              </linearGradient>
              <linearGradient id="dailyExpenseGrad" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#fb7185" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#be123c" stopOpacity={0.5} />
              </linearGradient>
            </defs>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="18%">
                  <CartesianGrid
                    stroke="rgba(148,163,184,0.07)"
                    strokeDasharray="3 8"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={({ x, y, payload }) => {
                      const isToday = payload.value === todayDay;
                      return (
                        <g transform={`translate(${x},${y})`}>
                          {isToday && (
                            <circle cx={0} cy={6} r={10} fill="rgba(139,92,246,0.25)" />
                          )}
                          <text
                            x={0} y={0} dy={12}
                            textAnchor="middle"
                            fill={isToday ? '#a78bfa' : 'rgba(100,116,139,0.8)'}
                            fontSize={isToday ? 11 : 9}
                            fontWeight={isToday ? 900 : 700}
                          >
                            {payload.value}
                          </text>
                        </g>
                      );
                    }}
                    interval={Math.floor(lastDay / 10)}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'rgba(100,116,139,0.7)', fontSize: 9, fontWeight: 700 }}
                    tickFormatter={v => v === 0 ? '' : `R$${Math.round(v / 1000) > 0 ? Math.round(v / 1000) + 'k' : v}`}
                    width={36}
                  />
                  <RechartsTooltip
                    cursor={{ fill: 'rgba(139,92,246,0.06)', radius: 6 }}
                    content={(props) => (
                      <CustomTooltip
                        active={props.active}
                        payload={props.payload?.map(p => ({ name: p.name as string, value: p.value as number, color: p.color }))}
                        label={props.label}
                        maskCurrency={maskCurrency}
                      />
                    )}
                  />
                  {todayDay && (
                    <ReferenceLine
                      x={todayDay}
                      stroke="rgba(139,92,246,0.5)"
                      strokeWidth={1.5}
                      strokeDasharray="3 3"
                      label={{ value: 'Hoje', position: 'insideTopRight', fill: '#a78bfa', fontSize: 9, fontWeight: 900 }}
                    />
                  )}
                  <Bar name="Receitas" dataKey="income" radius={[4, 4, 1, 1]} maxBarSize={14}>
                    {data.map((entry, i) => (
                      <Cell
                        key={`inc-${i}`}
                        fill={entry.isFuture ? 'rgba(52,211,153,0.18)' : entry.isToday ? '#34d399' : 'url(#dailyIncomeGrad)'}
                      />
                    ))}
                  </Bar>
                  <Bar name="Despesas" dataKey="expenses" radius={[4, 4, 1, 1]} maxBarSize={14}>
                    {data.map((entry, i) => (
                      <Cell
                        key={`exp-${i}`}
                        fill={entry.isFuture ? 'rgba(251,113,133,0.18)' : entry.isToday ? '#fb7185' : 'url(#dailyExpenseGrad)'}
                      />
                    ))}
                  </Bar>
                  <Line
                    name="Saldo"
                    type="monotone"
                    dataKey="balance"
                    stroke="#818cf8"
                    strokeWidth={2}
                    strokeLinecap="round"
                    dot={false}
                    activeDot={{ r: 4, fill: '#818cf8', stroke: '#0d1420', strokeWidth: 2 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 mt-3 text-[10px] font-bold text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-2.5 rounded-sm bg-emerald-400/80" />
              Receitas
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-2.5 rounded-sm bg-rose-400/80" />
              Despesas
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 rounded-full bg-indigo-400" />
              Saldo acumulado
            </span>
            {todayDay && (
              <span className="flex items-center gap-1.5">
                <span className="w-0.5 h-3 rounded-full bg-violet-400" />
                Hoje (dia {todayDay})
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
