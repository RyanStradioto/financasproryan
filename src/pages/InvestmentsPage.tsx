import { useState, useMemo, type ReactNode } from 'react';
import {
  Plus, TrendingUp, TrendingDown, BarChart3, Pencil, Trash2, ArrowUpRight, ArrowDownRight,
  Sparkles, Target, Percent, Receipt, Settings2, PiggyBank, CalendarClock, Flame,
  Calculator, Tag, Coins, Palette, ShieldCheck, ChevronRight, Image as ImageIcon, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  usePortfolio, useInvestmentRates,
  useAddInvestment, useUpdateInvestment, useDeleteInvestment,
  useInvestmentTransactions, useAddInvestmentTransaction,
  type PortfolioInvestment,
} from '@/hooks/useInvestments';
import { useAccounts } from '@/hooks/useFinanceData';
import {
  INDEX_TYPES, isAutoCalc, goalProgress, projectInvestment, monthsToGoal,
  effectiveAnnualRate, simulate,
  type InvestmentRates, type IndexType,
} from '@/lib/investmentReturns';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as RTooltip } from 'recharts';
import { useSensitiveData } from '@/components/finance/SensitiveData';
import MarketQuotes from '@/components/finance/MarketQuotes';
import InvestmentExplorer from '@/components/finance/InvestmentExplorer';

// ─── Constants ────────────────────────────────────────────────────────────────
const INVESTMENT_TYPES = [
  { value: 'caixinha', label: 'Caixinha',       icon: '📦', defaultIndex: 'cdi' as IndexType },
  { value: 'cdb',      label: 'CDB / RDB',      icon: '🏦', defaultIndex: 'cdi' as IndexType },
  { value: 'lci',      label: 'LCI',            icon: '🏛️', defaultIndex: 'cdi' as IndexType },
  { value: 'lca',      label: 'LCA',            icon: '🌾', defaultIndex: 'cdi' as IndexType },
  { value: 'tesouro',  label: 'Tesouro Direto', icon: '🏛️', defaultIndex: 'ipca' as IndexType },
  { value: 'poupanca', label: 'Poupança',       icon: '🐷', defaultIndex: 'poupanca' as IndexType },
  { value: 'fundo',    label: 'Fundo',          icon: '📊', defaultIndex: 'manual' as IndexType },
  { value: 'acoes',    label: 'Ações',          icon: '📈', defaultIndex: 'manual' as IndexType },
  { value: 'fii',      label: 'FII',            icon: '🏢', defaultIndex: 'manual' as IndexType },
  { value: 'cripto',   label: 'Cripto',         icon: '₿',  defaultIndex: 'manual' as IndexType },
  { value: 'outro',    label: 'Outro',          icon: '💼', defaultIndex: 'cdi' as IndexType },
];
const COVER_COLORS = ['#10b981', '#14b8a6', '#0ea5e9', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#f97316', '#84cc16', '#64748b', '#eab308'];
const EMOJIS = ['📦', '🏖️', '✈️', '🏠', '🚗', '💍', '🎓', '🚨', '🎁', '💻', '👶', '🐾', '🌱', '💰', '📈', '🏦'];
const LIQUIDITY_OPTIONS = [
  { value: 'diaria', label: 'Diária (D+0)', badge: 'D+0' },
  { value: 'd+1', label: 'D+1', badge: 'D+1' },
  { value: 'd+30', label: 'D+30', badge: 'D+30' },
  { value: 'd+360', label: 'D+360', badge: 'D+360' },
  { value: 'vencimento', label: 'No vencimento', badge: 'Venc.' },
];
const PROJ_LABELS = ['1 mês', '3 meses', '6 meses', '1 ano', '2 anos', '5 anos'];

type MoveType = 'aporte' | 'resgate' | 'rendimento' | 'taxa' | 'ir';
const MOVE_TYPES: { value: MoveType; label: string; verb: string; help: string; needsAccount: boolean; accountLabel: string; tone: 'expense' | 'income' | 'warning' }[] = [
  { value: 'aporte',     label: 'Aporte',     verb: 'Aportar',  help: 'O dinheiro sai da conta e entra no investimento. Baixa do saldo, mas NÃO é um gasto.', needsAccount: true,  accountLabel: 'Conta de origem',  tone: 'expense' },
  { value: 'resgate',    label: 'Resgate',    verb: 'Resgatar', help: 'O dinheiro volta do investimento para a conta. Entra no saldo, mas NÃO é receita.', needsAccount: true,  accountLabel: 'Conta de destino', tone: 'income' },
  { value: 'rendimento', label: 'Rendimento', verb: 'Lançar',   help: 'Ganho manual (para ativos sem taxa automática, ex.: ações, cripto).', needsAccount: false, accountLabel: '', tone: 'income' },
  { value: 'taxa',       label: 'Taxa',       verb: 'Lançar',   help: 'Taxa/custo descontado do investimento.', needsAccount: false, accountLabel: '', tone: 'warning' },
  { value: 'ir',         label: 'IR',         verb: 'Lançar',   help: 'Imposto descontado do investimento.', needsAccount: false, accountLabel: '', tone: 'warning' },
];
const MOVE_ICONS: Record<MoveType, typeof ArrowUpRight> = { aporte: ArrowUpRight, resgate: ArrowDownRight, rendimento: TrendingUp, taxa: Percent, ir: Receipt };

// ─── Helpers ──────────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().slice(0, 10);
const coverGradient = (c: string) => `linear-gradient(135deg, ${c} 0%, color-mix(in srgb, ${c}, #000 30%) 100%)`;
const num = (s: string) => parseFloat((s || '').replace(',', '.')) || 0;
const rateLabel = (inv: { index_type?: string | null; cdi_percent?: number | null; annual_rate?: number | null }) => {
  const idx = inv.index_type || 'cdi';
  if (idx === 'cdi') return `${Number(inv.cdi_percent) || 100}% CDI`;
  if (idx === 'prefixado') return `${Number(inv.annual_rate) || 0}% a.a.`;
  if (idx === 'ipca') return `IPCA + ${Number(inv.annual_rate) || 0}%`;
  if (idx === 'poupanca') return 'Poupança';
  return 'Manual';
};

function Ring({ value, color, size = 52, stroke = 5, children }: { value: number; color: string; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(Math.max(value, 0), 1));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" className="transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function InvestmentsPage() {
  const { maskCurrency, maskText, isVisible } = useSensitiveData();
  const portfolio = usePortfolio();
  const { rates, setRates } = useInvestmentRates();
  const { data: allTransactions = [] } = useInvestmentTransactions();
  const { data: accounts = [] } = useAccounts();
  const addInvestment = useAddInvestment();
  const updateInvestment = useUpdateInvestment();
  const deleteInvestment = useDeleteInvestment();
  const addTransaction = useAddInvestmentTransaction();

  const investments = portfolio.investments;

  // dialog state
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<PortfolioInvestment | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [showRates, setShowRates] = useState(false);
  const [showSim, setShowSim] = useState(false);
  const [movement, setMovement] = useState<{ investmentId: string; type: MoveType } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PortfolioInvestment | null>(null);

  // forms
  const emptyForm = {
    name: '', type: 'caixinha', index_type: 'cdi' as IndexType, institution: '',
    current_value: '', accrued: '', cdi_percent: '100', annual_rate: '', goal_amount: '',
    liquidity: 'diaria', color: COVER_COLORS[0], icon: '📦', photo_url: '',
  };
  const [form, setForm] = useState({ ...emptyForm });
  const [rebalance, setRebalance] = useState('');
  const [moveForm, setMoveForm] = useState({ amount: '', accountId: '', date: todayStr(), description: '' });
  const [rateForm, setRateForm] = useState({ selic: '', cdi: '', ipca: '' });
  const [sim, setSim] = useState({ initial: '1000', monthly: '300', years: '5', index_type: 'cdi' as IndexType, cdi_percent: '100', annual_rate: '' });

  // derived
  const detail = detailId ? investments.find(i => i.id === detailId) ?? null : null;
  const pieData = useMemo(() => investments
    .filter(i => i.value > 0)
    .map(i => ({ id: i.id, name: i.name, value: i.value, color: i.color || COVER_COLORS[0], pct: portfolio.totalValue > 0 ? (i.value / portfolio.totalValue) * 100 : 0, icon: i.icon }))
    .sort((a, b) => b.value - a.value), [investments, portfolio.totalValue]);
  const showDonut = pieData.length >= 1 && portfolio.totalValue > 0;

  const simResult = useMemo(() => {
    const annualRate = effectiveAnnualRate({ index_type: sim.index_type, cdi_percent: num(sim.cdi_percent) || 100, annual_rate: num(sim.annual_rate) }, rates);
    return simulate({ initial: num(sim.initial), monthly: num(sim.monthly), months: Math.round(num(sim.years) * 12), annualRate, indexType: sim.index_type }, rates);
  }, [sim, rates]);
  const simAnnualPct = effectiveAnnualRate({ index_type: sim.index_type, cdi_percent: num(sim.cdi_percent) || 100, annual_rate: num(sim.annual_rate) }, rates) * 100;
  const simChart = useMemo(() => { const step = Math.max(1, Math.floor(simResult.series.length / 60)); return simResult.series.filter((_, i) => i % step === 0 || i === simResult.series.length - 1); }, [simResult]);

  // handlers
  const openNew = () => { setForm({ ...emptyForm }); setShowNew(true); };
  const onTypeChange = (type: string) => {
    const info = INVESTMENT_TYPES.find(t => t.value === type);
    setForm(p => ({ ...p, type, index_type: info?.defaultIndex ?? p.index_type, icon: p.icon && p.icon !== INVESTMENT_TYPES.find(t => t.value === p.type)?.icon ? p.icon : (info?.icon ?? p.icon) }));
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return toast.error('Dê um nome à caixinha');
    const current = num(form.current_value);
    const accrued = Math.min(num(form.accrued), current); // how much already yielded
    try {
      await addInvestment.mutateAsync({
        name: form.name.trim(), type: form.type, index_type: form.index_type, institution: form.institution,
        current_value: current, total_invested: Math.max(0, current - accrued), value_date: todayStr(),
        cdi_percent: form.index_type === 'cdi' ? (num(form.cdi_percent) || 100) : 100,
        annual_rate: (form.index_type === 'prefixado' || form.index_type === 'ipca') ? num(form.annual_rate) : 0,
        goal_amount: num(form.goal_amount), liquidity: form.liquidity,
        icon: form.icon || INVESTMENT_TYPES.find(t => t.value === form.type)?.icon || '📦',
        color: form.color, photo_url: form.photo_url || null,
      });
      toast.success('Caixinha criada! 🎉');
      setShowNew(false);
    } catch (e) { toast.error((e as Error).message); }
  };

  const openEdit = (inv: PortfolioInvestment) => {
    setForm({
      name: inv.name, type: inv.type || 'caixinha', index_type: (inv.index_type as IndexType) || 'cdi',
      institution: inv.institution || '', current_value: '', accrued: '', cdi_percent: String(inv.cdi_percent ?? 100),
      annual_rate: String(inv.annual_rate ?? ''), goal_amount: inv.goal_amount ? String(inv.goal_amount) : '',
      liquidity: inv.liquidity || 'diaria', color: inv.color || COVER_COLORS[0], icon: inv.icon || '📦', photo_url: inv.photo_url || '',
    });
    setRebalance('');
    setEditing(inv);
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    try {
      const patch: Record<string, unknown> = {
        name: form.name || editing.name, type: form.type, index_type: form.index_type, institution: form.institution,
        cdi_percent: form.index_type === 'cdi' ? (num(form.cdi_percent) || 100) : 100,
        annual_rate: (form.index_type === 'prefixado' || form.index_type === 'ipca') ? num(form.annual_rate) : Number(editing.annual_rate) || 0,
        goal_amount: num(form.goal_amount), liquidity: form.liquidity, color: form.color, icon: form.icon || '📦', photo_url: form.photo_url || null,
      };
      const reb = num(rebalance);
      if (rebalance.trim() !== '' && reb >= 0) { patch.current_value = reb; patch.value_date = todayStr(); }
      await updateInvestment.mutateAsync({ id: editing.id, ...patch });
      toast.success('Caixinha atualizada!');
      setEditing(null);
    } catch (e) { toast.error((e as Error).message); }
  };

  const requestDelete = (inv: PortfolioInvestment) => {
    setDetailId(null);
    setDeleteTarget(inv);
  };
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteInvestment.mutateAsync(deleteTarget.id);
      toast.success(`"${deleteTarget.name}" excluída`);
      setDeleteTarget(null);
    } catch (e) { toast.error((e as Error).message); }
  };

  const openMovement = (investmentId: string, type: MoveType) => {
    if (!investmentId) return toast.error('Crie uma caixinha primeiro');
    const firstAccount = accounts.find(a => !a.archived);
    setMoveForm({ amount: '', accountId: firstAccount?.id ?? '', date: todayStr(), description: '' });
    setDetailId(null);
    setMovement({ investmentId, type });
  };

  const handleMovement = async () => {
    if (!movement) return;
    const cfg = MOVE_TYPES.find(t => t.value === movement.type)!;
    const amount = num(moveForm.amount);
    if (!amount || amount <= 0) return toast.error('Informe um valor válido');
    if (cfg.needsAccount && !moveForm.accountId) return toast.error(`Selecione a ${cfg.accountLabel.toLowerCase()}`);
    const inv = investments.find(i => i.id === movement.investmentId);
    const reduces = movement.type === 'resgate' || movement.type === 'taxa' || movement.type === 'ir';
    if (reduces && inv && amount > inv.value + 0.005) return toast.error(`Valor maior que o saldo da caixinha (${formatCurrency(inv.value)})`);
    try {
      await addTransaction.mutateAsync({ investment_id: movement.investmentId, type: movement.type, amount, date: moveForm.date || todayStr(), account_id: cfg.needsAccount ? (moveForm.accountId || null) : null, description: moveForm.description.trim() || cfg.label });
      toast.success(`${cfg.label} de ${formatCurrency(amount)}${inv ? ` em ${inv.name}` : ''} registrado!`);
      setMovement(null);
    } catch (e) { toast.error((e as Error).message); }
  };

  const openRates = () => { setRateForm({ selic: (rates.selicAnnual * 100).toFixed(2), cdi: (rates.cdiAnnual * 100).toFixed(2), ipca: (rates.ipcaAnnual * 100).toFixed(2) }); setShowRates(true); };
  const handleSaveRates = () => {
    setRates({ selicAnnual: num(rateForm.selic) / 100, cdiAnnual: num(rateForm.cdi) / 100, ipcaAnnual: num(rateForm.ipca) / 100 });
    toast.success('Taxas atualizadas!');
    setShowRates(false);
  };

  const formIsAuto = isAutoCalc(form.index_type);

  // ── render ──
  return (
    <div className="space-y-5 animate-fade-in pb-10">

      {/* ─── Hero ──────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-[1.75rem] border border-border/60 bg-gradient-to-br from-card via-card to-primary/[0.07] p-5 shadow-md sm:p-6">
        <div className="pointer-events-none absolute -top-24 -right-20 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/4 h-44 w-56 rounded-full bg-income/[0.08] blur-3xl" />
        <div className="relative z-10 flex flex-col gap-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/30 to-primary/5 shadow-inner sm:h-14 sm:w-14">
                <PiggyBank className="h-6 w-6 text-primary sm:h-7 sm:w-7" />
              </div>
              <div className="min-w-0">
                <h1 className="flex items-center gap-2 text-2xl font-extrabold leading-none tracking-tight">Investimentos <Sparkles className="hidden h-4 w-4 shrink-0 text-primary opacity-70 min-[380px]:inline" /></h1>
                <p className="mt-1.5 truncate text-xs text-muted-foreground sm:text-sm">{portfolio.count} {portfolio.count === 1 ? 'caixinha' : 'caixinhas'} · rendendo de verdade</p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2 max-sm:w-full">
              <Button variant="outline" onClick={() => setShowSim(true)} className="gap-2 max-sm:flex-1"><Calculator className="h-4 w-4" /> Simular</Button>
              <Button onClick={openNew} className="gap-2 bg-primary text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90 max-sm:flex-1"><Plus className="h-4 w-4" /> Nova caixinha</Button>
            </div>
          </div>

          {/* Big bruto headline + 3 distinct stat tiles (no duplicated numbers) */}
          <div className="space-y-2.5">
            <div className="rounded-2xl border border-border/50 bg-background/50 p-4 backdrop-blur-sm">
              <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><Coins className="h-3 w-3" /> Total bruto</p>
              <p className="mt-1 currency text-3xl font-black leading-none text-foreground sm:text-4xl">{maskCurrency(formatCurrency(portfolio.totalValue))}</p>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                aportado {maskCurrency(formatCurrency(portfolio.totalInvested))}
                {portfolio.totalInvested > 0 && (
                  <span className={cn('ml-1.5 font-semibold', portfolio.totalYield >= 0 ? 'text-income' : 'text-expense')}>
                    · rendeu {portfolio.totalYield >= 0 ? '+' : ''}{maskCurrency(formatCurrency(portfolio.totalYield))}{isVisible ? ` (${portfolio.totalYieldPct >= 0 ? '+' : ''}${portfolio.totalYieldPct.toFixed(2)}%)` : ''} no total
                  </span>
                )}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-3 min-[420px]:gap-2.5">
              <div className="flex items-center justify-between gap-2 rounded-2xl border border-border/50 bg-background/50 p-3 backdrop-blur-sm min-[420px]:block">
                <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><ShieldCheck className="h-3 w-3" /> Líquido</p>
                <div className="text-right min-[420px]:mt-1 min-[420px]:text-left">
                  <p className="currency whitespace-nowrap text-base font-bold leading-none sm:text-xl">{maskCurrency(formatCurrency(portfolio.totalNet))}</p>
                  <p className="mt-1 hidden text-[10px] text-muted-foreground min-[420px]:block">resgatando hoje</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-2xl border border-income/20 bg-income/[0.06] p-3 backdrop-blur-sm min-[420px]:block">
                <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><CalendarClock className="h-3 w-3" /> Rendeu 12m</p>
                <div className="text-right min-[420px]:mt-1 min-[420px]:text-left">
                  <p className="currency whitespace-nowrap text-base font-bold leading-none text-income sm:text-xl">+{maskCurrency(formatCurrency(portfolio.totalYield12m))}</p>
                  <p className="mt-1 hidden text-[10px] text-muted-foreground min-[420px]:block">últimos 12 meses</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-2xl border border-income/20 bg-income/[0.06] p-3 backdrop-blur-sm min-[420px]:block">
                <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><Flame className="h-3 w-3" /> Rende/dia</p>
                <div className="text-right min-[420px]:mt-1 min-[420px]:text-left">
                  <p className="currency whitespace-nowrap text-base font-bold leading-none text-income sm:text-xl">≈ {maskCurrency(formatCurrency(portfolio.perDayYield))}</p>
                  <p className="mt-1 hidden text-[10px] text-muted-foreground min-[420px]:block">no ritmo atual</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={openRates} className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm transition-colors hover:bg-background"><Settings2 className="h-3 w-3 text-primary" /><span className="text-muted-foreground">CDI:</span><span className="text-foreground">{(rates.cdiAnnual * 100).toFixed(2)}% a.a.</span></button>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm"><span className="text-muted-foreground">Selic:</span><span className="text-foreground">{(rates.selicAnnual * 100).toFixed(2)}%</span></span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm"><span className="text-muted-foreground">IPCA:</span><span className="text-foreground">{(rates.ipcaAnnual * 100).toFixed(2)}%</span></span>
          </div>
        </div>
      </div>

      {/* ─── Cotações ao vivo ──────────────────────────────────────────────── */}
      <MarketQuotes />

      {/* ─── Allocation ────────────────────────────────────────────────────── */}
      {showDonut && (
        <div className="rounded-[1.5rem] border border-border/60 bg-card p-5 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold"><span className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/10"><BarChart3 className="h-3 w-3 text-primary" /></span> Alocação do portfólio</h3>
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <div className="relative shrink-0" style={{ width: 196, height: 196 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={64} outerRadius={92} paddingAngle={2} dataKey="value" strokeWidth={0} cornerRadius={8}>
                    {pieData.map(e => <Cell key={e.id} fill={e.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Total</p>
                <p className="mt-0.5 currency text-sm font-bold leading-tight">{maskCurrency(formatCurrency(portfolio.totalValue))}</p>
              </div>
            </div>
            <div className="w-full flex-1 space-y-2.5">
              {pieData.map(item => (
                <button key={item.id} onClick={() => setDetailId(item.id)} className="w-full space-y-1 text-left transition-opacity hover:opacity-80">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex min-w-0 items-center gap-2"><span className="text-sm">{item.icon}</span><span className="truncate font-medium">{item.name}</span></span>
                    <span className="ml-2 flex shrink-0 items-center gap-3"><span className="text-muted-foreground">{isVisible ? `${item.pct.toFixed(1)}%` : maskText('00%')}</span><span className="font-semibold tabular-nums">{maskCurrency(formatCurrency(item.value))}</span></span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${item.pct}%`, backgroundColor: item.color }} /></div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Caixinha cards ────────────────────────────────────────────────── */}
      {investments.length === 0 ? (
        <div className="rounded-[1.5rem] border border-border/60 bg-card py-16 text-center shadow-sm">
          <PiggyBank className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
          <p className="font-medium text-muted-foreground">Nenhuma caixinha ainda</p>
          <p className="mt-1 text-sm text-muted-foreground">Crie a primeira, lance quanto você tem hoje, e ela rende sozinha.</p>
          <Button onClick={openNew} className="mt-4"><Plus className="mr-1 h-4 w-4" /> Criar caixinha</Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {investments.map((inv, idx) => {
            const color = inv.color || COVER_COLORS[0];
            const prog = goalProgress(inv.value, inv.goal_amount);
            const oneYear = inv.isAuto && inv.value > 0 ? projectInvestment(inv.value, inv.annualRate, inv.type, inv.index_type)[3] : null;
            return (
              <div
                key={inv.id}
                onClick={() => setDetailId(inv.id)}
                style={{ animationDelay: `${idx * 40}ms` }}
                className="group flex cursor-pointer flex-col overflow-hidden rounded-[1.5rem] border border-border/60 bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl animate-fade-in"
              >
                {/* Cover */}
                <div className="relative h-28 overflow-hidden" style={inv.photo_url ? undefined : { background: coverGradient(color) }}>
                  {inv.photo_url && <img src={inv.photo_url} alt={inv.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" />
                  <span className="absolute left-3 top-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/25 text-2xl shadow-sm backdrop-blur-md">{inv.icon}</span>
                  <span className="absolute right-3 top-3 rounded-full bg-black/30 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur-md">{rateLabel(inv)}</span>
                  <div className="absolute bottom-2.5 left-3 right-3 flex items-end justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-white drop-shadow">{inv.name}</p>
                      <p className="truncate text-[10px] text-white/80">{inv.institution || INVESTMENT_TYPES.find(t => t.value === inv.type)?.label}</p>
                    </div>
                    <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button onClick={e => { e.stopPropagation(); openEdit(inv); }} className="rounded-lg bg-white/25 p-1.5 text-white backdrop-blur-md hover:bg-white/40" title="Editar"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={e => { e.stopPropagation(); requestDelete(inv); }} className="rounded-lg bg-white/25 p-1.5 text-white backdrop-blur-md hover:bg-expense" title="Excluir"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Saldo atual</p>
                      <p className="currency text-2xl font-extrabold leading-none">{maskCurrency(formatCurrency(inv.value))}</p>
                      <span className={cn('mt-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-bold', inv.yieldAbs >= 0 ? 'bg-income/10 text-income' : 'bg-expense/10 text-expense')}>
                        {inv.yieldAbs >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {inv.yieldAbs >= 0 ? '+' : ''}{maskCurrency(formatCurrency(inv.yieldAbs))}
                        {isVisible && inv.invested > 0 && <span className="opacity-80"> ({inv.yieldPct >= 0 ? '+' : ''}{inv.yieldPct.toFixed(1)}%)</span>}
                      </span>
                    </div>
                    {prog !== null && (
                      <Ring value={prog} color={color}>
                        <span className="text-[10px] font-bold">{isVisible ? `${Math.round(prog * 100)}%` : '••'}</span>
                      </Ring>
                    )}
                  </div>

                  {inv.isAuto && (
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                      <div className="rounded-lg bg-muted/40 px-2 py-1.5"><p className="text-muted-foreground">Líquido hoje</p><p className="currency font-bold">{maskCurrency(formatCurrency(inv.netValue))}</p></div>
                      <div className="rounded-lg bg-muted/40 px-2 py-1.5"><p className="text-muted-foreground">Rende/dia</p><p className="currency font-bold text-income">≈ {maskCurrency(formatCurrency(inv.perDayYield))}</p></div>
                    </div>
                  )}

                  {prog !== null && (
                    <div className="mt-3">
                      <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1"><Target className="h-3 w-3" /> Meta {maskCurrency(formatCurrency(Number(inv.goal_amount)))}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${prog * 100}%`, background: coverGradient(color) }} /></div>
                    </div>
                  )}

                  {oneYear && (
                    <div className="mt-3 flex items-center justify-between rounded-xl border border-primary/15 bg-primary/[0.04] px-3 py-2">
                      <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground"><TrendingUp className="h-3 w-3 text-primary" /> Em 1 ano</span>
                      <span className="text-xs font-bold">{maskCurrency(formatCurrency(oneYear.gross))} <span className="text-[11px] text-income">+{maskCurrency(formatCurrency(oneYear.gain))}</span></span>
                    </div>
                  )}

                  <div className="mt-3 flex items-center gap-2 border-t border-border/40 pt-3">
                    <button onClick={e => { e.stopPropagation(); openMovement(inv.id, 'aporte'); }} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-expense/8 py-1.5 text-[11px] font-semibold text-expense transition-colors hover:bg-expense/15"><ArrowUpRight className="h-3 w-3" /> Aportar</button>
                    <button onClick={e => { e.stopPropagation(); openMovement(inv.id, 'resgate'); }} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-income/8 py-1.5 text-[11px] font-semibold text-income transition-colors hover:bg-income/15"><ArrowDownRight className="h-3 w-3" /> Resgatar</button>
                    <span className="flex items-center gap-0.5 text-[11px] font-semibold text-muted-foreground transition-colors group-hover:text-primary">Abrir <ChevronRight className="h-3.5 w-3.5" /></span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Simulador (atalho) + Educação ─────────────────────────────────── */}
      <button
        onClick={() => setShowSim(true)}
        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 to-info/[0.06] p-4 text-left transition-all hover:border-primary/40"
      >
        <span className="flex items-center gap-3 min-w-0">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15"><Calculator className="h-5 w-5 text-primary" /></span>
          <span className="min-w-0">
            <span className="block text-sm font-bold">Simular um investimento</span>
            <span className="block text-xs text-muted-foreground">Quanto rende seu dinheiro com juros compostos?</span>
          </span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-primary" />
      </button>

      <InvestmentExplorer />

      {/* ─── Caixinha DETAIL dialog ────────────────────────────────────────── */}
      <Dialog open={!!detail} onOpenChange={o => !o && setDetailId(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto p-0 sm:max-w-xl">
          {detail && (() => {
            const color = detail.color || COVER_COLORS[0];
            const prog = goalProgress(detail.value, detail.goal_amount);
            const proj = detail.isAuto && detail.value > 0 ? projectInvestment(detail.value, detail.annualRate, detail.type, detail.index_type) : [];
            const series = proj.length ? simulate({ initial: detail.value, monthly: 0, months: 60, annualRate: detail.annualRate, type: detail.type, indexType: detail.index_type }, rates).series.filter((_, i) => i % 3 === 0 || i === 60) : [];
            const eta = detail.goal_amount && detail.value < Number(detail.goal_amount) ? monthsToGoal(detail.value, Number(detail.goal_amount), detail.annualRate) : null;
            const txns = allTransactions.filter(t => t.investment_id === detail.id);
            const auto = detail.isAuto;
            return (
              <>
                {/* Cover header */}
                <div className="relative h-32 overflow-hidden rounded-t-lg" style={detail.photo_url ? undefined : { background: coverGradient(color) }}>
                  {detail.photo_url && <img src={detail.photo_url} alt={detail.name} className="h-full w-full object-cover" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/65 to-black/10" />
                  <span className="absolute left-4 top-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/25 text-3xl shadow-sm backdrop-blur-md">{detail.icon}</span>
                  <span className="absolute right-4 top-4 rounded-full bg-black/30 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-md">{rateLabel(detail)}</span>
                  <div className="absolute bottom-3 left-4 right-4">
                    <p className="text-lg font-extrabold text-white drop-shadow">{detail.name}</p>
                    <p className="text-xs text-white/85">{detail.institution || INVESTMENT_TYPES.find(t => t.value === detail.type)?.label} · {LIQUIDITY_OPTIONS.find(o => o.value === detail.liquidity)?.label}</p>
                  </div>
                </div>

                <div className="space-y-4 p-4 sm:p-5">
                  {/* Big value + metrics */}
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Saldo atual (bruto)</p>
                    <p className="currency text-3xl font-black leading-none">{maskCurrency(formatCurrency(detail.value))}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    <div className="rounded-xl border border-border/50 bg-muted/20 p-2.5"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Líquido</p><p className="currency text-sm font-bold">{maskCurrency(formatCurrency(detail.netValue))}</p></div>
                    <div className="rounded-xl border border-border/50 bg-muted/20 p-2.5"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Aportado</p><p className="currency text-sm font-bold">{maskCurrency(formatCurrency(detail.invested))}</p></div>
                    <div className="rounded-xl border border-income/20 bg-income/[0.06] p-2.5"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Rendeu 12m</p><p className="currency text-sm font-bold text-income">+{maskCurrency(formatCurrency(detail.yield12m))}</p></div>
                    {detail.isAuto
                      ? <div className="rounded-xl border border-income/20 bg-income/[0.06] p-2.5"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Rende/dia</p><p className="currency text-sm font-bold text-income">≈ {maskCurrency(formatCurrency(detail.perDayYield))}</p></div>
                      : <div className="rounded-xl border border-income/20 bg-income/[0.06] p-2.5"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Rendimento</p><p className="currency text-sm font-bold text-income">{detail.yieldAbs >= 0 ? '+' : ''}{maskCurrency(formatCurrency(detail.yieldAbs))}</p></div>}
                  </div>

                  {/* Goal */}
                  {prog !== null && (
                    <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1 text-muted-foreground"><Target className="h-3.5 w-3.5" /> Meta: {maskCurrency(formatCurrency(Number(detail.goal_amount)))}</span>
                        <span className="font-bold">{isVisible ? `${Math.round(prog * 100)}%` : maskText('00%')}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${prog * 100}%`, background: coverGradient(color) }} /></div>
                      {eta != null && eta > 0 && isVisible && <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground"><CalendarClock className="h-3 w-3" /> ~{eta} {eta === 1 ? 'mês' : 'meses'} pra meta no ritmo atual</p>}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => openMovement(detail.id, 'aporte')} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-expense/10 py-2 text-xs font-semibold text-expense transition-colors hover:bg-expense/20"><ArrowUpRight className="h-3.5 w-3.5" /> Aportar</button>
                    <button onClick={() => openMovement(detail.id, 'resgate')} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-income/10 py-2 text-xs font-semibold text-income transition-colors hover:bg-income/20"><ArrowDownRight className="h-3.5 w-3.5" /> Resgatar</button>
                    {!auto && <button onClick={() => openMovement(detail.id, 'rendimento')} className="flex items-center justify-center gap-1.5 rounded-xl bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"><TrendingUp className="h-3.5 w-3.5" /> Rendimento</button>}
                    <button onClick={() => { setDetailId(null); openEdit(detail); }} className="flex items-center justify-center gap-1.5 rounded-xl bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/70"><Pencil className="h-3.5 w-3.5" /> Editar</button>
                    <button onClick={() => requestDelete(detail)} className="flex items-center justify-center gap-1.5 rounded-xl bg-expense/10 px-3 py-2 text-xs font-semibold text-expense transition-colors hover:bg-expense/20"><Trash2 className="h-3.5 w-3.5" /> Excluir</button>
                  </div>

                  {/* Projection */}
                  {proj.length > 0 && (
                    <div className="rounded-xl border border-primary/15 bg-primary/[0.04] p-3">
                      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground"><TrendingUp className="h-3.5 w-3.5 text-primary" /> Vai render (saldo de hoje · {(detail.annualRate * 100).toFixed(1)}% a.a.)</p>
                      {series.length > 1 && (
                        <div style={{ width: '100%', height: 140 }}>
                          <ResponsiveContainer>
                            <AreaChart data={series} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                              <defs><linearGradient id="dpg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.4} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient></defs>
                              <XAxis dataKey="month" tickFormatter={m => `${Math.round(m / 12)}a`} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" interval="preserveStartEnd" />
                              <YAxis hide domain={[detail.value, 'dataMax']} />
                              <RTooltip formatter={(v: number) => [formatCurrency(v), 'Saldo']} labelFormatter={m => `Mês ${m}`} contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 10, fontSize: 11 }} />
                              <Area type="monotone" dataKey="gross" stroke={color} fill="url(#dpg)" strokeWidth={2.5} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                      <div className="mt-2 space-y-1.5">
                        {proj.map((p, i) => (
                          <div key={p.label} className="flex items-center justify-between rounded-lg bg-card/60 px-3 py-1.5 text-xs">
                            <span className="w-16 shrink-0 font-medium text-muted-foreground">{PROJ_LABELS[i]}</span>
                            <div className="text-right"><p className="font-bold">{maskCurrency(formatCurrency(p.gross))}</p><p className="text-[10px] text-income">+{maskCurrency(formatCurrency(p.gain))} bruto · líq. +{maskCurrency(formatCurrency(p.net - detail.value))}</p></div>
                          </div>
                        ))}
                      </div>
                      <p className="mt-1.5 px-1 text-[10px] leading-relaxed text-muted-foreground">Estimativa com a taxa atual sobre o saldo de hoje; "líq." desconta IR/IOF pelo prazo. Não considera novos aportes nem mudança do CDI.</p>
                    </div>
                  )}

                  {/* History */}
                  {txns.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Movimentações</p>
                      <div className="space-y-1.5">
                        {txns.slice(0, 30).map(t => {
                          const positive = t.type === 'aporte' || t.type === 'rendimento';
                          const label: Record<string, string> = { aporte: 'Aporte', resgate: 'Resgate', rendimento: 'Rendimento', taxa: 'Taxa', ir: 'IR' };
                          return (
                            <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg bg-muted/20 px-3 py-2">
                              <div className="flex min-w-0 items-center gap-2.5">
                                <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px]', t.type === 'aporte' ? 'bg-expense/10 text-expense' : t.type === 'resgate' || t.type === 'rendimento' ? 'bg-income/10 text-income' : 'bg-warning/10 text-warning')}>{t.type === 'aporte' ? '↑' : t.type === 'resgate' ? '↓' : t.type === 'rendimento' ? '📈' : '💸'}</span>
                                <div className="min-w-0"><p className="truncate text-sm font-medium">{t.description || label[t.type] || t.type}</p><p className="text-xs text-muted-foreground">{formatDate(t.date)}</p></div>
                              </div>
                              <span className={cn('shrink-0 text-sm font-semibold tabular-nums', positive ? 'text-income' : 'text-expense')}>{positive ? '+' : '−'}{maskCurrency(formatCurrency(Number(t.amount)))}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ─── New / Edit dialog ─────────────────────────────────────────────── */}
      <Dialog open={showNew || !!editing} onOpenChange={o => { if (!o) { setShowNew(false); setEditing(null); } }}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Editar caixinha' : 'Nova caixinha'}</DialogTitle></DialogHeader>

          <div className="overflow-hidden rounded-2xl border border-border/40 shadow-sm">
            <div className="relative h-28" style={form.photo_url ? undefined : { background: coverGradient(form.color) }}>
              {form.photo_url && <img src={form.photo_url} alt="" className="h-full w-full object-cover" onError={e => (e.currentTarget.style.display = 'none')} />}
              {form.photo_url && <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />}
              <span className="absolute left-3 top-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/25 text-2xl backdrop-blur-md">{form.icon || '📦'}</span>
              <span className="absolute right-3 top-3 rounded-full bg-black/30 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur-md">{rateLabel({ index_type: form.index_type, cdi_percent: Number(form.cdi_percent), annual_rate: Number(form.annual_rate) })}</span>
              <p className="absolute bottom-2 left-3 right-3 truncate text-sm font-bold text-white drop-shadow">{form.name || 'Nome da caixinha'}</p>
            </div>
            <div className="flex items-center justify-between bg-card px-4 py-2.5">
              <span className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">{form.institution || INVESTMENT_TYPES.find(t => t.value === form.type)?.label}</span>
              <span className="currency text-lg font-extrabold">{formatCurrency(editing ? editing.value : num(form.current_value))}</span>
            </div>
          </div>

          <div className="space-y-3.5">
            <section className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-3.5">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground"><Tag className="h-3 w-3" /> Identidade</p>
              <div><Label className="text-xs text-muted-foreground">Nome *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Caixinha Turbo, Nossa Casa..." /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs text-muted-foreground">Tipo</Label><Select value={form.type} onValueChange={onTypeChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{INVESTMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>)}</SelectContent></Select></div>
                <div><Label className="text-xs text-muted-foreground">Instituição</Label><Input value={form.institution} onChange={e => setForm(p => ({ ...p, institution: e.target.value }))} placeholder="Nubank, XP..." /></div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Emoji</Label>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {EMOJIS.map(e => <button key={e} type="button" onClick={() => setForm(p => ({ ...p, icon: e }))} className={cn('flex h-8 w-8 items-center justify-center rounded-lg border text-lg transition-all', form.icon === e ? 'scale-110 border-primary bg-primary/10' : 'border-border/60 hover:bg-muted')}>{e}</button>)}
                  <Input value={form.icon} onChange={e => setForm(p => ({ ...p, icon: e.target.value }))} maxLength={4} className="h-8 w-12 text-center" placeholder="✏️" />
                </div>
              </div>
              <div>
                <Label className="flex items-center gap-1 text-xs text-muted-foreground"><Palette className="h-3 w-3" /> Cor da capa</Label>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {COVER_COLORS.map(c => <button key={c} type="button" onClick={() => setForm(p => ({ ...p, color: c }))} className={cn('h-7 w-7 rounded-full transition-all', form.color === c ? 'scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-card' : 'hover:scale-105')} style={{ backgroundColor: c }} />)}
                  <Input type="color" value={form.color} onChange={e => setForm(p => ({ ...p, color: e.target.value }))} className="h-7 w-8 cursor-pointer rounded p-0.5" />
                </div>
              </div>
              <div><Label className="flex items-center gap-1.5 text-xs text-muted-foreground"><ImageIcon className="h-3.5 w-3.5" /> Foto de capa (URL opcional)</Label><Input value={form.photo_url} onChange={e => setForm(p => ({ ...p, photo_url: e.target.value }))} placeholder="https://..." /></div>
            </section>

            <section className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-3.5">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground"><Percent className="h-3 w-3" /> Como rende</p>
              <div className="flex flex-wrap gap-1.5">{INDEX_TYPES.map(t => <button key={t.value} type="button" onClick={() => setForm(p => ({ ...p, index_type: t.value }))} className={cn('rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all', form.index_type === t.value ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 text-muted-foreground hover:bg-muted')}>{t.label}</button>)}</div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">{INDEX_TYPES.find(t => t.value === form.index_type)?.help}</p>
              {form.index_type === 'cdi' && (
                <div>
                  <Label className="text-xs text-muted-foreground">% do CDI</Label>
                  <div className="flex items-center gap-2"><Input type="number" step="1" value={form.cdi_percent} onChange={e => setForm(p => ({ ...p, cdi_percent: e.target.value }))} placeholder="100" className="flex-1" />{['100', '115', '120'].map(v => <button key={v} type="button" onClick={() => setForm(p => ({ ...p, cdi_percent: v }))} className={cn('rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors', form.cdi_percent === v ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 text-muted-foreground hover:bg-muted')}>{v}%</button>)}</div>
                  <p className="mt-1 text-[11px] text-muted-foreground">Normal = 100% · Turbo = 115% · Turbo premium = 120%.</p>
                </div>
              )}
              {form.index_type === 'prefixado' && (<div><Label className="text-xs text-muted-foreground">Taxa (% ao ano)</Label><Input type="number" step="0.1" value={form.annual_rate} onChange={e => setForm(p => ({ ...p, annual_rate: e.target.value }))} placeholder="Ex: 12.5" /></div>)}
              {form.index_type === 'ipca' && (<div><Label className="text-xs text-muted-foreground">IPCA + (% ao ano)</Label><Input type="number" step="0.1" value={form.annual_rate} onChange={e => setForm(p => ({ ...p, annual_rate: e.target.value }))} placeholder="Ex: 6.5" /></div>)}
            </section>

            <section className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-3.5">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground"><Coins className="h-3 w-3" /> Valores</p>
              {!editing ? (
                <>
                  <div>
                    <Label className="text-xs text-muted-foreground">Quanto você tem hoje (R$)</Label>
                    <Input type="number" step="0.01" value={form.current_value} onChange={e => setForm(p => ({ ...p, current_value: e.target.value }))} placeholder="0,00" />
                    <p className="mt-1 text-[11px] text-muted-foreground">{formIsAuto ? 'A partir daqui a caixinha rende sozinha.' : 'Você atualiza o valor manualmente quando quiser.'}</p>
                  </div>
                  <div>
                    <Label className="flex items-center gap-1 text-xs text-muted-foreground"><TrendingUp className="h-3 w-3" /> Quanto já rendeu (opcional)</Label>
                    <Input type="number" step="0.01" value={form.accrued} onChange={e => setForm(p => ({ ...p, accrued: e.target.value }))} placeholder="0,00" />
                    <p className="mt-1 text-[11px] text-muted-foreground">Coloque o rendimento que o banco já mostra (ex.: últimos 12 meses). Já aparece como rendimento, e daqui pra frente calculamos o real.</p>
                  </div>
                </>
              ) : (
                <div>
                  <Label className="text-xs text-muted-foreground">Corrigir saldo atual (opcional)</Label>
                  <Input type="number" step="0.01" value={rebalance} onChange={e => setRebalance(e.target.value)} placeholder={formatCurrency(editing.value)} />
                  <p className="mt-1 text-[11px] text-muted-foreground">Valor atual: <strong>{formatCurrency(editing.value)}</strong>. Preencha só pra ajustar ao valor real de hoje — recomeça o rendimento a partir dele.</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="flex items-center gap-1 text-xs text-muted-foreground"><Target className="h-3 w-3" /> Meta (opcional)</Label><Input type="number" step="0.01" value={form.goal_amount} onChange={e => setForm(p => ({ ...p, goal_amount: e.target.value }))} placeholder="Ex: 10000" /></div>
                <div><Label className="text-xs text-muted-foreground">Liquidez</Label><Select value={form.liquidity} onValueChange={v => setForm(p => ({ ...p, liquidity: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{LIQUIDITY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div>
              </div>
            </section>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowNew(false); setEditing(null); }}>Cancelar</Button>
            <Button onClick={editing ? handleSaveEdit : handleCreate} disabled={addInvestment.isPending || updateInvestment.isPending}>{editing ? 'Salvar' : 'Criar caixinha'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Movement dialog ───────────────────────────────────────────────── */}
      <Dialog open={!!movement} onOpenChange={o => !o && setMovement(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto">
          {movement && (() => {
            const inv = investments.find(i => i.id === movement.investmentId);
            const auto = inv ? inv.isAuto : true;
            const types = MOVE_TYPES.filter(t => auto ? (t.value === 'aporte' || t.value === 'resgate') : true);
            const cfg = MOVE_TYPES.find(t => t.value === movement.type)!;
            const Icon = MOVE_ICONS[movement.type];
            const tone = cfg.tone === 'expense' ? 'text-expense' : cfg.tone === 'income' ? 'text-income' : 'text-warning';
            return (
              <>
                <DialogHeader><DialogTitle className="flex items-center gap-2"><Icon className={cn('h-5 w-5', tone)} /> {cfg.verb}{inv ? ` · ${inv.name}` : ''}</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Tipo de movimentação</Label>
                    <div className={cn('mt-1.5 grid gap-1.5', types.length <= 2 ? 'grid-cols-2' : 'grid-cols-5')}>
                      {types.map(t => { const TIcon = MOVE_ICONS[t.value]; const active = movement.type === t.value; return <button key={t.value} type="button" onClick={() => setMovement(m => m ? { ...m, type: t.value } : m)} className={cn('flex flex-col items-center gap-1 rounded-lg border py-2 text-[10px] font-semibold transition-all', active ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 text-muted-foreground hover:bg-muted')}><TIcon className="h-3.5 w-3.5" />{t.label}</button>; })}
                    </div>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{cfg.help}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Caixinha</Label>
                    <Select value={movement.investmentId} onValueChange={v => setMovement(m => { if (!m) return m; const next = investments.find(i => i.id === v); const nextAuto = next ? next.isAuto : true; const typeOk = nextAuto ? (m.type === 'aporte' || m.type === 'resgate') : true; return { ...m, investmentId: v, type: typeOk ? m.type : 'aporte' }; })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{investments.map(i => <SelectItem key={i.id} value={i.id}>{i.icon} {i.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs text-muted-foreground">Valor (R$)</Label><Input type="number" inputMode="decimal" step="0.01" min={0} value={moveForm.amount} onChange={e => setMoveForm(p => ({ ...p, amount: e.target.value }))} placeholder="0,00" autoFocus /></div>
                  {cfg.needsAccount && (<div><Label className="text-xs text-muted-foreground">{cfg.accountLabel}</Label><Select value={moveForm.accountId} onValueChange={v => setMoveForm(p => ({ ...p, accountId: v }))}><SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger><SelectContent>{accounts.filter(a => !a.archived).map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select></div>)}
                  <div><Label className="text-xs text-muted-foreground">Data</Label><Input type="date" value={moveForm.date} onChange={e => setMoveForm(p => ({ ...p, date: e.target.value }))} /></div>
                  <div><Label className="text-xs text-muted-foreground">Descrição (opcional)</Label><Input value={moveForm.description} onChange={e => setMoveForm(p => ({ ...p, description: e.target.value }))} placeholder={cfg.label} /></div>
                </div>
                <DialogFooter><Button variant="outline" onClick={() => setMovement(null)}>Cancelar</Button><Button onClick={handleMovement} disabled={addTransaction.isPending}>{addTransaction.isPending ? 'Salvando...' : cfg.verb}</Button></DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ─── Rates dialog ──────────────────────────────────────────────────── */}
      <Dialog open={showRates} onOpenChange={setShowRates}>
        <DialogContent>
          <DialogHeader><DialogTitle>Taxas de referência</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs leading-relaxed text-muted-foreground">Essas taxas alimentam o cálculo de rendimento das caixinhas pós-fixadas. Padrão (jun/2026): Selic 14,50% → CDI 14,40%.</p>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs text-muted-foreground">Selic (% a.a.)</Label><Input type="number" step="0.05" value={rateForm.selic} onChange={e => { const s = e.target.value; setRateForm(p => ({ ...p, selic: s, cdi: s === '' ? p.cdi : Math.max(0, num(s) - 0.10).toFixed(2) })); }} /></div>
              <div><Label className="text-xs text-muted-foreground">CDI (% a.a.)</Label><Input type="number" step="0.05" value={rateForm.cdi} onChange={e => setRateForm(p => ({ ...p, cdi: e.target.value }))} /></div>
              <div className="col-span-2"><Label className="text-xs text-muted-foreground">IPCA (% a.a.)</Label><Input type="number" step="0.05" value={rateForm.ipca} onChange={e => setRateForm(p => ({ ...p, ipca: e.target.value }))} /></div>
            </div>
            <p className="text-[11px] text-muted-foreground">Dica: o CDI fica ~0,10 ponto abaixo da Selic (ajusta sozinho ao editar a Selic).</p>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowRates(false)}>Cancelar</Button><Button onClick={handleSaveRates}>Salvar taxas</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Simulator dialog ──────────────────────────────────────────────── */}
      <Dialog open={showSim} onOpenChange={setShowSim}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Calculator className="h-5 w-5 text-primary" /> Simulador de investimento</DialogTitle></DialogHeader>
          <div className="space-y-3.5">
            <section className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs text-muted-foreground">Valor inicial (R$)</Label><Input type="number" step="0.01" value={sim.initial} onChange={e => setSim(p => ({ ...p, initial: e.target.value }))} placeholder="1000" /></div>
                <div><Label className="text-xs text-muted-foreground">Aporte mensal (R$)</Label><Input type="number" step="0.01" value={sim.monthly} onChange={e => setSim(p => ({ ...p, monthly: e.target.value }))} placeholder="300" /></div>
                <div><Label className="text-xs text-muted-foreground">Por quantos anos</Label><Input type="number" step="1" value={sim.years} onChange={e => setSim(p => ({ ...p, years: e.target.value }))} placeholder="5" /></div>
                <div><Label className="text-xs text-muted-foreground">Rende como</Label><Select value={sim.index_type} onValueChange={v => setSim(p => ({ ...p, index_type: v as IndexType }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{INDEX_TYPES.filter(t => t.value !== 'manual').map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
              </div>
              {sim.index_type === 'cdi' && (<div><Label className="text-xs text-muted-foreground">% do CDI</Label><div className="flex items-center gap-2"><Input type="number" step="1" value={sim.cdi_percent} onChange={e => setSim(p => ({ ...p, cdi_percent: e.target.value }))} className="flex-1" />{['100', '115', '120'].map(v => <button key={v} type="button" onClick={() => setSim(p => ({ ...p, cdi_percent: v }))} className={cn('rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors', sim.cdi_percent === v ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 text-muted-foreground hover:bg-muted')}>{v}%</button>)}</div></div>)}
              {sim.index_type === 'prefixado' && (<div><Label className="text-xs text-muted-foreground">Taxa (% ao ano)</Label><Input type="number" step="0.1" value={sim.annual_rate} onChange={e => setSim(p => ({ ...p, annual_rate: e.target.value }))} placeholder="12.5" /></div>)}
              {sim.index_type === 'ipca' && (<div><Label className="text-xs text-muted-foreground">IPCA + (% ao ano)</Label><Input type="number" step="0.1" value={sim.annual_rate} onChange={e => setSim(p => ({ ...p, annual_rate: e.target.value }))} placeholder="6.5" /></div>)}
              <p className="text-[11px] text-muted-foreground">Taxa estimada: <strong>{simAnnualPct.toFixed(2)}% a.a.</strong></p>
            </section>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl border border-border/50 bg-background/50 p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Você terá (bruto)</p><p className="mt-1 currency text-lg font-black leading-tight sm:text-2xl">{formatCurrency(simResult.gross)}</p></div>
              <div className="rounded-2xl border border-income/20 bg-income/[0.06] p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Líquido (após IR)</p><p className="mt-1 currency text-lg font-black leading-tight sm:text-2xl text-income">{formatCurrency(simResult.net)}</p></div>
              <div className="rounded-2xl border border-border/50 bg-background/50 p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total investido</p><p className="mt-1 currency text-base font-bold leading-none">{formatCurrency(simResult.invested)}</p></div>
              <div className="rounded-2xl border border-border/50 bg-background/50 p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Rendimento líquido</p><p className="mt-1 currency text-base font-bold leading-none text-income">+{formatCurrency(simResult.netGain)}</p></div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Evolução</p>
              <div style={{ width: '100%', height: 180 }}>
                <ResponsiveContainer>
                  <AreaChart data={simChart} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                    <defs><linearGradient id="simGross" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} /><stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} /></linearGradient></defs>
                    <XAxis dataKey="month" tickFormatter={m => `${Math.round(m / 12)}a`} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" interval="preserveStartEnd" />
                    <YAxis hide domain={[0, 'dataMax']} />
                    <RTooltip formatter={(v: number, n: string) => [formatCurrency(v), n === 'gross' ? 'Investimento' : n === 'invested' ? 'Aportado' : 'Poupança']} labelFormatter={m => `Mês ${m}`} contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }} />
                    <Area type="monotone" dataKey="invested" stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" fill="none" strokeWidth={1.5} />
                    <Area type="monotone" dataKey="savings" stroke="hsl(var(--expense))" fill="none" strokeWidth={1.5} />
                    <Area type="monotone" dataKey="gross" stroke="hsl(var(--primary))" fill="url(#simGross)" strokeWidth={2.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: 'hsl(var(--primary))' }} /> Seu investimento</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: 'hsl(var(--expense))' }} /> Poupança</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-muted-foreground" /> Aportado</span>
              </div>
              {simResult.gross - simResult.savings > 0.5 && <p className="mt-2 text-[11px] text-muted-foreground">Rende <strong className="text-income">{formatCurrency(simResult.gross - simResult.savings)}</strong> a mais que a poupança no mesmo período. 🚀</p>}
            </div>
            <p className="text-[10px] leading-relaxed text-muted-foreground">Estimativa com a taxa atual constante; impostos pelo prazo total. Rentabilidade estimada não garante resultado futuro.</p>
          </div>
          <DialogFooter><Button onClick={() => setShowSim(false)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete confirmation dialog ────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          {deleteTarget && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Trash2 className="h-5 w-5 text-expense" /> Excluir caixinha?</DialogTitle>
              </DialogHeader>
              <div className="overflow-hidden rounded-2xl border border-border/40 shadow-sm">
                <div className="relative flex items-center gap-3 overflow-hidden p-3.5" style={deleteTarget.photo_url ? undefined : { background: coverGradient(deleteTarget.color || COVER_COLORS[0]) }}>
                  {deleteTarget.photo_url && <img src={deleteTarget.photo_url} alt="" className="absolute inset-0 h-full w-full object-cover" />}
                  {deleteTarget.photo_url && <div className="absolute inset-0 bg-black/55" />}
                  <span className="relative z-10 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/25 text-2xl backdrop-blur-md">{deleteTarget.icon}</span>
                  <div className="relative z-10 min-w-0">
                    <p className="truncate text-sm font-bold text-white drop-shadow">{deleteTarget.name}</p>
                    <p className="text-[11px] text-white/90">{maskCurrency(formatCurrency(deleteTarget.value))} · {rateLabel(deleteTarget)}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-xl border border-expense/20 bg-expense/5 p-3 text-xs leading-relaxed text-muted-foreground">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-expense" />
                <span>Isso remove a caixinha e o histórico dela. As despesas/receitas já lançadas na conta <strong>não</strong> são apagadas — seu saldo continua igual. Esta ação não pode ser desfeita.</span>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
                <Button onClick={confirmDelete} disabled={deleteInvestment.isPending} className="bg-expense text-white hover:bg-expense/90">{deleteInvestment.isPending ? 'Excluindo...' : 'Excluir caixinha'}</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
