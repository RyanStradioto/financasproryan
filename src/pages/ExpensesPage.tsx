import { useState, useMemo } from 'react';
import { useExpenses, useDeleteExpense, useUpdateExpense, useCategories, useAccounts, type Expense } from '@/hooks/useFinanceData';
import { useCCTransactionsForMonth, useCreditCards, type CreditCardTransaction } from '@/hooks/useCreditCards';
import { getMonthYear, formatCurrency, formatDate, getStatusColor, getStatusLabel } from '@/lib/format';
import { detectCreditCardExpense } from '@/lib/paymentMethod';
import { formatWorkTime } from '@/lib/workTime';
import { useWorkTimeCalc } from '@/hooks/useProfile';
import MonthSelector from '@/components/finance/MonthSelector';
import TransactionDialog from '@/components/finance/TransactionDialog';
import EditTransactionDialog from '@/components/finance/EditTransactionDialog';
import { Trash2, Pencil, Paperclip, Clock, ChevronDown, Filter, Search, X, TrendingDown, Receipt, SlidersHorizontal, Check, ArrowUp, ArrowDown, CreditCard, Landmark } from 'lucide-react';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type ExpenseRow = Expense & { _type: 'expense' };
type CCRow = CreditCardTransaction & { _type: 'cc' };
type Row = ExpenseRow | CCRow;
type PickerOption = { id: string; name: string; icon?: string | null };

function DatePicker({ date, onChange }: { date: string; onChange: (d: string) => void }) {
  const [editing, setEditing] = useState(false);
  return editing ? (
    <input
      type="date"
      defaultValue={date}
      autoFocus
      onBlur={e => { if (e.target.value) onChange(e.target.value); setEditing(false); }}
      onChange={e => { if (e.target.value) { onChange(e.target.value); setEditing(false); } }}
      className="h-7 w-[130px] rounded-lg border border-primary/40 bg-muted/50 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
    />
  ) : (
    <button
      onClick={() => setEditing(true)}
      className="text-muted-foreground hover:text-foreground hover:bg-muted/60 px-1.5 py-0.5 rounded-md transition-colors text-sm group/date flex items-center gap-1.5"
    >
      {formatDate(date)}
      <Pencil className="w-3 h-3 opacity-0 group-hover/date:opacity-40 shrink-0" />
    </button>
  );
}

function OptionPicker({ value, options, placeholder, onChange, hideIcon }: {
  value: string | null;
  options: PickerOption[];
  placeholder: string;
  onChange: (id: string | null) => void;
  hideIcon?: boolean;
}) {
  const selected = options.find(o => o.id === value);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 px-1.5 py-0.5 rounded-md transition-colors group/pick whitespace-nowrap">
          {selected ? (hideIcon ? selected.name : `${selected.icon ?? ''} ${selected.name}`.trim()) : <span className="opacity-40">{placeholder}</span>}
          <ChevronDown className="w-3 h-3 opacity-0 group-hover/pick:opacity-40 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1 max-h-52 overflow-y-auto" align="start">
        <button
          onClick={() => onChange(null)}
          className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors hover:bg-muted ${!value ? 'opacity-40 cursor-default' : ''}`}
        >
          — Nenhum
        </button>
        {options.map(o => (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors hover:bg-muted ${o.id === value ? 'opacity-50 cursor-default' : ''}`}
          >
            {o.icon} {o.name}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

const STATUSES = [
  { value: 'concluido', label: 'Concluído', color: 'bg-success' },
  { value: 'pendente',  label: 'Pendente',  color: 'bg-warning' },
  { value: 'agendado',  label: 'Agendado',  color: 'bg-info'    },
];

function StatusPicker({ status, onChange }: { status: string; onChange: (s: string) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer hover:opacity-80 transition-opacity ${getStatusColor(status)}`}
        >
          {getStatusLabel(status)}
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-36 p-1" align="start">
        {STATUSES.map(s => (
          <button
            key={s.value}
            onClick={() => onChange(s.value)}
            className={`w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors hover:bg-muted ${
              s.value === status ? 'opacity-50 cursor-default' : ''
            }`}
          >
            <span className={`inline-block w-2 h-2 rounded-full ${s.color}`} />
            {s.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export default function ExpensesPage() {
  const [month, setMonth] = useState(getMonthYear());
  const { data: expenses = [], isLoading } = useExpenses(month);
  const { data: categories = [] } = useCategories();
  const { data: accounts = [] } = useAccounts();
  const { data: ccTransactions = [] } = useCCTransactionsForMonth(month);
  const { data: creditCards = [] } = useCreditCards();
  const deleteExpense = useDeleteExpense();
  const updateExpense = useUpdateExpense();
  const [editing, setEditing] = useState<(Expense & { type: 'expense' }) | null>(null);
  const { calcWorkTime, hourlyRate } = useWorkTimeCalc();

  const handleStatusChange = async (id: string, status: string) => {
    try { await updateExpense.mutateAsync({ id, status }); }
    catch { toast.error('Erro ao atualizar status'); }
  };

  const handleDateChange = async (id: string, date: string) => {
    try { await updateExpense.mutateAsync({ id, date }); }
    catch { toast.error('Erro ao atualizar data'); }
  };

  const handleCategoryChange = async (id: string, category_id: string | null) => {
    try { await updateExpense.mutateAsync({ id, category_id: category_id ?? undefined }); }
    catch { toast.error('Erro ao atualizar categoria'); }
  };

  const handleAccountChange = async (id: string, account_id: string | null) => {
    try { await updateExpense.mutateAsync({ id, account_id: account_id ?? undefined }); }
    catch { toast.error('Erro ao atualizar conta'); }
  };

  // Filters
  const [filterSearch, setFilterSearch] = useState('');
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [filterAccounts, setFilterAccounts] = useState<string[]>([]);
  const [filterAmountMin, setFilterAmountMin] = useState('');
  const [filterAmountMax, setFilterAmountMax] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'description' | 'status' | 'category'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [filterOpen, setFilterOpen] = useState(false);
  const [catSearch, setCatSearch] = useState('');
  const [showCCOnly, setShowCCOnly] = useState(false);

  const toggleStatus   = (v: string) => setFilterStatuses(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);
  const toggleCategory = (v: string) => setFilterCategories(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);
  const toggleAccount  = (v: string) => setFilterAccounts(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);

  const activeFilterCount = filterStatuses.length + filterCategories.length + filterAccounts.length +
    (filterAmountMin !== '' ? 1 : 0) + (filterAmountMax !== '' ? 1 : 0);
  const hasActiveFilters = !!(filterSearch || activeFilterCount > 0 || showCCOnly);

  const clearFilters = () => {
    setFilterSearch(''); setFilterStatuses([]); setFilterCategories([]);
    setFilterAccounts([]); setFilterAmountMin(''); setFilterAmountMax('');
    setShowCCOnly(false);
  };

  const STATUS_ORDER: Record<string, number> = { concluido: 0, pendente: 1, agendado: 2 };

  // Filter out CC-mirror expenses so they don't double-count with ccTransactions
  const nonCCExpenses = useMemo(() =>
    expenses.filter(e => !detectCreditCardExpense(e, creditCards, accounts).isCreditCard)
  , [expenses, creditCards, accounts]);

  // Merge real expenses (no CC mirrors) + CC transactions
  const allRows: Row[] = useMemo(() => [
    ...nonCCExpenses.map(e => ({ ...e, _type: 'expense' as const })),
    ...ccTransactions.map(t => ({ ...t, _type: 'cc' as const })),
  ], [nonCCExpenses, ccTransactions]);

  const filtered: Row[] = useMemo(() => allRows.filter(item => {
    if (showCCOnly && item._type !== 'cc') return false;
    if (filterSearch && !item.description?.toLowerCase().includes(filterSearch.toLowerCase())) return false;
    if (filterCategories.length > 0 && !filterCategories.includes(item.category_id ?? '')) return false;
    if (filterAmountMin !== '' && Number(item.amount) < Number(filterAmountMin)) return false;
    if (filterAmountMax !== '' && Number(item.amount) > Number(filterAmountMax)) return false;
    // Status and account filters only apply to regular expenses
    if (item._type === 'expense') {
      if (filterStatuses.length > 0 && !filterStatuses.includes(item.status)) return false;
      if (filterAccounts.length > 0 && !filterAccounts.includes(item.account_id ?? '')) return false;
    }
    return true;
  }).sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'date')        cmp = new Date(b.date).getTime() - new Date(a.date).getTime();
    if (sortBy === 'amount')      cmp = Number(b.amount) - Number(a.amount);
    if (sortBy === 'description') cmp = (a.description ?? '').localeCompare(b.description ?? '');
    if (sortBy === 'status') {
      const sA = a._type === 'expense' ? (STATUS_ORDER[a.status] ?? 99) : 100;
      const sB = b._type === 'expense' ? (STATUS_ORDER[b.status] ?? 99) : 100;
      cmp = sA - sB;
    }
    if (sortBy === 'category') {
      const catA = categories.find(c => c.id === a.category_id)?.name ?? '';
      const catB = categories.find(c => c.id === b.category_id)?.name ?? '';
      cmp = catA.localeCompare(catB);
    }
    return sortDir === 'asc' ? -cmp : cmp;
  }), [allRows, filterSearch, filterCategories, filterAmountMin, filterAmountMax, filterStatuses, filterAccounts, showCCOnly, sortBy, sortDir, categories]);

  const totalExpenses = useMemo(() => nonCCExpenses.reduce((s, e) => s + Number(e.amount), 0), [nonCCExpenses]);
  const totalCC = useMemo(() => ccTransactions.reduce((s, t) => s + Number(t.amount), 0), [ccTransactions]);
  const total = filtered.reduce((s, r) => s + Number(r.amount), 0);
  const totalItems = nonCCExpenses.length + ccTransactions.length;

  // Aliases used in summary cards
  const creditTotal = totalCC;
  const accountTotal = totalExpenses;
  const scheduledTotal = useMemo(() => nonCCExpenses.filter(e => e.status !== 'concluido').reduce((s, e) => s + Number(e.amount), 0), [nonCCExpenses]);

  const getCategoryName = (id: string | null) => {
    if (!id) return '—';
    const cat = categories.find(c => c.id === id);
    return cat ? `${cat.icon} ${cat.name}` : '—';
  };

  const getAccountName = (id: string | null, hideIcon = false) => {
    if (!id) return '—';
    const acc = accounts.find(a => a.id === id);
    return acc ? (hideIcon ? acc.name : `${acc.icon} ${acc.name}`) : '—';
  };

  const getCardName = (cardId: string) => {
    const card = creditCards.find(c => c.id === cardId);
    return card ? card.name : 'Cartão';
  };

  const getCardColor = (cardId: string) => {
    const card = creditCards.find(c => c.id === cardId);
    return card?.color ?? '#6366f1';
  };

  const handleDelete = async (id: string) => {
    const item = expenses.find(e => e.id === id);
    try {
      const result = await deleteExpense.mutateAsync(id);
      if (result.softDeleted) {
        toast.success('Despesa movida para lixeira', {
          description: item ? `"${item.description || 'Despesa'}" pode ser restaurada em até 30 dias` : undefined,
          duration: 5000,
          action: {
            label: 'Desfazer',
            onClick: async () => {
              try {
                const { error } = await (await import('@/integrations/supabase/client')).supabase
                  .from('expenses')
                  .update({ deleted_at: null } as any)
                  .eq('id', id);
                if (!error) { toast.success('Despesa restaurada!'); window.location.reload(); }
              } catch { /* silent */ }
            },
          },
        });
      } else {
        toast.success('Despesa excluída', {
          description: 'A lixeira ainda não está habilitada neste banco, então a exclusão foi permanente.',
          duration: 4000,
        });
      }
    } catch { toast.error('Erro ao remover'); }
  };

  const filteredCats = categories.filter(c =>
    !catSearch || c.name.toLowerCase().includes(catSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero Header */}
      <div className="hero-card flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-expense/20 blur-3xl rounded-full pointer-events-none" />
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-expense/30 to-expense/10 flex items-center justify-center shadow-inner border border-expense/20">
            <TrendingDown className="w-7 h-7 sm:w-8 sm:h-8 text-expense drop-shadow-md" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-1">Despesas</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-expense animate-pulse" />
              {hasActiveFilters ? `${filtered.length} de ` : ''}{totalItems} lançamentos neste mês
              {ccTransactions.length > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-md bg-[#6366f1]/10 text-[#6366f1] border border-[#6366f1]/20 font-medium">
                  <CreditCard className="w-3 h-3" />{ccTransactions.length} no cartão
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 relative z-10 w-full sm:w-auto mt-2 sm:mt-0">
          {/* Summary mini chips */}
          {ccTransactions.length > 0 && (
            <div className="hidden md:flex flex-col items-end gap-1">
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-muted-foreground">Débito/Espécie</span>
                <span className="text-sm font-bold text-expense">{formatCurrency(totalExpenses)}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-muted-foreground">Cartão de Crédito</span>
                <span className="text-sm font-bold text-[#6366f1]">{formatCurrency(totalCC)}</span>
              </div>
            </div>
          )}
          <div className="flex flex-col items-start sm:items-end mb-2 sm:mb-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Total Mensal</p>
            <p className="text-3xl sm:text-4xl font-extrabold text-expense currency drop-shadow-sm leading-none">{formatCurrency(totalExpenses + totalCC)}</p>
          </div>
          <div className="w-full h-px sm:w-px sm:h-12 bg-border/50 block sm:mx-2 my-2 sm:my-0" />
          <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-2">
            <div className="w-full sm:w-auto"><MonthSelector month={month} onChange={setMonth} /></div>
            <div className="w-full sm:w-auto"><TransactionDialog type="expense" /></div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cartao</p>
            <CreditCard className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-xl font-extrabold text-primary currency">{formatCurrency(creditTotal)}</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Debito / PIX</p>
            <Landmark className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-2 text-xl font-extrabold currency">{formatCurrency(accountTotal)}</p>
        </div>
        <div className="rounded-2xl border border-warning/25 bg-warning/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Em aberto</p>
            <Clock className="h-4 w-4 text-warning" />
          </div>
          <p className="mt-2 text-xl font-extrabold text-warning currency">{formatCurrency(scheduledTotal)}</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-2xl border border-border/60 bg-card/50 p-3 shadow-sm">
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por descrição..."
              value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)}
              className="h-10 w-full rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all shadow-sm"
            />
            {filterSearch && (
              <button onClick={() => setFilterSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* CC toggle */}
          {ccTransactions.length > 0 && (
            <button
              onClick={() => setShowCCOnly(v => !v)}
              className={`h-10 flex items-center gap-2 px-3.5 rounded-xl border text-sm font-medium transition-colors shadow-sm shrink-0 ${showCCOnly ? 'border-[#6366f1]/50 bg-[#6366f1]/10 text-[#6366f1]' : 'border-border/60 bg-card/50 text-foreground hover:bg-muted/50'}`}
              title="Mostrar apenas cartão de crédito"
            >
              <CreditCard className="w-4 h-4" />
              <span className="hidden sm:inline">Só Cartão</span>
            </button>
          )}

          {/* Filter panel button */}
          <Popover open={filterOpen} onOpenChange={(o) => { setFilterOpen(o); if (!o) setCatSearch(''); }}>
            <PopoverTrigger asChild>
              <button className={`h-10 flex items-center gap-2 px-3.5 rounded-xl border text-sm font-medium transition-colors shadow-sm shrink-0 ${activeFilterCount > 0 ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border/60 bg-card/50 text-foreground hover:bg-muted/50'}`}>
                <SlidersHorizontal className="w-4 h-4" />
                <span className="hidden sm:inline">Filtros</span>
                {activeFilterCount > 0 && (
                  <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0 shadow-xl" align="end">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
                <span className="text-sm font-bold">Filtros</span>
                {activeFilterCount > 0 && (
                  <button onClick={clearFilters} className="text-xs text-destructive font-medium hover:underline">
                    Limpar tudo
                  </button>
                )}
              </div>
              <div className="p-4 space-y-5 max-h-[460px] overflow-y-auto">

                {/* Status */}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Status (despesas)</p>
                  <div className="space-y-0.5">
                    {STATUSES.map(s => (
                      <button
                        key={s.value}
                        onClick={() => toggleStatus(s.value)}
                        className="flex items-center gap-2.5 w-full py-1.5 px-2 rounded-lg hover:bg-muted/60 transition-colors text-sm"
                      >
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${filterStatuses.includes(s.value) ? 'bg-primary border-primary' : 'border-border'}`}>
                          {filterStatuses.includes(s.value) && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                        </div>
                        <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${s.color}`} />
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Categories */}
                {categories.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Categoria</p>
                    {categories.length > 5 && (
                      <div className="relative mb-2">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Buscar categoria..."
                          value={catSearch}
                          onChange={e => setCatSearch(e.target.value)}
                          className="h-7 w-full rounded-lg border border-border/60 bg-muted/30 pl-7 pr-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                      </div>
                    )}
                    <div className="space-y-0.5 max-h-36 overflow-y-auto">
                      {filteredCats.map(c => (
                        <button
                          key={c.id}
                          onClick={() => toggleCategory(c.id)}
                          className="flex items-center gap-2.5 w-full py-1.5 px-2 rounded-lg hover:bg-muted/60 transition-colors text-sm"
                        >
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${filterCategories.includes(c.id) ? 'bg-primary border-primary' : 'border-border'}`}>
                            {filterCategories.includes(c.id) && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                          </div>
                          <span className="shrink-0">{c.icon}</span>
                          <span className="truncate">{c.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Accounts */}
                {accounts.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Conta (despesas)</p>
                    <div className="space-y-0.5">
                      {accounts.map(a => (
                        <button
                          key={a.id}
                          onClick={() => toggleAccount(a.id)}
                          className="flex items-center gap-2.5 w-full py-1.5 px-2 rounded-lg hover:bg-muted/60 transition-colors text-sm"
                        >
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${filterAccounts.includes(a.id) ? 'bg-primary border-primary' : 'border-border'}`}>
                            {filterAccounts.includes(a.id) && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                          </div>
                          <span className="shrink-0">{a.icon}</span>
                          <span className="truncate">{a.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Amount range */}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Valor (R$)</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      placeholder="Mínimo"
                      value={filterAmountMin}
                      onChange={e => setFilterAmountMin(e.target.value)}
                      className="h-8 w-full rounded-lg border border-border/60 bg-muted/30 px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    <span className="text-muted-foreground text-sm shrink-0">—</span>
                    <input
                      type="number"
                      min={0}
                      placeholder="Máximo"
                      value={filterAmountMax}
                      onChange={e => setFilterAmountMax(e.target.value)}
                      className="h-8 w-full rounded-lg border border-border/60 bg-muted/30 px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                </div>

                {/* Sort */}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Ordenar por</p>
                  <div className="flex items-center gap-2">
                    <select
                      value={sortBy}
                      onChange={e => setSortBy(e.target.value as typeof sortBy)}
                      className="flex-1 h-8 rounded-lg border border-border/60 bg-muted/30 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <option value="date">Data</option>
                      <option value="amount">Valor</option>
                      <option value="description">Descrição</option>
                      <option value="category">Categoria</option>
                      <option value="status">Status</option>
                    </select>
                    <button
                      onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                      title={sortDir === 'asc' ? 'Crescente' : 'Decrescente'}
                      className="h-8 w-8 flex items-center justify-center rounded-lg border border-border/60 bg-muted/30 hover:bg-muted transition-colors shrink-0"
                    >
                      {sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="h-10 flex items-center gap-1.5 px-3 rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/10 text-xs font-medium transition-colors shadow-sm bg-card/50 shrink-0"
            >
              <X className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Limpar</span>
            </button>
          )}
        </div>

        {/* Active filter chips */}
        {(activeFilterCount > 0 || showCCOnly) && (
          <div className="flex items-center gap-2 flex-wrap px-1">
            {showCCOnly && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#6366f1]/10 border border-[#6366f1]/20 text-[#6366f1] text-xs font-medium">
                <CreditCard className="w-3 h-3" /> Só Cartão
                <button onClick={() => setShowCCOnly(false)} className="hover:opacity-70 ml-0.5 transition-opacity">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filterStatuses.map(s => {
              const st = STATUSES.find(x => x.value === s);
              return (
                <span key={s} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted border border-border/60 text-xs font-medium">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${st?.color}`} />
                  {st?.label}
                  <button onClick={() => toggleStatus(s)} className="text-muted-foreground hover:text-foreground ml-0.5 transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
            {filterCategories.map(id => {
              const cat = categories.find(c => c.id === id);
              return cat ? (
                <span key={id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted border border-border/60 text-xs font-medium">
                  {cat.icon} {cat.name}
                  <button onClick={() => toggleCategory(id)} className="text-muted-foreground hover:text-foreground ml-0.5 transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ) : null;
            })}
            {filterAccounts.map(id => {
              const acc = accounts.find(a => a.id === id);
              return acc ? (
                <span key={id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted border border-border/60 text-xs font-medium">
                  {acc.icon} {acc.name}
                  <button onClick={() => toggleAccount(id)} className="text-muted-foreground hover:text-foreground ml-0.5 transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ) : null;
            })}
            {(filterAmountMin !== '' || filterAmountMax !== '') && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted border border-border/60 text-xs font-medium">
                R$ {filterAmountMin || '0'} — {filterAmountMax ? `R$ ${filterAmountMax}` : '∞'}
                <button onClick={() => { setFilterAmountMin(''); setFilterAmountMax(''); }} className="text-muted-foreground hover:text-foreground ml-0.5 transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Mobile card list */}
      <div className="sm:hidden stat-card p-0 overflow-hidden divide-y divide-border/40">
        {totalItems === 0 && !isLoading && (
          <div className="flex flex-col items-center py-16 gap-4 bg-muted/5">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center shadow-sm border border-border/50">
              <Receipt className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-foreground mb-1">Nenhuma despesa</p>
              <p className="text-xs text-muted-foreground">Clique em "Nova Despesa" para começar</p>
            </div>
          </div>
        )}
        {totalItems > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center py-12 gap-3">
            <Filter className="w-8 h-8 text-muted-foreground opacity-40" />
            <p className="text-sm font-medium text-muted-foreground">Nenhuma despesa encontrada</p>
            <button onClick={clearFilters} className="text-xs text-primary font-bold">Limpar filtros</button>
          </div>
        )}
        {filtered.map((item) => {
          const cat = categories.find(c => c.id === item.category_id);
          const isCC = item._type === 'cc';
          const cardColor = isCC ? getCardColor((item as CCRow).credit_card_id) : undefined;

          return (
            <div key={`${item._type}-${item.id}`} className={`p-4 flex flex-col gap-3 relative hover:bg-muted/10 transition-colors ${isCC ? 'bg-[#6366f1]/[0.02]' : ''}`}>
              <div
                className="absolute top-0 left-0 w-1 h-full"
                style={isCC
                  ? { backgroundColor: cardColor }
                  : { backgroundColor: (item as ExpenseRow).status === 'concluido' ? 'rgb(16 185 129 / 0.8)' : (item as ExpenseRow).status === 'pendente' ? 'rgb(245 158 11 / 0.8)' : 'rgb(59 130 246 / 0.8)' }
                }
              />
              <div className="flex items-center justify-between gap-3 pl-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-full flex items-center justify-center text-xl shrink-0 shadow-sm border ${isCC ? 'border-[#6366f1]/20' : 'border-border/60 bg-muted/40'}`}
                    style={isCC ? { backgroundColor: `${cardColor}20` } : undefined}
                  >
                    {isCC ? <CreditCard className="w-5 h-5" style={{ color: cardColor }} /> : (cat?.icon || '🛒')}
                  </div>
                  <div className="min-w-0 flex flex-col justify-center">
                    <div className="flex items-center gap-1.5 mb-1">
                      <p className="font-bold text-[15px] leading-tight truncate text-foreground/95">{item.description || 'Despesa'}</p>
                      {isCC && (item as CCRow).is_installment && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#6366f1]/10 text-[#6366f1] border border-[#6366f1]/20 font-bold shrink-0">
                          {(item as CCRow).installment_number}/{(item as CCRow).total_installments}x
                        </span>
                      )}
                      {!isCC && (item as ExpenseRow).attachment_url && (
                        <a href={(item as ExpenseRow).attachment_url!} target="_blank" rel="noopener noreferrer" className="text-primary shrink-0 hover:scale-110 transition-transform">
                          <Paperclip className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {isCC
                        ? <span className="text-muted-foreground">{formatDate(item.date)}</span>
                        : <DatePicker date={item.date} onChange={d => handleDateChange(item.id, d)} />
                      }
                      {isCC
                        ? <span className="text-muted-foreground">{getCategoryName(item.category_id)}</span>
                        : <OptionPicker value={item.category_id} options={categories} placeholder="Categoria" onChange={v => handleCategoryChange(item.id, v)} hideIcon />
                      }
                    </div>
                  </div>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1.5">
                  <p className="font-extrabold text-expense text-lg tabular-nums leading-none tracking-tight">{formatCurrency(Number(item.amount))}</p>
                  {isCC ? (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border"
                      style={{ color: cardColor, borderColor: `${cardColor}40`, backgroundColor: `${cardColor}15` }}
                    >
                      <CreditCard className="w-3 h-3" />
                      {getCardName((item as CCRow).credit_card_id)}
                    </span>
                  ) : (
                    <StatusPicker status={(item as ExpenseRow).status} onChange={s => handleStatusChange(item.id, s)} />
                  )}
                </div>
              </div>
              {!isCC && (
                <div className="flex items-center justify-between pt-2.5 pl-2 mt-1">
                  <div className="flex items-center gap-2">
                    {hourlyRate > 0 && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium bg-muted/20 px-2 py-1 rounded-full border border-border/40">
                        <Clock className="w-3 h-3 text-accent-foreground/60" />{formatWorkTime(calcWorkTime(Number(item.amount)))}
                      </span>
                    )}
                    {(item as ExpenseRow).account_id && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium bg-muted/20 px-2 py-1 rounded-full border border-border/40">
                        {getAccountName((item as ExpenseRow).account_id, true)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setEditing({ ...(item as ExpenseRow), type: 'expense' })} className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors bg-muted/20">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors bg-muted/20">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 bg-expense/5 border-t border-expense/10">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total filtrado</span>
            <span className="font-extrabold text-expense currency">{formatCurrency(total)}</span>
          </div>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block rounded-2xl border border-border/70 bg-card/70 p-3 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3.5 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Data</th>
                <th className="text-left py-3.5 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Descrição</th>
                <th className="text-left py-3.5 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Categoria</th>
                <th className="text-left py-3.5 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Status / Cartão</th>
                <th className="text-right py-3.5 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Valor</th>
                {hourlyRate && <th className="text-center py-3.5 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Trabalho</th>}
                <th className="text-left py-3.5 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Conta</th>
                <th className="py-3.5 px-4 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const isCC = item._type === 'cc';
                const wt = calcWorkTime(Number(item.amount));
                const cardColor = isCC ? getCardColor((item as CCRow).credit_card_id) : undefined;

                if (isCC) {
                  const cc = item as CCRow;
                  return (
                    <tr key={`cc-${cc.id}`} className="border-b border-border/30 hover:bg-[#6366f1]/[0.03] transition-all" style={{ borderLeftColor: cardColor, borderLeftWidth: 3 }}>
                      <td className="py-3.5 px-4 text-muted-foreground text-sm">{formatDate(cc.date)}</td>
                      <td className="py-3.5 px-4 font-medium">
                        <div className="flex items-center gap-2">
                          {cc.description || 'Compra'}
                          {cc.is_installment && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold border" style={{ color: cardColor, borderColor: `${cardColor}40`, backgroundColor: `${cardColor}15` }}>
                              {cc.installment_number}/{cc.total_installments}x
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground text-xs">{getCategoryName(cc.category_id)}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border"
                          style={{ color: cardColor, borderColor: `${cardColor}40`, backgroundColor: `${cardColor}15` }}
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          {getCardName(cc.credit_card_id)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right currency font-bold text-expense">{formatCurrency(Number(cc.amount))}</td>
                      {hourlyRate && (
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent/50 text-xs font-semibold text-accent-foreground">
                            <Clock className="w-3 h-3" />{formatWorkTime(wt)}
                          </span>
                        </td>
                      )}
                      <td className="py-3.5 px-4 text-xs text-muted-foreground">—</td>
                      <td className="py-3.5 px-4">
                        <a href="/cartoes" className="text-[10px] text-muted-foreground hover:text-[#6366f1] transition-colors flex items-center gap-1 opacity-0 group-hover:opacity-100">
                          Ver fatura →
                        </a>
                      </td>
                    </tr>
                  );
                }

                const exp = item as ExpenseRow;
                return (
                  <tr key={`exp-${exp.id}`} className="border-b border-border/30 hover:bg-muted/40 transition-all group">
                    <td className="py-3.5 px-4">
                      <DatePicker date={exp.date} onChange={d => handleDateChange(exp.id, d)} />
                    </td>
                    <td className="border-y border-border/50 bg-background/45 py-3.5 px-4 font-semibold group-hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-1.5">
                        {exp.description || 'Despesa'}
                        {exp.attachment_url && (
                          <a href={exp.attachment_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
                            <Paperclip className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <OptionPicker value={exp.category_id} options={categories} placeholder="Categoria" onChange={v => handleCategoryChange(exp.id, v)} />
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusPicker status={exp.status} onChange={s => handleStatusChange(exp.id, s)} />
                    </td>
                    <td className="py-3.5 px-4 text-right currency font-bold text-expense">{formatCurrency(Number(exp.amount))}</td>
                    {hourlyRate && (
                      <td className="border-y border-border/50 bg-background/45 py-3.5 px-4 text-center group-hover:bg-muted/30 transition-colors">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent/50 text-xs font-semibold text-accent-foreground">
                          <Clock className="w-3 h-3" />{formatWorkTime(wt)}
                        </span>
                      </td>
                    )}
                    <td className="py-3.5 px-4">
                      <OptionPicker value={exp.account_id} options={accounts} placeholder="Conta" onChange={v => handleAccountChange(exp.id, v)} />
                    </td>
                    <td className="rounded-r-xl border-y border-r border-border/50 bg-background/45 py-3.5 px-4 group-hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => setEditing({ ...exp, type: 'expense' })} className="text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all p-1.5 rounded-lg">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(exp.id)} className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all p-1.5 rounded-lg">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {totalItems === 0 && !isLoading && (
                <tr><td colSpan={hourlyRate ? 8 : 7} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center">
                      <Receipt className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Nenhuma despesa neste mês</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">Adicione uma despesa para começar a acompanhar</p>
                    </div>
                  </div>
                </td></tr>
              )}
              {totalItems > 0 && filtered.length === 0 && (
                <tr><td colSpan={hourlyRate ? 8 : 7} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <Filter className="w-8 h-8 text-muted-foreground opacity-40" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Nenhuma despesa com esses filtros</p>
                      <button onClick={clearFilters} className="text-xs text-primary underline mt-1">Limpar filtros</button>
                    </div>
                  </div>
                </td></tr>
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/20">
                  <td colSpan={3} className="py-3.5 px-4 font-bold text-xs uppercase tracking-wider text-muted-foreground">TOTAL FILTRADO</td>
                  <td className="py-3.5 px-4 text-xs text-muted-foreground">
                    {ccTransactions.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-[#6366f1]/10 text-[#6366f1] font-medium">
                        <CreditCard className="w-3 h-3" /> CC: {formatCurrency(totalCC)}
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right currency font-extrabold text-expense">{formatCurrency(total)}</td>
                  {hourlyRate && (
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent/50 text-xs font-bold text-accent-foreground">
                        <Clock className="w-3 h-3" />{formatWorkTime(calcWorkTime(total))}
                      </span>
                    </td>
                  )}
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {editing && (
        <EditTransactionDialog
          open={!!editing}
          onOpenChange={(open) => !open && setEditing(null)}
          transaction={editing}
        />
      )}
    </div>
  );
}
