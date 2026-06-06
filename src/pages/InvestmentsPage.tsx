import { useState } from 'react';
import {
  Plus, TrendingUp, BarChart3, Pencil, ChevronDown, ChevronUp,
  Image as ImageIcon, Trash2, ArrowUpRight, ArrowDownRight,
  Wallet, Target, Sparkles, Percent, Receipt,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  useInvestments,
  useAddInvestment,
  useUpdateInvestment,
  useDeleteInvestment,
  useInvestmentTransactions,
  useAddInvestmentTransaction,
} from '@/hooks/useInvestments';
import { useAccounts } from '@/hooks/useFinanceData';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useSensitiveData } from '@/components/finance/SensitiveData';
import type { Investment } from '@/hooks/useInvestments';

// ─── Constants ────────────────────────────────────────────────────────────────

const INVESTMENT_TYPES = [
  { value: 'cdb',      label: 'CDB',            icon: '🏦' },
  { value: 'lci',      label: 'LCI',            icon: '🏛️' },
  { value: 'lca',      label: 'LCA',            icon: '🌾' },
  { value: 'tesouro',  label: 'Tesouro Direto', icon: '🏛️' },
  { value: 'acoes',    label: 'Ações',           icon: '📈' },
  { value: 'fii',      label: 'FII',             icon: '🏢' },
  { value: 'poupanca', label: 'Poupança',        icon: '🐷' },
  { value: 'caixinha', label: 'Caixinha',        icon: '📦' },
  { value: 'fundo',    label: 'Fundo',           icon: '📊' },
  { value: 'cripto',   label: 'Cripto',          icon: '₿'  },
  { value: 'outro',    label: 'Outro',           icon: '💼' },
];

const TYPE_COLORS: Record<string, string> = {
  cdb: '#10b981', lci: '#06b6d4', lca: '#84cc16',
  tesouro: '#3b82f6', acoes: '#f59e0b', fii: '#8b5cf6',
  poupanca: '#ec4899', caixinha: '#f97316', fundo: '#6366f1',
  cripto: '#ef4444', outro: '#6b7280',
};

const PRESET_COLORS = [
  '#10b981','#06b6d4','#3b82f6','#8b5cf6','#f59e0b',
  '#ef4444','#ec4899','#f97316','#84cc16','#6b7280',
];

const LIQUIDITY_OPTIONS = [
  { value: 'diaria',     label: 'Diária',        badge: 'D+0' },
  { value: 'd+1',        label: 'D+1',           badge: 'D+1' },
  { value: 'd+30',       label: 'D+30',          badge: 'D+30' },
  { value: 'd+360',      label: 'D+360',         badge: 'D+360' },
  { value: 'vencimento', label: 'No vencimento', badge: 'Venc.' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const project = (current: number, annualRate: number, months: number): number =>
  current * Math.pow(1 + annualRate / 100, months / 12);

const liquidityBadge = (liq: string | null) =>
  LIQUIDITY_OPTIONS.find(o => o.value === liq)?.badge ?? 'D+0';

const todayStr = () => new Date().toISOString().slice(0, 10);

// ─── Movement types (aporte / resgate / rendimento / taxa / IR) ───────────────
type MoveType = 'aporte' | 'resgate' | 'rendimento' | 'taxa' | 'ir';

const MOVE_TYPES: {
  value: MoveType;
  label: string;
  verb: string;
  help: string;
  needsAccount: boolean;
  accountLabel: string;
  tone: 'expense' | 'income' | 'warning';
}[] = [
  { value: 'aporte',     label: 'Aporte',     verb: 'Aportar',   help: 'O dinheiro sai da conta e entra no investimento. Baixa do saldo, mas NÃO é um gasto.', needsAccount: true,  accountLabel: 'Conta de origem',  tone: 'expense' },
  { value: 'resgate',    label: 'Resgate',    verb: 'Resgatar',  help: 'O dinheiro volta do investimento para a conta. Entra no saldo, mas NÃO é uma receita.', needsAccount: true,  accountLabel: 'Conta de destino', tone: 'income' },
  { value: 'rendimento', label: 'Rendimento', verb: 'Lançar',    help: 'O investimento valorizou. Aumenta o patrimônio sem mexer na conta.', needsAccount: false, accountLabel: '', tone: 'income' },
  { value: 'taxa',       label: 'Taxa',       verb: 'Lançar',    help: 'Taxa/custo descontado do investimento (não mexe na conta).', needsAccount: false, accountLabel: '', tone: 'warning' },
  { value: 'ir',         label: 'IR',         verb: 'Lançar',    help: 'Imposto de renda descontado do investimento (não mexe na conta).', needsAccount: false, accountLabel: '', tone: 'warning' },
];

const MOVE_ICONS: Record<MoveType, typeof ArrowUpRight> = {
  aporte: ArrowUpRight,
  resgate: ArrowDownRight,
  rendimento: TrendingUp,
  taxa: Percent,
  ir: Receipt,
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function InvestmentsPage() {
  const { maskCurrency, maskText, isVisible } = useSensitiveData();
  const { data: investments = [] } = useInvestments();
  const { data: allTransactions = [] } = useInvestmentTransactions();
  const { data: accounts = [] } = useAccounts();
  const addInvestment   = useAddInvestment();
  const updateInvestment = useUpdateInvestment();
  const deleteInvestment = useDeleteInvestment();
  const addTransaction  = useAddInvestmentTransaction();

  // ── dialog states ──────────────────────────────────────────────────────────
  const [showNewInvestment, setShowNewInvestment] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [selectedInvestment, setSelectedInvestment] = useState<string | null>(null);
  const [expandedProjections, setExpandedProjections] = useState<string | null>(null);

  // ── movement dialog (aporte/resgate/rendimento/taxa/ir) ─────────────────────
  const [movement, setMovement] = useState<{ investmentId: string; type: MoveType } | null>(null);
  const [moveForm, setMoveForm] = useState({ amount: '', accountId: '', date: todayStr(), description: '' });

  // ── new investment form ────────────────────────────────────────────────────
  const [newInv, setNewInv] = useState({
    name: '', type: 'cdb', institution: '', current_value: '',
    annual_rate: '', liquidity: 'diaria', photo_url: '',
  });

  // ── edit form ──────────────────────────────────────────────────────────────
  const [editForm, setEditForm] = useState({
    name: '', institution: '', type: 'cdb', icon: '',
    color: '', annual_rate: '', liquidity: 'diaria', photo_url: '',
  });

  // ── derived totals ─────────────────────────────────────────────────────────
  const totalPatrimony = investments.reduce((s, i) => s + Number(i.current_value), 0);
  const totalInvested  = investments.reduce((s, i) => s + Number(i.total_invested), 0);
  const totalReturn    = totalPatrimony - totalInvested;
  const returnPct      = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;
  const avgRate        = investments.length > 0
    ? investments.reduce((s, i) => s + Number(i.annual_rate ?? 0), 0) / investments.length
    : 0;

  const selectedTxns = selectedInvestment
    ? allTransactions.filter(t => t.investment_id === selectedInvestment)
    : allTransactions;

  const pieData = investments
    .filter(i => Number(i.current_value) > 0)
    .map(i => ({
      id: i.id, name: i.name, value: Number(i.current_value),
      color: i.color ?? TYPE_COLORS[i.type] ?? '#10b981',
      pct: totalPatrimony > 0 ? (Number(i.current_value) / totalPatrimony) * 100 : 0,
      icon: i.icon,
    }));
  const showDonut = pieData.length >= 1 && totalPatrimony > 0;

  // ── handlers ───────────────────────────────────────────────────────────────

  const openEdit = (inv: Investment) => {
    setEditForm({
      name: inv.name,
      institution: inv.institution ?? '',
      type: inv.type ?? 'cdb',
      icon: inv.icon ?? '',
      color: inv.color ?? TYPE_COLORS[inv.type] ?? '#10b981',
      annual_rate: String(inv.annual_rate ?? ''),
      liquidity: inv.liquidity ?? 'diaria',
      photo_url: inv.photo_url ?? '',
    });
    setEditingInvestment(inv);
  };

  const handleSaveEdit = async () => {
    if (!editingInvestment) return;
    try {
      await updateInvestment.mutateAsync({
        id: editingInvestment.id,
        name: editForm.name || editingInvestment.name,
        institution: editForm.institution,
        type: editForm.type,
        icon: editForm.icon || INVESTMENT_TYPES.find(t => t.value === editForm.type)?.icon,
        color: editForm.color,
        annual_rate: parseFloat(editForm.annual_rate) || 0,
        liquidity: editForm.liquidity,
        photo_url: editForm.photo_url || null,
      });
      toast.success('Investimento atualizado!');
      setEditingInvestment(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleNewInvestment = async () => {
    if (!newInv.name.trim()) return toast.error('Informe o nome do investimento');
    try {
      await addInvestment.mutateAsync({
        name: newInv.name.trim(),
        type: newInv.type,
        institution: newInv.institution,
        current_value: parseFloat(newInv.current_value) || 0,
        total_invested: parseFloat(newInv.current_value) || 0,
        icon: INVESTMENT_TYPES.find(t => t.value === newInv.type)?.icon ?? '📈',
        color: TYPE_COLORS[newInv.type] ?? '#10b981',
        annual_rate: parseFloat(newInv.annual_rate) || 0,
        liquidity: newInv.liquidity,
        photo_url: newInv.photo_url || null,
      });
      toast.success('Investimento cadastrado!');
      setShowNewInvestment(false);
      setNewInv({ name: '', type: 'cdb', institution: '', current_value: '', annual_rate: '', liquidity: 'diaria', photo_url: '' });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // ── movement (aporte/resgate/rendimento/taxa/ir) ─────────────────────────────
  const openMovement = (investmentId: string, type: MoveType) => {
    if (!investmentId) return toast.error('Cadastre um ativo primeiro');
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
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ─── Hero Header ──────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-info/[0.06] p-4 shadow-sm sm:rounded-3xl sm:p-6">
        <div className="absolute -top-16 -right-16 w-56 h-56 bg-info/10 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-48 h-24 bg-income/[0.06] blur-2xl rounded-full pointer-events-none" />
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-info/25 to-info/5 flex items-center justify-center shadow-inner border border-info/15 shrink-0">
              <BarChart3 className="w-6 h-6 sm:w-7 sm:h-7 text-info" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-none flex items-center gap-2">
                Investimentos
                <Sparkles className="w-4 h-4 text-info opacity-60 shrink-0" />
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1.5">
                Gestão patrimonial — {investments.length} ativo{investments.length !== 1 ? 's' : ''} cadastrado{investments.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <Button
            onClick={() => setShowNewInvestment(true)}
            className="w-full sm:w-auto shrink-0 gap-2 bg-info hover:bg-info/90 text-white shadow-md shadow-info/20"
            data-tutorial-target="new-investment"
          >
            <Plus className="w-4 h-4" /> Novo Ativo
          </Button>
        </div>

        {/* Stat chips */}
        <div className="relative z-10 flex flex-wrap gap-2 mt-4">
          <div className="flex items-center gap-1.5 rounded-full bg-background/70 border border-border/60 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm">
            <Wallet className="w-3 h-3 text-info" />
            <span className="text-muted-foreground">Patrimônio:</span>
            <span className="text-foreground">{maskCurrency(formatCurrency(totalPatrimony))}</span>
          </div>
          <div className={cn(
            'flex items-center gap-1.5 rounded-full bg-background/70 border border-border/60 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm',
          )}>
            <TrendingUp className="w-3 h-3 text-income" />
            <span className="text-muted-foreground">Rendimento:</span>
            <span className={totalReturn >= 0 ? 'text-income' : 'text-expense'}>
              {totalReturn >= 0 ? '+' : ''}{maskCurrency(formatCurrency(totalReturn))}
              {totalInvested > 0 && isVisible && (
                <span className="text-muted-foreground font-normal ml-1">({returnPct >= 0 ? '+' : ''}{returnPct.toFixed(2)}%)</span>
              )}
            </span>
          </div>
          {avgRate > 0 && (
            <div className="flex items-center gap-1.5 rounded-full bg-background/70 border border-border/60 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm">
              <Target className="w-3 h-3 text-primary" />
              <span className="text-muted-foreground">Média:</span>
              <span className="text-foreground">{isVisible ? `${avgRate.toFixed(1)}% a.a.` : maskText('00%')}</span>
            </div>
          )}
        </div>
      </div>

      {/* ─── How to register movements ────────────────────────────────────── */}
      <div className="rounded-xl border border-border/60 bg-muted/30 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <BarChart3 className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Como registrar movimentações?</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Use <strong>Aportar</strong> e <strong>Resgatar</strong> direto no ativo. O aporte baixa do saldo da conta
              (mas <strong>não conta como gasto</strong>) e o resgate volta pra conta. O valor do investimento é atualizado automaticamente.
            </p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0 sm:flex-col lg:flex-row">
          <button
            onClick={() => openMovement(investments[0]?.id ?? '', 'aporte')}
            disabled={investments.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-expense/10 text-expense text-xs font-semibold hover:bg-expense/20 transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowUpRight className="w-3.5 h-3.5" /> Registrar Aporte
          </button>
          <button
            onClick={() => openMovement(investments[0]?.id ?? '', 'resgate')}
            disabled={investments.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-income/10 text-income text-xs font-semibold hover:bg-income/20 transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowDownRight className="w-3.5 h-3.5" /> Registrar Resgate
          </button>
        </div>
      </div>

      {/* ─── KPI Cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="stat-card">
          <p className="text-xs text-muted-foreground mb-1">Patrimônio Total</p>
          <p className="truncate text-xl font-bold text-info">{maskCurrency(formatCurrency(totalPatrimony))}</p>
          <p className="text-xs text-muted-foreground mt-1">{investments.length} ativo{investments.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground mb-1">Total Investido</p>
          <p className="truncate text-xl font-bold">{maskCurrency(formatCurrency(totalInvested))}</p>
          <p className="text-xs text-muted-foreground mt-1">Custo de aquisição</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground mb-1">Rendimento Líquido</p>
          <p className={cn('text-xl font-bold truncate', totalReturn >= 0 ? 'text-income' : 'text-expense')}>
            {totalReturn >= 0 ? '+' : ''}{maskCurrency(formatCurrency(totalReturn))}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {isVisible ? `${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(2)}%` : maskText('00%')}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground mb-1">Taxa Média</p>
          <p className="text-xl font-bold text-primary">
            {isVisible && avgRate > 0 ? `${avgRate.toFixed(1)}%` : avgRate > 0 ? maskText('00%') : '—'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">ao ano</p>
        </div>
      </div>

      {/* ─── Allocation Donut ─────────────────────────────────────────────── */}
      {showDonut && (
        <div className="stat-card">
          <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-info/10 flex items-center justify-center">
              <BarChart3 className="w-3 h-3 text-info" />
            </div>
            Alocação do Portfólio
          </h3>
          <div className="flex flex-col sm:flex-row gap-6 items-center">
            <div className="relative shrink-0" style={{ width: 200, height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData} cx="50%" cy="50%"
                    innerRadius={62} outerRadius={90}
                    paddingAngle={2} dataKey="value" strokeWidth={0}
                  >
                    {pieData.map(entry => <Cell key={entry.id} fill={entry.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Patrimônio</p>
                <p className="text-sm font-bold leading-tight mt-0.5">{maskCurrency(formatCurrency(totalPatrimony))}</p>
              </div>
            </div>
            <div className="flex-1 space-y-2.5 w-full">
              {pieData.map(item => (
                <div key={item.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm">{item.icon}</span>
                      <span className="font-medium truncate">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-2">
                      <span className="text-muted-foreground">{isVisible ? `${item.pct.toFixed(1)}%` : maskText('00%')}</span>
                      <span className="font-semibold tabular-nums">{maskCurrency(formatCurrency(item.value))}</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${item.pct}%`, backgroundColor: item.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Investment Cards ─────────────────────────────────────────────── */}
      {investments.length === 0 ? (
        <div className="stat-card py-16 text-center">
          <TrendingUp className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="font-medium text-muted-foreground">Nenhum investimento cadastrado</p>
          <p className="text-sm text-muted-foreground mt-1">Clique em "Novo Ativo" para começar</p>
          <Button onClick={() => setShowNewInvestment(true)} className="mt-4" variant="outline">
            <Plus className="w-4 h-4 mr-1" /> Novo Ativo
          </Button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {investments.map(inv => {
            const typeInfo  = INVESTMENT_TYPES.find(t => t.value === inv.type);
            const returnVal = Number(inv.current_value) - Number(inv.total_invested);
            const pct       = Number(inv.total_invested) > 0 ? (returnVal / Number(inv.total_invested)) * 100 : 0;
            const isSelected = selectedInvestment === inv.id;
            const annualRate = Number(inv.annual_rate) || 0;
            const hasRate    = annualRate > 0;
            const showProj   = expandedProjections === inv.id;
            const cur        = Number(inv.current_value);
            const cardColor  = inv.color ?? TYPE_COLORS[inv.type] ?? '#10b981';

            return (
              <div
                key={inv.id}
                className={cn(
                  'stat-card flex flex-col gap-0 overflow-hidden transition-all',
                  isSelected ? 'ring-2 ring-primary' : 'hover:ring-1 hover:ring-border',
                )}
              >
                {/* Photo banner */}
                {inv.photo_url && (
                  <div className="h-24 -mx-4 -mt-4 mb-3 overflow-hidden rounded-t-xl">
                    <img src={inv.photo_url} alt={inv.name} className="w-full h-full object-cover" />
                  </div>
                )}

                {/* Card header */}
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0"
                    onClick={() => setSelectedInvestment(isSelected ? null : inv.id)}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                      style={{ backgroundColor: cardColor + '22' }}
                    >
                      {inv.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm leading-tight truncate">{inv.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {typeInfo?.label}{inv.institution ? ` · ${inv.institution}` : ''}
                      </p>
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex gap-0.5 shrink-0 ml-1">
                    <button
                      onClick={e => { e.stopPropagation(); openEdit(inv); }}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Editar / Personalizar"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); deleteInvestment.mutate(inv.id); }}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Values */}
                <div className="space-y-1.5 flex-1">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-muted-foreground">Valor atual</span>
                    <span className="font-bold text-base">{maskCurrency(formatCurrency(cur))}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Investido</span>
                    <span>{maskCurrency(formatCurrency(Number(inv.total_invested)))}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Rendimento</span>
                    <span className={returnVal >= 0 ? 'text-income font-medium' : 'text-expense font-medium'}>
                      {returnVal >= 0 ? '+' : ''}{maskCurrency(formatCurrency(returnVal))}
                      {Number(inv.total_invested) > 0 && (
                        <span className="text-muted-foreground ml-1">
                          ({isVisible ? `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%` : maskText('0%')})
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3 h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.min(100, (cur / (totalPatrimony || 1)) * 100)}%`, backgroundColor: cardColor }}
                  />
                </div>

                {/* Tags row */}
                <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                  <span
                    className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: cardColor + '22', color: cardColor }}
                  >
                    {liquidityBadge(inv.liquidity)}
                  </span>
                  {hasRate && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-income/10 text-income font-medium">
                      {annualRate}% a.a.
                    </span>
                  )}
                </div>

                {/* Projections (expandable) */}
                {hasRate && cur > 0 && (
                  <div className="mt-2.5">
                    <button
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
                      onClick={e => { e.stopPropagation(); setExpandedProjections(showProj ? null : inv.id); }}
                    >
                      <TrendingUp className="w-3 h-3" />
                      Projeções
                      {showProj ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
                    </button>
                    {showProj && (
                      <div className="mt-2 space-y-1.5">
                        {[
                          { label: '30 dias',  months: 1  },
                          { label: '3 meses',  months: 3  },
                          { label: '6 meses',  months: 6  },
                          { label: '12 meses', months: 12 },
                          { label: '24 meses', months: 24 },
                          { label: '5 anos',   months: 60 },
                        ].map(({ label, months }) => {
                          const proj = project(cur, annualRate, months);
                          const gain = proj - cur;
                          const gainPct = (gain / cur) * 100;
                          return (
                            <div key={label} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                              <span className="text-[11px] text-muted-foreground font-medium w-16 shrink-0">{label}</span>
                              <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden mx-3">
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${Math.min(100, gainPct * 2)}%`, backgroundColor: cardColor }}
                                />
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-xs font-bold">{maskCurrency(formatCurrency(proj))}</p>
                                <p className="text-[10px] text-income">+{maskCurrency(formatCurrency(gain))}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Quick action buttons */}
                <div className="flex gap-2 mt-3 pt-3 border-t border-border/40">
                  <button
                    onClick={e => { e.stopPropagation(); openMovement(inv.id, 'aporte'); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-expense/8 text-expense text-[11px] font-semibold hover:bg-expense/15 transition-colors"
                    title="Aportar (sai da conta, vira patrimônio)"
                  >
                    <ArrowUpRight className="w-3 h-3" /> Aportar
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); openMovement(inv.id, 'resgate'); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-income/8 text-income text-[11px] font-semibold hover:bg-income/15 transition-colors"
                    title="Resgatar (volta para a conta)"
                  >
                    <ArrowDownRight className="w-3 h-3" /> Resgatar
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); openMovement(inv.id, 'rendimento'); }}
                    className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-info/8 text-info text-[11px] font-semibold hover:bg-info/15 transition-colors"
                    title="Lançar rendimento / taxa / IR"
                  >
                    <TrendingUp className="w-3 h-3" /> Rend.
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Transaction History ──────────────────────────────────────────── */}
      {selectedTxns.length > 0 && (
        <div className="stat-card">
          <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center">
              <BarChart3 className="w-3 h-3 text-primary" />
            </div>
            {selectedInvestment
              ? `Histórico — ${investments.find(i => i.id === selectedInvestment)?.name}`
              : 'Histórico de movimentações'}
          </h3>
          <div className="space-y-2">
            {selectedTxns.slice(0, 20).map(t => {
              const isPositive = t.type === 'aporte' || t.type === 'rendimento';
              const typeLabel: Record<string, string> = {
                aporte: 'Aporte', resgate: 'Resgate', rendimento: 'Rendimento', taxa: 'Taxa', ir: 'IR',
              };
              return (
                <div key={t.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[11px]',
                      t.type === 'aporte' ? 'bg-expense/10 text-expense' :
                      t.type === 'resgate' ? 'bg-income/10 text-income' :
                      t.type === 'rendimento' ? 'bg-income/10 text-income' :
                      'bg-warning/10 text-warning',
                    )}>
                      {t.type === 'aporte' ? '↑' : t.type === 'resgate' ? '↓' : t.type === 'rendimento' ? '📈' : '💸'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t.description || typeLabel[t.type] || t.type}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(t.date)}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={cn('text-sm font-semibold tabular-nums', isPositive ? 'text-income' : 'text-expense')}>
                      {isPositive ? '+' : '−'}{maskCurrency(formatCurrency(Number(t.amount)))}
                    </span>
                    <p className="text-[10px] text-muted-foreground capitalize">{typeLabel[t.type] || t.type}</p>
                  </div>
                </div>
              );
            })}
          </div>
          {selectedInvestment && (
            <button
              onClick={() => setSelectedInvestment(null)}
              className="mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Ver todos os ativos →
            </button>
          )}
        </div>
      )}

      {/* ── Edit Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={!!editingInvestment} onOpenChange={o => !o && setEditingInvestment(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>Personalizar Investimento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Nome</Label>
                <Input
                  value={editForm.name}
                  onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Ex: CDB Nubank 100% CDI"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Instituição</Label>
                <Input
                  value={editForm.institution}
                  onChange={e => setEditForm(p => ({ ...p, institution: e.target.value }))}
                  placeholder="Nubank, XP..."
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Tipo</Label>
                <Select value={editForm.type} onValueChange={v => setEditForm(p => ({ ...p, type: v, icon: p.icon || (INVESTMENT_TYPES.find(t => t.value === v)?.icon ?? '') }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INVESTMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Ícone (emoji)</Label>
                <Input
                  value={editForm.icon}
                  onChange={e => setEditForm(p => ({ ...p, icon: e.target.value }))}
                  placeholder="📈" maxLength={4}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Liquidez</Label>
                <Select value={editForm.liquidity} onValueChange={v => setEditForm(p => ({ ...p, liquidity: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LIQUIDITY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Taxa de rendimento (% ao ano)</Label>
                <Input
                  type="number" step="0.1" min={0}
                  value={editForm.annual_rate}
                  onChange={e => setEditForm(p => ({ ...p, annual_rate: e.target.value }))}
                  placeholder="Ex: 12.5"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Usada para calcular projeções de 30 dias até 5 anos no card
                </p>
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Cor</Label>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      className={cn('w-7 h-7 rounded-full transition-all', editForm.color === c ? 'ring-2 ring-offset-2 ring-foreground scale-110' : 'hover:scale-105')}
                      style={{ backgroundColor: c }}
                      onClick={() => setEditForm(p => ({ ...p, color: c }))}
                    />
                  ))}
                  <Input
                    type="color"
                    value={editForm.color || '#10b981'}
                    onChange={e => setEditForm(p => ({ ...p, color: e.target.value }))}
                    className="w-8 h-7 p-0.5 rounded cursor-pointer"
                  />
                </div>
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5" /> Foto / imagem (URL opcional)
                </Label>
                <Input
                  value={editForm.photo_url}
                  onChange={e => setEditForm(p => ({ ...p, photo_url: e.target.value }))}
                  placeholder="https://..."
                />
                {editForm.photo_url && (
                  <img
                    src={editForm.photo_url} alt="preview"
                    className="mt-2 h-16 w-full object-cover rounded-lg"
                    onError={e => (e.currentTarget.style.display = 'none')}
                  />
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingInvestment(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={updateInvestment.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── New Investment Dialog ────────────────────────────────────────── */}
      <Dialog open={showNewInvestment} onOpenChange={setShowNewInvestment}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo Investimento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Nome *</Label>
              <Input
                placeholder="Ex: CDB Nubank 100% CDI"
                value={newInv.name}
                onChange={e => setNewInv(p => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Tipo</Label>
                <Select value={newInv.type} onValueChange={v => setNewInv(p => ({ ...p, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INVESTMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Instituição</Label>
                <Input
                  placeholder="Nubank, XP..."
                  value={newInv.institution}
                  onChange={e => setNewInv(p => ({ ...p, institution: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Valor que tenho hoje (R$)</Label>
                <Input
                  type="number" placeholder="0,00"
                  value={newInv.current_value}
                  onChange={e => setNewInv(p => ({ ...p, current_value: e.target.value }))}
                />
                <p className="text-[11px] text-muted-foreground mt-1">Saldo atual da caixinha/ativo. Depois é só usar Aportar/Resgatar.</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Rentabilidade (% a.a.)</Label>
                <Input
                  type="number" step="0.1" placeholder="Ex: 12.5"
                  value={newInv.annual_rate}
                  onChange={e => setNewInv(p => ({ ...p, annual_rate: e.target.value }))}
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Liquidez</Label>
                <Select value={newInv.liquidity} onValueChange={v => setNewInv(p => ({ ...p, liquidity: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LIQUIDITY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewInvestment(false)}>Cancelar</Button>
            <Button onClick={handleNewInvestment} disabled={addInvestment.isPending}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Movement Dialog (aporte/resgate/rendimento/taxa/ir) ──────────────── */}
      <Dialog open={!!movement} onOpenChange={o => !o && setMovement(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto">
          {movement && (() => {
            const cfg = MOVE_TYPES.find(t => t.value === movement.type)!;
            const Icon = MOVE_ICONS[movement.type];
            const inv = investments.find(i => i.id === movement.investmentId);
            const toneClass = cfg.tone === 'expense' ? 'text-expense' : cfg.tone === 'income' ? 'text-income' : 'text-warning';
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Icon className={cn('w-5 h-5', toneClass)} />
                    {cfg.verb}{inv ? ` · ${inv.name}` : ''}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {/* Tipo de movimentação */}
                  <div>
                    <Label className="text-xs text-muted-foreground">Tipo de movimentação</Label>
                    <div className="grid grid-cols-5 gap-1.5 mt-1.5">
                      {MOVE_TYPES.map(t => {
                        const TIcon = MOVE_ICONS[t.value];
                        const active = movement.type === t.value;
                        return (
                          <button
                            key={t.value}
                            type="button"
                            onClick={() => setMovement(m => (m ? { ...m, type: t.value } : m))}
                            className={cn(
                              'flex flex-col items-center gap-1 rounded-lg border py-2 text-[10px] font-semibold transition-all',
                              active ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 text-muted-foreground hover:bg-muted',
                            )}
                          >
                            <TIcon className="w-3.5 h-3.5" />
                            {t.label}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">{cfg.help}</p>
                  </div>

                  {/* Ativo */}
                  <div>
                    <Label className="text-xs text-muted-foreground">Investimento</Label>
                    <Select value={movement.investmentId} onValueChange={v => setMovement(m => (m ? { ...m, investmentId: v } : m))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {investments.map(i => <SelectItem key={i.id} value={i.id}>{i.icon} {i.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Valor */}
                  <div>
                    <Label className="text-xs text-muted-foreground">Valor (R$)</Label>
                    <Input
                      type="number" inputMode="decimal" step="0.01" min={0} placeholder="0,00"
                      value={moveForm.amount}
                      onChange={e => setMoveForm(p => ({ ...p, amount: e.target.value }))}
                      autoFocus
                    />
                  </div>

                  {/* Conta (apenas aporte/resgate) */}
                  {cfg.needsAccount && (
                    <div>
                      <Label className="text-xs text-muted-foreground">{cfg.accountLabel}</Label>
                      <Select value={moveForm.accountId} onValueChange={v => setMoveForm(p => ({ ...p, accountId: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
                        <SelectContent>
                          {accounts.filter(a => !a.archived).map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Data */}
                  <div>
                    <Label className="text-xs text-muted-foreground">Data</Label>
                    <Input
                      type="date"
                      value={moveForm.date}
                      onChange={e => setMoveForm(p => ({ ...p, date: e.target.value }))}
                    />
                  </div>

                  {/* Descrição */}
                  <div>
                    <Label className="text-xs text-muted-foreground">Descrição (opcional)</Label>
                    <Input
                      placeholder={cfg.label}
                      value={moveForm.description}
                      onChange={e => setMoveForm(p => ({ ...p, description: e.target.value }))}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setMovement(null)}>Cancelar</Button>
                  <Button onClick={handleMovement} disabled={addTransaction.isPending}>
                    {addTransaction.isPending ? 'Salvando...' : cfg.verb}
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

    </div>
  );
}
