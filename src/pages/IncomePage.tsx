import { useState, useMemo } from 'react';
import { useIncome, useDeleteIncome, useUpdateIncome, useAccounts, type Income } from '@/hooks/useFinanceData';
import { getMonthYear, formatCurrency, formatDate, getStatusColor, getStatusLabel } from '@/lib/format';
import { formatWorkTime } from '@/lib/workTime';
import { useWorkTimeCalc } from '@/hooks/useProfile';
import MonthSelector from '@/components/finance/MonthSelector';
import TransactionDialog from '@/components/finance/TransactionDialog';
import EditTransactionDialog from '@/components/finance/EditTransactionDialog';
import { Trash2, Pencil, Paperclip, Clock, TrendingUp, ChevronDown, Search, X, Filter, PiggyBank, SlidersHorizontal, Check, ArrowUp, ArrowDown, ArrowUpRight, ArrowDownRight, Landmark, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { accountBrandFromRow } from '@/lib/accountBrand';

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

export default function IncomePage() {
  const [month, setMonth] = useState(getMonthYear());
  // Previous month for MoM delta
  const prevMonth = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, [month]);

  const { data: income = [], isLoading } = useIncome(month);
  const { data: prevIncome = [] } = useIncome(prevMonth);
  const { data: accounts = [] } = useAccounts();
  const [selectedAccountId, setSelectedAccountId] = useState<string>('__all__');
  const deleteIncome = useDeleteIncome();
  const updateIncome = useUpdateIncome();
  const [editing, setEditing] = useState<(Income & { type: 'income' }) | null>(null);
  const { calcWorkTime, hourlyRate } = useWorkTimeCalc();

  const handleStatusChange = async (id: string, status: string) => {
    try { await updateIncome.mutateAsync({ id, status }); }
    catch { toast.error('Erro ao atualizar status'); }
  };

  const handleDateChange = async (id: string, date: string) => {
    try { await updateIncome.mutateAsync({ id, date }); }
    catch { toast.error('Erro ao atualizar data'); }
  };

  const handleAccountChange = async (id: string, account_id: string | null) => {
    try { await updateIncome.mutateAsync({ id, account_id: account_id ?? undefined }); }
    catch { toast.error('Erro ao atualizar conta'); }
  };

  // Filters
  const [filterSearch, setFilterSearch] = useState('');
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [filterAccounts, setFilterAccounts] = useState<string[]>([]);
  const [filterAmountMin, setFilterAmountMin] = useState('');
  const [filterAmountMax, setFilterAmountMax] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'description' | 'status'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [filterOpen, setFilterOpen] = useState(false);

  const toggleStatus  = (v: string) => setFilterStatuses(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);
  const toggleAccount = (v: string) => setFilterAccounts(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);

  const activeFilterCount = filterStatuses.length + filterAccounts.length +
    (filterAmountMin !== '' ? 1 : 0) + (filterAmountMax !== '' ? 1 : 0);
  const hasActiveFilters = !!(filterSearch || activeFilterCount > 0);

  const clearFilters = () => {
    setFilterSearch(''); setFilterStatuses([]); setFilterAccounts([]);
    setFilterAmountMin(''); setFilterAmountMax('');
  };

  const STATUS_ORDER: Record<string, number> = { concluido: 0, pendente: 1, agendado: 2 };

  const scopedIncome = useMemo(() => {
    if (selectedAccountId === '__all__') return income;
    return income.filter(i => i.account_id === selectedAccountId);
  }, [income, selectedAccountId]);

  const filtered = scopedIncome.filter(i => {
    if (filterStatuses.length > 0 && !filterStatuses.includes(i.status)) return false;
    if (filterAccounts.length > 0 && !filterAccounts.includes(i.account_id ?? '')) return false;
    if (filterAmountMin !== '' && Number(i.amount) < Number(filterAmountMin)) return false;
    if (filterAmountMax !== '' && Number(i.amount) > Number(filterAmountMax)) return false;
    if (filterSearch && !i.description?.toLowerCase().includes(filterSearch.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'date')        cmp = new Date(b.date).getTime() - new Date(a.date).getTime();
    if (sortBy === 'amount')      cmp = Number(b.amount) - Number(a.amount);
    if (sortBy === 'description') cmp = (a.description ?? '').localeCompare(b.description ?? '');
    if (sortBy === 'status')      cmp = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
    return sortDir === 'asc' ? -cmp : cmp;
  });

  const total = filtered.reduce((s, i) => s + Number(i.amount), 0);

  // â”€â”€ Stats for hero â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const totalAll = useMemo(() => scopedIncome.reduce((s, i) => s + Number(i.amount), 0), [scopedIncome]);
  const totalReceived = useMemo(() => scopedIncome.filter(i => i.status === 'concluido').reduce((s, i) => s + Number(i.amount), 0), [scopedIncome]);
  const totalPending = useMemo(() => scopedIncome.filter(i => i.status !== 'concluido').reduce((s, i) => s + Number(i.amount), 0), [scopedIncome]);
  const prevTotalAll = useMemo(() => prevIncome.reduce((s, i) => s + Number(i.amount), 0), [prevIncome]);
  const incomeDelta = useMemo(() => {
    if (prevTotalAll === 0) return totalAll > 0 ? 100 : null;
    return ((totalAll - prevTotalAll) / prevTotalAll) * 100;
  }, [totalAll, prevTotalAll]);

  const getAccountName = (id: string | null, hideIcon = false) => {
    if (!id) return '—';
    const acc = accounts.find(a => a.id === id);
    return acc ? (hideIcon ? acc.name : `${acc.icon} ${acc.name}`) : '—';
  };

  const handleDelete = async (id: string) => {
    const item = income.find(i => i.id === id);
    try {
      const result = await deleteIncome.mutateAsync(id);
      if (result.softDeleted) {
        toast.success('Receita movida para lixeira', {
          description: item ? `"${item.description || 'Receita'}" pode ser restaurada em até 30 dias` : undefined,
          duration: 5000,
          action: {
            label: 'Desfazer',
            onClick: async () => {
              try {
                const { error } = await (await import('@/integrations/supabase/client')).supabase
                  .from('income')
                  .update({ deleted_at: null })
                  .eq('id', id);
                if (!error) { toast.success('Receita restaurada!'); window.location.reload(); }
              } catch { /* silent */ }
            },
          },
        });
      } else {
        toast.success('Receita excluída', {
          description: 'A lixeira ainda não está habilitada neste banco, então a exclusão foi permanente.',
          duration: 4000,
        });
      }
    } catch { toast.error('Erro ao remover'); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* â”€â”€â”€ Hero Header â”€â”€â”€ */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-income/[0.06] p-4 shadow-sm sm:rounded-3xl sm:p-7">
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-income/15 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute -bottom-32 -left-20 w-64 h-64 bg-income/[0.06] blur-3xl rounded-full pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-5">
          {/* Title row */}
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-income/25 to-income/5 flex items-center justify-center shadow-inner border border-income/15 shrink-0">
                <TrendingUp className="w-6 h-6 sm:w-7 sm:h-7 text-income" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-none">Receitas</h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-income animate-pulse" />
                    {hasActiveFilters ? `${filtered.length} de ${scopedIncome.length}` : scopedIncome.length} {scopedIncome.length === 1 ? 'recebimento' : 'recebimentos'}
                  </span>
                  {incomeDelta !== null && incomeDelta !== 0 && (
                    <span className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold text-[10px] uppercase tracking-wide border',
                      incomeDelta > 0 ? 'bg-income/10 text-income border-income/20' : 'bg-expense/10 text-expense border-expense/20',
                    )}>
                      {incomeDelta > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {Math.abs(incomeDelta).toFixed(0)}% vs anterior
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex w-full min-w-0 flex-col gap-2 min-[430px]:flex-row sm:w-auto sm:items-center sm:gap-3 sm:shrink-0 sm:flex-nowrap">
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger className="h-9 min-[430px]:w-[170px] sm:w-[190px]">
                  <SelectValue placeholder="Conta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas as contas</SelectItem>
                  {accounts.filter(a => !a.archived).map(a => {
                    const brand = accountBrandFromRow(a);
                    return (
                      <SelectItem key={a.id} value={a.id}>
                        <span className="inline-flex items-center gap-2">
                          {brand.logoUrl ? (
                            <img src={brand.logoUrl} alt={a.name} className="h-4 w-4 object-contain inline-block" />
                          ) : (
                            <span>{a.icon}</span>
                          )}
                          {a.name}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <MonthSelector month={month} onChange={setMonth} />
              <TransactionDialog type="income" defaultAccountId={selectedAccountId === '__all__' ? undefined : selectedAccountId} />
            </div>
          </div>

          {/* Total + breakdown chips */}
          <div className="flex flex-col md:flex-row items-stretch md:items-end justify-between gap-5 pt-1">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/80 mb-1.5">Total no mês</p>
              <p className="text-3xl min-[390px]:text-4xl sm:text-5xl font-black text-income currency leading-none tracking-tight truncate max-w-full">{formatCurrency(totalAll)}</p>
            </div>

            {/* Stats chips: Recebido | Pendente | Trabalho equivalente */}
            <div className="grid grid-cols-1 gap-2 min-[430px]:grid-cols-3 md:gap-3 md:max-w-md w-full">
              <div className="rounded-xl border border-income/25 bg-income/[0.06] px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-income mb-0.5">
                  <Check className="h-3 w-3" />
                  <p className="text-[9px] font-bold uppercase tracking-wider">Recebido</p>
                </div>
                <p className="text-sm sm:text-base font-extrabold currency text-income tabular-nums whitespace-nowrap truncate">{formatCurrency(totalReceived)}</p>
              </div>
              <div className="rounded-xl border border-warning/25 bg-warning/[0.06] px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-warning mb-0.5">
                  <Clock className="h-3 w-3" />
                  <p className="text-[9px] font-bold uppercase tracking-wider">A receber</p>
                </div>
                <p className="text-sm sm:text-base font-extrabold currency text-warning tabular-nums whitespace-nowrap truncate">{formatCurrency(totalPending)}</p>
              </div>
              {hourlyRate > 0 ? (
                <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm px-3 py-2.5">
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
                    <Clock className="h-3 w-3" />
                    <p className="text-[9px] font-bold uppercase tracking-wider">Trabalho</p>
                  </div>
                  <p className="text-sm sm:text-base font-extrabold tabular-nums whitespace-nowrap truncate">{formatWorkTime(calcWorkTime(totalReceived))}</p>
                </div>
              ) : (
                <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm px-3 py-2.5">
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
                    <Landmark className="h-3 w-3" />
                    <p className="text-[9px] font-bold uppercase tracking-wider">Contas</p>
                  </div>
                  <p className="text-sm sm:text-base font-extrabold tabular-nums whitespace-nowrap truncate">{accounts.length}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="space-y-2 p-1">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {/* Search */}
          <div className="relative w-full sm:max-w-md sm:flex-1">
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

          {/* Filter panel button */}
          <div className="grid grid-cols-[1fr_auto] gap-2 sm:flex sm:items-center">
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
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
              <div className="p-4 space-y-5 max-h-[420px] overflow-y-auto">

                {/* Status */}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Status</p>
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

                {/* Accounts */}
                {accounts.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Conta</p>
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
        </div>

        {/* Active filter chips */}
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-2 flex-wrap px-1">
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
        {scopedIncome.length === 0 && !isLoading && (
          <div className="flex flex-col items-center py-16 gap-4 bg-muted/5">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center shadow-sm border border-border/50">
              <PiggyBank className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-foreground mb-1">Nenhuma receita</p>
              <p className="text-xs text-muted-foreground">Clique em "Nova Receita" para começar</p>
            </div>
          </div>
        )}
        {scopedIncome.length > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center py-12 gap-3">
            <Filter className="w-8 h-8 text-muted-foreground opacity-40" />
            <p className="text-sm font-medium text-muted-foreground">Nenhuma receita encontrada</p>
            <button onClick={clearFilters} className="text-xs text-primary font-bold">Limpar filtros</button>
          </div>
        )}
        {filtered.map((item) => (
          <div key={item.id} className="p-4 flex flex-col gap-3 relative hover:bg-muted/10 transition-colors">
            <div className={`absolute top-0 left-0 w-1 h-full ${item.status === 'concluido' ? 'bg-success/80' : item.status === 'pendente' ? 'bg-warning/80' : 'bg-info/80'}`} />
            <div className="flex items-start justify-between gap-3 pl-2">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-income/10 flex items-center justify-center text-income text-xl shrink-0 shadow-sm border border-income/30">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex flex-col justify-center">
                  <div className="flex items-center gap-1.5 mb-1">
                    <p className="font-bold text-[15px] leading-tight truncate text-foreground/95">{item.description || 'Receita'}</p>
                    {item.attachment_url && (
                      <a href={item.attachment_url} target="_blank" rel="noopener noreferrer" className="text-primary shrink-0 hover:scale-110 transition-transform">
                        <Paperclip className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <DatePicker date={item.date} onChange={d => handleDateChange(item.id, d)} />
                  </div>
                </div>
              </div>
              <div className="shrink-0 flex flex-col items-end gap-1.5">
                <p className="mobile-card-value font-extrabold text-income text-base min-[390px]:text-lg tabular-nums tracking-tight">+{formatCurrency(Number(item.amount))}</p>
                <StatusPicker status={item.status} onChange={s => handleStatusChange(item.id, s)} />
              </div>
            </div>
            <div className="flex items-center justify-between pt-2.5 pl-2 mt-1">
              <div className="flex items-center gap-2">
                {hourlyRate > 0 && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium bg-muted/20 px-2 py-1 rounded-full border border-border/40">
                    <Clock className="w-3 h-3 text-accent-foreground/60" />{formatWorkTime(calcWorkTime(Number(item.amount)))}
                  </span>
                )}
                {item.account_id && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium bg-muted/20 px-2 py-1 rounded-full border border-border/40">
                    {getAccountName(item.account_id, true)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setEditing({ ...item, type: 'income' })} className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors bg-muted/20">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(item.id)} className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors bg-muted/20">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-income/8 border border-income/15">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total</span>
            <span className="font-extrabold text-income currency">{formatCurrency(total)}</span>
          </div>
        )}
      </div>

      {/* â”€â”€â”€ Desktop table â”€â”€â”€ */}
      <div className="hidden sm:block rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 border-b border-border/60">
                <th className="text-left py-3 px-5 font-semibold text-[10px] uppercase tracking-[0.1em] text-muted-foreground/80 w-[110px]">Data</th>
                <th className="text-left py-3 px-3 font-semibold text-[10px] uppercase tracking-[0.1em] text-muted-foreground/80">Descrição</th>
                <th className="text-left py-3 px-3 font-semibold text-[10px] uppercase tracking-[0.1em] text-muted-foreground/80 w-[160px]">Status / Conta</th>
                <th className="text-right py-3 px-3 font-semibold text-[10px] uppercase tracking-[0.1em] text-muted-foreground/80 w-[130px]">Valor</th>
                {hourlyRate && <th className="text-center py-3 px-3 font-semibold text-[10px] uppercase tracking-[0.1em] text-muted-foreground/80 w-[110px]">Equivalente</th>}
                <th className="py-3 px-3 w-[80px]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filtered.map((item) => {
                const wt = calcWorkTime(Number(item.amount));
                const statusColor =
                  item.status === 'concluido' ? 'rgb(16 185 129)' :
                  item.status === 'pendente' ? 'rgb(245 158 11)' :
                  'rgb(59 130 246)';
                return (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors group relative">
                    <td className="py-3 pl-5 pr-3 relative">
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full opacity-70" style={{ backgroundColor: statusColor }} />
                      <DatePicker date={item.date} onChange={d => handleDateChange(item.id, d)} />
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-foreground">{item.description || 'Receita'}</span>
                        {item.attachment_url && (
                          <a href={item.attachment_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 shrink-0">
                            <Paperclip className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-col gap-1 items-start">
                        <StatusPicker status={item.status} onChange={s => handleStatusChange(item.id, s)} />
                        <OptionPicker value={item.account_id} options={accounts} placeholder="conta…" onChange={v => handleAccountChange(item.id, v)} />
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right currency font-bold text-income tabular-nums whitespace-nowrap">+{formatCurrency(Number(item.amount))}</td>
                    {hourlyRate && (
                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent/40 text-[11px] font-semibold text-accent-foreground/90">
                          <Clock className="w-3 h-3" />{formatWorkTime(wt)}
                        </span>
                      </td>
                    )}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setEditing({ ...item, type: 'income' })} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {scopedIncome.length === 0 && !isLoading && (
                <tr><td colSpan={hourlyRate ? 6 : 5} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center">
                      <Receipt className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Nenhuma receita neste mês</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">Adicione uma receita para começar a acompanhar</p>
                    </div>
                  </div>
                </td></tr>
              )}
              {scopedIncome.length > 0 && filtered.length === 0 && (
                <tr><td colSpan={hourlyRate ? 6 : 5} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <Filter className="w-8 h-8 text-muted-foreground opacity-40" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Nenhuma receita com esses filtros</p>
                      <button onClick={clearFilters} className="text-xs text-primary underline mt-1">Limpar filtros</button>
                    </div>
                  </div>
                </td></tr>
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="border-t border-border/60 bg-gradient-to-r from-muted/30 via-income/[0.04] to-muted/30">
                  <td colSpan={3} className="py-3.5 pl-5 pr-3 font-bold text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                    Total filtrado
                  </td>
                  <td className="py-3.5 px-3 text-right currency font-black text-income text-base tabular-nums whitespace-nowrap">+{formatCurrency(total)}</td>
                  {hourlyRate && (
                    <td className="py-3.5 px-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-accent/50 text-[11px] font-bold text-accent-foreground">
                        <Clock className="w-3 h-3" />{formatWorkTime(calcWorkTime(total))}
                      </span>
                    </td>
                  )}
                  <td className="py-3.5 px-3"></td>
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

