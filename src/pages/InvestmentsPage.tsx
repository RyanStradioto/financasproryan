import { useState } from 'react';
import {
  Plus, TrendingUp, ArrowUpCircle, ArrowDownCircle, Trash2,
  BarChart3, Pencil, ChevronDown, ChevronUp, Image as ImageIcon,
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
  useAddInvestmentTransaction,
  useInvestmentTransactions,
} from '@/hooks/useInvestments';
import { useAccounts } from '@/hooks/useFinanceData';
import { formatCurrency, formatDate } from '@/lib/format';
import { toast } from 'sonner';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useSensitiveData } from '@/components/finance/SensitiveData';
import type { Investment } from '@/hooks/useInvestments';

// ─── Constants ────────────────────────────────────────────────────────────────

const INVESTMENT_TYPES = [
  { value: 'cdb',      label: 'CDB',           icon: '🏦' },
  { value: 'lci',      label: 'LCI',           icon: '🏛️' },
  { value: 'lca',      label: 'LCA',           icon: '🌾' },
  { value: 'tesouro',  label: 'Tesouro Direto', icon: '🏛️' },
  { value: 'acoes',    label: 'Ações',          icon: '📈' },
  { value: 'fii',      label: 'FII',            icon: '🏢' },
  { value: 'poupanca', label: 'Poupança',       icon: '🐷' },
  { value: 'caixinha', label: 'Caixinha',       icon: '📦' },
  { value: 'fundo',    label: 'Fundo',          icon: '📊' },
  { value: 'cripto',   label: 'Cripto',         icon: '₿'  },
  { value: 'outro',    label: 'Outro',          icon: '💼' },
];

const TYPE_COLORS: Record<string, string> = {
  cdb: '#10b981',
  lci: '#06b6d4',
  lca: '#84cc16',
  tesouro: '#3b82f6',
  acoes: '#f59e0b',
  fii: '#8b5cf6',
  poupanca: '#ec4899',
  caixinha: '#f97316',
  fundo: '#6366f1',
  cripto: '#ef4444',
  outro: '#6b7280',
};

const PRESET_COLORS = [
  '#10b981','#06b6d4','#3b82f6','#8b5cf6','#f59e0b',
  '#ef4444','#ec4899','#f97316','#84cc16','#6b7280',
];

const LIQUIDITY_OPTIONS = [
  { value: 'diaria',      label: 'Diária',        badge: 'D+0' },
  { value: 'd+1',         label: 'D+1',           badge: 'D+1' },
  { value: 'd+30',        label: 'D+30',          badge: 'D+30' },
  { value: 'd+360',       label: 'D+360',         badge: 'D+360' },
  { value: 'vencimento',  label: 'No vencimento', badge: 'Venc.' },
];

const TYPES_WITH_ACCOUNT = ['aporte', 'resgate'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Compound growth: current * (1 + rate/100) ^ (months/12) */
const project = (current: number, annualRate: number, months: number): number =>
  current * Math.pow(1 + annualRate / 100, months / 12);

const liquidityBadge = (liq: string | null) =>
  LIQUIDITY_OPTIONS.find(o => o.value === liq)?.badge ?? 'D+0';

// ─── Component ────────────────────────────────────────────────────────────────

export default function InvestmentsPage() {
  const { maskCurrency, maskText, isVisible } = useSensitiveData();
  const { data: investments = [] } = useInvestments();
  const { data: accounts = [] } = useAccounts();
  const { data: allTransactions = [] } = useInvestmentTransactions();
  const addInvestment = useAddInvestment();
  const updateInvestment = useUpdateInvestment();
  const deleteInvestment = useDeleteInvestment();
  const addTransaction = useAddInvestmentTransaction();

  // ── dialog states ──────────────────────────────────────────────────────────
  const [showNewInvestment, setShowNewInvestment] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [showAporte, setShowAporte] = useState<string | null>(null);
  const [selectedInvestment, setSelectedInvestment] = useState<string | null>(null);
  const [expandedProjections, setExpandedProjections] = useState<string | null>(null);

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

  // ── movimentação form ──────────────────────────────────────────────────────
  const [aporteData, setAporteData] = useState<{
    amount: string; date: string;
    type: 'aporte' | 'resgate' | 'rendimento' | 'taxa' | 'ir';
    account_id: string; description: string;
  }>({ amount: '', date: new Date().toISOString().split('T')[0], type: 'aporte', account_id: '', description: '' });

  // ── derived totals ─────────────────────────────────────────────────────────
  const totalPatrimony  = investments.reduce((s, i) => s + Number(i.current_value), 0);
  const totalInvested   = investments.reduce((s, i) => s + Number(i.total_invested), 0);
  const totalReturn     = totalPatrimony - totalInvested;
  const returnPct       = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;

  const selectedTxns = selectedInvestment ? allTransactions.filter((t) => t.investment_id === selectedInvestment) : allTransactions;

  const openMovimentacao = (id: string, type: 'aporte' | 'resgate' | 'rendimento' | 'taxa' | 'ir') => {
    setAporteData((p) => ({ ...p, type }));
    setShowAporte(id);
  };

  const openEdit = (invId: string) => {
    const inv = investmentViews.find((i) => i.id === invId);
    if (!inv) return;

    setEditInv({
      id: inv.id,
      name: inv.name,
      type: inv.type,
      institution: inv.institution || '',
      color: inv.color || TYPE_COLORS[inv.type] || TYPE_COLORS.outro,
      annualRate: String(inv.profile.annualRate),
      liquidity: inv.profile.liquidity,
      monthlyContribution: String(inv.profile.monthlyContribution || 0),
    });
    setShowEditInvestment(inv.id);
  };

  const pieData = investments
    .filter(i => Number(i.current_value) > 0)
    .map(i => ({
      id: i.id, name: i.name, value: Number(i.current_value),
      color: i.color ?? TYPE_COLORS[i.type] ?? '#10b981',
      pct: totalPatrimony > 0 ? (Number(i.current_value) / totalPatrimony) * 100 : 0,
      icon: i.icon,
    }));
  const showDonut = pieData.length >= 1 && totalPatrimony > 0;

  // movimentação helpers
  const showAccountSelector = TYPES_WITH_ACCOUNT.includes(aporteData.type);
  const accountLabel = aporteData.type === 'aporte' ? 'Debitar da conta (opcional)' : 'Depositar na conta (opcional)';
  const previewAmount = parseFloat(aporteData.amount) || 0;
  const showPreview = showAccountSelector && !!aporteData.account_id && previewAmount > 0;
  const selectedAccount = accounts.find(a => a.id === aporteData.account_id);

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

  const handleAporte = async () => {
    if (!aporteData.amount || !showAporte) return;

    try {
      await addTransaction.mutateAsync({
        investment_id: showAporte,
        type: aporteData.type,
        amount: parseFloat(aporteData.amount),
        date: aporteData.date,
        account_id: aporteData.account_id || null,
        description: aporteData.description || (aporteData.type === 'aporte' ? 'Aporte' : 'Movimentacao'),
      });
      const label = { aporte: 'Aporte', resgate: 'Resgate', rendimento: 'Rendimento', taxa: 'Taxa', ir: 'IR' }[aporteData.type];
      toast.success(`${label} registrado ✅`);
      setShowAporte(null);
      setAporteData({
        amount: '',
        date: new Date().toISOString().split('T')[0],
        type: 'aporte',
        account_id: '',
        description: '',
      });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Investimentos</h1>
          <p className="text-sm text-muted-foreground">Gestão patrimonial — aportes não são despesas</p>
        </div>
        <Button onClick={() => setShowNewInvestment(true)} data-tutorial-target="new-investment">
          <Plus className="w-4 h-4 mr-1" /> Novo Ativo
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card">
          <p className="text-xs text-muted-foreground mb-1">Patrimonio Total</p>
          <p className="text-xl font-bold text-primary">{maskCurrency(formatCurrency(totalPatrimony))}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground mb-1">Total Investido</p>
          <p className="text-xl font-bold">{maskCurrency(formatCurrency(totalInvested))}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground mb-1">Rendimento</p>
          <p className={cn('text-xl font-bold', totalReturn >= 0 ? 'text-income' : 'text-expense')}>
            {totalReturn >= 0 ? '+' : ''}{maskCurrency(formatCurrency(totalReturn))}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground mb-1">Retorno %</p>
          <p className={cn('text-xl font-bold', returnPct >= 0 ? 'text-income' : 'text-expense')}>
            {isVisible ? `${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(2)}%` : maskText('12,34%')}
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3 text-sm flex items-start gap-3">
        <BarChart3 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        <span className="text-muted-foreground">
          <span className="font-medium text-primary">Lógica patrimonial ativa — </span>
          Aportes movem dinheiro da conta para o investimento. Resgates fazem o caminho inverso. Nunca são despesas.
        </span>
      </div>

      {/* Donut */}
      {showDonut && (
        <div className="stat-card">
          <h3 className="font-semibold text-sm mb-4">Alocação do Portfólio</h3>
          <div className="flex flex-col sm:flex-row gap-6 items-center">
            <div className="relative shrink-0" style={{ width: 200, height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={62} outerRadius={90} paddingAngle={2} dataKey="value" strokeWidth={0}>
                    {pieData.map((entry) => <Cell key={entry.id} fill={entry.color} />)}
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
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${item.pct}%`, backgroundColor: item.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Investment Cards */}
      {investments.length === 0 ? (
        <div className="stat-card py-16 text-center">
          <TrendingUp className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="font-medium text-muted-foreground">Nenhum investimento cadastrado</p>
          <p className="text-sm text-muted-foreground mt-1">Clique em "Novo Ativo" para começar</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {investments.map(inv => {
            const typeInfo  = INVESTMENT_TYPES.find(t => t.value === inv.type);
            const returnVal = Number(inv.current_value) - Number(inv.total_invested);
            const pct       = Number(inv.total_invested) > 0 ? (returnVal / Number(inv.total_invested)) * 100 : 0;
            const isSelected    = selectedInvestment === inv.id;
            const annualRate    = Number(inv.annual_rate) || 0;
            const hasRate       = annualRate > 0;
            const showProj      = expandedProjections === inv.id;
            const cur           = Number(inv.current_value);
            const cardColor     = inv.color ?? TYPE_COLORS[inv.type] ?? '#10b981';

            return (
              <div
                key={inv.id}
                className={`stat-card flex flex-col gap-0 overflow-hidden transition-all ${isSelected ? 'ring-2 ring-primary' : 'hover:ring-1 hover:ring-border'}`}
              >
                {/* Photo banner (if any) */}
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
                  <div className="flex gap-0.5 shrink-0 ml-1">
                    <button onClick={(e) => { e.stopPropagation(); openEdit(inv); }}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Editar">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setShowAporte(inv.id); setAporteData(p => ({ ...p, type: 'aporte' })); }}
                      className="p-1.5 rounded-lg hover:bg-income/10 text-income transition-colors" title="Aporte">
                      <ArrowUpCircle className="w-4 h-4" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setShowAporte(inv.id); setAporteData(p => ({ ...p, type: 'resgate' })); }}
                      className="p-1.5 rounded-lg hover:bg-expense/10 text-expense transition-colors" title="Resgate">
                      <ArrowDownCircle className="w-4 h-4" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); deleteInvestment.mutate(inv.id); }}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
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
                    <span>{maskCurrency(formatCurrency(inv.invested))}</span>
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
                  <div className="h-full rounded-full" style={{
                    width: `${Math.min(100, (cur / (totalPatrimony || 1)) * 100)}%`,
                    backgroundColor: cardColor,
                  }} />
                </div>

                {/* Tags row */}
                <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: cardColor + '22', color: cardColor }}>
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
                      onClick={(e) => { e.stopPropagation(); setExpandedProjections(showProj ? null : inv.id); }}
                    >
                      <TrendingUp className="w-3 h-3" />
                      Projeções
                      {showProj ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
                    </button>
                    {showProj && (
                      <div className="mt-2 grid grid-cols-3 gap-1.5">
                        {[
                          { label: '30 dias',  months: 1  },
                          { label: '6 meses',  months: 6  },
                          { label: '12 meses', months: 12 },
                        ].map(({ label, months }) => {
                          const proj = project(cur, annualRate, months);
                          const gain = proj - cur;
                          return (
                            <div key={label} className="rounded-lg bg-muted/40 p-2 text-center">
                              <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
                              <p className="text-xs font-bold">{maskCurrency(formatCurrency(proj))}</p>
                              <p className="text-[10px] text-income">+{maskCurrency(formatCurrency(gain))}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Transaction History */}
      {selectedTxns.length > 0 && (
        <div className="stat-card">
          <h3 className="font-semibold text-sm mb-4">
            {selectedInvestment ? `Historico - ${investmentViews.find((i) => i.id === selectedInvestment)?.name}` : 'Historico de movimentacoes'}
          </h3>
          <div className="space-y-2">
            {selectedTxns.slice(0, 20).map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    t.type === 'aporte' ? 'bg-primary' : t.type === 'resgate' ? 'bg-expense' :
                    t.type === 'rendimento' ? 'bg-income' : 'bg-warning'
                  }`} />
                  <div>
                    <p className="text-sm font-medium">{t.description || t.type}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(t.date)}</p>
                  </div>
                </div>
                <span className={`text-sm font-semibold currency ${
                  t.type === 'aporte' || t.type === 'rendimento' ? 'text-income' : 'text-expense'
                }`}>
                  {t.type === 'aporte' || t.type === 'rendimento' ? '+' : '−'}{maskCurrency(formatCurrency(Number(t.amount)))}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Edit Dialog ────────────────────────────────────────────────────── */}
      <Dialog open={!!editingInvestment} onOpenChange={o => !o && setEditingInvestment(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>Personalizar Investimento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Nome</Label>
                <Input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: CDB Nubank 100% CDI" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Instituição</Label>
                <Input value={editForm.institution} onChange={e => setEditForm(p => ({ ...p, institution: e.target.value }))} placeholder="Nubank, XP..." />
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
                <Input value={editForm.icon} onChange={e => setEditForm(p => ({ ...p, icon: e.target.value }))} placeholder="📈" maxLength={4} />
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
                  Usado para calcular projeções de 30 dias, 6 meses e 12 meses no card
                </p>
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Cor</Label>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      className={`w-7 h-7 rounded-full transition-all ${editForm.color === c ? 'ring-2 ring-offset-2 ring-foreground scale-110' : 'hover:scale-105'}`}
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
                  <img src={editForm.photo_url} alt="preview" className="mt-2 h-16 w-full object-cover rounded-lg" onError={(e) => (e.currentTarget.style.display = 'none')} />
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

      {/* ── New Investment Dialog ──────────────────────────────────────────── */}
      <Dialog open={showNewInvestment} onOpenChange={setShowNewInvestment}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo Investimento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Nome *</Label>
              <Input placeholder="Ex: CDB Nubank 100% CDI" value={newInv.name} onChange={e => setNewInv(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Tipo</Label>
                <Select value={newInv.type} onValueChange={v => setNewInv(p => ({ ...p, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{INVESTMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Instituição</Label>
                <Input placeholder="Nubank, XP..." value={newInv.institution} onChange={e => setNewInv(p => ({ ...p, institution: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Valor atual (R$)</Label>
                <Input type="number" placeholder="0,00" value={newInv.current_value} onChange={e => setNewInv(p => ({ ...p, current_value: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Rentabilidade (% a.a.)</Label>
                <Input type="number" step="0.1" placeholder="Ex: 12.5" value={newInv.annual_rate} onChange={e => setNewInv(p => ({ ...p, annual_rate: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Liquidez</Label>
                <Select value={newInv.liquidity} onValueChange={v => setNewInv(p => ({ ...p, liquidity: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LIQUIDITY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
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

      {/* ── Movimentação Dialog ────────────────────────────────────────────── */}
      <Dialog open={!!showAporte} onOpenChange={o => !o && setShowAporte(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Movimentacao Patrimonial</DialogTitle>
          </DialogHeader>
          <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-xs text-muted-foreground mb-2">
            ℹ️ Aportes e resgates <strong>não são despesas</strong> — transferem patrimônio entre conta e investimento.
          </div>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Tipo</Label>
              <Select value={aporteData.type} onValueChange={(v: string) => setAporteData(p => ({ ...p, type: v as typeof aporteData.type, account_id: '' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aporte">⬆️ Aporte — depositar no investimento</SelectItem>
                  <SelectItem value="resgate">⬇️ Resgate — retirar do investimento</SelectItem>
                  <SelectItem value="rendimento">📈 Rendimento — atualizar valor</SelectItem>
                  <SelectItem value="taxa">💸 Taxa / custo</SelectItem>
                  <SelectItem value="ir">🏛️ Imposto de renda (IR)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Valor (R$)</Label>
                <Input type="number" step="0.01" placeholder="0,00" value={aporteData.amount} onChange={e => setAporteData(p => ({ ...p, amount: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Data</Label>
                <Input type="date" value={aporteData.date} onChange={e => setAporteData(p => ({ ...p, date: e.target.value }))} style={{ fontSize: '16px' }} />
              </div>
            </div>
            {showAccountSelector && (
              <div>
                <Label className="text-xs text-muted-foreground">{accountLabel}</Label>
                <Select value={aporteData.account_id || '__none__'} onValueChange={v => setAporteData(p => ({ ...p, account_id: v === '__none__' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar conta..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sem conta (só registrar no investimento)</SelectItem>
                    {accounts.filter(a => !a.archived).map(a => <SelectItem key={a.id} value={a.id}>{a.icon} {a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {showPreview && (
              <div className={`rounded-lg px-3 py-2 text-sm border flex items-center gap-2 ${aporteData.type === 'aporte' ? 'bg-expense/5 border-expense/20 text-expense' : 'bg-income/5 border-income/20 text-income'}`}>
                <span>{aporteData.type === 'aporte' ? '↓' : '↑'}</span>
                <span>
                  {formatCurrency(previewAmount)} {aporteData.type === 'aporte' ? 'debitados' : 'creditados'} em <strong>{selectedAccount?.name}</strong>
                </span>
              </div>
            )}
            <div>
              <Label className="text-xs text-muted-foreground">Descrição (opcional)</Label>
              <Input placeholder="Ex: Aporte mensal" value={aporteData.description} onChange={e => setAporteData(p => ({ ...p, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAporte(null)}>Cancelar</Button>
            <Button onClick={handleAporte} disabled={addTransaction.isPending || !aporteData.amount}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
