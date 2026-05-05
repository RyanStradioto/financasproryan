import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  TrendingUp,
  ArrowUpCircle,
  ArrowDownCircle,
  Pencil,
  Trash2,
  BarChart3,
  Droplets,
  Sparkles,
  Gauge,
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
import { useSensitiveData } from '@/components/finance/SensitiveData';
import { cn } from '@/lib/utils';

const INVESTMENT_TYPES = [
  { value: 'cdb', label: 'CDB', icon: '🏦' },
  { value: 'lci', label: 'LCI', icon: '🏛️' },
  { value: 'lca', label: 'LCA', icon: '🌾' },
  { value: 'tesouro', label: 'Tesouro Direto', icon: '🏛️' },
  { value: 'acoes', label: 'Acoes', icon: '📈' },
  { value: 'fii', label: 'FII', icon: '🏢' },
  { value: 'poupanca', label: 'Poupanca', icon: '🐷' },
  { value: 'caixinha', label: 'Caixinha', icon: '📦' },
  { value: 'fundo', label: 'Fundo', icon: '📊' },
  { value: 'cripto', label: 'Cripto', icon: '₿' },
  { value: 'outro', label: 'Outro', icon: '💼' },
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

const DEFAULT_ANNUAL_RATE: Record<string, number> = {
  cdb: 12,
  lci: 10.5,
  lca: 10.5,
  tesouro: 10,
  acoes: 14,
  fii: 11,
  poupanca: 7,
  caixinha: 11,
  fundo: 10,
  cripto: 16,
  outro: 9,
};

const LIQUIDITY_OPTIONS = [
  { id: 'imediata', label: 'Imediata (D+0)', factor: 1 },
  { id: 'curta', label: 'Curta (D+1 ate D+30)', factor: 0.92 },
  { id: 'media', label: 'Media (D+31 ate D+180)', factor: 0.8 },
  { id: 'baixa', label: 'Baixa (> D+180)', factor: 0.65 },
] as const;

type LiquidityId = (typeof LIQUIDITY_OPTIONS)[number]['id'];

type InvestmentProfile = {
  annualRate: number;
  liquidity: LiquidityId;
  monthlyContribution: number;
};

const PROFILE_STORAGE_KEY = 'financaspro.investment-profiles.v2';

function getLiquidityOption(liquidity?: string) {
  return LIQUIDITY_OPTIONS.find((item) => item.id === liquidity) ?? LIQUIDITY_OPTIONS[1];
}

function getDefaultProfile(type: string): InvestmentProfile {
  return {
    annualRate: DEFAULT_ANNUAL_RATE[type] ?? 9,
    liquidity: type === 'poupanca' || type === 'caixinha' ? 'imediata' : 'curta',
    monthlyContribution: 0,
  };
}

function projectFutureValue(current: number, annualRate: number, monthlyContribution: number, months: number) {
  if (months <= 0) return current;
  const monthlyRate = annualRate / 100 / 12;
  if (monthlyRate <= 0) {
    return current + monthlyContribution * months;
  }

  const principalProjection = current * Math.pow(1 + monthlyRate, months);
  const contributionProjection = monthlyContribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
  return principalProjection + contributionProjection;
}

export default function InvestmentsPage() {
  const { maskCurrency, maskText, isVisible } = useSensitiveData();
  const { data: investments = [] } = useInvestments();
  const { data: accounts = [] } = useAccounts();
  const { data: allTransactions = [] } = useInvestmentTransactions();
  const addInvestment = useAddInvestment();
  const updateInvestment = useUpdateInvestment();
  const deleteInvestment = useDeleteInvestment();
  const addTransaction = useAddInvestmentTransaction();

  const [showNewInvestment, setShowNewInvestment] = useState(false);
  const [showAporte, setShowAporte] = useState<string | null>(null);
  const [showEditInvestment, setShowEditInvestment] = useState<string | null>(null);
  const [forecastMonths, setForecastMonths] = useState('12');
  const [selectedInvestment, setSelectedInvestment] = useState<string | null>(null);

  const [profiles, setProfiles] = useState<Record<string, InvestmentProfile>>({});

  const [newInv, setNewInv] = useState({ name: '', type: 'cdb', institution: '', current_value: '' });
  const [editInv, setEditInv] = useState({
    id: '',
    name: '',
    type: 'cdb',
    institution: '',
    color: TYPE_COLORS.cdb,
    annualRate: String(DEFAULT_ANNUAL_RATE.cdb),
    liquidity: 'curta' as LiquidityId,
    monthlyContribution: '0',
  });

  const [aporteData, setAporteData] = useState<{
    amount: string;
    date: string;
    type: 'aporte' | 'resgate' | 'rendimento' | 'taxa' | 'ir';
    account_id: string;
    description: string;
  }>({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    type: 'aporte',
    account_id: '',
    description: '',
  });

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, InvestmentProfile>;
        setProfiles(parsed);
      }
    } catch {
      // ignore storage parse issues
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profiles));
  }, [profiles]);

  const getProfile = (investmentId: string, type: string): InvestmentProfile => {
    const saved = profiles[investmentId];
    if (!saved) return getDefaultProfile(type);
    return {
      annualRate: Number(saved.annualRate) || getDefaultProfile(type).annualRate,
      liquidity: saved.liquidity ?? getDefaultProfile(type).liquidity,
      monthlyContribution: Number(saved.monthlyContribution) || 0,
    };
  };

  const monthsNum = Math.max(1, parseInt(forecastMonths) || 12);

  const investmentViews = useMemo(() => {
    return investments.map((inv) => {
      const current = Number(inv.current_value) || 0;
      const invested = Number(inv.total_invested) || 0;
      const returnValue = current - invested;
      const returnPct = invested > 0 ? (returnValue / invested) * 100 : 0;
      const profile = getProfile(inv.id, inv.type || 'outro');
      const monthlyRate = profile.annualRate / 100 / 12;
      const liquidity = getLiquidityOption(profile.liquidity);
      const monthlyGrossYield = current * monthlyRate;
      const monthlyLiquidYield = monthlyGrossYield * liquidity.factor;
      const liquidNow = current * liquidity.factor;
      const projectedGross = projectFutureValue(current, profile.annualRate, profile.monthlyContribution, monthsNum);
      const projectedLiquid = current + (projectedGross - current) * liquidity.factor;

      return {
        ...inv,
        current,
        invested,
        returnValue,
        returnPct,
        profile,
        liquidity,
        monthlyGrossYield,
        monthlyLiquidYield,
        liquidNow,
        projectedGross,
        projectedLiquid,
      };
    });
  }, [investments, profiles, monthsNum]);

  const totalPatrimony = investmentViews.reduce((s, i) => s + i.current, 0);
  const totalInvested = investmentViews.reduce((s, i) => s + i.invested, 0);
  const totalReturn = totalPatrimony - totalInvested;
  const returnPct = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;
  const totalLiquidNow = investmentViews.reduce((s, i) => s + i.liquidNow, 0);
  const totalMonthlyLiquidYield = investmentViews.reduce((s, i) => s + i.monthlyLiquidYield, 0);
  const totalProjectedLiquid = investmentViews.reduce((s, i) => s + i.projectedLiquid, 0);

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

  const handleNewInvestment = async () => {
    if (!newInv.name.trim()) return toast.error('Informe o nome do investimento');

    try {
      await addInvestment.mutateAsync({
        name: newInv.name.trim(),
        type: newInv.type,
        institution: newInv.institution,
        current_value: parseFloat(newInv.current_value) || 0,
        total_invested: parseFloat(newInv.current_value) || 0,
        icon: INVESTMENT_TYPES.find((t) => t.value === newInv.type)?.icon ?? '📈',
        color: TYPE_COLORS[newInv.type] ?? TYPE_COLORS.outro,
      });

      toast.success('Investimento cadastrado!');
      setShowNewInvestment(false);
      setNewInv({ name: '', type: 'cdb', institution: '', current_value: '' });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleUpdateInvestment = async () => {
    if (!editInv.id || !editInv.name.trim()) return toast.error('Nome do investimento e obrigatorio');

    try {
      await updateInvestment.mutateAsync({
        id: editInv.id,
        name: editInv.name.trim(),
        type: editInv.type,
        institution: editInv.institution,
        color: editInv.color,
        icon: INVESTMENT_TYPES.find((t) => t.value === editInv.type)?.icon ?? '📈',
      });

      setProfiles((prev) => ({
        ...prev,
        [editInv.id]: {
          annualRate: parseFloat(editInv.annualRate) || getDefaultProfile(editInv.type).annualRate,
          liquidity: editInv.liquidity,
          monthlyContribution: parseFloat(editInv.monthlyContribution) || 0,
        },
      }));

      toast.success('Caixinha atualizada!');
      setShowEditInvestment(null);
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

      const label =
        aporteData.type === 'aporte'
          ? 'Aporte'
          : aporteData.type === 'resgate'
            ? 'Resgate'
            : aporteData.type === 'rendimento'
              ? 'Rendimento'
              : 'Movimentacao';

      toast.success(`${label} registrado!`);
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="hero-card flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Investimentos</h1>
          <p className="text-sm text-muted-foreground">Caixinhas personalizaveis com previsao de rendimento por liquidez</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/80 px-2.5 py-1 text-xs text-muted-foreground">
              <Droplets className="h-3 w-3" /> Liquidez atual {maskCurrency(formatCurrency(totalLiquidNow))}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-primary">
              <Sparkles className="h-3 w-3" /> Previsao liquida em {monthsNum} meses {maskCurrency(formatCurrency(totalProjectedLiquid))}
            </span>
          </div>
        </div>
        <Button onClick={() => setShowNewInvestment(true)} data-tutorial-target="new-investment">
          <Plus className="w-4 h-4 mr-1" /> Novo Ativo
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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
        <div className="stat-card">
          <p className="text-xs text-muted-foreground mb-1">Rendimento mensal liquido</p>
          <p className="text-xl font-bold text-primary">+{maskCurrency(formatCurrency(totalMonthlyLiquidYield))}</p>
        </div>
      </div>

      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex flex-wrap items-center gap-3">
        <Gauge className="w-4 h-4 text-primary" />
        <span className="text-sm text-muted-foreground">Previsao por liquidez:</span>
        <div className="w-[140px]">
          <Select value={forecastMonths} onValueChange={setForecastMonths}>
            <SelectTrigger className="h-9 bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 mes</SelectItem>
              <SelectItem value="3">3 meses</SelectItem>
              <SelectItem value="6">6 meses</SelectItem>
              <SelectItem value="12">12 meses</SelectItem>
              <SelectItem value="24">24 meses</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <span className="text-sm font-semibold text-primary">Valor liquido projetado: {maskCurrency(formatCurrency(totalProjectedLiquid))}</span>
      </div>

      {investmentViews.length === 0 ? (
        <div className="stat-card py-16 text-center">
          <TrendingUp className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="font-medium text-muted-foreground">Nenhum investimento cadastrado</p>
          <p className="text-sm text-muted-foreground mt-1">Adicione seus ativos para acompanhar o patrimonio</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {investmentViews.map((inv) => {
            const typeInfo = INVESTMENT_TYPES.find((t) => t.value === inv.type);
            const isSelected = selectedInvestment === inv.id;
            const portfolioPct = totalPatrimony > 0 ? (inv.current / totalPatrimony) * 100 : 0;

            return (
              <div
                key={inv.id}
                className={cn('stat-card cursor-pointer transition-all border', isSelected ? 'ring-2 ring-primary border-primary/30' : 'hover:ring-1 hover:ring-border')}
                onClick={() => setSelectedInvestment(isSelected ? null : inv.id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ backgroundColor: (inv.color ?? '#10b981') + '22' }}>
                      {inv.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{inv.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{typeInfo?.label} {inv.institution && `· ${inv.institution}`}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); openMovimentacao(inv.id, 'aporte'); }} className="p-1.5 rounded-lg hover:bg-income/10 text-income transition-colors" title="Aporte">
                      <ArrowUpCircle className="w-4 h-4" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); openMovimentacao(inv.id, 'resgate'); }} className="p-1.5 rounded-lg hover:bg-expense/10 text-expense transition-colors" title="Resgate">
                      <ArrowDownCircle className="w-4 h-4" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); openEdit(inv.id); }} className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors" title="Personalizar">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); deleteInvestment.mutate(inv.id); }} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Arquivar">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Valor atual</span>
                    <span className="font-bold">{maskCurrency(formatCurrency(inv.current))}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Investido</span>
                    <span>{maskCurrency(formatCurrency(inv.invested))}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Rendimento</span>
                    <span className={cn('font-medium', inv.returnValue >= 0 ? 'text-income' : 'text-expense')}>
                      {inv.returnValue >= 0 ? '+' : ''}{maskCurrency(formatCurrency(inv.returnValue))} ({isVisible ? `${inv.returnPct >= 0 ? '+' : ''}${inv.returnPct.toFixed(2)}%` : maskText('12,34%')})
                    </span>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-lg bg-muted/40 border border-border/50 px-2 py-1.5">
                    <p className="text-muted-foreground">Liquidez</p>
                    <p className="font-semibold text-primary">{inv.liquidity.label}</p>
                  </div>
                  <div className="rounded-lg bg-muted/40 border border-border/50 px-2 py-1.5">
                    <p className="text-muted-foreground">Taxa anual</p>
                    <p className="font-semibold">{inv.profile.annualRate.toFixed(2)}%</p>
                  </div>
                  <div className="rounded-lg bg-primary/5 border border-primary/20 px-2 py-1.5 col-span-2">
                    <p className="text-muted-foreground">Previsao liquida ({monthsNum}m)</p>
                    <p className="font-semibold text-primary">{maskCurrency(formatCurrency(inv.projectedLiquid))}</p>
                  </div>
                </div>

                <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, portfolioPct)}%`, backgroundColor: inv.color ?? '#10b981' }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedTxns.length > 0 && (
        <div className="stat-card">
          <h3 className="font-semibold text-sm mb-4">
            {selectedInvestment ? `Historico - ${investmentViews.find((i) => i.id === selectedInvestment)?.name}` : 'Historico de movimentacoes'}
          </h3>
          <div className="space-y-2">
            {selectedTxns.slice(0, 20).map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className={cn('w-2 h-2 rounded-full', t.type === 'aporte' ? 'bg-primary' : t.type === 'resgate' ? 'bg-expense' : t.type === 'rendimento' ? 'bg-income' : 'bg-warning')} />
                  <div>
                    <p className="text-sm font-medium">{t.description || t.type}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(t.date)}</p>
                  </div>
                </div>
                <span className={cn('text-sm font-semibold currency', t.type === 'aporte' || t.type === 'rendimento' ? 'text-income' : 'text-expense')}>
                  {t.type === 'aporte' || t.type === 'rendimento' ? '+' : '-'}{maskCurrency(formatCurrency(Number(t.amount)))}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={showNewInvestment} onOpenChange={setShowNewInvestment}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Investimento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input placeholder="Ex: CDB Nubank" value={newInv.name} onChange={(e) => setNewInv((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={newInv.type} onValueChange={(v) => setNewInv((p) => ({ ...p, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INVESTMENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Instituicao</Label>
              <Input placeholder="Ex: Nubank, XP..." value={newInv.institution} onChange={(e) => setNewInv((p) => ({ ...p, institution: e.target.value }))} />
            </div>
            <div>
              <Label>Valor atual (R$)</Label>
              <Input type="number" placeholder="0,00" value={newInv.current_value} onChange={(e) => setNewInv((p) => ({ ...p, current_value: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewInvestment(false)}>Cancelar</Button>
            <Button onClick={handleNewInvestment} disabled={addInvestment.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showEditInvestment} onOpenChange={(open) => !open && setShowEditInvestment(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Personalizar Caixinha / Ativo</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={editInv.name} onChange={(e) => setEditInv((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={editInv.type} onValueChange={(v) => setEditInv((p) => ({ ...p, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INVESTMENT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cor</Label>
                <Input type="color" value={editInv.color} onChange={(e) => setEditInv((p) => ({ ...p, color: e.target.value }))} className="h-10" />
              </div>
            </div>
            <div>
              <Label>Instituicao</Label>
              <Input value={editInv.institution} onChange={(e) => setEditInv((p) => ({ ...p, institution: e.target.value }))} />
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-3">
              <p className="text-xs font-semibold text-primary">Parametros de previsao</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Taxa anual (%)</Label>
                  <Input type="number" value={editInv.annualRate} onChange={(e) => setEditInv((p) => ({ ...p, annualRate: e.target.value }))} />
                </div>
                <div>
                  <Label>Liquidez</Label>
                  <Select value={editInv.liquidity} onValueChange={(v) => setEditInv((p) => ({ ...p, liquidity: v as LiquidityId }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LIQUIDITY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Aporte mensal previsto (R$)</Label>
                <Input type="number" value={editInv.monthlyContribution} onChange={(e) => setEditInv((p) => ({ ...p, monthlyContribution: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditInvestment(null)}>Cancelar</Button>
            <Button onClick={handleUpdateInvestment} disabled={updateInvestment.isPending}>Salvar personalizacao</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showAporte} onOpenChange={(o) => !o && setShowAporte(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Movimentacao Patrimonial</DialogTitle>
          </DialogHeader>
          <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-xs text-muted-foreground mb-2">
            Esta movimentacao nao e despesa. Ela transfere dinheiro entre conta e investimento.
          </div>
          <div className="space-y-4">
            <div>
              <Label>Tipo</Label>
              <Select value={aporteData.type} onValueChange={(v: string) => setAporteData((p) => ({ ...p, type: v as typeof aporteData.type }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aporte">Aporte (entrada no investimento)</SelectItem>
                  <SelectItem value="resgate">Resgate (retirada)</SelectItem>
                  <SelectItem value="rendimento">Rendimento recebido</SelectItem>
                  <SelectItem value="taxa">Taxa/custo</SelectItem>
                  <SelectItem value="ir">IR sobre rendimento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor (R$)</Label>
              <Input type="number" placeholder="0,00" value={aporteData.amount} onChange={(e) => setAporteData((p) => ({ ...p, amount: e.target.value }))} />
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={aporteData.date} onChange={(e) => setAporteData((p) => ({ ...p, date: e.target.value }))} />
            </div>
            <div>
              <Label>Conta de origem (opcional)</Label>
              <Select value={aporteData.account_id || '__none__'} onValueChange={(v) => setAporteData((p) => ({ ...p, account_id: v === '__none__' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione conta..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem conta</SelectItem>
                  {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.icon} {a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descricao</Label>
              <Input placeholder="Ex: Aporte mensal..." value={aporteData.description} onChange={(e) => setAporteData((p) => ({ ...p, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAporte(null)}>Cancelar</Button>
            <Button onClick={handleAporte} disabled={addTransaction.isPending}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
