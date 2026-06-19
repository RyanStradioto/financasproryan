import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  Tooltip as RTooltip, CartesianGrid, PieChart, Pie, Cell, ReferenceLine,
  RadialBarChart, RadialBar, PolarAngleAxis,
} from 'recharts';
import {
  TrendingUp, TrendingDown, CalendarClock, Wallet, Receipt, Layers3, Trophy,
  ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownRight, Lightbulb, CalendarRange,
  CreditCard as CardIcon, Repeat, Sparkles, Gauge, PiggyBank,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, getMonthYear } from '@/lib/format';
import { useSensitiveData } from '@/components/finance/SensitiveData';
import { useCreditCards, useCreditCardTransactions } from '@/hooks/useCreditCards';
import { useCategories, useIncome } from '@/hooks/useFinanceData';

const FALLBACK = '#64748b';
const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MONTHS_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const mShort = (m: string) => { const [, mm] = (m || '').split('-').map(Number); return MONTHS_PT[(mm - 1) % 12] ?? m; };
const mFull = (m: string) => { const [y, mm] = (m || '').split('-').map(Number); return `${MONTHS_FULL[(mm - 1) % 12] ?? ''} ${y ?? ''}`.trim(); };
const addMonths = (m: string, d: number) => { const [y, mm] = m.split('-').map(Number); const dt = new Date(y, mm - 1 + d, 1); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`; };
const lastMonths = (n: number, anchor: string) => Array.from({ length: n }, (_, i) => addMonths(anchor, -(n - 1 - i)));
const tierColor = (pct: number) => (pct > 80 ? 'hsl(var(--expense))' : pct > 50 ? 'hsl(var(--warning))' : 'hsl(var(--income))');

type Tab = 'mes' | 'trend';

export default function CreditCardAnalytics() {
  const { maskCurrency } = useSensitiveData();
  const { data: cards = [] } = useCreditCards();
  const { data: allTx = [] } = useCreditCardTransactions();
  const { data: categories = [] } = useCategories();
  const { data: allIncome = [] } = useIncome();

  const [tab, setTab] = useState<Tab>('mes');
  const [cardFilter, setCardFilter] = useState('__all__');
  const [range, setRange] = useState<6 | 12>(6);
  const [ready, setReady] = useState(false); // evita recharts medir largura 0 no abrir do dialog

  useEffect(() => { const t = setTimeout(() => setReady(true), 130); return () => clearTimeout(t); }, []);

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

  const monthBounds = useMemo(() => {
    const ms = scoped.map((t) => t.bill_month).filter(Boolean).sort();
    return { min: ms[0] ?? nowMonth, max: ms[ms.length - 1] ?? nowMonth };
  }, [scoped, nowMonth]);
  const maxNav = monthBounds.max > nowMonth ? monthBounds.max : nowMonth;

  // Mês inicial = mês atual se tiver fatura, senão o último mês com dados.
  const [selMonth, setSelMonth] = useState<string | null>(null);
  const effMonth = selMonth ?? (scoped.some((t) => t.bill_month === nowMonth) ? nowMonth : monthBounds.max);

  // renda do mês (concluída) para % comprometido
  const incomeByMonth = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of allIncome) {
      if (i.status !== 'concluido') continue;
      const k = (i.date || '').slice(0, 7);
      m.set(k, (m.get(k) ?? 0) + Number(i.amount));
    }
    return m;
  }, [allIncome]);

  // limite (cartão selecionado ou soma)
  const limitInfo = useMemo(() => {
    const relevant = cardFilter === '__all__' ? cards : cards.filter((c) => c.id === cardFilter);
    const limit = relevant.reduce((s, c) => s + (Number(c.credit_limit) || 0), 0);
    const aberto = scoped.filter((t) => !t.paid).reduce((s, t) => s + Number(t.amount), 0);
    const pct = limit > 0 ? Math.min(100, Math.max(0, (aberto / limit) * 100)) : 0;
    return { limit, aberto, pct, disponivel: Math.max(0, limit - aberto) };
  }, [cards, cardFilter, scoped]);

  // ─────────────── MÊS ───────────────
  const md = useMemo(() => {
    const prev = addMonths(effMonth, -1);
    const txM = scoped.filter((t) => t.bill_month === effMonth);
    const txPrev = scoped.filter((t) => t.bill_month === prev);
    const fatura = txM.reduce((s, t) => s + Number(t.amount), 0);
    const faturaPrev = txPrev.reduce((s, t) => s + Number(t.amount), 0);
    const compras = txM.filter((t) => Number(t.amount) > 0).length;
    const ticket = compras ? fatura / compras : 0;
    const parcelado = txM.filter((t) => t.is_installment).reduce((s, t) => s + Number(t.amount), 0);
    const avista = Math.max(0, fatura - parcelado);
    const pago = txM.length > 0 && txM.every((t) => t.paid);
    const deltaPct = faturaPrev > 0 ? ((fatura - faturaPrev) / faturaPrev) * 100 : null;
    const renda = incomeByMonth.get(effMonth) ?? 0;
    const pctRenda = renda > 0 ? (fatura / renda) * 100 : null;

    // sparkline: últimas 6 faturas terminando em effMonth
    const spark = lastMonths(6, effMonth).map((m) => ({ v: scoped.filter((t) => t.bill_month === m).reduce((s, t) => s + Number(t.amount), 0) }));

    // categorias com Δ
    const prevByCat = new Map<string, number>();
    for (const t of txPrev) { const k = String(t.category_id ?? 'none'); prevByCat.set(k, (prevByCat.get(k) ?? 0) + Number(t.amount)); }
    const byCat = new Map<string, number>();
    for (const t of txM) { if (Number(t.amount) <= 0) continue; const k = String(t.category_id ?? 'none'); byCat.set(k, (byCat.get(k) ?? 0) + Number(t.amount)); }
    const total = Array.from(byCat.values()).reduce((s, v) => s + v, 0) || 1;
    const cats = Array.from(byCat.entries()).map(([k, value]) => {
      const meta = k === 'none' ? { name: 'Sem categoria', icon: '❓', color: FALLBACK } : catOf(k);
      const prevV = prevByCat.get(k) ?? 0;
      return { key: k, ...meta, value, pct: (value / total) * 100, deltaPct: prevV > 0 ? ((value - prevV) / prevV) * 100 : null };
    }).sort((a, b) => b.value - a.value);

    // acumulado por dia: effMonth vs prev
    const [y, mm] = effMonth.split('-').map(Number);
    const lastDay = new Date(y, mm, 0).getDate();
    const dailySel = new Array(lastDay).fill(0);
    const [py, pmm] = prev.split('-').map(Number);
    const prevLastDay = new Date(py, pmm, 0).getDate();
    const dailyPrev = new Array(prevLastDay).fill(0);
    for (const t of txM) { const d = Number((t.date || '').slice(8, 10)); if (d >= 1 && d <= lastDay && Number(t.amount) > 0) dailySel[d - 1] += Number(t.amount); }
    for (const t of txPrev) { const d = Number((t.date || '').slice(8, 10)); if (d >= 1 && d <= prevLastDay && Number(t.amount) > 0) dailyPrev[d - 1] += Number(t.amount); }
    let accS = 0, accP = 0;
    const cumul = Array.from({ length: Math.max(lastDay, prevLastDay) }, (_, i) => {
      accS += dailySel[i] ?? 0; accP += dailyPrev[i] ?? 0;
      return { day: i + 1, atual: i < lastDay ? accS : null, anterior: i < prevLastDay ? accP : null };
    });

    const byCard = (cardFilter === '__all__' && cards.length > 1)
      ? cards.map((c) => ({ name: c.name, color: c.color || FALLBACK, value: txM.filter((t) => t.credit_card_id === c.id).reduce((s, t) => s + Number(t.amount), 0) })).filter((c) => c.value > 0).sort((a, b) => b.value - a.value)
      : [];

    const top = [...txM].filter((t) => Number(t.amount) > 0).sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 6)
      .map((t) => ({ id: t.id, desc: t.description || 'Compra', amount: Number(t.amount), icon: catOf(t.category_id).icon, parc: t.is_installment ? `${t.installment_number}/${t.total_installments}` : null }));

    return { prev, fatura, faturaPrev, compras, ticket, parcelado, avista, pago, deltaPct, pctRenda, spark, cats, cumul, byCard, top };
  }, [scoped, effMonth, cardFilter, cards, catMap, incomeByMonth]);

  // ─────────────── TENDÊNCIAS ───────────────
  const tr = useMemo(() => {
    const months = lastMonths(range, nowMonth);
    const series = months.map((m) => ({ name: mShort(m), month: m, total: scoped.filter((t) => t.bill_month === m).reduce((s, t) => s + Number(t.amount), 0) }));
    const withData = series.filter((s) => s.total > 0);
    const totalPeriodo = series.reduce((s, x) => s + x.total, 0);
    const media = withData.length ? totalPeriodo / withData.length : 0;
    const maxF = series.reduce((a, b) => (b.total > a.total ? b : a), { total: 0, name: '' } as { total: number; name: string });
    const minF = withData.length ? withData.reduce((a, b) => (b.total < a.total ? b : a)) : { total: 0, name: '' };
    const half = Math.floor(series.length / 2);
    const firstAvg = series.slice(0, half).reduce((s, x) => s + x.total, 0) / Math.max(1, half);
    const secondAvg = series.slice(half).reduce((s, x) => s + x.total, 0) / Math.max(1, series.length - half);
    const trendPct = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;

    const catTotals = new Map<string, number>();
    for (const t of scoped) { if (!months.includes(t.bill_month) || Number(t.amount) <= 0) continue; const k = String(t.category_id ?? 'none'); catTotals.set(k, (catTotals.get(k) ?? 0) + Number(t.amount)); }
    const topKeys = Array.from(catTotals.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k);
    const topMeta = topKeys.map((k, i) => ({ key: k, label: `c${i}`, name: k === 'none' ? 'Sem cat.' : catOf(k).name, color: k === 'none' ? FALLBACK : catOf(k).color }));
    const stack = months.map((m) => {
      const row: Record<string, number | string> = { name: mShort(m) };
      let outros = 0;
      for (const t of scoped.filter((x) => x.bill_month === m && Number(x.amount) > 0)) {
        const k = String(t.category_id ?? 'none');
        const meta = topMeta.find((c) => c.key === k);
        if (meta) row[meta.label] = (Number(row[meta.label]) || 0) + Number(t.amount);
        else outros += Number(t.amount);
      }
      row.outros = outros;
      return row;
    });
    const topDonut = topMeta.map((c) => ({ name: c.name, color: c.color, value: catTotals.get(c.key) ?? 0 }));
    const outrosTotal = Array.from(catTotals.entries()).filter(([k]) => !topKeys.includes(k)).reduce((s, [, v]) => s + v, 0);
    if (outrosTotal > 0) topDonut.push({ name: 'Outros', color: FALLBACK, value: outrosTotal });

    const futAcc = new Map<string, number>();
    for (const t of scoped) { if (t.paid || t.bill_month <= nowMonth) continue; futAcc.set(t.bill_month, (futAcc.get(t.bill_month) ?? 0) + Number(t.amount)); }
    const futuras = Array.from(futAcc.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(0, 8).map(([m, v]) => ({ name: mShort(m), total: v }));
    const aVencer = Array.from(futAcc.values()).reduce((s, v) => s + v, 0);

    const recAcc = new Map<string, { name: string; icon: string; value: number }>();
    for (const t of scoped) { if (!t.is_recurring || !months.includes(t.bill_month)) continue; const key = (t.description || 'Recorrente').toLowerCase(); const cur = recAcc.get(key) ?? { name: t.description || 'Recorrente', icon: catOf(t.category_id).icon, value: 0 }; cur.value += Number(t.amount); recAcc.set(key, cur); }
    const recorrentes = Array.from(recAcc.values()).sort((a, b) => b.value - a.value).slice(0, 5);

    const nextM = addMonths(nowMonth, 1);
    const agendadoProx = scoped.filter((t) => t.bill_month === nextM).reduce((s, t) => s + Number(t.amount), 0);

    return { series, totalPeriodo, media, maxF, minF, trendPct, topMeta, stack, topDonut, futuras, aVencer, recorrentes, nextM, agendadoProx };
  }, [scoped, range, nowMonth, catMap]);

  const insights = useMemo(() => {
    const out: { icon: string; text: string; tone: 'good' | 'warn' | 'info' }[] = [];
    if (md.deltaPct !== null) { const up = md.deltaPct >= 0; out.push({ icon: up ? '📈' : '📉', tone: up ? 'warn' : 'good', text: `Fatura de ${mFull(effMonth)} ${up ? 'subiu' : 'caiu'} ${Math.abs(md.deltaPct).toFixed(0)}% vs ${mShort(md.prev)}.` }); }
    if (md.pctRenda !== null) out.push({ icon: '💰', tone: md.pctRenda > 40 ? 'warn' : 'info', text: `O cartão comprometeu ${md.pctRenda.toFixed(0)}% da sua renda em ${mShort(effMonth)}.` });
    if (md.cats[0]) out.push({ icon: md.cats[0].icon, tone: 'info', text: `Maior gasto: ${md.cats[0].name} (${md.cats[0].pct.toFixed(0)}% · ${fmt(md.cats[0].value)}).` });
    const dispar = md.cats.filter((c) => c.deltaPct !== null && c.deltaPct > 40 && c.value > 50).sort((a, b) => (b.deltaPct ?? 0) - (a.deltaPct ?? 0))[0];
    if (dispar) out.push({ icon: '🚨', tone: 'warn', text: `${dispar.name} disparou: +${dispar.deltaPct!.toFixed(0)}% vs o mês anterior.` });
    if (tr.aVencer > 0) out.push({ icon: '🗓️', tone: 'info', text: `${fmt(tr.aVencer)} em parcelas comprometidas nos próximos meses.` });
    if (Math.abs(tr.trendPct) >= 5) out.push({ icon: tr.trendPct > 0 ? '⚠️' : '✅', tone: tr.trendPct > 0 ? 'warn' : 'good', text: `Tendência ${range}m: ${tr.trendPct > 0 ? 'subindo' : 'caindo'} ${Math.abs(tr.trendPct).toFixed(0)}%.` });
    if (limitInfo.limit > 0) out.push({ icon: limitInfo.pct > 80 ? '🔴' : '💳', tone: limitInfo.pct > 80 ? 'warn' : 'info', text: `Limite usado: ${limitInfo.pct.toFixed(0)}% · disponível ${fmt(limitInfo.disponivel)}.` });
    return out;
  }, [md, tr, limitInfo, effMonth, range]);

  const axis = { fontSize: 10, fill: 'hsl(var(--muted-foreground))' };
  const tip = { background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 } as const;
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
      {/* filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={cardFilter} onChange={(e) => setCardFilter(e.target.value)} className="h-9 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 sm:flex-none">
          <option value="__all__">Todos os cartões</option>
          {cards.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </select>
        <div className="flex shrink-0 overflow-hidden rounded-xl border border-border">
          {([['mes', 'Mês'], ['trend', 'Tendências']] as const).map(([k, lbl]) => (
            <button key={k} onClick={() => setTab(k)} className={cn('px-3.5 py-1.5 text-xs font-bold transition-colors', tab === k ? 'bg-primary text-primary-foreground' : 'bg-muted/30 text-muted-foreground')}>{lbl}</button>
          ))}
        </div>
      </div>

      {tab === 'mes' ? (
        <>
          {/* seletor de mês */}
          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-2 py-1.5">
            <button onClick={() => setSelMonth(effMonth > monthBounds.min ? addMonths(effMonth, -1) : effMonth)} disabled={effMonth <= monthBounds.min} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
            <span className="flex items-center gap-1.5 text-sm font-bold capitalize"><CalendarRange className="h-4 w-4 text-primary" />{mFull(effMonth)}</span>
            <button onClick={() => setSelMonth(effMonth < maxNav ? addMonths(effMonth, 1) : effMonth)} disabled={effMonth >= maxNav} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
          </div>

          {/* HERO: fatura + sparkline | gauge de limite */}
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/12 to-transparent p-4 lg:col-span-2">
              <span className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/15 blur-2xl" />
              <div className="relative z-10 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground"><Receipt className="h-3 w-3 text-primary" /> Fatura de {mShort(effMonth)}</p>
                  <p className="mt-1 currency text-2xl font-black leading-tight tabular-nums sm:text-3xl">{fmt(md.fatura)}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                    {md.deltaPct !== null && <DeltaBadge pct={md.deltaPct} suffix={`vs ${mShort(md.prev)}`} />}
                    <span>{md.compras} compras · ticket {fmt(md.ticket)}</span>
                    <span className={cn('rounded-full px-1.5 py-0.5 font-bold', md.pago ? 'bg-income/10 text-income' : md.fatura > 0 ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground')}>{md.fatura > 0 ? (md.pago ? 'paga' : 'em aberto') : 'sem gastos'}</span>
                  </div>
                </div>
              </div>
              {/* sparkline */}
              <div className="relative z-10 mt-2 h-10 w-full">
                {ready && (
                  <ResponsiveContainer>
                    <AreaChart data={md.spark} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                      <defs><linearGradient id="ccSpark" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} /><stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} /></linearGradient></defs>
                      <Area type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#ccSpark)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* gauge limite */}
            <div className="rounded-2xl border border-border/60 bg-card p-4">
              <p className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground"><Gauge className="h-3 w-3 text-primary" /> Limite</p>
              {limitInfo.limit > 0 ? (
                <div className="relative mx-auto mt-1 h-28 w-full">
                  {ready && (
                    <ResponsiveContainer>
                      <RadialBarChart innerRadius="68%" outerRadius="100%" barSize={12} data={[{ value: limitInfo.pct }]} startAngle={90} endAngle={-270}>
                        <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                        <RadialBar background dataKey="value" cornerRadius={20} fill={tierColor(limitInfo.pct)} angleAxisId={0} />
                      </RadialBarChart>
                    </ResponsiveContainer>
                  )}
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-black tabular-nums">{limitInfo.pct.toFixed(0)}%</span>
                    <span className="text-[9px] uppercase text-muted-foreground">usado</span>
                  </div>
                </div>
              ) : <p className="mt-3 text-xs text-muted-foreground">Defina o limite do cartão para ver o uso.</p>}
              {limitInfo.limit > 0 && <p className="mt-1 text-center text-[11px] text-muted-foreground">disponível <b className="text-income">{fmt(limitInfo.disponivel)}</b></p>}
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <Kpi icon={Layers3} label="Compras" value={String(md.compras)} sub={`ticket ${fmt(md.ticket)}`} />
            <Kpi icon={Repeat} label="Parcelado" value={fmt(md.parcelado)} sub={`à vista ${fmt(md.avista)}`} />
            <Kpi icon={PiggyBank} label="% da renda" value={md.pctRenda !== null ? `${md.pctRenda.toFixed(0)}%` : '—'} sub={md.pctRenda !== null ? 'comprometida' : 'sem renda no mês'} tone={md.pctRenda !== null && md.pctRenda > 40 ? 'warning' : undefined} />
            <Kpi icon={Wallet} label="Em aberto (total)" value={fmt(limitInfo.aberto)} tone="warning" />
          </div>

          {/* acumulado vs mês anterior */}
          <Section title="Ritmo de gasto — este mês vs anterior" icon={TrendingUp}>
            <div className="h-44 w-full">
              {ready && (
                <ResponsiveContainer>
                  <LineChart data={md.cumul} margin={{ top: 8, right: 6, left: -14, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.35} vertical={false} />
                    <XAxis dataKey="day" tick={axis} tickLine={false} axisLine={false} interval={4} />
                    <YAxis tick={axis} tickLine={false} axisLine={false} width={42} tickFormatter={kFmt} />
                    <RTooltip contentStyle={tip} formatter={(v: number, n) => [fmt(v), n === 'atual' ? mShort(effMonth) : mShort(md.prev)]} labelFormatter={(l) => `Dia ${l}`} />
                    <Line type="monotone" dataKey="anterior" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="5 4" dot={false} connectNulls />
                    <Line type="monotone" dataKey="atual" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </Section>

          {/* categorias: donut + lista */}
          <Section title="Por categoria (variação vs mês anterior)" icon={Layers3}>
            {md.cats.length === 0 ? <Empty text="Sem gastos neste mês." /> : (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="mx-auto h-40 w-40 shrink-0">
                  {ready && (
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={md.cats.slice(0, 7)} dataKey="value" nameKey="name" innerRadius={42} outerRadius={68} paddingAngle={2} strokeWidth={0}>
                          {md.cats.slice(0, 7).map((c) => <Cell key={c.key} fill={c.color} />)}
                        </Pie>
                        <RTooltip contentStyle={tip} formatter={(v: number) => fmt(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  {md.cats.slice(0, 6).map((c) => (
                    <div key={c.key} className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="flex min-w-0 items-center gap-1.5"><span>{c.icon}</span><span className="truncate font-medium">{c.name}</span></span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          {c.deltaPct !== null && Math.abs(c.deltaPct) >= 1 && <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-bold', c.deltaPct > 0 ? 'bg-expense/10 text-expense' : 'bg-income/10 text-income')}>{c.deltaPct > 0 ? '+' : ''}{c.deltaPct.toFixed(0)}%</span>}
                          <span className="font-bold tabular-nums">{fmt(c.value)}</span>
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${Math.max(2, c.pct)}%`, backgroundColor: c.color }} /></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>

          {/* por cartão (se aplicável) + maiores compras */}
          <div className="grid gap-4 lg:grid-cols-2">
            {md.byCard.length > 0 && (
              <Section title="Por cartão neste mês" icon={CardIcon}><DonutList data={md.byCard} fmt={fmt} ready={ready} /></Section>
            )}
            <Section title="Maiores compras do mês" icon={Trophy}>
              {md.top.length === 0 ? <Empty text="Sem compras." /> : (
                <div className="space-y-1.5">
                  {md.top.map((t, i) => (
                    <div key={t.id} className="flex items-center justify-between gap-3 rounded-xl bg-muted/30 px-3 py-2">
                      <span className="flex min-w-0 items-center gap-2.5"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[11px] font-bold text-primary">{i + 1}</span><span className="text-base">{t.icon}</span><span className="min-w-0"><span className="block truncate text-sm font-medium">{t.desc}</span>{t.parc && <span className="block text-[10px] text-muted-foreground">parcela {t.parc}</span>}</span></span>
                      <span className="shrink-0 text-sm font-bold tabular-nums">{fmt(t.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>

          {insights.length > 0 && <InsightsBlock insights={insights} />}
        </>
      ) : (
        <>
          <div className="flex overflow-hidden rounded-lg border border-border w-fit">
            {([6, 12] as const).map((r) => <button key={r} onClick={() => setRange(r)} className={cn('px-3 py-1.5 text-xs font-semibold transition-colors', range === r ? 'bg-primary text-primary-foreground' : 'bg-muted/30 text-muted-foreground')}>{r} meses</button>)}
          </div>

          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <Kpi icon={Receipt} label={`Total ${range}m`} value={fmt(tr.totalPeriodo)} />
            <Kpi icon={TrendingUp} label="Média mensal" value={fmt(tr.media)} />
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
              <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{tr.trendPct > 0 ? <TrendingUp className="h-3 w-3 text-expense" /> : <TrendingDown className="h-3 w-3 text-income" />} Tendência</p>
              <p className={cn('mt-1 text-lg font-black tabular-nums', tr.trendPct > 0 ? 'text-expense' : 'text-income')}>{tr.trendPct > 0 ? '+' : ''}{tr.trendPct.toFixed(0)}%</p>
              <p className="text-[10px] text-muted-foreground">{tr.trendPct > 2 ? 'subindo' : tr.trendPct < -2 ? 'caindo' : 'estável'}</p>
            </div>
            <Kpi icon={CalendarClock} label="A vencer" value={fmt(tr.aVencer)} tone="warning" />
          </div>

          <Section title="Evolução das faturas" icon={TrendingUp}>
            <div className="h-56 w-full">
              {ready && (
                <ResponsiveContainer>
                  <AreaChart data={tr.series} margin={{ top: 10, right: 6, left: -14, bottom: 0 }}>
                    <defs><linearGradient id="ccFat" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} /><stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.35} vertical={false} />
                    <XAxis dataKey="name" tick={axis} tickLine={false} axisLine={false} />
                    <YAxis tick={axis} tickLine={false} axisLine={false} width={42} tickFormatter={kFmt} />
                    <RTooltip contentStyle={tip} formatter={(v: number) => fmt(v)} labelFormatter={(l) => `Fatura ${l}`} />
                    {tr.media > 0 && <ReferenceLine y={tr.media} stroke="hsl(var(--info))" strokeDasharray="4 4" />}
                    <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#ccFat)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <span>Maior: <b className="text-foreground">{fmt(tr.maxF.total)}</b> ({tr.maxF.name})</span>
              <span>Menor: <b className="text-foreground">{fmt(tr.minF.total)}</b> ({tr.minF.name})</span>
              <span>· tracejado = média</span>
            </div>
          </Section>

          <Section title="Categorias ao longo do tempo" icon={Layers3}>
            <div className="h-56 w-full">
              {ready && (
                <ResponsiveContainer>
                  <BarChart data={tr.stack} margin={{ top: 10, right: 6, left: -14, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.35} vertical={false} />
                    <XAxis dataKey="name" tick={axis} tickLine={false} axisLine={false} />
                    <YAxis tick={axis} tickLine={false} axisLine={false} width={42} tickFormatter={kFmt} />
                    <RTooltip contentStyle={tip} formatter={(v: number, n) => [fmt(v), tr.topMeta.find((c) => c.label === n)?.name ?? 'Outros']} cursor={{ fill: 'hsl(var(--muted)/0.3)' }} />
                    {tr.topMeta.map((c) => <Bar key={c.key} dataKey={c.label} stackId="a" fill={c.color} />)}
                    <Bar dataKey="outros" stackId="a" fill={FALLBACK} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
              {tr.topMeta.map((c) => <span key={c.key} className="flex items-center gap-1 text-muted-foreground"><span className="h-2 w-2 rounded-full" style={{ background: c.color }} />{c.name}</span>)}
              <span className="flex items-center gap-1 text-muted-foreground"><span className="h-2 w-2 rounded-full" style={{ background: FALLBACK }} />Outros</span>
            </div>
          </Section>

          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="Top categorias do período" icon={Layers3}><DonutList data={tr.topDonut} fmt={fmt} ready={ready} /></Section>
            <Section title="Parcelas a vencer" icon={CalendarClock}>
              {tr.futuras.length === 0 ? <Empty text="Nenhuma parcela futura. 🎉" /> : (
                <div className="h-44 w-full">
                  {ready && (
                    <ResponsiveContainer>
                      <BarChart data={tr.futuras} margin={{ top: 10, right: 6, left: -14, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.35} vertical={false} />
                        <XAxis dataKey="name" tick={axis} tickLine={false} axisLine={false} />
                        <YAxis tick={axis} tickLine={false} axisLine={false} width={42} tickFormatter={kFmt} />
                        <RTooltip contentStyle={tip} formatter={(v: number) => fmt(v)} labelFormatter={(l) => `Vence ${l}`} cursor={{ fill: 'hsl(var(--muted)/0.3)' }} />
                        <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={40} fill="hsl(var(--warning))" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              )}
            </Section>
          </div>

          <Section title="Próxima fatura & assinaturas" icon={CalendarClock}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-primary/20 bg-primary/[0.06] p-3">
                <p className="text-[11px] text-muted-foreground">Já lançado para {mFull(tr.nextM)}</p>
                <p className="currency text-xl font-black tabular-nums">{fmt(tr.agendadoProx)}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">+ novas compras até o fechamento</p>
              </div>
              {tr.recorrentes.length > 0 && (
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Assinaturas / recorrências</p>
                  <div className="space-y-1.5">
                    {tr.recorrentes.map((r, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 text-xs"><span className="flex min-w-0 items-center gap-1.5"><Repeat className="h-3 w-3 shrink-0 text-info" /><span className="truncate">{r.name}</span></span><span className="shrink-0 font-bold tabular-nums">{fmt(r.value)}</span></div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Section>

          {insights.length > 0 && <InsightsBlock insights={insights} />}
        </>
      )}
    </div>
  );
}

function DeltaBadge({ pct, suffix }: { pct: number; suffix?: string }) {
  const up = pct > 0;
  return (
    <span className={cn('flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-bold', up ? 'bg-expense/10 text-expense' : 'bg-income/10 text-income')}>
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}{up ? '+' : ''}{pct.toFixed(0)}%{suffix ? <span className="font-normal opacity-70"> {suffix}</span> : null}
    </span>
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

function Empty({ text }: { text: string }) { return <p className="py-6 text-center text-xs text-muted-foreground">{text}</p>; }

function InsightsBlock({ insights }: { insights: { icon: string; text: string; tone: 'good' | 'warn' | 'info' }[] }) {
  return (
    <Section title="Insights" icon={Lightbulb}>
      <div className="grid gap-2 sm:grid-cols-2">
        {insights.map((ins, i) => (
          <div key={i} className={cn('flex items-start gap-2 rounded-xl border p-2.5 text-xs leading-relaxed', ins.tone === 'good' ? 'border-income/20 bg-income/[0.05]' : ins.tone === 'warn' ? 'border-expense/20 bg-expense/[0.05]' : 'border-border/60 bg-muted/20')}>
            <span className="shrink-0">{ins.icon}</span><span>{ins.text}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

function DonutList({ data, fmt, ready }: { data: { name: string; color: string; value: number }[]; fmt: (v: number) => string; ready: boolean }) {
  const clean = data.filter((d) => d.value > 0);
  if (clean.length === 0) return <Empty text="Sem dados." />;
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="mx-auto h-32 w-32 shrink-0">
        {ready && (
          <ResponsiveContainer>
            <PieChart>
              <Pie data={clean} dataKey="value" nameKey="name" innerRadius={36} outerRadius={58} paddingAngle={2} strokeWidth={0}>
                {clean.map((d) => <Cell key={d.name} fill={d.color} />)}
              </Pie>
              <RTooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }} formatter={(v: number) => fmt(v)} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        {clean.map((d) => (
          <div key={d.name} className="flex items-center justify-between gap-2 text-xs"><span className="flex min-w-0 items-center gap-1.5"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} /><span className="truncate font-medium">{d.name}</span></span><span className="shrink-0 font-bold tabular-nums">{fmt(d.value)}</span></div>
        ))}
      </div>
    </div>
  );
}
