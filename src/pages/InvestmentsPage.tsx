import { useState, useMemo } from 'react';
import {
  Plus, TrendingUp, TrendingDown, BarChart3, Pencil, ChevronDown, ChevronUp,
  Image as ImageIcon, Trash2, ArrowUpRight, ArrowDownRight, Sparkles, Target,
  Percent, Receipt, Settings2, Flame, PiggyBank, CalendarClock, Calculator,
  Tag, Coins, Palette, ShieldCheck,
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

// ─── Constants ────────────────────────────────────────────────────────────────
const INVESTMENT_TYPES = [
  { value: 'caixinha', label: 'Caixinha',        icon: '📦', defaultIndex: 'cdi' as IndexType },
  { value: 'cdb',      label: 'CDB / RDB',       icon: '🏦', defaultIndex: 'cdi' as IndexType },
  { value: 'lci',      label: 'LCI',             icon: '🏛️', defaultIndex: 'cdi' as IndexType },
  { value: 'lca',      label: 'LCA',             icon: '🌾', defaultIndex: 'cdi' as IndexType },
  { value: 'tesouro',  label: 'Tesouro Direto',  icon: '🏛️', defaultIndex: 'ipca' as IndexType },
  { value: 'poupanca', label: 'Poupança',        icon: '🐷', defaultIndex: 'poupanca' as IndexType },
  { value: 'fundo',    label: 'Fundo',           icon: '📊', defaultIndex: 'manual' as IndexType },
  { value: 'acoes',    label: 'Ações',           icon: '📈', defaultIndex: 'manual' as IndexType },
  { value: 'fii',      label: 'FII',             icon: '🏢', defaultIndex: 'manual' as IndexType },
  { value: 'cripto',   label: 'Cripto',          icon: '₿',  defaultIndex: 'manual' as IndexType },
  { value: 'outro',    label: 'Outro',           icon: '💼', defaultIndex: 'cdi' as IndexType },
];

const COVER_COLORS = [
  '#10b981', '#14b8a6', '#0ea5e9', '#6366f1', '#8b5cf6', '#ec4899',
  '#f43f5e', '#f59e0b', '#f97316', '#84cc16', '#64748b', '#eab308',
];

const EMOJIS = ['📦', '🏖️', '✈️', '🏠', '🚗', '💍', '🎓', '🚨', '🎁', '💻', '👶', '🐾', '🌱', '💰', '📈', '🏦'];

const LIQUIDITY_OPTIONS = [
  { value: 'diaria',     label: 'Diária (D+0)', badge: 'D+0' },
  { value: 'd+1',        label: 'D+1',          badge: 'D+1' },
  { value: 'd+30',       label: 'D+30',         badge: 'D+30' },
  { value: 'd+360',      label: 'D+360',        badge: 'D+360' },
  { value: 'vencimento', label: 'No vencimento', badge: 'Venc.' },
];

type MoveType = 'aporte' | 'resgate' | 'rendimento' | 'taxa' | 'ir';
const MOVE_TYPES: { value: MoveType; label: string; verb: string; help: string; needsAccount: boolean; accountLabel: string; tone: 'expense' | 'income' | 'warning'; autoOnly: boolean }[] = [
  { value: 'aporte',     label: 'Aporte',     verb: 'Aportar',  help: 'O dinheiro sai da conta e entra no investimento. Baixa do saldo, mas NÃO é um gasto.', needsAccount: true,  accountLabel: 'Conta de origem',  tone: 'expense', autoOnly: false },
  { value: 'resgate',    label: 'Resgate',    verb: 'Resgatar', help: 'O dinheiro volta do investimento para a conta. Entra no saldo, mas NÃO é receita.', needsAccount: true,  accountLabel: 'Conta de destino', tone: 'income', autoOnly: false },
  { value: 'rendimento', label: 'Rendimento', verb: 'Lançar',   help: 'Ganho manual (use para ativos sem taxa automática, ex.: ações, cripto).', needsAccount: false, accountLabel: '', tone: 'income', autoOnly: false },
  { value: 'taxa',       label: 'Taxa',       verb: 'Lançar',   help: 'Taxa/custo descontado do investimento.', needsAccount: false, accountLabel: '', tone: 'warning', autoOnly: false },
  { value: 'ir',         label: 'IR',         verb: 'Lançar',   help: 'Imposto descontado do investimento.', needsAccount: false, accountLabel: '', tone: 'warning', autoOnly: false },
];
const MOVE_ICONS: Record<MoveType, typeof ArrowUpRight> = {
  aporte: ArrowUpRight, resgate: ArrowDownRight, rendimento: TrendingUp, taxa: Percent, ir: Receipt,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().slice(0, 10);
const coverGradient = (color: string) =>
  `linear-gradient(135deg, ${color} 0%, color-mix(in srgb, ${color}, #000 28%) 100%)`;

const rateLabel = (inv: { index_type?: string | null; cdi_percent?: number | null; annual_rate?: number | null }) => {
  const idx = inv.index_type || 'cdi';
  if (idx === 'cdi') return `${Number(inv.cdi_percent) || 100}% CDI`;
  if (idx === 'prefixado') return `${Number(inv.annual_rate) || 0}% a.a.`;
  if (idx === 'ipca') return `IPCA + ${Number(inv.annual_rate) || 0}%`;
  if (idx === 'poupanca') return 'Poupança';
  return 'Manual';
};

const PROJ_LABELS = ['1 mês', '3 meses', '6 meses', '1 ano', '2 anos', '5 anos'];

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

  // ── dialog state ──
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<PortfolioInvestment | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showRates, setShowRates] = useState(false);
  const [showSim, setShowSim] = useState(false);
  const [movement, setMovement] = useState<{ investmentId: string; type: MoveType } | null>(null);

  // ── forms ──
  const emptyForm = {
    name: '', type: 'caixinha', index_type: 'cdi' as IndexType, institution: '',
    current_value: '', cdi_percent: '100', annual_rate: '', goal_amount: '',
    liquidity: 'diaria', color: COVER_COLORS[0], icon: '📦', photo_url: '',
  };
  const [form, setForm] = useState({ ...emptyForm });
  const [rebalance, setRebalance] = useState('');
  const [moveForm, setMoveForm] = useState({ amount: '', accountId: '', date: todayStr(), description: '' });
  const [rateForm, setRateForm] = useState({ selic: '', cdi: '', ipca: '' });
  const [sim, setSim] = useState({ initial: '1000', monthly: '300', years: '5', index_type: 'cdi' as IndexType, cdi_percent: '100', annual_rate: '' });

  // ── derived ──
  const simResult = useMemo(() => {
    const annualRate = effectiveAnnualRate(
      { index_type: sim.index_type, cdi_percent: parseFloat(sim.cdi_percent.replace(',', '.')) || 100, annual_rate: parseFloat(sim.annual_rate.replace(',', '.')) || 0 },
      rates,
    );
    return simulate({
      initial: parseFloat(sim.initial.replace(',', '.')) || 0,
      monthly: parseFloat(sim.monthly.replace(',', '.')) || 0,
      months: Math.round((parseFloat(sim.years.replace(',', '.')) || 0) * 12),
      annualRate,
      indexType: sim.index_type,
    }, rates);
  }, [sim, rates]);
  const simAnnualPct = simResult.invested > 0 ? (effectiveAnnualRate({ index_type: sim.index_type, cdi_percent: parseFloat(sim.cdi_percent.replace(',', '.')) || 100, annual_rate: parseFloat(sim.annual_rate.replace(',', '.')) || 0 }, rates) * 100) : 0;
  const simChartData = useMemo(() => {
    const step = Math.max(1, Math.floor(simResult.series.length / 60));
    return simResult.series.filter((_, i) => i % step === 0 || i === simResult.series.length - 1);
  }, [simResult]);
  const pieData = useMemo(() => investments
    .filter(i => i.value > 0)
    .map(i => ({
      id: i.id, name: i.name, value: i.value,
      color: i.color || COVER_COLORS[0],
      pct: portfolio.totalValue > 0 ? (i.value / portfolio.totalValue) * 100 : 0,
      icon: i.icon,
    }))
    .sort((a, b) => b.value - a.value), [investments, portfolio.totalValue]);
  const showDonut = pieData.length >= 1 && portfolio.totalValue > 0;

  const selectedTxns = selected ? allTransactions.filter(t => t.investment_id === selected) : allTransactions;

  // ── handlers ──
  const openNew = () => { setForm({ ...emptyForm }); setShowNew(true); };

  const onTypeChange = (type: string) => {
    const info = INVESTMENT_TYPES.find(t => t.value === type);
    setForm(p => ({
      ...p, type,
      index_type: info?.defaultIndex ?? p.index_type,
      icon: p.icon && p.icon !== INVESTMENT_TYPES.find(t => t.value === p.type)?.icon ? p.icon : (info?.icon ?? p.icon),
    }));
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return toast.error('Dê um nome à caixinha');
    const current = parseFloat(form.current_value.replace(',', '.')) || 0;
    try {
      await addInvestment.mutateAsync({
        name: form.name.trim(),
        type: form.type,
        index_type: form.index_type,
        institution: form.institution,
        current_value: current,
        total_invested: current,
        value_date: todayStr(),
        cdi_percent: form.index_type === 'cdi' ? (parseFloat(form.cdi_percent.replace(',', '.')) || 100) : 100,
        annual_rate: (form.index_type === 'prefixado' || form.index_type === 'ipca') ? (parseFloat(form.annual_rate.replace(',', '.')) || 0) : 0,
        goal_amount: parseFloat(form.goal_amount.replace(',', '.')) || 0,
        liquidity: form.liquidity,
        icon: form.icon || INVESTMENT_TYPES.find(t => t.value === form.type)?.icon || '📦',
        color: form.color,
        photo_url: form.photo_url || null,
      });
      toast.success('Caixinha criada! 🎉');
      setShowNew(false);
    } catch (e) { toast.error((e as Error).message); }
  };

  const openEdit = (inv: PortfolioInvestment) => {
    setForm({
      name: inv.name, type: inv.type || 'caixinha', index_type: (inv.index_type as IndexType) || 'cdi',
      institution: inv.institution || '', current_value: '', cdi_percent: String(inv.cdi_percent ?? 100),
      annual_rate: String(inv.annual_rate ?? ''), goal_amount: inv.goal_amount ? String(inv.goal_amount) : '',
      liquidity: inv.liquidity || 'diaria', color: inv.color || COVER_COLORS[0], icon: inv.icon || '📦',
      photo_url: inv.photo_url || '',
    });
    setRebalance('');
    setEditing(inv);
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    try {
      const patch: Record<string, unknown> = {
        name: form.name || editing.name,
        type: form.type,
        index_type: form.index_type,
        institution: form.institution,
        cdi_percent: form.index_type === 'cdi' ? (parseFloat(form.cdi_percent.replace(',', '.')) || 100) : 100,
        annual_rate: (form.index_type === 'prefixado' || form.index_type === 'ipca') ? (parseFloat(form.annual_rate.replace(',', '.')) || 0) : Number(editing.annual_rate) || 0,
        goal_amount: parseFloat(form.goal_amount.replace(',', '.')) || 0,
        liquidity: form.liquidity,
        color: form.color,
        icon: form.icon || '📦',
        photo_url: form.photo_url || null,
      };
      // Optional "Corrigir saldo atual": resets baseline to the typed value as of today.
      const reb = parseFloat(rebalance.replace(',', '.'));
      if (rebalance.trim() !== '' && !isNaN(reb)) {
        patch.current_value = reb;
        patch.value_date = todayStr();
      }
      await updateInvestment.mutateAsync({ id: editing.id, ...patch });
      toast.success('Caixinha atualizada!');
      setEditing(null);
    } catch (e) { toast.error((e as Error).message); }
  };

  const openMovement = (investmentId: string, type: MoveType) => {
    if (!investmentId) return toast.error('Crie uma caixinha primeiro');
    const firstAccount = accounts.find(a => !a.archived);
    setMoveForm({ amount: '', accountId: firstAccount?.id ?? '', date: todayStr(), description: '' });
    setMovement({ investmentId, type });
  };

  const handleMovement = async () => {
    if (!movement) return;
    const cfg = MOVE_TYPES.find(t => t.value === movement.type)!;
    const amount = parseFloat(moveForm.amount.replace(',', '.'));
    if (!amount || amount <= 0) return toast.error('Informe um valor válido');
    if (cfg.needsAccount && !moveForm.accountId) return toast.error(`Selecione a ${cfg.accountLabel.toLowerCase()}`);
    const inv = investments.find(i => i.id === movement.investmentId);
    const reducesValue = movement.type === 'resgate' || movement.type === 'taxa' || movement.type === 'ir';
    if (reducesValue && inv && amount > inv.value + 0.005) {
      return toast.error(`Valor maior que o saldo da caixinha (${formatCurrency(inv.value)})`);
    }
    try {
      await addTransaction.mutateAsync({
        investment_id: movement.investmentId,
        type: movement.type,
        amount,
        date: moveForm.date || todayStr(),
        account_id: cfg.needsAccount ? (moveForm.accountId || null) : null,
        description: moveForm.description.trim() || cfg.label,
      });
      toast.success(`${cfg.label} de ${formatCurrency(amount)}${inv ? ` em ${inv.name}` : ''} registrado!`);
      setMovement(null);
    } catch (e) { toast.error((e as Error).message); }
  };

  const openRates = () => { setRateForm({ selic: String((rates.selicAnnual * 100).toFixed(2)), cdi: String((rates.cdiAnnual * 100).toFixed(2)), ipca: String((rates.ipcaAnnual * 100).toFixed(2)) }); setShowRates(true); };
  const handleSaveRates = () => {
    const next: InvestmentRates = {
      selicAnnual: (parseFloat(rateForm.selic.replace(',', '.')) || 0) / 100,
      cdiAnnual: (parseFloat(rateForm.cdi.replace(',', '.')) || 0) / 100,
      ipcaAnnual: (parseFloat(rateForm.ipca.replace(',', '.')) || 0) / 100,
    };
    setRates(next);
    toast.success('Taxas atualizadas!');
    setShowRates(false);
  };

  const formIsAuto = isAutoCalc(form.index_type);

  // ── render ──
  return (
    <div className="space-y-5 animate-fade-in">

      {/* ─── Hero / Portfolio overview ─────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-card via-card to-primary/[0.06] p-5 shadow-sm sm:p-6">
        <div className="pointer-events-none absolute -top-20 -right-16 h-60 w-60 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 left-1/4 h-40 w-52 rounded-full bg-income/[0.07] blur-2xl" />
        <div className="relative z-10 flex flex-col gap-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/25 to-primary/5 shadow-inner sm:h-14 sm:w-14">
                <BarChart3 className="h-6 w-6 text-primary sm:h-7 sm:w-7" />
              </div>
              <div className="min-w-0">
                <h1 className="flex items-center gap-2 text-2xl font-extrabold leading-none tracking-tight sm:text-3xl">
                  Investimentos <Sparkles className="h-4 w-4 shrink-0 text-primary opacity-60" />
                </h1>
                <p className="mt-1.5 text-xs text-muted-foreground sm:text-sm">
                  {portfolio.count} {portfolio.count === 1 ? 'caixinha' : 'caixinhas'} · rendendo de verdade
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" onClick={() => setShowSim(true)} className="gap-2">
                <Calculator className="h-4 w-4" /> <span className="hidden sm:inline">Simular</span>
              </Button>
              <Button onClick={openNew} className="gap-2 bg-primary text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90">
                <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Nova caixinha</span><span className="sm:hidden">Nova</span>
              </Button>
            </div>
          </div>

          {/* Headline numbers — total bruto / líquido / rendeu 12m / rendimento total */}
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <div className="col-span-2 rounded-2xl border border-border/50 bg-background/50 p-3.5 backdrop-blur-sm lg:col-span-1">
              <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><Coins className="h-3 w-3" /> Total bruto</p>
              <p className="mt-1 currency text-3xl font-black leading-none text-foreground">{maskCurrency(formatCurrency(portfolio.totalValue))}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">aportado {maskCurrency(formatCurrency(portfolio.totalInvested))} · {portfolio.count} {portfolio.count === 1 ? 'caixinha' : 'caixinhas'}</p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-background/50 p-3.5 backdrop-blur-sm">
              <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><ShieldCheck className="h-3 w-3" /> Total líquido</p>
              <p className="mt-1 currency text-xl font-bold leading-none">{maskCurrency(formatCurrency(portfolio.totalNet))}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">se resgatar hoje (após IR/IOF)</p>
            </div>
            <div className="rounded-2xl border border-income/20 bg-income/[0.06] p-3.5 backdrop-blur-sm">
              <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><CalendarClock className="h-3 w-3" /> Rendeu (12 meses)</p>
              <p className="mt-1 currency text-xl font-bold leading-none text-income">+{maskCurrency(formatCurrency(portfolio.totalYield12m))}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">≈ {maskCurrency(formatCurrency(portfolio.perDayYield))}/dia</p>
            </div>
            <div className="rounded-2xl border border-income/20 bg-income/[0.06] p-3.5 backdrop-blur-sm">
              <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><TrendingUp className="h-3 w-3" /> Rendimento total</p>
              <p className={cn('mt-1 currency text-xl font-bold leading-none', portfolio.totalYield >= 0 ? 'text-income' : 'text-expense')}>
                {portfolio.totalYield >= 0 ? '+' : ''}{maskCurrency(formatCurrency(portfolio.totalYield))}
              </p>
              <p className={cn('mt-1 text-[11px] font-semibold', portfolio.totalYield >= 0 ? 'text-income' : 'text-expense')}>
                {isVisible && portfolio.totalInvested > 0 ? `${portfolio.totalYieldPct >= 0 ? '+' : ''}${portfolio.totalYieldPct.toFixed(2)}% desde o início` : maskText('00%')}
              </p>
            </div>
          </div>

          {/* Rate chips */}
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={openRates} className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm transition-colors hover:bg-background">
              <Settings2 className="h-3 w-3 text-primary" />
              <span className="text-muted-foreground">CDI:</span>
              <span className="text-foreground">{(rates.cdiAnnual * 100).toFixed(2)}% a.a.</span>
            </button>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm">
              <span className="text-muted-foreground">Selic:</span><span className="text-foreground">{(rates.selicAnnual * 100).toFixed(2)}%</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm">
              <span className="text-muted-foreground">IPCA:</span><span className="text-foreground">{(rates.ipcaAnnual * 100).toFixed(2)}%</span>
            </span>
          </div>
        </div>
      </div>

      {/* ─── Allocation donut ─────────────────────────────────────────────── */}
      {showDonut && (
        <div className="stat-card">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/10"><BarChart3 className="h-3 w-3 text-primary" /></div>
            Alocação do portfólio
          </h3>
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <div className="relative shrink-0" style={{ width: 200, height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={62} outerRadius={90} paddingAngle={2} dataKey="value" strokeWidth={0} cornerRadius={6}>
                    {pieData.map(e => <Cell key={e.id} fill={e.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Total</p>
                <p className="mt-0.5 text-sm font-bold leading-tight">{maskCurrency(formatCurrency(portfolio.totalValue))}</p>
              </div>
            </div>
            <div className="w-full flex-1 space-y-2.5">
              {pieData.map(item => (
                <div key={item.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex min-w-0 items-center gap-2"><span className="text-sm">{item.icon}</span><span className="truncate font-medium">{item.name}</span></span>
                    <span className="ml-2 flex shrink-0 items-center gap-3">
                      <span className="text-muted-foreground">{isVisible ? `${item.pct.toFixed(1)}%` : maskText('00%')}</span>
                      <span className="font-semibold tabular-nums">{maskCurrency(formatCurrency(item.value))}</span>
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${item.pct}%`, backgroundColor: item.color }} /></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Caixinha cards ───────────────────────────────────────────────── */}
      {investments.length === 0 ? (
        <div className="stat-card py-16 text-center">
          <PiggyBank className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
          <p className="font-medium text-muted-foreground">Nenhuma caixinha ainda</p>
          <p className="mt-1 text-sm text-muted-foreground">Crie a primeira e lance quanto você tem hoje — daí ela rende sozinha.</p>
          <Button onClick={openNew} className="mt-4"><Plus className="mr-1 h-4 w-4" /> Criar caixinha</Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {investments.map(inv => {
            const color = inv.color || COVER_COLORS[0];
            const isSel = selected === inv.id;
            const showProj = expanded === inv.id;
            const prog = goalProgress(inv.value, inv.goal_amount);
            const annualPct = inv.annualRate * 100;
            const proj = inv.isAuto && inv.value > 0 ? projectInvestment(inv.value, inv.annualRate, inv.type, inv.index_type) : [];
            const eta = inv.goal_amount && inv.value < inv.goal_amount ? monthsToGoal(inv.value, Number(inv.goal_amount), inv.annualRate) : null;
            return (
              <div key={inv.id} className={cn('group flex flex-col overflow-hidden rounded-3xl border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg', isSel ? 'border-primary ring-1 ring-primary' : 'border-border/60')}>
                {/* Cover */}
                <div className="relative h-24 overflow-hidden" style={inv.photo_url ? undefined : { background: coverGradient(color) }}>
                  {inv.photo_url && <img src={inv.photo_url} alt={inv.name} className="h-full w-full object-cover" />}
                  {inv.photo_url && <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />}
                  <div className="absolute left-3 top-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 text-2xl backdrop-blur-md">{inv.icon}</div>
                  <span className="absolute right-3 top-3 rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur-md">{rateLabel(inv)}</span>
                  <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between">
                    <p className="truncate pr-2 text-sm font-bold text-white drop-shadow">{inv.name}</p>
                    <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <button onClick={() => openEdit(inv)} className="rounded-lg bg-white/20 p-1.5 text-white backdrop-blur-md hover:bg-white/30" title="Editar"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => { if (confirm(`Excluir "${inv.name}"?`)) deleteInvestment.mutate(inv.id); }} className="rounded-lg bg-white/20 p-1.5 text-white backdrop-blur-md hover:bg-expense/80" title="Excluir"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="flex flex-1 flex-col p-4">
                  <button onClick={() => setSelected(isSel ? null : inv.id)} className="text-left">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{inv.institution || (INVESTMENT_TYPES.find(t => t.value === inv.type)?.label ?? 'Investimento')}</p>
                    <p className="currency text-2xl font-extrabold leading-none">{maskCurrency(formatCurrency(inv.value))}</p>
                  </button>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-bold', inv.yieldAbs >= 0 ? 'bg-income/10 text-income' : 'bg-expense/10 text-expense')}>
                      {inv.yieldAbs >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {inv.yieldAbs >= 0 ? '+' : ''}{maskCurrency(formatCurrency(inv.yieldAbs))}
                      {isVisible && inv.invested > 0 && <span className="opacity-80"> ({inv.yieldPct >= 0 ? '+' : ''}{inv.yieldPct.toFixed(1)}%)</span>}
                    </span>
                    {inv.isAuto && inv.perDayYield > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Flame className="h-3 w-3 text-orange-500" /> ≈ {maskCurrency(formatCurrency(inv.perDayYield))}/dia</span>
                    )}
                  </div>

                  {inv.isAuto && (
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                      <span><ShieldCheck className="mr-0.5 inline h-3 w-3" />Líquido {maskCurrency(formatCurrency(inv.netValue))}</span>
                      <span><CalendarClock className="mr-0.5 inline h-3 w-3" />12m +{maskCurrency(formatCurrency(inv.yield12m))}</span>
                    </div>
                  )}

                  {/* Goal progress */}
                  {prog !== null && (
                    <div className="mt-3">
                      <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1"><Target className="h-3 w-3" /> Meta {maskCurrency(formatCurrency(Number(inv.goal_amount)))}</span>
                        <span className="font-semibold">{isVisible ? `${Math.round(prog * 100)}%` : maskText('00%')}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${prog * 100}%`, background: coverGradient(color) }} /></div>
                      {eta != null && eta > 0 && isVisible && <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground"><CalendarClock className="h-3 w-3" /> ~{eta} {eta === 1 ? 'mês' : 'meses'} pra meta no ritmo atual</p>}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-3 flex gap-2 border-t border-border/40 pt-3">
                    <button onClick={() => openMovement(inv.id, 'aporte')} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-expense/8 py-1.5 text-[11px] font-semibold text-expense transition-colors hover:bg-expense/15" title="Aportar"><ArrowUpRight className="h-3 w-3" /> Aportar</button>
                    <button onClick={() => openMovement(inv.id, 'resgate')} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-income/8 py-1.5 text-[11px] font-semibold text-income transition-colors hover:bg-income/15" title="Resgatar"><ArrowDownRight className="h-3 w-3" /> Resgatar</button>
                    {!inv.isAuto && (
                      <button onClick={() => openMovement(inv.id, 'rendimento')} className="flex items-center justify-center gap-1.5 rounded-lg bg-primary/8 px-2.5 py-1.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/15" title="Lançar rendimento/taxa"><TrendingUp className="h-3 w-3" /></button>
                    )}
                  </div>

                  {/* Projection toggle */}
                  {proj.length > 0 && (
                    <div className="mt-2.5">
                      <button onClick={() => setExpanded(showProj ? null : inv.id)} className="flex w-full items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
                        <TrendingUp className="h-3 w-3" /> Projeção {annualPct > 0 ? `(${annualPct.toFixed(1)}% a.a.)` : ''}
                        {showProj ? <ChevronUp className="ml-auto h-3 w-3" /> : <ChevronDown className="ml-auto h-3 w-3" />}
                      </button>
                      {showProj && (
                        <div className="mt-2 space-y-1.5">
                          {proj.map((p, i) => (
                            <div key={p.label} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-1.5 text-xs">
                              <span className="w-16 shrink-0 font-medium text-muted-foreground">{PROJ_LABELS[i]}</span>
                              <div className="text-right">
                                <p className="font-bold">{maskCurrency(formatCurrency(p.gross))}</p>
                                <p className="text-[10px] text-income">+{maskCurrency(formatCurrency(p.gain))} bruto · líq. +{maskCurrency(formatCurrency(p.net - inv.value))}</p>
                              </div>
                            </div>
                          ))}
                          <p className="px-1 text-[10px] leading-relaxed text-muted-foreground">Estimativa com a taxa atual; "líq." já desconta IR/IOF conforme o prazo. Não considera mudanças de CDI.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Transaction history ──────────────────────────────────────────── */}
      {selectedTxns.length > 0 && (
        <div className="stat-card">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/10"><BarChart3 className="h-3 w-3 text-primary" /></div>
            {selected ? `Histórico — ${investments.find(i => i.id === selected)?.name}` : 'Histórico de movimentações'}
          </h3>
          <div className="space-y-2">
            {selectedTxns.slice(0, 20).map(t => {
              const positive = t.type === 'aporte' || t.type === 'rendimento';
              const label: Record<string, string> = { aporte: 'Aporte', resgate: 'Resgate', rendimento: 'Rendimento', taxa: 'Taxa', ir: 'IR' };
              return (
                <div key={t.id} className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-0">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px]', t.type === 'aporte' ? 'bg-expense/10 text-expense' : t.type === 'resgate' || t.type === 'rendimento' ? 'bg-income/10 text-income' : 'bg-warning/10 text-warning')}>
                      {t.type === 'aporte' ? '↑' : t.type === 'resgate' ? '↓' : t.type === 'rendimento' ? '📈' : '💸'}
                    </div>
                    <div className="min-w-0"><p className="truncate text-sm font-medium">{t.description || label[t.type] || t.type}</p><p className="text-xs text-muted-foreground">{formatDate(t.date)}</p></div>
                  </div>
                  <span className={cn('shrink-0 text-sm font-semibold tabular-nums', positive ? 'text-income' : 'text-expense')}>{positive ? '+' : '−'}{maskCurrency(formatCurrency(Number(t.amount)))}</span>
                </div>
              );
            })}
          </div>
          {selected && <button onClick={() => setSelected(null)} className="mt-3 text-xs text-muted-foreground hover:text-foreground">Ver todas as caixinhas →</button>}
        </div>
      )}

      {/* ─── New / Edit dialog ────────────────────────────────────────────── */}
      <Dialog open={showNew || !!editing} onOpenChange={o => { if (!o) { setShowNew(false); setEditing(null); } }}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Editar caixinha' : 'Nova caixinha'}</DialogTitle></DialogHeader>

          {/* Live preview — looks like the real pocket card */}
          <div className="overflow-hidden rounded-2xl border border-border/40 shadow-sm">
            <div className="relative h-28" style={form.photo_url ? undefined : { background: coverGradient(form.color) }}>
              {form.photo_url && <img src={form.photo_url} alt="" className="h-full w-full object-cover" onError={e => (e.currentTarget.style.display = 'none')} />}
              {form.photo_url && <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />}
              <span className="absolute left-3 top-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 text-2xl backdrop-blur-md">{form.icon || '📦'}</span>
              <span className="absolute right-3 top-3 rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur-md">{rateLabel({ index_type: form.index_type, cdi_percent: Number(form.cdi_percent), annual_rate: Number(form.annual_rate) })}</span>
              <p className="absolute bottom-2 left-3 right-3 truncate text-sm font-bold text-white drop-shadow">{form.name || 'Nome da caixinha'}</p>
            </div>
            <div className="flex items-center justify-between bg-card px-4 py-2.5">
              <span className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">{form.institution || INVESTMENT_TYPES.find(t => t.value === form.type)?.label}</span>
              <span className="currency text-lg font-extrabold">{formatCurrency(editing ? editing.value : (parseFloat((form.current_value || '0').replace(',', '.')) || 0))}</span>
            </div>
          </div>

          <div className="space-y-3.5">
            {/* Identidade */}
            <section className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-3.5">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground"><Tag className="h-3 w-3" /> Identidade</p>
              <div>
                <Label className="text-xs text-muted-foreground">Nome *</Label>
                <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Caixinha Turbo, Nossa Casa..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Tipo</Label>
                  <Select value={form.type} onValueChange={onTypeChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{INVESTMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Instituição</Label>
                  <Input value={form.institution} onChange={e => setForm(p => ({ ...p, institution: e.target.value }))} placeholder="Nubank, XP..." />
                </div>
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
              <div>
                <Label className="flex items-center gap-1.5 text-xs text-muted-foreground"><ImageIcon className="h-3.5 w-3.5" /> Foto de capa (URL opcional)</Label>
                <Input value={form.photo_url} onChange={e => setForm(p => ({ ...p, photo_url: e.target.value }))} placeholder="https://..." />
              </div>
            </section>

            {/* Rendimento */}
            <section className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-3.5">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground"><Percent className="h-3 w-3" /> Como rende</p>
              <div className="flex flex-wrap gap-1.5">
                {INDEX_TYPES.map(t => <button key={t.value} type="button" onClick={() => setForm(p => ({ ...p, index_type: t.value }))} className={cn('rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all', form.index_type === t.value ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 text-muted-foreground hover:bg-muted')}>{t.label}</button>)}
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">{INDEX_TYPES.find(t => t.value === form.index_type)?.help}</p>
              {form.index_type === 'cdi' && (
                <div>
                  <Label className="text-xs text-muted-foreground">% do CDI</Label>
                  <div className="flex items-center gap-2">
                    <Input type="number" step="1" value={form.cdi_percent} onChange={e => setForm(p => ({ ...p, cdi_percent: e.target.value }))} placeholder="100" className="flex-1" />
                    {['100', '115', '120'].map(v => <button key={v} type="button" onClick={() => setForm(p => ({ ...p, cdi_percent: v }))} className={cn('rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors', form.cdi_percent === v ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 text-muted-foreground hover:bg-muted')}>{v}%</button>)}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">Normal = 100% · Turbo = 115% · Turbo premium = 120%.</p>
                </div>
              )}
              {form.index_type === 'prefixado' && (<div><Label className="text-xs text-muted-foreground">Taxa (% ao ano)</Label><Input type="number" step="0.1" value={form.annual_rate} onChange={e => setForm(p => ({ ...p, annual_rate: e.target.value }))} placeholder="Ex: 12.5" /></div>)}
              {form.index_type === 'ipca' && (<div><Label className="text-xs text-muted-foreground">IPCA + (% ao ano)</Label><Input type="number" step="0.1" value={form.annual_rate} onChange={e => setForm(p => ({ ...p, annual_rate: e.target.value }))} placeholder="Ex: 6.5" /></div>)}
            </section>

            {/* Valores */}
            <section className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-3.5">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground"><Coins className="h-3 w-3" /> Valores</p>
              {!editing ? (
                <div>
                  <Label className="text-xs text-muted-foreground">Quanto você tem hoje (R$)</Label>
                  <Input type="number" step="0.01" value={form.current_value} onChange={e => setForm(p => ({ ...p, current_value: e.target.value }))} placeholder="0,00" />
                  <p className="mt-1 text-[11px] text-muted-foreground">{formIsAuto ? 'A partir daqui a caixinha rende sozinha. Depois é só Aportar/Resgatar.' : 'Você atualiza o valor manualmente quando quiser.'}</p>
                </div>
              ) : (
                <div>
                  <Label className="text-xs text-muted-foreground">Corrigir saldo atual (opcional)</Label>
                  <Input type="number" step="0.01" value={rebalance} onChange={e => setRebalance(e.target.value)} placeholder={formatCurrency(editing.value)} />
                  <p className="mt-1 text-[11px] text-muted-foreground">Valor atual: <strong>{formatCurrency(editing.value)}</strong>. Preencha só se quiser ajustar para o valor real de hoje — recomeça o rendimento a partir desse valor.</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="flex items-center gap-1 text-xs text-muted-foreground"><Target className="h-3 w-3" /> Meta (opcional)</Label>
                  <Input type="number" step="0.01" value={form.goal_amount} onChange={e => setForm(p => ({ ...p, goal_amount: e.target.value }))} placeholder="Ex: 10000" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Liquidez</Label>
                  <Select value={form.liquidity} onValueChange={v => setForm(p => ({ ...p, liquidity: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{LIQUIDITY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </section>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowNew(false); setEditing(null); }}>Cancelar</Button>
            <Button onClick={editing ? handleSaveEdit : handleCreate} disabled={addInvestment.isPending || updateInvestment.isPending}>{editing ? 'Salvar' : 'Criar caixinha'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Movement dialog ──────────────────────────────────────────────── */}
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
                      {types.map(t => {
                        const TIcon = MOVE_ICONS[t.value];
                        const active = movement.type === t.value;
                        return <button key={t.value} type="button" onClick={() => setMovement(m => m ? { ...m, type: t.value } : m)} className={cn('flex flex-col items-center gap-1 rounded-lg border py-2 text-[10px] font-semibold transition-all', active ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 text-muted-foreground hover:bg-muted')}><TIcon className="h-3.5 w-3.5" />{t.label}</button>;
                      })}
                    </div>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{cfg.help}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Caixinha</Label>
                    <Select value={movement.investmentId} onValueChange={v => setMovement(m => {
                      if (!m) return m;
                      const next = investments.find(i => i.id === v);
                      const nextAuto = next ? next.isAuto : true;
                      const typeOk = nextAuto ? (m.type === 'aporte' || m.type === 'resgate') : true;
                      return { ...m, investmentId: v, type: typeOk ? m.type : 'aporte' };
                    })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{investments.map(i => <SelectItem key={i.id} value={i.id}>{i.icon} {i.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs text-muted-foreground">Valor (R$)</Label><Input type="number" inputMode="decimal" step="0.01" min={0} value={moveForm.amount} onChange={e => setMoveForm(p => ({ ...p, amount: e.target.value }))} placeholder="0,00" autoFocus /></div>
                  {cfg.needsAccount && (
                    <div>
                      <Label className="text-xs text-muted-foreground">{cfg.accountLabel}</Label>
                      <Select value={moveForm.accountId} onValueChange={v => setMoveForm(p => ({ ...p, accountId: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
                        <SelectContent>{accounts.filter(a => !a.archived).map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  )}
                  <div><Label className="text-xs text-muted-foreground">Data</Label><Input type="date" value={moveForm.date} onChange={e => setMoveForm(p => ({ ...p, date: e.target.value }))} /></div>
                  <div><Label className="text-xs text-muted-foreground">Descrição (opcional)</Label><Input value={moveForm.description} onChange={e => setMoveForm(p => ({ ...p, description: e.target.value }))} placeholder={cfg.label} /></div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setMovement(null)}>Cancelar</Button>
                  <Button onClick={handleMovement} disabled={addTransaction.isPending}>{addTransaction.isPending ? 'Salvando...' : cfg.verb}</Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ─── Rates dialog ─────────────────────────────────────────────────── */}
      <Dialog open={showRates} onOpenChange={setShowRates}>
        <DialogContent>
          <DialogHeader><DialogTitle>Taxas de referência</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs leading-relaxed text-muted-foreground">Essas taxas alimentam o cálculo de rendimento das caixinhas pós-fixadas. Padrão (jun/2026): Selic 14,50% → CDI 14,40%.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Selic (% a.a.)</Label>
                <Input type="number" step="0.05" value={rateForm.selic} onChange={e => { const s = e.target.value; setRateForm(p => ({ ...p, selic: s, cdi: s === '' ? p.cdi : (Math.max(0, (parseFloat(s.replace(',', '.')) || 0) - 0.10)).toFixed(2) })); }} />
              </div>
              <div><Label className="text-xs text-muted-foreground">CDI (% a.a.)</Label><Input type="number" step="0.05" value={rateForm.cdi} onChange={e => setRateForm(p => ({ ...p, cdi: e.target.value }))} /></div>
              <div className="col-span-2"><Label className="text-xs text-muted-foreground">IPCA (% a.a.)</Label><Input type="number" step="0.05" value={rateForm.ipca} onChange={e => setRateForm(p => ({ ...p, ipca: e.target.value }))} /></div>
            </div>
            <p className="text-[11px] text-muted-foreground">Dica: o CDI fica ~0,10 ponto abaixo da Selic (ajusta sozinho ao editar a Selic).</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRates(false)}>Cancelar</Button>
            <Button onClick={handleSaveRates}>Salvar taxas</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Simulator dialog ─────────────────────────────────────────────── */}
      <Dialog open={showSim} onOpenChange={setShowSim}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Calculator className="h-5 w-5 text-primary" /> Simulador de investimento</DialogTitle></DialogHeader>

          <div className="space-y-3.5">
            {/* Inputs */}
            <section className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs text-muted-foreground">Valor inicial (R$)</Label><Input type="number" step="0.01" value={sim.initial} onChange={e => setSim(p => ({ ...p, initial: e.target.value }))} placeholder="1000" /></div>
                <div><Label className="text-xs text-muted-foreground">Aporte mensal (R$)</Label><Input type="number" step="0.01" value={sim.monthly} onChange={e => setSim(p => ({ ...p, monthly: e.target.value }))} placeholder="300" /></div>
                <div><Label className="text-xs text-muted-foreground">Por quantos anos</Label><Input type="number" step="1" value={sim.years} onChange={e => setSim(p => ({ ...p, years: e.target.value }))} placeholder="5" /></div>
                <div>
                  <Label className="text-xs text-muted-foreground">Rende como</Label>
                  <Select value={sim.index_type} onValueChange={v => setSim(p => ({ ...p, index_type: v as IndexType }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{INDEX_TYPES.filter(t => t.value !== 'manual').map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              {sim.index_type === 'cdi' && (
                <div>
                  <Label className="text-xs text-muted-foreground">% do CDI</Label>
                  <div className="flex items-center gap-2">
                    <Input type="number" step="1" value={sim.cdi_percent} onChange={e => setSim(p => ({ ...p, cdi_percent: e.target.value }))} className="flex-1" />
                    {['100', '115', '120'].map(v => <button key={v} type="button" onClick={() => setSim(p => ({ ...p, cdi_percent: v }))} className={cn('rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors', sim.cdi_percent === v ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 text-muted-foreground hover:bg-muted')}>{v}%</button>)}
                  </div>
                </div>
              )}
              {sim.index_type === 'prefixado' && (<div><Label className="text-xs text-muted-foreground">Taxa (% ao ano)</Label><Input type="number" step="0.1" value={sim.annual_rate} onChange={e => setSim(p => ({ ...p, annual_rate: e.target.value }))} placeholder="12.5" /></div>)}
              {sim.index_type === 'ipca' && (<div><Label className="text-xs text-muted-foreground">IPCA + (% ao ano)</Label><Input type="number" step="0.1" value={sim.annual_rate} onChange={e => setSim(p => ({ ...p, annual_rate: e.target.value }))} placeholder="6.5" /></div>)}
              <p className="text-[11px] text-muted-foreground">Taxa estimada: <strong>{simAnnualPct.toFixed(2)}% a.a.</strong> (CDI atual {(rates.cdiAnnual * 100).toFixed(2)}%).</p>
            </section>

            {/* Results */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl border border-border/50 bg-background/50 p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Você terá (bruto)</p>
                <p className="mt-1 currency text-2xl font-black leading-none text-foreground">{formatCurrency(simResult.gross)}</p>
              </div>
              <div className="rounded-2xl border border-income/20 bg-income/[0.06] p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Líquido (após IR)</p>
                <p className="mt-1 currency text-2xl font-black leading-none text-income">{formatCurrency(simResult.net)}</p>
              </div>
              <div className="rounded-2xl border border-border/50 bg-background/50 p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total investido</p>
                <p className="mt-1 currency text-base font-bold leading-none">{formatCurrency(simResult.invested)}</p>
              </div>
              <div className="rounded-2xl border border-border/50 bg-background/50 p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Rendimento líquido</p>
                <p className="mt-1 currency text-base font-bold leading-none text-income">+{formatCurrency(simResult.netGain)}</p>
              </div>
            </div>

            {/* Chart */}
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Evolução</p>
              <div style={{ width: '100%', height: 180 }}>
                <ResponsiveContainer>
                  <AreaChart data={simChartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                    <defs>
                      <linearGradient id="simGross" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} /><stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} /></linearGradient>
                    </defs>
                    <XAxis dataKey="month" tickFormatter={m => `${Math.round(m / 12)}a`} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" interval="preserveStartEnd" />
                    <YAxis hide domain={[0, 'dataMax']} />
                    <RTooltip
                      formatter={(v: number, n: string) => [formatCurrency(v), n === 'gross' ? 'Investimento' : n === 'invested' ? 'Aportado' : 'Poupança']}
                      labelFormatter={m => `Mês ${m}`}
                      contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }}
                    />
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
              {simResult.gross - simResult.savings > 0.5 && (
                <p className="mt-2 text-[11px] text-muted-foreground">Rende <strong className="text-income">{formatCurrency(simResult.gross - simResult.savings)}</strong> a mais que a poupança no mesmo período. 🚀</p>
              )}
            </div>
            <p className="text-[10px] leading-relaxed text-muted-foreground">Estimativa com a taxa atual constante; impostos calculados pelo prazo total. Rentabilidade passada/estimada não garante resultado futuro.</p>
          </div>

          <DialogFooter><Button onClick={() => setShowSim(false)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
