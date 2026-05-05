import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useCategories, useAddCategory, useUpdateCategory, useDeleteCategory, useExpenses } from '@/hooks/useFinanceData';
import { useCCTransactionsForMonth } from '@/hooks/useCreditCards';
import { useProfile } from '@/hooks/useProfile';
import { formatCurrency, getMonthYear } from '@/lib/format';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Plus, Pencil, Trash2, Grid3X3, Sparkles, Wand2, Check } from 'lucide-react';
import { toast } from 'sonner';
import MonthSelector from '@/components/finance/MonthSelector';
import { buildDescriptionAmountKey, buildExpenseMatchKey, parseStructuredCardMarker } from '@/lib/paymentMethod';
import { cn } from '@/lib/utils';

const ICONS = ['🏠', '🛒', '🚗', '💰', '🎮', '🍔', '📚', '🏋️', '⚕️', '👕', '🎬', '🏷️', '💳', '📱', '✈️', '🐶', '⛽', '🎓', '🍕', '☕', '🎁', '💄', '🪥'];

// Starter pack — pre-categories tuned to the 50/30/20 rule, with budget percentage suggestions.
// User can adjust monthly_salary in profile and budget will be calculated dynamically.
type StarterCategory = {
  name: string;
  icon: string;
  budgetPct: number; // % of monthly income suggested
  group: 'essencial' | 'estilo' | 'investimento' | 'extra';
};

const STARTER_PACK: StarterCategory[] = [
  // Essenciais (50%)
  { name: 'Moradia',      icon: '🏠', budgetPct: 25, group: 'essencial' },
  { name: 'Alimentação',  icon: '🍔', budgetPct: 12, group: 'essencial' },
  { name: 'Transporte',   icon: '🚗', budgetPct: 8,  group: 'essencial' },
  { name: 'Saúde',        icon: '⚕️', budgetPct: 5,  group: 'essencial' },
  // Estilo de vida (30%)
  { name: 'Lazer',        icon: '🎬', budgetPct: 8,  group: 'estilo' },
  { name: 'Compras',      icon: '🛒', budgetPct: 6,  group: 'estilo' },
  { name: 'Restaurantes', icon: '🍕', budgetPct: 6,  group: 'estilo' },
  { name: 'Educação',     icon: '📚', budgetPct: 5,  group: 'estilo' },
  { name: 'Academia',     icon: '🏋️', budgetPct: 3,  group: 'estilo' },
  { name: 'Assinaturas',  icon: '📱', budgetPct: 2,  group: 'estilo' },
  // Investimento (20%)
  { name: 'Investimentos',icon: '💰', budgetPct: 15, group: 'investimento' },
  { name: 'Reserva',      icon: '🏦', budgetPct: 5,  group: 'investimento' },
];

const GROUP_META: Record<StarterCategory['group'], { label: string; color: string; bgClass: string; textClass: string; borderClass: string }> = {
  essencial:     { label: 'Essenciais',  color: 'expense', bgClass: 'bg-expense/[0.06]',  textClass: 'text-expense',  borderClass: 'border-expense/25' },
  estilo:        { label: 'Estilo',      color: 'warning', bgClass: 'bg-warning/[0.06]',  textClass: 'text-warning',  borderClass: 'border-warning/25' },
  investimento:  { label: 'Investir',    color: 'income',  bgClass: 'bg-income/[0.06]',   textClass: 'text-income',   borderClass: 'border-income/25' },
  extra:         { label: 'Extra',       color: 'muted',   bgClass: 'bg-muted/30',        textClass: 'text-muted-foreground', borderClass: 'border-border/40' },
};

function CurrencyInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d]/g, '');
    if (!raw) { onChange(''); return; }
    const num = parseInt(raw) / 100;
    onChange(num.toFixed(2).replace('.', ','));
  };
  return (
    <Input
      value={value ? `R$ ${value}` : ''}
      onChange={handleChange}
      placeholder="R$ 0,00"
      className="font-mono"
    />
  );
}

export default function CategoriesPage() {
  const [month, setMonth] = useState(getMonthYear());
  const { data: categories = [] } = useCategories();
  const { data: expenses = [] } = useExpenses(month);
  const { data: ccTransactions = [] } = useCCTransactionsForMonth(month);
  const { data: profile } = useProfile();
  const addCategory = useAddCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🏷️');
  const [budget, setBudget] = useState('');

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState('');
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [editBudget, setEditBudget] = useState('');

  const [starterOpen, setStarterOpen] = useState(false);
  const [selectedStarter, setSelectedStarter] = useState<Set<string>>(new Set(STARTER_PACK.map(s => s.name)));
  const [importing, setImporting] = useState(false);

  const monthlyIncome = profile?.monthly_salary && profile.monthly_salary > 0 ? Number(profile.monthly_salary) : 0;

  const activeCategories = categories.filter(c => !c.archived);

  const { categoryByTxId, categoryByMatchKey, categoryByLooseKey } = useMemo(() => {
    const byTxId = new Map<string, string>();
    const byKey = new Map<string, string>();
    const byLooseKey = new Map<string, string>();

    ccTransactions.forEach((tx) => {
      if (!tx.category_id) return;
      byTxId.set(tx.id, tx.category_id);
      byKey.set(buildExpenseMatchKey(tx.description || '', tx.date, Number(tx.amount) || 0), tx.category_id);
      byLooseKey.set(`${tx.bill_month}|${buildDescriptionAmountKey(tx.description || '', Number(tx.amount) || 0)}`, tx.category_id);
    });

    return { categoryByTxId: byTxId, categoryByMatchKey: byKey, categoryByLooseKey: byLooseKey };
  }, [ccTransactions]);

  const resolveCategoryId = (expense: { category_id: string | null; notes: string | null; description: string; date: string; amount: number }) => {
    if (expense.category_id) return expense.category_id;

    const marker = parseStructuredCardMarker(expense.notes);
    if (marker?.transactionId && categoryByTxId.has(marker.transactionId)) {
      return categoryByTxId.get(marker.transactionId) ?? null;
    }

    const matchKey = buildExpenseMatchKey(expense.description || '', expense.date, Number(expense.amount) || 0);
    const billMonth = marker?.billMonth ?? expense.date?.slice(0, 7);
    const looseKey = `${billMonth}|${buildDescriptionAmountKey(expense.description || '', Number(expense.amount) || 0)}`;
    return categoryByMatchKey.get(matchKey) ?? categoryByLooseKey.get(looseKey) ?? null;
  };

  // ── Per-category aggregated totals ─────────────────────────────
  const categoriesWithStats = useMemo(() => {
    return activeCategories.map(cat => {
      const spentExp = expenses
        .filter(e => resolveCategoryId({ ...e, amount: Number(e.amount) }) === cat.id)
        .reduce((s, e) => s + Number(e.amount), 0);
      const spentCC = ccTransactions
        .filter(t => t.category_id === cat.id)
        .reduce((s, t) => s + Number(t.amount), 0);
      const spent = spentExp + spentCC;
      const budgetNum = Number(cat.monthly_budget);
      const pct = budgetNum > 0 ? (spent / budgetNum) * 100 : 0;
      return { ...cat, spent, budgetNum, pct, overBudget: budgetNum > 0 && spent > budgetNum };
    }).sort((a, b) => b.spent - a.spent);
  }, [activeCategories, expenses, ccTransactions, resolveCategoryId]);

  const totalBudget = useMemo(() => activeCategories.reduce((s, c) => s + Number(c.monthly_budget || 0), 0), [activeCategories]);
  const totalSpent = useMemo(() => categoriesWithStats.reduce((s, c) => s + c.spent, 0), [categoriesWithStats]);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { toast.error('Nome é obrigatório'); return; }
    if (activeCategories.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('Já existe uma categoria com este nome');
      return;
    }
    const numBudget = parseFloat(budget.replace(',', '.')) || 0;
    if (numBudget < 0) { toast.error('Orçamento não pode ser negativo'); return; }
    try {
      await addCategory.mutateAsync({ name: trimmed, icon, monthly_budget: numBudget });
      toast.success('Categoria criada!');
      setName(''); setIcon('🏷️'); setBudget(''); setOpen(false);
    } catch (err) {
      const error = err as Error;
      toast.error(error.message);
    }
  };

  const openEdit = (cat: typeof activeCategories[0]) => {
    setEditId(cat.id);
    setEditName(cat.name);
    setEditIcon(cat.icon);
    setEditBudget(Number(cat.monthly_budget).toFixed(2).replace('.', ','));
    setEditOpen(true);
  };

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = editName.trim();
    if (!trimmed) { toast.error('Nome é obrigatório'); return; }
    if (activeCategories.some(c => c.id !== editId && c.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('Já existe uma categoria com este nome');
      return;
    }
    const numBudget = parseFloat(editBudget.replace(',', '.')) || 0;
    if (numBudget < 0) { toast.error('Orçamento não pode ser negativo'); return; }
    try {
      await updateCategory.mutateAsync({ id: editId, name: trimmed, icon: editIcon, monthly_budget: numBudget });
      toast.success('Categoria atualizada!');
      setEditOpen(false);
    } catch (err) {
      const error = err as Error;
      toast.error(error.message);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteCategory.mutateAsync(editId);
      toast.success('Categoria arquivada');
      setEditOpen(false);
    } catch (err) {
      const error = err as Error;
      toast.error(error.message);
    }
  };

  const toggleStarterSelection = (name: string) => {
    setSelectedStarter(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const importStarterPack = async () => {
    const toCreate = STARTER_PACK.filter(s => selectedStarter.has(s.name) && !activeCategories.some(c => c.name.toLowerCase() === s.name.toLowerCase()));
    if (toCreate.length === 0) {
      toast.info('Selecione pelo menos uma categoria nova');
      return;
    }
    setImporting(true);
    try {
      for (const s of toCreate) {
        const budgetVal = monthlyIncome > 0 ? Math.round(monthlyIncome * (s.budgetPct / 100)) : 0;
        await addCategory.mutateAsync({ name: s.name, icon: s.icon, monthly_budget: budgetVal });
      }
      toast.success(`${toCreate.length} categoria${toCreate.length !== 1 ? 's' : ''} criada${toCreate.length !== 1 ? 's' : ''}!`);
      setStarterOpen(false);
    } catch (err) {
      const error = err as Error;
      toast.error('Erro: ' + error.message);
    } finally {
      setImporting(false);
    }
  };

  const isAddValid = name.trim().length > 0;
  const showStarterCTA = activeCategories.length < 3;

  // Group starter pack by group for the import dialog
  const starterByGroup = useMemo(() => {
    const groups: Record<StarterCategory['group'], StarterCategory[]> = { essencial: [], estilo: [], investimento: [], extra: [] };
    STARTER_PACK.forEach(s => groups[s.group].push(s));
    return groups;
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ─── Hero Header ─── */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-primary/[0.05] p-4 shadow-sm sm:rounded-3xl sm:p-7">
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-primary/15 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute -bottom-32 -left-20 w-64 h-64 bg-info/[0.06] blur-3xl rounded-full pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-primary/25 to-primary/5 flex items-center justify-center shadow-inner border border-primary/15 shrink-0">
                <Grid3X3 className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-none">Categorias</h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    {activeCategories.length} {activeCategories.length === 1 ? 'categoria' : 'categorias'}
                  </span>
                  {totalBudget > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-info/10 text-info border border-info/20 font-semibold text-[10px] uppercase tracking-wide">
                      Orçamento total {formatCurrency(totalBudget)}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="grid w-full grid-cols-1 gap-2 min-[430px]:grid-cols-[minmax(0,1fr)_auto_auto] sm:w-auto sm:flex sm:shrink-0">
              <MonthSelector month={month} onChange={setMonth} />
              {showStarterCTA && (
                <Button
                  onClick={() => setStarterOpen(true)}
                  variant="outline"
                  className="h-10 gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
                >
                  <Wand2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Sugerir</span>
                </Button>
              )}
              <Button onClick={() => setOpen(true)} className="h-10 gap-1.5" data-tutorial-target="new-category">
                <Plus className="w-4 h-4" />
                <span>Nova</span>
              </Button>
            </div>
          </div>

          {/* Stats chips */}
          {activeCategories.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
              <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
                  <Grid3X3 className="h-3 w-3" />
                  <p className="text-[9px] font-bold uppercase tracking-wider">Categorias</p>
                </div>
                <p className="text-sm sm:text-base font-extrabold tabular-nums">{activeCategories.length}</p>
              </div>
              <div className="rounded-xl border border-info/25 bg-info/[0.06] px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-info mb-0.5">
                  <Sparkles className="h-3 w-3" />
                  <p className="text-[9px] font-bold uppercase tracking-wider">Orçamento</p>
                </div>
                <p className="text-sm sm:text-base font-extrabold currency text-info tabular-nums whitespace-nowrap truncate">{formatCurrency(totalBudget)}</p>
              </div>
              <div className={cn(
                'col-span-2 md:col-span-1 rounded-xl border px-3 py-2.5',
                totalBudget > 0 && totalSpent > totalBudget ? 'border-expense/25 bg-expense/[0.06]' : 'border-income/25 bg-income/[0.06]',
              )}>
                <div className={cn(
                  'flex items-center gap-1.5 mb-0.5',
                  totalBudget > 0 && totalSpent > totalBudget ? 'text-expense' : 'text-income',
                )}>
                  <Pencil className="h-3 w-3" />
                  <p className="text-[9px] font-bold uppercase tracking-wider">Gasto</p>
                </div>
                <p className={cn('text-sm sm:text-base font-extrabold currency tabular-nums whitespace-nowrap truncate',
                  totalBudget > 0 && totalSpent > totalBudget ? 'text-expense' : 'text-income',
                )}>{formatCurrency(totalSpent)}</p>
                {totalBudget > 0 && (
                  <p className="text-[10px] mt-0.5 font-semibold opacity-70">{((totalSpent / totalBudget) * 100).toFixed(0)}% do orçamento</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Starter banner (when very few categories) ─── */}
      {activeCategories.length === 0 && (
        <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/[0.10] via-primary/[0.04] to-card p-6 sm:p-8 shadow-sm">
          <div className="absolute -top-20 -right-16 w-56 h-56 bg-primary/20 blur-3xl rounded-full pointer-events-none" />
          <div className="relative z-10 flex flex-col items-center text-center max-w-md mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-md shadow-primary/30 mb-3">
              <Wand2 className="w-7 h-7 text-primary-foreground" />
            </div>
            <h3 className="text-lg font-extrabold mb-1">Comece com um pacote pronto</h3>
            <p className="text-sm text-muted-foreground mb-5">
              {monthlyIncome > 0
                ? `Vamos criar 12 categorias inteligentes com orçamentos sugeridos baseados na sua renda de ${formatCurrency(monthlyIncome)}.`
                : 'Vamos criar 12 categorias inteligentes que cobrem moradia, alimentação, lazer, investimentos e mais.'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button onClick={() => setStarterOpen(true)} className="gap-2 bg-primary shadow-md shadow-primary/20 rounded-xl">
                <Sparkles className="w-4 h-4" /> Importar categorias sugeridas
              </Button>
              <Button onClick={() => setOpen(true)} variant="outline" className="gap-2 rounded-xl">
                <Plus className="w-4 h-4" /> Criar do zero
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Category grid ─── */}
      <div className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {categoriesWithStats.map(cat => (
          <button
            key={cat.id}
            onClick={() => openEdit(cat)}
            className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-primary/40 transition-all text-left"
          >
            {/* Decorative gradient */}
            <div className={cn(
              'absolute -top-10 -right-10 w-28 h-28 rounded-full opacity-[0.08] group-hover:opacity-[0.14] group-hover:scale-110 transition-all duration-500 pointer-events-none',
              cat.overBudget && 'bg-gradient-to-br from-expense to-transparent',
              !cat.overBudget && cat.pct >= 60 && 'bg-gradient-to-br from-warning to-transparent',
              !cat.overBudget && cat.pct < 60 && 'bg-gradient-to-br from-primary to-transparent',
            )} />

            <div className="relative z-10">
              {/* Header */}
              <div className="flex items-center justify-between mb-3 gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-muted/50 border border-border/60 flex items-center justify-center text-xl shrink-0">
                    {cat.icon}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm leading-tight truncate">{cat.name}</h3>
                    {cat.budgetNum > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">Orçamento {formatCurrency(cat.budgetNum)}</p>
                    )}
                  </div>
                </div>
                <Pencil className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
              </div>

              {/* Spent + bar */}
              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Gasto</span>
                  <span className={cn(
                    'text-base font-extrabold currency tabular-nums whitespace-nowrap',
                    cat.overBudget ? 'text-expense' : cat.budgetNum > 0 ? 'text-foreground' : 'text-muted-foreground',
                  )}>{formatCurrency(cat.spent)}</span>
                </div>
                {cat.budgetNum > 0 ? (
                  <>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-700',
                          cat.overBudget ? 'bg-gradient-to-r from-expense/60 to-expense' :
                          cat.pct >= 80 ? 'bg-gradient-to-r from-warning/60 to-warning' :
                          'bg-gradient-to-r from-primary/60 to-primary',
                        )}
                        style={{ width: `${Math.min(100, cat.pct)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-semibold">
                      <span className={cn(
                        cat.overBudget ? 'text-expense' :
                        cat.pct >= 80 ? 'text-warning' :
                        'text-income',
                      )}>{cat.pct.toFixed(0)}% usado</span>
                      <span className="text-muted-foreground">
                        {cat.overBudget
                          ? `+${formatCurrency(cat.spent - cat.budgetNum)}`
                          : `${formatCurrency(Math.max(0, cat.budgetNum - cat.spent))} restante`}
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-[10px] text-muted-foreground italic">Sem orçamento definido — clique para configurar</p>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* ─── Add Dialog ─── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nova Categoria</DialogTitle></DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Ícone</Label>
              <div className="grid grid-cols-8 gap-1.5 max-h-[140px] overflow-y-auto p-1">
                {ICONS.map(i => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setIcon(i)}
                    className={cn(
                      'w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all',
                      icon === i ? 'bg-primary/15 ring-2 ring-primary scale-110' : 'bg-muted hover:bg-muted/70',
                    )}
                  >{i}</button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Alimentação" required autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Orçamento Mensal</Label>
              <CurrencyInput value={budget} onChange={setBudget} />
              {monthlyIncome > 0 && budget && (
                <p className="text-[11px] text-muted-foreground">
                  {((parseFloat(budget.replace(',', '.')) / monthlyIncome) * 100).toFixed(1)}% da sua renda
                </p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={addCategory.isPending || !isAddValid}>Criar</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Dialog ─── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Editar Categoria</DialogTitle></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Ícone</Label>
              <div className="grid grid-cols-8 gap-1.5 max-h-[140px] overflow-y-auto p-1">
                {ICONS.map(i => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setEditIcon(i)}
                    className={cn(
                      'w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all',
                      editIcon === i ? 'bg-primary/15 ring-2 ring-primary scale-110' : 'bg-muted hover:bg-muted/70',
                    )}
                  >{i}</button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Orçamento Mensal</Label>
              <CurrencyInput value={editBudget} onChange={setEditBudget} />
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={updateCategory.isPending}>Salvar</Button>
              <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleteCategory.isPending}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Starter Pack Dialog ─── */}
      <Dialog open={starterOpen} onOpenChange={setStarterOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-primary" />
              Categorias sugeridas
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {monthlyIncome > 0
                ? `Orçamentos calculados a partir da sua renda de ${formatCurrency(monthlyIncome)} (regra 50/30/20)`
                : 'Defina sua renda mensal nas Configurações para receber sugestões de orçamento personalizadas.'}
            </p>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {(['essencial', 'estilo', 'investimento'] as const).map(group => {
              const meta = GROUP_META[group];
              const items = starterByGroup[group];
              return (
                <div key={group} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className={cn('h-2 w-2 rounded-full', meta.color === 'expense' ? 'bg-expense' : meta.color === 'warning' ? 'bg-warning' : 'bg-income')} />
                    <p className={cn('text-[11px] font-bold uppercase tracking-[0.15em]', meta.textClass)}>{meta.label}</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {items.map(s => {
                      const exists = activeCategories.some(c => c.name.toLowerCase() === s.name.toLowerCase());
                      const checked = selectedStarter.has(s.name) && !exists;
                      const budgetVal = monthlyIncome > 0 ? Math.round(monthlyIncome * (s.budgetPct / 100)) : 0;
                      return (
                        <button
                          key={s.name}
                          type="button"
                          onClick={() => !exists && toggleStarterSelection(s.name)}
                          disabled={exists}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all',
                            exists
                              ? 'bg-muted/30 border-border/40 opacity-60 cursor-not-allowed'
                              : checked
                                ? `${meta.bgClass} ${meta.borderClass} shadow-sm`
                                : 'bg-card/60 border-border/60 hover:border-primary/30 hover:bg-card',
                          )}
                        >
                          <div className={cn(
                            'w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors',
                            checked ? `${meta.bgClass} border-current ${meta.textClass}` : 'border-border',
                          )}>
                            {checked && <Check className="w-3 h-3" />}
                          </div>
                          <span className="text-lg shrink-0">{s.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate">{s.name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {s.budgetPct}% da renda
                              {budgetVal > 0 && ` · ${formatCurrency(budgetVal)}`}
                              {exists && ' · já existe'}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-3 border-t border-border/40">
            <p className="text-xs text-muted-foreground">
              {selectedStarter.size} {selectedStarter.size === 1 ? 'selecionada' : 'selecionadas'}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStarterOpen(false)} className="flex-1 sm:flex-none">Cancelar</Button>
              <Button onClick={importStarterPack} disabled={importing || selectedStarter.size === 0} className="flex-1 sm:flex-none gap-1.5">
                {importing ? 'Criando...' : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Criar {selectedStarter.size}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
