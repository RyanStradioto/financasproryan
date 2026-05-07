import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useCategories, useAddCategory, useUpdateCategory, useDeleteCategory, useExpenses, useAccounts, useCategoryAccountBudgets, useReplaceCategoryAccountBudgets, type Account } from '@/hooks/useFinanceData';
import { useCCTransactionsForMonth, useCreditCards } from '@/hooks/useCreditCards';
import { useProfile } from '@/hooks/useProfile';
import { formatCurrency, getMonthYear } from '@/lib/format';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2, Grid3X3, Sparkles, Wand2, Check, Wallet, X, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import MonthSelector from '@/components/finance/MonthSelector';
import { buildDescriptionAmountKey, buildExpenseMatchKey, detectCreditCardExpense, parseStructuredCardMarker } from '@/lib/paymentMethod';
import { cn } from '@/lib/utils';
import { accountBrandFromRow, resolveAccountBrand } from '@/lib/accountBrand';

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

type BudgetSplit = {
  accountId: string;
  budget: string;
};

type AccountBudgetBreakdown = {
  key: string;
  accountId: string | null;
  name: string;
  icon: string;
  logoUrl?: string;
  budget: number;
  spent: number;
  remaining: number;
  pct: number;
  overBudget: boolean;
};

function parseCurrencyInput(value: string) {
  return parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0;
}

function formatCurrencyInput(value: number) {
  return Number(value || 0).toFixed(2).replace('.', ',');
}

function normalizeBudgetSplits(splits: BudgetSplit[]) {
  const byAccount = new Map<string, number>();

  splits.forEach((split) => {
    const accountId = split.accountId;
    const monthlyBudget = parseCurrencyInput(split.budget);
    if (!accountId || monthlyBudget <= 0) return;
    byAccount.set(accountId, (byAccount.get(accountId) || 0) + monthlyBudget);
  });

  return Array.from(byAccount.entries()).map(([account_id, monthly_budget]) => ({
    account_id,
    monthly_budget,
  }));
}

function getSplitTotal(splits: BudgetSplit[]) {
  return normalizeBudgetSplits(splits).reduce((sum, split) => sum + split.monthly_budget, 0);
}

function BudgetSplitEditor({
  accounts,
  splits,
  onChange,
}: {
  accounts: Account[];
  splits: BudgetSplit[];
  onChange: (splits: BudgetSplit[]) => void;
}) {
  const activeAccounts = accounts.filter((account) => !account.archived);
  const total = splits.reduce((sum, split) => sum + parseCurrencyInput(split.budget), 0);

  const updateSplit = (index: number, patch: Partial<BudgetSplit>) => {
    onChange(splits.map((split, i) => (i === index ? { ...split, ...patch } : split)));
  };

  const removeSplit = (index: number) => {
    onChange(splits.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <Label className="text-xs">Orçamento por conta</Label>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Separe o limite da categoria por carteira ou banco.</p>
        </div>
        {splits.length > 0 && (
          <span className="shrink-0 rounded-lg border border-primary/20 bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">
            {formatCurrency(total)}
          </span>
        )}
      </div>

      {splits.length > 0 && (
        <div className="space-y-2">
          {splits.map((split, index) => {
            const usedAccountIds = new Set(splits.map((item, i) => (i === index ? '' : item.accountId)).filter(Boolean));
            const selectedAccount = activeAccounts.find((account) => account.id === split.accountId);
            return (
              <div key={`${split.accountId || 'new'}-${index}`} className="grid grid-cols-[minmax(0,1fr)_120px_32px] gap-2">
                <select
                  value={split.accountId}
                  onChange={(event) => updateSplit(index, { accountId: event.target.value })}
                  className="h-10 min-w-0 rounded-lg border border-input bg-background px-2 text-sm"
                  required
                >
                  <option value="">Conta...</option>
                  {activeAccounts
                    .filter((account) => account.id === split.accountId || !usedAccountIds.has(account.id))
                    .map((account) => {
                      const brand = accountBrandFromRow(account);
                      return (
                        <option key={account.id} value={account.id}>
                          {brand.name !== 'custom' ? '' : account.icon ? `${account.icon} ` : ''}{account.name}
                        </option>
                      );
                    })}
                </select>
                <CurrencyInput value={split.budget} onChange={(value) => updateSplit(index, { budget: value })} />
                <button
                  type="button"
                  onClick={() => removeSplit(index)}
                  className="flex h-10 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  title={selectedAccount ? `Remover ${selectedAccount.name}` : 'Remover'}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        disabled={activeAccounts.length === 0 || splits.length >= activeAccounts.length}
        onClick={() => {
          const used = new Set(splits.map((split) => split.accountId));
          const nextAccount = activeAccounts.find((account) => !used.has(account.id));
          onChange([...splits, { accountId: nextAccount?.id || '', budget: '' }]);
        }}
      >
        <Plus className="mr-1 h-3.5 w-3.5" />
        Adicionar conta
      </Button>
    </div>
  );
}

export default function CategoriesPage() {
  const [month, setMonth] = useState(getMonthYear());
  const { data: categories = [] } = useCategories();
  const { data: accounts = [] } = useAccounts();
  const { data: categoryAccountBudgets = [] } = useCategoryAccountBudgets();
  const { data: expenses = [] } = useExpenses(month);
  const { data: ccTransactions = [] } = useCCTransactionsForMonth(month);
  const { data: creditCards = [] } = useCreditCards();
  const { data: profile } = useProfile();
  const addCategory = useAddCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const replaceCategoryAccountBudgets = useReplaceCategoryAccountBudgets();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🏷️');
  const [budget, setBudget] = useState('');
  const [budgetSplits, setBudgetSplits] = useState<BudgetSplit[]>([]);

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState('');
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [editBudget, setEditBudget] = useState('');
  const [editBudgetSplits, setEditBudgetSplits] = useState<BudgetSplit[]>([]);
  const [expandedBreakdowns, setExpandedBreakdowns] = useState<Set<string>>(new Set());

  const [starterOpen, setStarterOpen] = useState(false);
  const [selectedStarter, setSelectedStarter] = useState<Set<string>>(new Set(STARTER_PACK.map(s => s.name)));
  const [importing, setImporting] = useState(false);

  const monthlyIncome = profile?.monthly_salary && profile.monthly_salary > 0 ? Number(profile.monthly_salary) : 0;

  const activeCategories = categories.filter(c => !c.archived);

  const nonCCExpenses = useMemo(
    () => expenses.filter((expense) => !detectCreditCardExpense(expense, creditCards, accounts).isCreditCard),
    [accounts, creditCards, expenses],
  );

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

  const accountById = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts]);

  const accountIdByBrand = useMemo(() => {
    const map = new Map<string, string>();
    accounts.forEach((account) => {
      const brand = accountBrandFromRow(account);
      if (brand.name !== 'custom' && !map.has(brand.name)) {
        map.set(brand.name, account.id);
      }
    });
    return map;
  }, [accounts]);

  const cardAccountIdByCardId = useMemo(() => {
    const map = new Map<string, string>();
    creditCards.forEach((card) => {
      const brandName = resolveAccountBrand(card.name).name;
      const accountId = brandName === 'custom' ? null : accountIdByBrand.get(brandName);
      if (accountId) map.set(card.id, accountId);
    });
    return map;
  }, [accountIdByBrand, creditCards]);

  // ── Per-category aggregated totals ─────────────────────────────
  const categoriesWithStats = useMemo(() => {
    return activeCategories.map(cat => {
      const budgetRows = categoryAccountBudgets.filter((budgetRow) => budgetRow.category_id === cat.id);
      const budgetByAccount = new Map<string, number>();
      budgetRows.forEach((budgetRow) => {
        budgetByAccount.set(budgetRow.account_id, (budgetByAccount.get(budgetRow.account_id) || 0) + Number(budgetRow.monthly_budget || 0));
      });

      const spentByAccount = new Map<string, number>();
      const addSpent = (accountId: string | null | undefined, amount: number) => {
        const key = accountId || '__none__';
        spentByAccount.set(key, (spentByAccount.get(key) || 0) + amount);
      };

      nonCCExpenses.forEach((expense) => {
        if (resolveCategoryId({ ...expense, amount: Number(expense.amount) }) !== cat.id) return;
        addSpent(expense.account_id, Number(expense.amount || 0));
      });

      ccTransactions.forEach((transaction) => {
        if (transaction.category_id !== cat.id) return;
        addSpent(cardAccountIdByCardId.get(transaction.credit_card_id) || null, Number(transaction.amount || 0));
      });

      const spent = Array.from(spentByAccount.values()).reduce((sum, value) => sum + value, 0);
      const budgetNum = budgetRows.length > 0
        ? Array.from(budgetByAccount.values()).reduce((sum, value) => sum + value, 0)
        : Number(cat.monthly_budget || 0);
      const breakdownKeys = new Set<string>([
        ...Array.from(budgetByAccount.keys()),
        ...Array.from(spentByAccount.keys()),
      ]);

      const accountBreakdown: AccountBudgetBreakdown[] = Array.from(breakdownKeys).map((key) => {
        const account = key === '__none__' ? null : accountById.get(key);
        const brand = account ? accountBrandFromRow(account) : null;
        const rowBudget = key === '__none__' ? 0 : (budgetByAccount.get(key) || 0);
        const rowSpent = spentByAccount.get(key) || 0;
        const rowPct = rowBudget > 0 ? (rowSpent / rowBudget) * 100 : 0;
        return {
          key,
          accountId: key === '__none__' ? null : key,
          name: account?.name || 'Sem conta',
          icon: account ? (brand?.icon || account.icon || '💳') : 'Wallet',
          logoUrl: brand?.logoUrl,
          budget: rowBudget,
          spent: rowSpent,
          remaining: rowBudget - rowSpent,
          pct: rowPct,
          overBudget: rowBudget > 0 && rowSpent > rowBudget,
        };
      }).sort((a, b) => {
        if (a.key === '__none__') return 1;
        if (b.key === '__none__') return -1;
        return (b.budget + b.spent) - (a.budget + a.spent);
      });

      const pct = budgetNum > 0 ? (spent / budgetNum) * 100 : 0;
      const splitOverBudget = accountBreakdown.some((row) => row.overBudget);
      return { ...cat, spent, budgetNum, pct, overBudget: (budgetNum > 0 && spent > budgetNum) || splitOverBudget, accountBreakdown };
    }).sort((a, b) => b.spent - a.spent);
  }, [accountById, activeCategories, cardAccountIdByCardId, categoryAccountBudgets, ccTransactions, nonCCExpenses, resolveCategoryId]);

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
    const splitRows = normalizeBudgetSplits(budgetSplits);
    const numBudget = splitRows.length > 0 ? getSplitTotal(budgetSplits) : parseCurrencyInput(budget);
    if (numBudget < 0) { toast.error('Orçamento não pode ser negativo'); return; }
    try {
      const newCategory = await addCategory.mutateAsync({ name: trimmed, icon, monthly_budget: numBudget });
      if (splitRows.length > 0) {
        await replaceCategoryAccountBudgets.mutateAsync({ categoryId: newCategory.id, budgets: splitRows });
      }
      toast.success('Categoria criada!');
      setName(''); setIcon('🏷️'); setBudget(''); setBudgetSplits([]); setOpen(false);
    } catch (err) {
      const error = err as Error;
      toast.error(error.message);
    }
  };

  const openEdit = (cat: typeof categoriesWithStats[0]) => {
    const existingSplits = categoryAccountBudgets
      .filter((budgetRow) => budgetRow.category_id === cat.id)
      .map((budgetRow) => ({
        accountId: budgetRow.account_id,
        budget: formatCurrencyInput(Number(budgetRow.monthly_budget || 0)),
      }));
    setEditId(cat.id);
    setEditName(cat.name);
    setEditIcon(cat.icon);
    setEditBudget(Number(cat.monthly_budget).toFixed(2).replace('.', ','));
    setEditBudgetSplits(existingSplits);
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
    const splitRows = normalizeBudgetSplits(editBudgetSplits);
    const numBudget = splitRows.length > 0 ? getSplitTotal(editBudgetSplits) : parseCurrencyInput(editBudget);
    if (numBudget < 0) { toast.error('Orçamento não pode ser negativo'); return; }
    try {
      await updateCategory.mutateAsync({ id: editId, name: trimmed, icon: editIcon, monthly_budget: numBudget });
      await replaceCategoryAccountBudgets.mutateAsync({ categoryId: editId, budgets: splitRows });
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
        {categoriesWithStats.map(cat => {
          const expanded = expandedBreakdowns.has(cat.id);
          const hasBreakdown = cat.accountBreakdown.length > 0;
          const visibleBreakdown = expanded ? cat.accountBreakdown : cat.accountBreakdown.slice(0, 3);

          return (
          <div
            key={cat.id}
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
                <button
                  type="button"
                  onClick={() => openEdit(cat)}
                  className="rounded-lg p-1 text-muted-foreground/40 transition-colors hover:bg-primary/10 hover:text-primary group-hover:text-primary"
                  title="Editar categoria"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
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

              {hasBreakdown && (
                <div className="mt-3 space-y-1.5 rounded-xl border border-border/50 bg-background/35 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      <Wallet className="h-3 w-3" />
                      Por conta
                    </span>
                    {cat.accountBreakdown.length > 3 && (
                      <button
                        type="button"
                        onClick={() => {
                          setExpandedBreakdowns((prev) => {
                            const next = new Set(prev);
                            if (next.has(cat.id)) next.delete(cat.id);
                            else next.add(cat.id);
                            return next;
                          });
                        }}
                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary/10"
                      >
                        {expanded ? 'Ver menos' : `+${cat.accountBreakdown.length - 3}`}
                        <ChevronDown className={cn('h-3 w-3 transition-transform', expanded && 'rotate-180')} />
                      </button>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    {visibleBreakdown.map((row) => (
                      <div key={row.key} className="rounded-lg bg-card/55 px-2 py-1.5">
                        <div className="flex items-center justify-between gap-2">
                            <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-bold">
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted/60 text-[10px]">
                                {row.logoUrl ? (
                                  <img src={row.logoUrl} alt="" className="h-full w-full object-contain p-0.5" />
                                ) : row.icon === 'Wallet' ? (
                                  <Wallet className="h-3 w-3" />
                                ) : row.icon}
                              </span>
                            <span className="truncate">{row.name}</span>
                          </span>
                          <span className={cn('shrink-0 text-[11px] font-extrabold tabular-nums', row.overBudget ? 'text-expense' : row.remaining >= 0 ? 'text-income' : 'text-warning')}>
                            {row.budget > 0 ? formatCurrency(Math.max(0, row.remaining)) : formatCurrency(row.spent)}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2 text-[9px] text-muted-foreground">
                          <span>{formatCurrency(row.spent)} gasto</span>
                          <span>{row.budget > 0 ? `${formatCurrency(row.budget)} limite` : 'sem orçamento'}</span>
                        </div>
                        {row.budget > 0 && (
                          <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn('h-full rounded-full', row.overBudget ? 'bg-expense' : row.pct >= 80 ? 'bg-warning' : 'bg-primary')}
                              style={{ width: `${Math.min(100, row.pct)}%` }}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          );
        })}
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
              {budgetSplits.length > 0 && (
                <p className="text-[11px] text-primary">
                  Com orçamento por conta, o total será {formatCurrency(getSplitTotal(budgetSplits))}.
                </p>
              )}
              {monthlyIncome > 0 && budget && (
                <p className="text-[11px] text-muted-foreground">
                  {((parseCurrencyInput(budget) / monthlyIncome) * 100).toFixed(1)}% da sua renda
                </p>
              )}
            </div>
            <BudgetSplitEditor accounts={accounts} splits={budgetSplits} onChange={setBudgetSplits} />
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
              {editBudgetSplits.length > 0 && (
                <p className="text-[11px] text-primary">
                  Com orçamento por conta, o total será {formatCurrency(getSplitTotal(editBudgetSplits))}.
                </p>
              )}
            </div>
            <BudgetSplitEditor accounts={accounts} splits={editBudgetSplits} onChange={setEditBudgetSplits} />
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
