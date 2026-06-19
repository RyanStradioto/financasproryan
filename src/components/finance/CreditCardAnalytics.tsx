import { useMemo, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid,
  PieChart, Pie, Cell, LabelList,
} from 'recharts';
import { TrendingUp, CalendarClock, Wallet, Receipt, Layers3, PieChart as PieIcon, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, getMonthYear } from '@/lib/format';
import { useSensitiveData } from '@/components/finance/SensitiveData';
import { useCreditCards, useCreditCardTransactions } from '@/hooks/useCreditCards';
import { useCategories } from '@/hooks/useFinanceData';

const CAT_FALLBACK = '#64748b';
const monthLabel = (m: string) => {
  const [y, mm] = m.split('-').map(Number);
  if (!y || !mm) return m;
  return new Date(y, mm - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
};
function lastMonths(n: number): string[] {
  const [y, m] = getMonthYear().split('-').map(Number);
  const arr: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    arr.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return arr;
}

export default function CreditCardAnalytics() {
  const { maskCurrency } = useSensitiveData();
  const { data: cards = [] } = useCreditCards();
  const { data: allTx = [] } = useCreditCardTransactions();
  const { data: categories = [] } = useCategories();

  const [cardFilter, setCardFilter] = useState<string>('__all__');
  const [range, setRange] = useState<6 | 12>(6);

  const fmt = (v: number) => maskCurrency(formatCurrency(v));
  const nowMonth = getMonthYear();

  const catMap = useMemo(() => {
    const m = new Map<string, { name: string; icon: string; color: string }>();
    for (const c of categories) m.set(String(c.id), { name: String(c.name), icon: String(c.icon || '🏷️'), color: String(c.color || CAT_FALLBACK) });
    return m;
  }, [categories]);

  // Transações no escopo (cartão selecionado ou todos)
  const scoped = useMemo(
    () => (cardFilter === '__all__' ? allTx : allTx.filter((t) => t.credit_card_id === cardFilter)),
    [allTx, cardFilter],
  );

  const months = useMemo(() => lastMonths(range), [range]);
  const monthsSet = useMemo(() => new Set(months), [months]);

  // ── Métricas ──
  const stats = useMemo(() => {
    const gastoMes = scoped.filter((t) => t.bill_month === nowMonth).reduce((s, t) => s + Number(t.amount), 0);
    const periodTx = scoped.filter((t) => monthsSet.has(t.bill_month));
    const totalPeriodo = periodTx.reduce((s, t) => s + Number(t.amount), 0);
    const mesesComGasto = new Set(periodTx.filter((t) => Number(t.amount) > 0).map((t) => t.bill_month)).size || 1;
    const mediaMensal = totalPeriodo / mesesComGasto;
    const emAberto = scoped.filter((t) => !t.paid).reduce((s, t) => s + Number(t.amount), 0);
    const aVencer = scoped.filter((t) => !t.paid && t.bill_month > nowMonth).reduce((s, t) => s + Number(t.amount), 0);
    const parcelasAbertas = scoped.filter((t) => !t.paid && t.is_installment).length;
    return { gastoMes, mediaMensal, emAberto, aVencer, parcelasAbertas, totalPeriodo };
  }, [scoped, nowMonth, monthsSet]);

  // ── Evolução das faturas (por bill_month) ──
  const faturaSeries = useMemo(() => months.map((m) => ({
    name: monthLabel(m),
    month: m,
    total: scoped.filter((t) => t.bill_month === m).reduce((s, t) => s + Number(t.amount), 0),
    atual: m === nowMonth,
  })), [scoped, months, nowMonth]);

  // ── Gastos por categoria (no período) ──
  const catSeries = useMemo(() => {
    const acc = new Map<string, number>();
    for (const t of scoped) {
      if (!monthsSet.has(t.bill_month)) continue;
      const amt = Number(t.amount);
      if (amt <= 0) continue;
      const key = String(t.category_id ?? 'none');
      acc.set(key, (acc.get(key) ?? 0) + amt);
    }
    const arr = Array.from(acc.entries()).map(([key, value]) => {
      const meta = key === 'none' ? { name: 'Sem categoria', icon: '❓', color: CAT_FALLBACK } : catMap.get(key);
      return { name: meta?.name ?? 'Outros', icon: meta?.icon ?? '🏷️', color: meta?.color ?? CAT_FALLBACK, value };
    }).sort((a, b) => b.value - a.value);
    const total = arr.reduce((s, c) => s + c.value, 0) || 1;
    return arr.map((c) => ({ ...c, pct: (c.value / total) * 100 })).slice(0, 6);
  }, [scoped, monthsSet, catMap]);

  // ── Comprometimento futuro (parcelas a vencer) ──
  const futuraSeries = useMemo(() => {
    const acc = new Map<string, number>();
    for (const t of scoped) {
      if (t.paid || t.bill_month <= nowMonth) continue;
      acc.set(t.bill_month, (acc.get(t.bill_month) ?? 0) + Number(t.amount));
    }
    return Array.from(acc.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(0, 8)
      .map(([m, v]) => ({ name: monthLabel(m), month: m, total: v }));
  }, [scoped, nowMonth]);

  // ── Distribuição por cartão (donut) ──
  const cardSeries = useMemo(() => {
    if (cards.length < 2 || cardFilter !== '__all__') return [];
    return cards.map((c) => ({
      name: c.name,
      color: c.color || CAT_FALLBACK,
      value: allTx.filter((t) => t.credit_card_id === c.id && monthsSet.has(t.bill_month) && Number(t.amount) > 0).reduce((s, t) => s + Number(t.amount), 0),
    })).filter((c) => c.value > 0).sort((a, b) => b.value - a.value);
  }, [cards, cardFilter, allTx, monthsSet]);

  // ── Top compras (no período) ──
  const topCompras = useMemo(() => [...scoped]
    .filter((t) => monthsSet.has(t.bill_month) && Number(t.amount) > 0)
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, 6)
    .map((t) => ({
      id: t.id,
      desc: t.description || 'Compra',
      amount: Number(t.amount),
      month: monthLabel(t.bill_month),
      cat: catMap.get(String(t.category_id))?.icon ?? '💳',
    })), [scoped, monthsSet, catMap]);

  const chartAxis = { fontSize: 10, fill: 'hsl(var(--muted-foreground))' };
  const tooltipStyle = { background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 };
  const kFmt = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v));

  const hasData = allTx.length > 0;

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={cardFilter}
          onChange={(e) => setCardFilter(e.target.value)}
          className="h-9 rounded-lg border border-border bg-background px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="__all__">Todos os cartões</option>
          {cards.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </select>
        <div className="flex overflow-hidden rounded-lg border border-border">
          {([6, 12] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn('px-3 py-1.5 text-xs font-semibold transition-colors', range === r ? 'bg-primary text-primary-foreground' : 'bg-muted/30 text-muted-foreground')}
            >
              {r} meses
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
          <PieIcon className="h-10 w-10 opacity-30" />
          <p className="text-sm font-medium">Sem dados de cartão ainda</p>
          <p className="text-xs">Lance compras nos cartões para ver as análises aqui.</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <Kpi icon={Receipt} label="Gasto no mês" value={fmt(stats.gastoMes)} tone="primary" />
            <Kpi icon={TrendingUp} label={`Média ${range}m`} value={fmt(stats.mediaMensal)} tone="info" />
            <Kpi icon={Wallet} label="Em aberto" value={fmt(stats.emAberto)} tone="warning" />
            <Kpi icon={CalendarClock} label="A vencer" value={fmt(stats.aVencer)} sub={`${stats.parcelasAbertas} parcela${stats.parcelasAbertas !== 1 ? 's' : ''}`} tone="expense" />
          </div>

          {/* Evolução das faturas */}
          <Section title="Evolução das faturas" icon={TrendingUp}>
            <div className="h-52 w-full">
              <ResponsiveContainer>
                <BarChart data={faturaSeries} margin={{ top: 14, right: 6, left: -14, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
                  <XAxis dataKey="name" tick={chartAxis} tickLine={false} axisLine={false} />
                  <YAxis tick={chartAxis} tickLine={false} axisLine={false} width={42} tickFormatter={kFmt} />
                  <RTooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} labelFormatter={(l) => `Fatura ${l}`} cursor={{ fill: 'hsl(var(--muted)/0.3)' }} />
                  <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={46}>
                    {faturaSeries.map((d) => <Cell key={d.month} fill={d.atual ? 'hsl(var(--primary))' : 'hsl(var(--primary)/0.4)'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>

          {/* Por categoria */}
          <Section title="Gastos por categoria" icon={Layers3}>
            {catSeries.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">Sem gastos categorizados no período.</p>
            ) : (
              <div className="space-y-2.5">
                {catSeries.map((c) => (
                  <div key={c.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex min-w-0 items-center gap-1.5"><span>{c.icon}</span><span className="truncate font-medium">{c.name}</span></span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="font-bold tabular-nums">{fmt(c.value)}</span>
                        <span className="w-9 text-right text-muted-foreground">{c.pct.toFixed(0)}%</span>
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full" style={{ width: `${Math.max(2, c.pct)}%`, backgroundColor: c.color }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* A vencer + por cartão */}
          <div className={cn('grid gap-4', cardSeries.length > 0 ? 'lg:grid-cols-2' : 'grid-cols-1')}>
            <Section title="Parcelas a vencer" icon={CalendarClock}>
              {futuraSeries.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">Nenhuma parcela futura em aberto. 🎉</p>
              ) : (
                <div className="h-44 w-full">
                  <ResponsiveContainer>
                    <BarChart data={futuraSeries} margin={{ top: 14, right: 6, left: -14, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
                      <XAxis dataKey="name" tick={chartAxis} tickLine={false} axisLine={false} />
                      <YAxis tick={chartAxis} tickLine={false} axisLine={false} width={42} tickFormatter={kFmt} />
                      <RTooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} labelFormatter={(l) => `Vence em ${l}`} cursor={{ fill: 'hsl(var(--muted)/0.3)' }} />
                      <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={40} fill="hsl(var(--warning))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Section>

            {cardSeries.length > 0 && (
              <Section title="Distribuição por cartão" icon={PieIcon}>
                <div className="flex items-center gap-4">
                  <div className="h-40 w-40 shrink-0">
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={cardSeries} dataKey="value" innerRadius={42} outerRadius={68} paddingAngle={2} strokeWidth={0}>
                          {cardSeries.map((c) => <Cell key={c.name} fill={c.color} />)}
                        </Pie>
                        <RTooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    {cardSeries.map((c) => (
                      <div key={c.name} className="flex items-center justify-between text-xs">
                        <span className="flex min-w-0 items-center gap-1.5"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} /><span className="truncate font-medium">{c.name}</span></span>
                        <span className="shrink-0 font-bold tabular-nums">{fmt(c.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Section>
            )}
          </div>

          {/* Top compras */}
          <Section title="Maiores compras do período" icon={Trophy}>
            {topCompras.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">Sem compras no período.</p>
            ) : (
              <div className="space-y-1.5">
                {topCompras.map((t, i) => (
                  <div key={t.id} className="flex items-center justify-between gap-3 rounded-xl bg-muted/30 px-3 py-2">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[11px] font-bold text-primary">{i + 1}</span>
                      <span className="text-base">{t.cat}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{t.desc}</span>
                        <span className="block text-[10px] uppercase text-muted-foreground">{t.month}</span>
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-bold tabular-nums">{fmt(t.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, tone }: { icon: typeof Wallet; label: string; value: string; sub?: string; tone: 'primary' | 'info' | 'warning' | 'expense' }) {
  const toneCls = {
    primary: 'text-primary',
    info: 'text-info',
    warning: 'text-warning',
    expense: 'text-expense',
  }[tone];
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className={cn('h-3 w-3', toneCls)} /> {label}
      </p>
      <p className="mt-1 currency text-base font-black leading-tight tabular-nums sm:text-lg">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Wallet; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-3.5">
      <h4 className="mb-3 flex items-center gap-2 text-sm font-bold">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10"><Icon className="h-3.5 w-3.5 text-primary" /></span>
        {title}
      </h4>
      {children}
    </div>
  );
}
