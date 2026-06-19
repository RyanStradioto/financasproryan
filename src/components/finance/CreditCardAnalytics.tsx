import { useMemo, useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip,
  CartesianGrid, PieChart, Pie, Cell, ReferenceLine,
} from 'recharts';
import {
  TrendingUp, TrendingDown, CalendarClock, Wallet, Receipt, Layers3, Trophy,
  ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownRight, Lightbulb, CalendarRange,
  CreditCard as CardIcon, Repeat, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, getMonthYear } from '@/lib/format';
import { useSensitiveData } from '@/components/finance/SensitiveData';
import { useCreditCards, useCreditCardTransactions } from '@/hooks/useCreditCards';
import { useCategories } from '@/hooks/useFinanceData';

const FALLBACK = '#64748b';
const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MONTHS_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const mShort = (m: string) => { const [, mm] = m.split('-').map(Number); return MONTHS_PT[(mm - 1) % 12] ?? m; };
const mFull = (m: string) => { const [y, mm] = m.split('-').map(Number); return `${MONTHS_FULL[(mm - 1) % 12]} ${y}`; };
const addMonths = (m: string, delta: number) => { const [y, mm] = m.split('-').map(Number); const d = new Date(y, mm - 1 + delta, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const lastMonths = (n: number, anchor: string) => Array.from({ length: n }, (_, i) => addMonths(anchor, -(n - 1 - i)));

type Tab = 'mes' | 'trend';

export default function CreditCardAnalytics() {
  const { maskCurrency } = useSensitiveData();
  const { data: cards = [] } = useCreditCards();
  const { data: allTx = [] } = useCreditCardTransactions();
  const { data: categories = [] } = useCategories();

  const [tab, setTab] = useState<Tab>('mes');
  const [cardFilter, setCardFilter] = useState('__all__');
  const [selMonth, setSelMonth] = useState(getMonthYear());
  const [range, setRange] = useState<6 | 12>(6);

  const fmt = (v: number) => maskCurrency(formatCurrency(v));
  const nowMonth = getMonthYear();

  const catMap = useMemo(() => {
    const m = new Map<string, { name: string; icon: string; color: string }>();
    for (const c of categories) m.set(String(c.id), { name: String(c.name), icon: String(c.icon || '🏷️'), color: String(c.color || FALLBACK) });
    return m;
  }, [categories]);
  const catOf = (id: string | null) => (id && catMap.get(String(id))) || { name: 'Sem categoria', icon: '❓', color: FALLBACK };

  const scoped = useMemo(
    () => (cardFilter === '__all__' ? allTx : allTx.filter((t) => t.credit_card_id === cardFilter)),
    [allTx, cardFilter],
  );

  // Limites do seletor de mês (intervalo com dados)
  const monthBounds = useMemo(() => {
    const ms = scoped.map((t) => t.bill_month).filter(Boolean).sort();
    return { min: ms[0] ?? nowMonth, max: ms[ms.length - 1] ?? nowMonth };
  }, [scoped, nowMonth]);
  const maxNav = monthBounds.max > nowMonth ? monthBounds.max : nowMonth;

  // ─────────────── MÊS (deep dive) ───────────────
  const monthData = useMemo(() => {
    const prev = addMonths(selMonth, -1);
    const txM = scoped.filter((t) => t.bill_month === selMonth);
    const txPrev = scoped.filter((t) => t.bill_month === prev);
    const fatura = txM.reduce((s, t) => s + Number(t.amount), 0);
    const faturaPrev = txPrev.reduce((s, t) => s + Number(t.amount), 0);
    const compras = txM.filter((t) => Number(t.amount) > 0).length;
    const ticket = compras ? fatura / compras : 0;
    const parcelado = txM.filter((t) => t.is_installment).reduce((s, t) => s + Number(t.amount), 0);
    const recorrente = txM.filter((t) => t.is_recurring).reduce((s, t) => s + Number(t.amount), 0);
    const avista = Math.max(0, fatura - parcelado);
    const pago = txM.length > 0 && txM.every((t) => t.paid);
    const deltaPct = faturaPrev > 0 ? ((fatura - faturaPrev) / faturaPrev) * 100 : null;

    // categorias deste mês com Δ vs mês anterior
    const prevByCat = new Map<string, number>();
    for (const t of txPrev) { const k = String(t.category_id ?? 'none'); prevByCat.set(k, (prevByCat.get(k) ?? 0) + Number(t.amount)); }
    const byCatMap = new Map<string, number>();
    for (const t of txM) { if (Number(t.amount) <= 0) continue; const k = String(t.category_id ?? 'none'); byCatMap.set(k, (byCatMap.get(k) ?? 0) + Number(t.amount)); }
    const cats = Array.from(byCatMap.entries()).map(([k, value]) => {
      const meta = k === 'none' ? { name: 'Sem categoria', icon: '❓', color: FALLBACK } : catOf(k);
      const prevV = prevByCat.get(k) ?? 0;
      return { key: k, ...meta, value, prevValue: prevV, deltaPct: prevV > 0 ? ((value - prevV) / prevV) * 100 : null };
    }).sort((a, b) => b.value - a.value);
    const catTotal = cats.reduce((s, c) => s + c.value, 0) || 1;
    const catsPct = cats.map((c) => ({ ...c, pct: (c.value / catTotal) * 100 }));

    // por dia do mês
    const [y, mm] = selMonth.split('-').map(Number);
    const lastDay = new Date(y, mm, 0).getDate();
    const byDay = Array.from({ length: lastDay }, (_, i) => ({ day: i + 1, total: 0 }));
    for (const t of txM) { const d = Number((t.date || '').slice(8, 10)); if (d >= 1 && d <= lastDay && Number(t.amount) > 0) byDay[d - 1].total += Number(t.amount); }

    // por cartão (se todos & múltiplos)
    const byCard = (cardFilter === '__all__' && cards.length > 1)
      ? cards.map((c) => ({ name: c.name, color: c.color || FALLBACK, value: txM.filter((t) => t.credit_card_id === c.id).reduce((s, t) => s + Number(t.amount), 0) })).filter((c) => c.value > 0).sort((a, b) => b.value - a.value)
      : [];

    const top = [...txM].filter((t) => Number(t.amount) > 0).sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 6)
      .map((t) => ({ id: t.id, desc: t.description || 'Compra', amount: Number(t.amount), icon: catOf(t.category_id).icon, parc: t.is_installment ? `${t.installment_number}/${t.total_installments}` : null }));

    return { prev, fatura, faturaPrev, compras, ticket, parcelado, avista, recorrente, pago, deltaPct, cats: catsPct, byDay, byCard, top };
  }, [scoped, selMonth, cardFilter, cards, catMap]);

  // limite (do cartão selecionado, ou soma)
  const limitInfo = useMemo(() => {
    const relevant = cardFilter === '__all__' ? cards : cards.filter((c) => c.id === cardFilter);
    const limit = relevant.reduce((s, c) => s + (Number(c.credit_limit) || 0), 0);
    const aberto = scoped.filter((t) => !t.paid).reduce((s, t) => s + Number(t.amount), 0);
    const pct = limit > 0 ? Math.min(100, Math.max(0, (aberto / limit) * 100)) : 0;
    return { limit, aberto, pct, disponivel: Math.max(0, limit - aberto) };
  }, [cards, cardFilter, scoped]);

  // ─────────────── TENDÊNCIAS (multi-mês) ───────────────
  const trend = useMemo(() => {
    const months = lastMonths(range, nowMonth);
    const series = months.map((m) => ({ name: mShort(m), month: m, total: scoped.filter((t) => t.bill_month === m).reduce((s, t) => s + Number(t.amount), 0) }));
    const withData = series.filter((s) => s.total > 0);
    const totalPeriodo = series.reduce((s, x) => s + x.total, 0);
    const media = withData.length ? totalPeriodo / withData.length : 0;
    const maxF = series.reduce((a, b) => (b.total > a.total ? b : a), series[0] ?? { total: 0, name: '' });
    const minF = withData.length ? withData.reduce((a, b) => (b.total < a.total ? b : a)) : { total: 0, name: '' };

    // tendência: média 1ª metade vs 2ª metade
    const half = Math.floor(series.length / 2);
    const firstAvg = series.slice(0, half).reduce((s, x) => s + x.total, 0) / Math.max(1, half);
    const secondAvg = series.slice(half).reduce((s, x) => s + x.total, 0) / Math.max(1, series.length - half);
    const trendPct = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;

    // categorias ao longo do tempo (top 5 + outros)
    const catTotals = new Map<string, number>();
    for (const t of scoped) { if (!months.includes(t.bill_month) || Number(t.amount) <= 0) continue; const k = String(t.category_id ?? 'none'); catTotals.set(k, (catTotals.get(k) ?? 0) + Number(t.amount)); }
    const topCatKeys = Array.from(catTotals.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k);
    const topCatMeta = topCatKeys.map((k) => (k === 'none' ? { key: k, name: 'Sem cat.', color: FALLBACK } : { key: k, name: catOf(k).name, color: catOf(k).color }));
    const stack = months.map((m) => {
      const row: Record<string, number | string> = { name: mShort(m) };
      let outros = 0;
      const mTx = scoped.filter((t) => t.bill_month === m && Number(t.amount) > 0);
      for (const t of mTx) {
        const k = String(t.category_id ?? 'none');
        if (topCatKeys.includes(k)) { const nm = topCatMeta.find((c) => c.key === k)!.name; row[nm] = (Number(row[nm]) || 0) + Number(t.amount); }
        else outros += Number(t.amount);
      }
      row['Outros'] = outros;
      return row;
    });

    // parcelas a vencer (futuro, não pago)
    const futAcc = new Map<string, number>();
    for (const t of scoped) { if (t.paid || t.bill_month <= nowMonth) continue; futAcc.set(t.bill_month, (futAcc.get(t.bill_month) ?? 0) + Number(t.amount)); }
    const futuras = Array.from(futAcc.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(0, 8).map(([m, v]) => ({ name: mShort(m), total: v }));
    const aVencer = Array.from(futAcc.values()).reduce((s, v) => s + v, 0);

    // recorrências (assinaturas) no período
    const recAcc = new Map<string, { name: string; icon: string; value: number; count: number }>();
    for (const t of scoped) { if (!t.is_recurring || !months.includes(t.bill_month)) continue; const key = (t.description || 'Recorrente').toLowerCase(); const cur = recAcc.get(key) ?? { name: t.description || 'Recorrente', icon: catOf(t.category_id).icon, value: 0, count: 0 }; cur.value += Number(t.amount); cur.count += 1; recAcc.set(key, cur); }
    const recorrentes = Array.from(recAcc.values()).sort((a, b) => b.value - a.value).slice(0, 5);

    // previsão próxima fatura
    const nextM = addMonths(nowMonth, 1);
    const agendadoProx = scoped.filter((t) => t.bill_month === nextM).reduce((s, t) => s + Number(t.amount), 0);

    return { months, series, totalPeriodo, media, maxF, minF, trendPct, topCatMeta, stack, futuras, aVencer, recorrentes, nextM, agendadoProx };
  }, [scoped, range, nowMonth, catMap]);

  // ─────────────── INSIGHTS ───────────────
  const insights = useMemo(() => {
    const out: { icon: string; text: string; tone: 'good' | 'warn' | 'info' }[] = [];
    if (monthData.deltaPct !== null) {
      const up = monthData.deltaPct >= 0;
      out.push({ icon: up ? '📈' : '📉', tone: up ? 'warn' : 'good', text: `Fatura de ${mFull(selMonth)} ficou ${Math.abs(monthData.deltaPct).toFixed(0)}% ${up ? 'maior' : 'menor'} que ${mShort(monthData.prev)}.` });
    }
    if (monthData.cats[0]) out.push({ icon: monthData.cats[0].icon, tone: 'info', text: `Maior gasto do mês: ${monthData.cats[0].name} (${monthData.cats[0].pct.toFixed(0)}% · ${fmt(monthData.cats[0].value)}).` });
    const disparou = monthData.cats.filter((c) => c.deltaPct !== null && c.deltaPct > 40 && c.value > 50).sort((a, b) => (b.deltaPct ?? 0) - (a.deltaPct ?? 0))[0];
    if (disparou) out.push({ icon: '🚨', tone: 'warn', text: `${disparou.name} disparou: +${disparou.deltaPct!.toFixed(0)}% vs o mês anterior.` });
    if (trend.aVencer > 0) out.push({ icon: '🗓️', tone: 'info', text: `Você tem ${fmt(trend.aVencer)} em parcelas comprometidas nos próximos meses.` });
    if (Math.abs(trend.trendPct) >= 5) out.push({ icon: trend.trendPct > 0 ? '⚠️' : '✅', tone: trend.trendPct > 0 ? 'warn' : 'good', text: `Tendência dos últimos ${range} meses: ${trend.trendPct > 0 ? 'subindo' : 'caindo'} ${Math.abs(trend.trendPct).toFixed(0)}%.` });
    if (limitInfo.limit > 0) out.push({ icon: limitInfo.pct > 80 ? '🔴' : '💳', tone: limitInfo.pct > 80 ? 'warn' : 'info', text: `Limite usado: ${limitInfo.pct.toFixed(0)}% · disponível ${fmt(limitInfo.disponivel)}.` });
    return out;
  }, [monthData, trend, limitInfo, selMonth, range]);

  const axis = { fontSize: 10, fill: 'hsl(var(--muted-foreground))' };
  const tip = { background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 };
  const kFmt = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(Math.round(v)));

  if (allTx.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
        <Sparkles className="h-10 w-10 opacity-30" />
        <p className="text-sm font-medium">Sem dados de cartão ainda</p>
        <p className="text-xs">Lance compras nos cartões para destravar as análises.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* filtros globais */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={cardFilter} onChange={(e) => setCardFilter(e.target.value)} className="h-9 rounded-lg border border-border bg-background px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30">
          <option value="__all__">Todos os cartões</option>
          {cards.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </select>
        <div className="ml-auto flex overflow-hidden rounded-xl border border-border">
          {([['mes', 'Mês'], ['trend', 'Tendências']] as const).map(([k, lbl]) => (
            <button key={k} onClick={() => setTab(k)} className={cn('px-3.5 py-1.5 text-xs font-bold transition-colors', tab === k ? 'bg-primary text-primary-foreground' : 'bg-muted/30 text-muted-foreground')}>{lbl}</button>
          ))}
        </div>
      </div>

      {tab === 'mes' ? (
        <>
          {/* seletor de mês */}
          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-2 py-1.5">
            <button onClick={() => setSelMonth((m) => (m > monthBounds.min ? addMonths(m, -1) : m))} disabled={selMonth <= monthBounds.min} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
            <span className="flex items-center gap-1.5 text-sm font-bold capitalize"><CalendarRange className="h-4 w-4 text-primary" />{mFull(selMonth)}</span>
            <button onClick={() => setSelMonth((m) => (m < maxNav ? addMonths(m, 1) : m))} disabled={selMonth >= maxNav} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
          </div>

          {/* KPIs do mês */}
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 to-transparent p-3">
              <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground"><Receipt className="h-3 w-3 text-primary" /> Fatura do mês</p>
              <p className="mt-1 currency text-lg font-black leading-tight tabular-nums sm:text-xl">{fmt(monthData.fatura)}</p>
              {monthData.deltaPct !== null && (
                <p className={cn('mt-0.5 flex items-center gap-0.5 text-[11px] font-bold', monthData.deltaPct > 0 ? 'text-expense' : 'text-income')}>
                  {monthData.deltaPct > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {monthData.deltaPct > 0 ? '+' : ''}{monthData.deltaPct.toFixed(0)}% <span className="font-normal text-muted-foreground">vs {mShort(monthData.prev)}</span>
                </p>
              )}
            </div>
            <Kpi icon={Layers3} label="Compras" value={String(monthData.compras)} sub={`ticket ${fmt(monthData.ticket)}`} />
            <Kpi icon={Repeat} label="Parcelado" value={fmt(monthData.parcelado)} sub={`à vista ${fmt(monthData.avista)}`} />
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
              <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground"><Wallet className="h-3 w-3 text-warning" /> Status</p>
              <p className={cn('mt-1 text-sm font-black', monthData.pago ? 'text-income' : 'text-warning')}>{monthData.fatura > 0 ? (monthData.pago ? 'Paga ✓' : 'Em aberto') : '—'}</p>
              {limitInfo.limit > 0 && <p className="text-[11px] text-muted-foreground">limite {limitInfo.pct.toFixed(0)}% usado</p>}
            </div>
          </div>

          {/* comparação rápida 3 meses */}
          <Section title="Esta fatura vs média" icon={TrendingUp}>
            <CompareBars
              rows={[
                { label: mShort(monthData.prev), value: monthData.faturaPrev, color: 'hsl(var(--muted-foreground))' },
                { label: mShort(selMonth), value: monthData.fatura, color: 'hsl(var(--primary))' },
                { label: `média ${range}m`, value: trend.media, color: 'hsl(var(--info))' },
              ]}
              fmt={fmt}
            />
          </Section>

          {/* categorias do mês com Δ */}
          <Section title="Por categoria (com variação vs mês anterior)" icon={Layers3}>
            {monthData.cats.length === 0 ? <Empty text="Sem gastos neste mês." /> : (
              <div className="space-y-2.5">
                {monthData.cats.slice(0, 8).map((c) => (
                  <div key={c.key} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex min-w-0 items-center gap-1.5"><span>{c.icon}</span><span className="truncate font-medium">{c.name}</span></span>
                      <span className="flex shrink-0 items-center gap-2">
                        {c.deltaPct !== null && Math.abs(c.deltaPct) >= 1 && (
                          <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-bold', c.deltaPct > 0 ? 'bg-expense/10 text-expense' : 'bg-income/10 text-income')}>{c.deltaPct > 0 ? '+' : ''}{c.deltaPct.toFixed(0)}%</span>
                        )}
                        <span className="font-bold tabular-nums">{fmt(c.value)}</span>
                        <span className="w-8 text-right text-muted-foreground">{c.pct.toFixed(0)}%</span>
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${Math.max(2, c.pct)}%`, backgroundColor: c.color }} /></div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* gastos por dia */}
            <Section title="Gastos ao longo do mês" icon={CalendarRange}>
              <div className="h-40 w-full">
                <ResponsiveContainer>
                  <BarChart data={monthData.byDay} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.35} vertical={false} />
                    <XAxis dataKey="day" tick={axis} tickLine={false} axisLine={false} interval={4} />
                    <YAxis tick={axis} tickLine={false} axisLine={false} width={40} tickFormatter={kFmt} />
                    <RTooltip contentStyle={tip} formatter={(v: number) => fmt(v)} labelFormatter={(l) => `Dia ${l}`} cursor={{ fill: 'hsl(var(--muted)/0.3)' }} />
                    <Bar dataKey="total" radius={[3, 3, 0, 0]} fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Section>

            {/* parcelado vs à vista / por cartão */}
            {monthData.byCard.length > 0 ? (
              <Section title="Por cartão neste mês" icon={CardIcon}>
                <DonutList data={monthData.byCard} fmt={fmt} />
              </Section>
            ) : (
              <Section title="Parcelado vs à vista" icon={Repeat}>
                <DonutList data={[{ name: 'Parcelado', color: 'hsl(var(--primary))', value: monthData.parcelado }, { name: 'À vista', color: 'hsl(var(--info))', value: monthData.avista }].filter((d) => d.value > 0)} fmt={fmt} />
              </Section>
            )}
          </div>

          {/* maiores compras */}
          <Section title="Maiores compras do mês" icon={Trophy}>
            {monthData.top.length === 0 ? <Empty text="Sem compras neste mês." /> : (
              <div className="space-y-1.5">
                {monthData.top.map((t, i) => (
                  <div key={t.id} className="flex items-center justify-between gap-3 rounded-xl bg-muted/30 px-3 py-2">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[11px] font-bold text-primary">{i + 1}</span>
                      <span className="text-base">{t.icon}</span>
                      <span className="min-w-0"><span className="block truncate text-sm font-medium">{t.desc}</span>{t.parc && <span className="block text-[10px] text-muted-foreground">parcela {t.parc}</span>}</span>
                    </span>
                    <span className="shrink-0 text-sm font-bold tabular-nums">{fmt(t.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* insights */}
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
        </>
      ) : (
        <>
          {/* range */}
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-lg border border-border">
              {([6, 12] as const).map((r) => <button key={r} onClick={() => setRange(r)} className={cn('px-3 py-1.5 text-xs font-semibold transition-colors', range === r ? 'bg-primary text-primary-foreground' : 'bg-muted/30 text-muted-foreground')}>{r} meses</button>)}
            </div>
          </div>

          {/* KPIs período */}
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <Kpi icon={Receipt} label={`Total ${range}m`} value={fmt(trend.totalPeriodo)} />
            <Kpi icon={TrendingUp} label="Média mensal" value={fmt(trend.media)} />
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
              <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{trend.trendPct > 0 ? <TrendingUp className="h-3 w-3 text-expense" /> : <TrendingDown className="h-3 w-3 text-income" />} Tendência</p>
              <p className={cn('mt-1 text-lg font-black tabular-nums', trend.trendPct > 0 ? 'text-expense' : 'text-income')}>{trend.trendPct > 0 ? '+' : ''}{trend.trendPct.toFixed(0)}%</p>
              <p className="text-[10px] text-muted-foreground">{trend.trendPct > 2 ? 'subindo' : trend.trendPct < -2 ? 'caindo' : 'estável'}</p>
            </div>
            <Kpi icon={CalendarClock} label="A vencer" value={fmt(trend.aVencer)} tone="warning" />
          </div>

          {/* evolução das faturas */}
          <Section title="Evolução das faturas" icon={TrendingUp}>
            <div className="h-56 w-full">
              <ResponsiveContainer>
                <AreaChart data={trend.series} margin={{ top: 10, right: 6, left: -14, bottom: 0 }}>
                  <defs><linearGradient id="ccFat" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} /><stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.35} vertical={false} />
                  <XAxis dataKey="name" tick={axis} tickLine={false} axisLine={false} />
                  <YAxis tick={axis} tickLine={false} axisLine={false} width={42} tickFormatter={kFmt} />
                  <RTooltip contentStyle={tip} formatter={(v: number) => fmt(v)} labelFormatter={(l) => `Fatura ${l}`} />
                  {trend.media > 0 && <ReferenceLine y={trend.media} stroke="hsl(var(--info))" strokeDasharray="4 4" />}
                  <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#ccFat)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <span>Maior: <b className="text-foreground">{fmt(trend.maxF.total)}</b> ({trend.maxF.name})</span>
              <span>Menor: <b className="text-foreground">{fmt(trend.minF.total)}</b> ({trend.minF.name})</span>
              <span>— linha tracejada = média</span>
            </div>
          </Section>

          {/* categorias ao longo do tempo */}
          <Section title="Categorias ao longo do tempo" icon={Layers3}>
            <div className="h-56 w-full">
              <ResponsiveContainer>
                <BarChart data={trend.stack} margin={{ top: 10, right: 6, left: -14, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.35} vertical={false} />
                  <XAxis dataKey="name" tick={axis} tickLine={false} axisLine={false} />
                  <YAxis tick={axis} tickLine={false} axisLine={false} width={42} tickFormatter={kFmt} />
                  <RTooltip contentStyle={tip} formatter={(v: number) => fmt(v)} cursor={{ fill: 'hsl(var(--muted)/0.3)' }} />
                  {trend.topCatMeta.map((c) => <Bar key={c.key} dataKey={c.name} stackId="a" fill={c.color} />)}
                  <Bar dataKey="Outros" stackId="a" fill={FALLBACK} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
              {trend.topCatMeta.map((c) => <span key={c.key} className="flex items-center gap-1 text-muted-foreground"><span className="h-2 w-2 rounded-full" style={{ background: c.color }} />{c.name}</span>)}
              <span className="flex items-center gap-1 text-muted-foreground"><span className="h-2 w-2 rounded-full" style={{ background: FALLBACK }} />Outros</span>
            </div>
          </Section>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* parcelas a vencer */}
            <Section title="Parcelas a vencer" icon={CalendarClock}>
              {trend.futuras.length === 0 ? <Empty text="Nenhuma parcela futura em aberto. 🎉" /> : (
                <div className="h-44 w-full">
                  <ResponsiveContainer>
                    <BarChart data={trend.futuras} margin={{ top: 10, right: 6, left: -14, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.35} vertical={false} />
                      <XAxis dataKey="name" tick={axis} tickLine={false} axisLine={false} />
                      <YAxis tick={axis} tickLine={false} axisLine={false} width={42} tickFormatter={kFmt} />
                      <RTooltip contentStyle={tip} formatter={(v: number) => fmt(v)} labelFormatter={(l) => `Vence ${l}`} cursor={{ fill: 'hsl(var(--muted)/0.3)' }} />
                      <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={40} fill="hsl(var(--warning))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Section>

            {/* previsão + recorrências */}
            <Section title="Próxima fatura & assinaturas" icon={CalendarClock}>
              <div className="rounded-xl border border-primary/20 bg-primary/[0.06] p-3">
                <p className="text-[11px] text-muted-foreground">Já lançado para {mFull(trend.nextM)}</p>
                <p className="currency text-xl font-black tabular-nums">{fmt(trend.agendadoProx)}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">+ novas compras que você fizer até o fechamento</p>
              </div>
              {trend.recorrentes.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Assinaturas/recorrências</p>
                  {trend.recorrentes.map((r, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex min-w-0 items-center gap-1.5"><Repeat className="h-3 w-3 shrink-0 text-info" /><span className="truncate">{r.name}</span></span>
                      <span className="shrink-0 font-bold tabular-nums">{fmt(r.value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>

          {/* insights */}
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
        </>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, tone }: { icon: typeof Wallet; label: string; value: string; sub?: string; tone?: 'warning' }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
      <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground"><Icon className={cn('h-3 w-3', tone === 'warning' ? 'text-warning' : 'text-primary')} /> {label}</p>
      <p className="mt-1 currency text-base font-black leading-tight tabular-nums sm:text-lg">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
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

function Empty({ text }: { text: string }) {
  return <p className="py-6 text-center text-xs text-muted-foreground">{text}</p>;
}

function CompareBars({ rows, fmt }: { rows: { label: string; value: number; color: string }[]; fmt: (v: number) => string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.label} className="space-y-1">
          <div className="flex items-center justify-between text-xs"><span className="capitalize text-muted-foreground">{r.label}</span><span className="font-bold tabular-nums">{fmt(r.value)}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: r.color }} /></div>
        </div>
      ))}
    </div>
  );
}

function DonutList({ data, fmt }: { data: { name: string; color: string; value: number }[]; fmt: (v: number) => string }) {
  if (data.length === 0) return <Empty text="Sem dados." />;
  return (
    <div className="flex items-center gap-4">
      <div className="h-32 w-32 shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={36} outerRadius={58} paddingAngle={2} strokeWidth={0}>
              {data.map((d) => <Cell key={d.name} fill={d.color} />)}
            </Pie>
            <RTooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }} formatter={(v: number) => fmt(v)} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        {data.map((d) => (
          <div key={d.name} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex min-w-0 items-center gap-1.5"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} /><span className="truncate font-medium">{d.name}</span></span>
            <span className="shrink-0 font-bold tabular-nums">{fmt(d.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
