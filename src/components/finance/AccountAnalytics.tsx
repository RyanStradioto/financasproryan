import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip as RTooltip,
  CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  TrendingUp, Wallet, Receipt, PiggyBank, Layers3, Trophy, Lightbulb,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, getMonthYear } from '@/lib/format';
import { useSensitiveData } from '@/components/finance/SensitiveData';
import { useAccounts, useIncome, useExpenses, useCategories } from '@/hooks/useFinanceData';
import { notNeutralTransfer } from '@/lib/investmentMarker';

const FALLBACK = '#64748b';
const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const mShort = (m: string) => { const [, mm] = (m || '').split('-').map(Number); return MONTHS_PT[(mm - 1) % 12] ?? m; };
const lastMonths = (n: number, anchor: string) => {
  const [y, m] = anchor.split('-').map(Number);
  return Array.from({ length: n }, (_, i) => { const d = new Date(y, m - 1 - (n - 1 - i), 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });
};

export default function AccountAnalytics({ accountId }: { accountId: string }) {
  const { maskCurrency } = useSensitiveData();
  const { data: accounts = [] } = useAccounts();
  const { data: incomeRaw = [] } = useIncome();
  const { data: expensesRaw = [] } = useExpenses();
  const { data: categories = [] } = useCategories();
  const [range, setRange] = useState<6 | 12>(6);
  const [ready, setReady] = useState(false);
  useEffect(() => { const t = setTimeout(() => setReady(true), 130); return () => clearTimeout(t); }, []);

  const fmt = (v: number) => maskCurrency(formatCurrency(v));
  const nowMonth = getMonthYear();
  const account = accounts.find((a) => a.id === accountId);

  const catMap = useMemo(() => {
    const m = new Map<string, { name: string; icon: string; color: string }>();
    for (const c of categories) m.set(String(c.id), { name: String(c.name), icon: String(c.icon || '🏷️'), color: String(c.color || FALLBACK) });
    return m;
  }, [categories]);

  // Receitas/Despesas concluídas desta conta (exclui transferências de investimento).
  const accIncome = useMemo(() => incomeRaw.filter((i) => i.account_id === accountId && i.status === 'concluido' && notNeutralTransfer(i)), [incomeRaw, accountId]);
  const accExpenses = useMemo(() => expensesRaw.filter((e) => e.account_id === accountId && e.status === 'concluido' && notNeutralTransfer(e)), [expensesRaw, accountId]);

  const salary = Number(account?.monthly_salary) || 0;
  const months = useMemo(() => lastMonths(range, nowMonth), [range, nowMonth]);
  const monthsSet = useMemo(() => new Set(months), [months]);

  const data = useMemo(() => {
    const incByM = new Map<string, number>();
    for (const i of accIncome) { const k = (i.date || '').slice(0, 7); incByM.set(k, (incByM.get(k) || 0) + Number(i.amount)); }
    const expByM = new Map<string, number>();
    for (const e of accExpenses) { const k = (e.date || '').slice(0, 7); expByM.set(k, (expByM.get(k) || 0) + Number(e.amount)); }

    const initial = Number(account?.initial_balance) || 0;
    const series = months.map((m) => {
      const renda = salary > 0 ? salary : incByM.get(m) || 0;
      const gastos = expByM.get(m) || 0;
      // saldo acumulado até o fim do mês m
      const balance = initial
        + accIncome.filter((i) => (i.date || '').slice(0, 7) <= m).reduce((s, i) => s + Number(i.amount), 0)
        - accExpenses.filter((e) => (e.date || '').slice(0, 7) <= m).reduce((s, e) => s + Number(e.amount), 0);
      return { name: mShort(m), m, renda, gastos, net: renda - gastos, rate: renda > 0 ? ((renda - gastos) / renda) * 100 : null, balance };
    });
    const cur = series[series.length - 1];
    const prev = series[series.length - 2] ?? { net: 0, rate: null, gastos: 0, renda: 0 };

    // categorias do período (despesas)
    const catAcc = new Map<string, number>();
    for (const e of accExpenses) { if (!monthsSet.has((e.date || '').slice(0, 7))) continue; const k = String(e.category_id ?? 'none'); catAcc.set(k, (catAcc.get(k) || 0) + Number(e.amount)); }
    const catArr = Array.from(catAcc.entries()).map(([k, value]) => {
      const meta = k === 'none' ? { name: 'Sem categoria', color: FALLBACK } : (catMap.get(k) ?? { name: 'Outros', color: FALLBACK });
      return { name: meta.name, color: meta.color, value };
    }).sort((a, b) => b.value - a.value);
    const top5 = catArr.slice(0, 5);
    const outros = catArr.slice(5).reduce((s, c) => s + c.value, 0);
    if (outros > 0) top5.push({ name: 'Outros', color: FALLBACK, value: outros });

    // maiores gastos do período
    const topExp = [...accExpenses].filter((e) => monthsSet.has((e.date || '').slice(0, 7)))
      .sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 6)
      .map((e) => ({ id: e.id, desc: e.description || 'Gasto', amount: Number(e.amount), icon: (catMap.get(String(e.category_id))?.icon) ?? '💸', month: mShort((e.date || '').slice(0, 7)) }));

    const totalGastos = series.reduce((s, x) => s + x.gastos, 0);
    const totalRenda = series.reduce((s, x) => s + x.renda, 0);
    const mediaSobra = series.length ? series.reduce((s, x) => s + x.net, 0) / series.length : 0;

    return { series, cur, prev, cats: top5, topExp, totalGastos, totalRenda, mediaSobra };
  }, [accIncome, accExpenses, months, monthsSet, salary, account, catMap]);

  const insights = useMemo(() => {
    const out: { icon: string; text: string; tone: 'good' | 'warn' | 'info' }[] = [];
    const { cur, prev, cats } = data;
    if (cur.rate !== null) out.push({ icon: cur.rate >= 0 ? '✅' : '🚨', tone: cur.rate >= 0 ? 'good' : 'warn', text: `Taxa de poupança de ${mShort(cur.m)}: ${cur.rate.toFixed(0)}%${cur.rate < 0 ? ' (gastou mais que a renda)' : ''}.` });
    if (cur.rate !== null && prev.rate !== null && Math.abs(cur.rate - prev.rate) >= 2) { const d = cur.rate - prev.rate; out.push({ icon: d >= 0 ? '📈' : '📉', tone: d >= 0 ? 'good' : 'warn', text: `Poupança ${d >= 0 ? 'melhorou' : 'piorou'} ${Math.abs(d).toFixed(0)}pp vs o mês anterior.` }); }
    if (cats[0]) out.push({ icon: '🏷️', tone: 'info', text: `Maior categoria de gasto: ${cats[0].name} (${fmt(cats[0].value)} no período).` });
    if (data.mediaSobra !== 0) out.push({ icon: '💡', tone: data.mediaSobra >= 0 ? 'info' : 'warn', text: `Sobra média no período: ${fmt(data.mediaSobra)}/mês.` });
    return out;
  }, [data]);

  const axis = { fontSize: 10, fill: 'hsl(var(--muted-foreground))' };
  const tip = { background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 } as const;
  const kFmt = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(Math.round(v)));

  if (!account) return <p className="py-10 text-center text-sm text-muted-foreground">Conta não encontrada.</p>;

  const cur = data.cur;
  const deltaNet = cur.rate !== null && data.prev.rate !== null ? cur.rate - data.prev.rate : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg" style={{ background: `${account.color || 'hsl(var(--primary))'}22` }}>{account.icon || '🏦'}</span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold">{account.name}</span>
            <span className="block text-[11px] text-muted-foreground">{salary > 0 ? `salário ${fmt(salary)}/mês` : 'renda pela receita registrada'}</span>
          </span>
        </span>
        <div className="flex shrink-0 overflow-hidden rounded-lg border border-border">
          {([6, 12] as const).map((r) => <button key={r} onClick={() => setRange(r)} className={cn('px-3 py-1.5 text-xs font-semibold transition-colors', range === r ? 'bg-primary text-primary-foreground' : 'bg-muted/30 text-muted-foreground')}>{r}m</button>)}
        </div>
      </div>

      {/* KPIs do mês atual */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Kpi icon={TrendingUp} label={`Renda ${mShort(cur.m)}`} value={fmt(cur.renda)} />
        <Kpi icon={Receipt} label="Gastos" value={fmt(cur.gastos)} tone="expense" />
        <Kpi icon={PiggyBank} label="Sobra" value={fmt(cur.net)} tone={cur.net >= 0 ? 'income' : 'expense'} />
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
          <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground"><Wallet className="h-3 w-3 text-primary" /> Poupança</p>
          <p className={cn('mt-1 text-base font-black tabular-nums sm:text-lg', cur.rate !== null && cur.rate < 0 ? 'text-expense' : 'text-income')}>{cur.rate !== null ? `${cur.rate.toFixed(0)}%` : '—'}</p>
          {deltaNet !== null && Math.abs(deltaNet) >= 1 && (
            <p className={cn('flex items-center gap-0.5 text-[10px] font-bold', deltaNet >= 0 ? 'text-income' : 'text-expense')}>{deltaNet >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}{Math.abs(deltaNet).toFixed(0)}pp vs mês ant.</p>
          )}
        </div>
      </div>

      {/* Renda × gastos (barras agrupadas) */}
      <Section title="Renda × gastos por mês" icon={Layers3}>
        <div className="h-56 w-full">
          {ready && (
            <ResponsiveContainer>
              <BarChart data={data.series} margin={{ top: 10, right: 6, left: -14, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.35} vertical={false} />
                <XAxis dataKey="name" tick={axis} tickLine={false} axisLine={false} />
                <YAxis tick={axis} tickLine={false} axisLine={false} width={42} tickFormatter={kFmt} />
                <RTooltip contentStyle={tip} formatter={(v: number, n) => [fmt(v), n === 'renda' ? 'Renda' : 'Gastos']} cursor={{ fill: 'hsl(var(--muted)/0.3)' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" formatter={(v) => (v === 'renda' ? 'Renda' : 'Gastos')} />
                <Bar dataKey="renda" fill="hsl(var(--income))" radius={[4, 4, 0, 0]} maxBarSize={22} />
                <Bar dataKey="gastos" fill="hsl(var(--expense))" radius={[4, 4, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Evolução do saldo */}
        <Section title="Evolução do saldo" icon={TrendingUp}>
          <div className="h-44 w-full">
            {ready && (
              <ResponsiveContainer>
                <AreaChart data={data.series} margin={{ top: 10, right: 6, left: -14, bottom: 0 }}>
                  <defs><linearGradient id="accBal" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} /><stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.35} vertical={false} />
                  <XAxis dataKey="name" tick={axis} tickLine={false} axisLine={false} />
                  <YAxis tick={axis} tickLine={false} axisLine={false} width={42} tickFormatter={kFmt} />
                  <RTooltip contentStyle={tip} formatter={(v: number) => fmt(v)} labelFormatter={(l) => `Saldo em ${l}`} />
                  <Area type="monotone" dataKey="balance" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#accBal)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Section>

        {/* Categorias da conta */}
        <Section title="Gastos por categoria" icon={Layers3}>
          {data.cats.length === 0 ? <Empty text="Sem gastos no período." /> : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="mx-auto h-32 w-32 shrink-0">
                {ready && (
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={data.cats} dataKey="value" nameKey="name" innerRadius={36} outerRadius={58} paddingAngle={2} strokeWidth={0}>
                        {data.cats.map((c) => <Cell key={c.name} fill={c.color} />)}
                      </Pie>
                      <RTooltip contentStyle={tip} formatter={(v: number) => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                {data.cats.map((c) => (
                  <div key={c.name} className="flex items-center justify-between gap-2 text-xs"><span className="flex min-w-0 items-center gap-1.5"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} /><span className="truncate font-medium">{c.name}</span></span><span className="shrink-0 font-bold tabular-nums">{fmt(c.value)}</span></div>
                ))}
              </div>
            </div>
          )}
        </Section>
      </div>

      {/* Maiores gastos */}
      <Section title="Maiores gastos do período" icon={Trophy}>
        {data.topExp.length === 0 ? <Empty text="Sem gastos no período." /> : (
          <div className="space-y-1.5">
            {data.topExp.map((t, i) => (
              <div key={t.id} className="flex items-center justify-between gap-3 rounded-xl bg-muted/30 px-3 py-2">
                <span className="flex min-w-0 items-center gap-2.5"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[11px] font-bold text-primary">{i + 1}</span><span className="text-base">{t.icon}</span><span className="min-w-0"><span className="block truncate text-sm font-medium">{t.desc}</span><span className="block text-[10px] uppercase text-muted-foreground">{t.month}</span></span></span>
                <span className="shrink-0 text-sm font-bold tabular-nums">{fmt(t.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {insights.length > 0 && (
        <Section title="Insights" icon={Lightbulb}>
          <div className="grid gap-2 sm:grid-cols-2">
            {insights.map((ins, i) => (
              <div key={i} className={cn('flex items-start gap-2 rounded-xl border p-2.5 text-xs leading-relaxed', ins.tone === 'good' ? 'border-income/20 bg-income/[0.05]' : ins.tone === 'warn' ? 'border-expense/20 bg-expense/[0.05]' : 'border-border/60 bg-muted/20')}>
                <span className="shrink-0">{ins.icon}</span><span>{ins.text}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone }: { icon: typeof Wallet; label: string; value: string; tone?: 'income' | 'expense' }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
      <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground"><Icon className={cn('h-3 w-3', tone === 'expense' ? 'text-expense' : tone === 'income' ? 'text-income' : 'text-primary')} /> {label}</p>
      <p className={cn('mt-1 currency text-base font-black leading-tight tabular-nums sm:text-lg', tone === 'expense' ? 'text-expense' : tone === 'income' ? 'text-income' : '')}>{value}</p>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Wallet; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-3.5">
      <h4 className="mb-3 flex items-center gap-2 text-sm font-bold"><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10"><Icon className="h-3.5 w-3.5 text-primary" /></span>{title}</h4>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) { return <p className="py-6 text-center text-xs text-muted-foreground">{text}</p>; }
