import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  TrendingUp,
  Trash2,
  Pencil,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Sparkles,
  Wallet,
  ArrowRight,
  Target,
  BadgePercent,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useInvestments, useAddInvestment, useUpdateInvestment, useDeleteInvestment, useInvestmentTransactions } from '@/hooks/useInvestments';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useSensitiveData } from '@/components/finance/SensitiveData';
import type { Investment } from '@/hooks/useInvestments';

const INVESTMENT_TYPES = [
  { value: 'cdb', label: 'CDB', icon: '🏦' },
  { value: 'lci', label: 'LCI', icon: '🏛️' },
  { value: 'lca', label: 'LCA', icon: '🌾' },
  { value: 'tesouro', label: 'Tesouro Direto', icon: '🏛️' },
  { value: 'acoes', label: 'Ações', icon: '📈' },
  { value: 'fii', label: 'FII', icon: '🏢' },
  { value: 'poupanca', label: 'Poupança', icon: '🐷' },
  { value: 'caixinha', label: 'Caixinha', icon: '📦' },
  { value: 'fundo', label: 'Fundo', icon: '📊' },
  { value: 'cripto', label: 'Cripto', icon: '₿' },
  { value: 'outro', label: 'Outro', icon: '💼' },
];

const TYPE_COLORS: Record<string, string> = {
  cdb: '#14b8a6',
  lci: '#06b6d4',
  lca: '#84cc16',
  tesouro: '#2563eb',
  acoes: '#f59e0b',
  fii: '#7c3aed',
  poupanca: '#ec4899',
  caixinha: '#f97316',
  fundo: '#4f46e5',
  cripto: '#ef4444',
  outro: '#6b7280',
};

const PRESET_COLORS = ['#14b8a6', '#06b6d4', '#2563eb', '#7c3aed', '#f59e0b', '#ef4444', '#ec4899', '#f97316', '#84cc16', '#6b7280'];

const LIQUIDITY_OPTIONS = [
  { value: 'diaria', label: 'Diária', badge: 'D+0' },
  { value: 'd+1', label: 'D+1', badge: 'D+1' },
  { value: 'd+30', label: 'D+30', badge: 'D+30' },
  { value: 'd+360', label: 'D+360', badge: 'D+360' },
  { value: 'vencimento', label: 'No vencimento', badge: 'Venc.' },
];

const project = (current: number, annualRate: number, months: number): number => current * Math.pow(1 + annualRate / 100, months / 12);
const liquidityBadge = (liq: string | null) => LIQUIDITY_OPTIONS.find(o => o.value === liq)?.badge ?? 'D+0';

export default function InvestmentsPage() {
  const { maskCurrency, maskText, isVisible } = useSensitiveData();
  const { data: investments = [] } = useInvestments();
  const { data: allTransactions = [] } = useInvestmentTransactions();
  const addInvestment = useAddInvestment();
  const updateInvestment = useUpdateInvestment();
  const deleteInvestment = useDeleteInvestment();

  const [showNewInvestment, setShowNewInvestment] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [selectedInvestment, setSelectedInvestment] = useState<string | null>(null);
  const [expandedProjections, setExpandedProjections] = useState<string | null>(null);

  const [newInv, setNewInv] = useState({
    name: '',
    type: 'cdb',
    institution: '',
    current_value: '',
    annual_rate: '',
    liquidity: 'diaria',
    photo_url: '',
  });

  const [editForm, setEditForm] = useState({
    name: '',
    institution: '',
    type: 'cdb',
    icon: '',
    color: '',
    annual_rate: '',
    liquidity: 'diaria',
    photo_url: '',
  });

  const totalPatrimony = investments.reduce((s, i) => s + Number(i.current_value), 0);
  const totalInvested = investments.reduce((s, i) => s + Number(i.total_invested), 0);
  const totalReturn = totalPatrimony - totalInvested;
  const returnPct = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;

  const selectedTxns = useMemo(
    () => (selectedInvestment ? allTransactions.filter(t => t.investment_id === selectedInvestment) : allTransactions),
    [allTransactions, selectedInvestment],
  );

  const pieData = investments
    .filter(i => Number(i.current_value) > 0)
    .map(i => ({
      id: i.id,
      name: i.name,
      value: Number(i.current_value),
      color: i.color ?? TYPE_COLORS[i.type] ?? '#14b8a6',
      pct: totalPatrimony > 0 ? (Number(i.current_value) / totalPatrimony) * 100 : 0,
      icon: i.icon,
    }));

  const openEdit = (inv: Investment) => {
    setEditForm({
      name: inv.name,
      institution: inv.institution ?? '',
      type: inv.type ?? 'cdb',
      icon: inv.icon ?? '',
      color: inv.color ?? TYPE_COLORS[inv.type] ?? '#14b8a6',
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
        color: TYPE_COLORS[newInv.type] ?? '#14b8a6',
        annual_rate: parseFloat(newInv.annual_rate) || 0,
        liquidity: newInv.liquidity,
        photo_url: newInv.photo_url || null,
      });
      toast.success('Ativo criado com sucesso!');
      setShowNewInvestment(false);
      setNewInv({ name: '', type: 'cdb', institution: '', current_value: '', annual_rate: '', liquidity: 'diaria', photo_url: '' });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-primary/20 via-background to-info/10 p-5 sm:p-7">
        <div className="absolute -top-20 -right-16 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-20 left-1/4 h-56 w-56 rounded-full bg-info/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Controle Patrimonial
            </p>
            <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">Investimentos e Caixinhas</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Esta aba agora é para gestão do patrimônio: alocação, personalização dos ativos e acompanhamento de rentabilidade.
            </p>
          </div>
          <Button onClick={() => setShowNewInvestment(true)} className="w-full sm:w-auto" data-tutorial-target="new-investment">
            <Plus className="mr-1 h-4 w-4" /> Novo Ativo
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-2 lg:grid-cols-4">
        <div className="stat-card rounded-2xl">
          <p className="text-xs text-muted-foreground">Patrimônio atual</p>
          <p className="mt-1 text-xl font-extrabold text-primary">{maskCurrency(formatCurrency(totalPatrimony))}</p>
        </div>
        <div className="stat-card rounded-2xl">
          <p className="text-xs text-muted-foreground">Capital investido</p>
          <p className="mt-1 text-xl font-extrabold">{maskCurrency(formatCurrency(totalInvested))}</p>
        </div>
        <div className="stat-card rounded-2xl">
          <p className="text-xs text-muted-foreground">Resultado acumulado</p>
          <p className={cn('mt-1 text-xl font-extrabold', totalReturn >= 0 ? 'text-income' : 'text-expense')}>
            {totalReturn >= 0 ? '+' : ''}{maskCurrency(formatCurrency(totalReturn))}
          </p>
        </div>
        <div className="stat-card rounded-2xl">
          <p className="text-xs text-muted-foreground">Rentabilidade</p>
          <p className={cn('mt-1 text-xl font-extrabold', returnPct >= 0 ? 'text-income' : 'text-expense')}>
            {isVisible ? `${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(2)}%` : maskText('12,34%')}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="flex items-center gap-2 text-sm font-semibold text-primary"><Wallet className="h-4 w-4" /> Lançamentos centralizados</p>
            <p className="text-sm text-muted-foreground">Receitas e despesas devem ser lançadas apenas nas abas próprias. Aqui você só personaliza e acompanha investimentos.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline" className="border-income/30 text-income hover:bg-income/10">
              <Link to="/receitas">Ir para Receitas <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
            <Button asChild variant="outline" className="border-expense/30 text-expense hover:bg-expense/10">
              <Link to="/despesas">Ir para Despesas <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </section>

      {pieData.length > 0 && totalPatrimony > 0 && (
        <section className="stat-card rounded-2xl">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold"><Target className="h-4 w-4 text-primary" /> Alocação do portfólio</h3>
          <div className="flex flex-col items-center gap-6 lg:flex-row">
            <div className="relative h-[220px] w-[220px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={70} outerRadius={98} paddingAngle={2} dataKey="value" strokeWidth={0}>
                    {pieData.map(entry => <Cell key={entry.id} fill={entry.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total</p>
                <p className="mt-1 text-sm font-black">{maskCurrency(formatCurrency(totalPatrimony))}</p>
              </div>
            </div>
            <div className="w-full space-y-3">
              {pieData.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedInvestment(prev => (prev === item.id ? null : item.id))}
                  className={cn(
                    'w-full rounded-xl border p-3 text-left transition-colors',
                    selectedInvestment === item.id ? 'border-primary/40 bg-primary/5' : 'border-border/60 hover:bg-muted/30',
                  )}
                >
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <div className="flex min-w-0 items-center gap-2">
                      <span>{item.icon}</span>
                      <span className="truncate font-semibold">{item.name}</span>
                    </div>
                    <span className="text-muted-foreground">{isVisible ? `${item.pct.toFixed(1)}%` : maskText('00%')}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full transition-all" style={{ width: `${item.pct}%`, backgroundColor: item.color }} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {investments.length === 0 ? (
        <div className="stat-card rounded-2xl py-16 text-center">
          <TrendingUp className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
          <p className="font-medium text-muted-foreground">Nenhum ativo cadastrado</p>
          <p className="mt-1 text-sm text-muted-foreground">Crie seu primeiro investimento e personalize sua caixinha.</p>
        </div>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {investments.map(inv => {
            const annualRate = Number(inv.annual_rate ?? 0);
            const cur = Number(inv.current_value || 0);
            const invested = Number(inv.total_invested || 0);
            const returnVal = cur - invested;
            const pct = invested > 0 ? (returnVal / invested) * 100 : 0;
            const cardColor = inv.color ?? TYPE_COLORS[inv.type] ?? '#14b8a6';
            const showProj = expandedProjections === inv.id;
            const hasRate = annualRate > 0;

            return (
              <article key={inv.id} className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30">
                <div className="absolute -top-14 -right-10 h-28 w-28 rounded-full blur-2xl" style={{ backgroundColor: `${cardColor}33` }} />

                <div className="relative flex items-start justify-between gap-3">
                  <button type="button" onClick={() => setSelectedInvestment(prev => (prev === inv.id ? null : inv.id))} className="min-w-0 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{inv.icon || INVESTMENT_TYPES.find(t => t.value === inv.type)?.icon || '📈'}</span>
                      <h3 className="truncate font-bold">{inv.name}</h3>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{inv.institution || 'Sem instituição'}</p>
                  </button>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(inv)} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary" title="Personalizar">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => deleteInvestment.mutate(inv.id)} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive" title="Arquivar">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground">Valor atual</span>
                    <span className="text-lg font-extrabold">{maskCurrency(formatCurrency(cur))}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Total investido</span>
                    <span>{maskCurrency(formatCurrency(invested))}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Resultado</span>
                    <span className={cn('font-semibold', returnVal >= 0 ? 'text-income' : 'text-expense')}>
                      {returnVal >= 0 ? '+' : ''}{maskCurrency(formatCurrency(returnVal))}
                      {invested > 0 && <span className="ml-1 text-muted-foreground">({isVisible ? `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%` : maskText('0%')})</span>}
                    </span>
                  </div>
                </div>

                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, (cur / (totalPatrimony || 1)) * 100)}%`, backgroundColor: cardColor }} />
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: `${cardColor}22`, color: cardColor }}>{liquidityBadge(inv.liquidity)}</span>
                  {hasRate && <span className="rounded-full bg-info/10 px-2 py-0.5 text-[11px] font-semibold text-info"><BadgePercent className="mr-1 inline h-3 w-3" />{annualRate}% a.a.</span>}
                </div>

                {hasRate && cur > 0 && (
                  <div className="mt-3">
                    <button className="flex w-full items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground" onClick={() => setExpandedProjections(showProj ? null : inv.id)}>
                      <TrendingUp className="h-3 w-3" /> Simulação de rentabilidade
                      {showProj ? <ChevronUp className="ml-auto h-3 w-3" /> : <ChevronDown className="ml-auto h-3 w-3" />}
                    </button>
                    {showProj && (
                      <div className="mt-2 grid grid-cols-3 gap-1.5">
                        {[{ label: '30 dias', months: 1 }, { label: '6 meses', months: 6 }, { label: '12 meses', months: 12 }].map(({ label, months }) => {
                          const proj = project(cur, annualRate, months);
                          const gain = proj - cur;
                          return (
                            <div key={label} className="rounded-lg bg-muted/40 p-2 text-center">
                              <p className="text-[10px] text-muted-foreground">{label}</p>
                              <p className="text-xs font-bold">{maskCurrency(formatCurrency(proj))}</p>
                              <p className="text-[10px] text-income">+{maskCurrency(formatCurrency(gain))}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}

      {selectedTxns.length > 0 && (
        <section className="stat-card rounded-2xl">
          <h3 className="mb-4 text-sm font-semibold">{selectedInvestment ? `Histórico: ${investments.find(i => i.id === selectedInvestment)?.name}` : 'Histórico de movimentações patrimoniais'}</h3>
          <div className="space-y-2">
            {selectedTxns.slice(0, 20).map(t => (
              <div key={t.id} className="flex items-center justify-between border-b border-border/50 py-2 last:border-0">
                <div>
                  <p className="text-sm font-medium">{t.description || t.type}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(t.date)}</p>
                </div>
                <span className={cn('text-sm font-semibold currency', t.type === 'aporte' || t.type === 'rendimento' ? 'text-income' : 'text-expense')}>
                  {t.type === 'aporte' || t.type === 'rendimento' ? '+' : '−'}{maskCurrency(formatCurrency(Number(t.amount)))}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <Dialog open={!!editingInvestment} onOpenChange={o => !o && setEditingInvestment(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>Personalizar Ativo</DialogTitle></DialogHeader>
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
                  <SelectContent>{INVESTMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Ícone</Label>
                <Input value={editForm.icon} onChange={e => setEditForm(p => ({ ...p, icon: e.target.value }))} placeholder="📈" maxLength={4} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Liquidez</Label>
                <Select value={editForm.liquidity} onValueChange={v => setEditForm(p => ({ ...p, liquidity: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LIQUIDITY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Rentabilidade (% ao ano)</Label>
                <Input type="number" step="0.1" min={0} value={editForm.annual_rate} onChange={e => setEditForm(p => ({ ...p, annual_rate: e.target.value }))} placeholder="Ex: 12.5" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Cor</Label>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {PRESET_COLORS.map(c => (
                    <button key={c} className={cn('h-7 w-7 rounded-full transition-all', editForm.color === c ? 'scale-110 ring-2 ring-foreground ring-offset-2' : 'hover:scale-105')} style={{ backgroundColor: c }} onClick={() => setEditForm(p => ({ ...p, color: c }))} />
                  ))}
                  <Input type="color" value={editForm.color || '#14b8a6'} onChange={e => setEditForm(p => ({ ...p, color: e.target.value }))} className="h-7 w-8 cursor-pointer rounded p-0.5" />
                </div>
              </div>
              <div className="col-span-2">
                <Label className="flex items-center gap-1.5 text-xs text-muted-foreground"><ImageIcon className="h-3.5 w-3.5" /> Foto (URL opcional)</Label>
                <Input value={editForm.photo_url} onChange={e => setEditForm(p => ({ ...p, photo_url: e.target.value }))} placeholder="https://..." />
                {editForm.photo_url && <img src={editForm.photo_url} alt="preview" className="mt-2 h-16 w-full rounded-lg object-cover" onError={e => (e.currentTarget.style.display = 'none')} />}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingInvestment(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={updateInvestment.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewInvestment} onOpenChange={setShowNewInvestment}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo Ativo</DialogTitle></DialogHeader>
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
    </div>
  );
}
