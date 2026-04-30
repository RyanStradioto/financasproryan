import { useState } from 'react';
import { useExpenses, useDeleteExpense, useUpdateExpense, useCategories, useAccounts, type Expense } from '@/hooks/useFinanceData';
import { getMonthYear, formatCurrency, formatDate, getStatusColor, getStatusLabel } from '@/lib/format';
import { formatWorkTime } from '@/lib/workTime';
import { useWorkTimeCalc } from '@/hooks/useProfile';
import MonthSelector from '@/components/finance/MonthSelector';
import TransactionDialog from '@/components/finance/TransactionDialog';
import EditTransactionDialog from '@/components/finance/EditTransactionDialog';
import { Trash2, Pencil, Paperclip, Clock, ChevronDown, Filter, Search, X, TrendingDown, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

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
  { value: 'concluido', label: 'Concluído' },
  { value: 'pendente',  label: 'Pendente'  },
  { value: 'agendado',  label: 'Agendado'  },
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
            <span className={`inline-block w-2 h-2 rounded-full ${s.value === 'concluido' ? 'bg-success' : s.value === 'pendente' ? 'bg-warning' : 'bg-info'}`} />
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
  const deleteExpense = useDeleteExpense();
  const updateExpense = useUpdateExpense();
  const [editing, setEditing] = useState<(Expense & { type: 'expense' }) | null>(null);
  const { calcWorkTime, hourlyRate } = useWorkTimeCalc();

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await updateExpense.mutateAsync({ id, status });
    } catch { toast.error('Erro ao atualizar status'); }
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
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterAccount, setFilterAccount] = useState('');

  const activeFilters = !!(filterSearch || filterStatus || filterCategory || filterAccount);
  const clearFilters = () => { setFilterSearch(''); setFilterStatus(''); setFilterCategory(''); setFilterAccount(''); };

  const STATUS_ORDER: Record<string, number> = { concluido: 0, pendente: 1, agendado: 2 };

  const filtered = expenses.filter(e => {
    if (filterStatus && e.status !== filterStatus) return false;
    if (filterCategory && e.category_id !== filterCategory) return false;
    if (filterAccount && e.account_id !== filterAccount) return false;
    if (filterSearch && !e.description?.toLowerCase().includes(filterSearch.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    const sa = STATUS_ORDER[a.status] ?? 99;
    const sb = STATUS_ORDER[b.status] ?? 99;
    if (sa !== sb) return sa - sb;
    const catA = categories.find(c => c.id === a.category_id)?.name ?? '';
    const catB = categories.find(c => c.id === b.category_id)?.name ?? '';
    if (catA !== catB) return catA.localeCompare(catB);
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  const total = filtered.reduce((s, e) => s + Number(e.amount), 0);

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
                if (!error) {
                  toast.success('Despesa restaurada!');
                  window.location.reload();
                }
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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Premium Hero Header */}
      <div className="hero-card flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-expense/20 blur-3xl rounded-full pointer-events-none" />
        
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-expense/30 to-expense/10 flex items-center justify-center shadow-inner border border-expense/20">
            <TrendingDown className="w-7 h-7 sm:w-8 sm:h-8 text-expense drop-shadow-md" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-1">Despesas</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-expense animate-pulse" />
              {activeFilters ? `${filtered.length} de ` : ''}{expenses.length} lançamentos neste mês
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 relative z-10 w-full sm:w-auto mt-2 sm:mt-0">
          <div className="flex flex-col items-start sm:items-end mb-2 sm:mb-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Total Mensal</p>
            <p className="text-3xl sm:text-4xl font-extrabold text-expense currency drop-shadow-sm leading-none">{formatCurrency(total)}</p>
          </div>
          <div className="w-full h-px sm:w-px sm:h-12 bg-border/50 block sm:mx-2 my-2 sm:my-0" />
          <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-none w-full sm:w-auto">
            <div className="shrink-0"><MonthSelector month={month} onChange={setMonth} /></div>
            <div className="shrink-0"><TransactionDialog type="expense" /></div>
          </div>
        </div>
      </div>

      {/* Modern Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-1">
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
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="h-10 rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm px-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer shadow-sm appearance-none pr-8 relative bg-no-repeat bg-[position:right_0.75rem_center] bg-[length:16px_12px]"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")` }}
          >
            <option value="">Todos Status</option>
            <option value="concluido">Concluído</option>
            <option value="pendente">Pendente</option>
            <option value="agendado">Agendado</option>
          </select>
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="h-10 rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm px-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer shadow-sm appearance-none pr-8 relative bg-no-repeat bg-[position:right_0.75rem_center] bg-[length:16px_12px]"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")` }}
          >
            <option value="">Todas Categorias</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
          {accounts.length > 0 && (
            <select
              value={filterAccount}
              onChange={e => setFilterAccount(e.target.value)}
              className="h-10 rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm px-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer shadow-sm appearance-none pr-8 relative bg-no-repeat bg-[position:right_0.75rem_center] bg-[length:16px_12px] max-w-[150px]"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")` }}
            >
              <option value="">Todas Contas</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
            </select>
          )}
          {activeFilters && (
            <button
              onClick={clearFilters}
              className="h-10 flex items-center gap-1.5 px-4 rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/10 text-xs font-medium transition-colors shadow-sm bg-card/50 backdrop-blur-sm shrink-0"
            >
              <X className="w-3.5 h-3.5" /> Limpar
            </button>
          )}
        </div>
      </div>

      {/* Mobile card list - Premium Flat Design */}
      <div className="sm:hidden stat-card p-0 overflow-hidden divide-y divide-border/40">
        {expenses.length === 0 && !isLoading && (
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
        {expenses.length > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center py-12 gap-3">
            <Filter className="w-8 h-8 text-muted-foreground opacity-40" />
            <p className="text-sm font-medium text-muted-foreground">Nenhuma despesa encontrada</p>
            <button onClick={clearFilters} className="text-xs text-primary font-bold">Limpar filtros</button>
          </div>
        )}
        {filtered.map((item) => {
          const cat = categories.find(c => c.id === item.category_id);
          return (
          <div key={item.id} className="p-4 flex flex-col gap-3 relative hover:bg-muted/10 transition-colors">
            <div className={`absolute top-0 left-0 w-1 h-full ${item.status === 'concluido' ? 'bg-success/80' : item.status === 'pendente' ? 'bg-warning/80' : 'bg-info/80'}`} />
            <div className="flex items-center justify-between gap-3 pl-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-full bg-muted/40 flex items-center justify-center text-xl shrink-0 shadow-sm border border-border/60">
                  {cat?.icon || '🛒'}
                </div>
                <div className="min-w-0 flex flex-col justify-center">
                  <div className="flex items-center gap-1.5 mb-1">
                    <p className="font-bold text-[15px] leading-tight truncate text-foreground/95">{item.description || 'Despesa'}</p>
                    {item.attachment_url && (
                      <a href={item.attachment_url} target="_blank" rel="noopener noreferrer" className="text-primary shrink-0 hover:scale-110 transition-transform">
                        <Paperclip className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap text-xs">
                    <DatePicker date={item.date} onChange={d => handleDateChange(item.id, d)} />
                    <span className="text-muted-foreground/30">•</span>
                    <OptionPicker value={item.category_id} options={categories} placeholder="Categoria" onChange={v => handleCategoryChange(item.id, v)} hideIcon />
                  </div>
                </div>
              </div>
              <div className="shrink-0 flex flex-col items-end gap-1.5">
                <p className="font-extrabold text-expense text-lg tabular-nums leading-none tracking-tight">{formatCurrency(Number(item.amount))}</p>
                <StatusPicker status={item.status} onChange={s => handleStatusChange(item.id, s)} />
              </div>
            </div>
            
            {/* Quick Actions Footer */}
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
                <button
                  onClick={() => setEditing({ ...item, type: 'expense' })}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors bg-muted/20"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors bg-muted/20"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )})}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-expense/8 border border-expense/15">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total</span>
            <span className="font-extrabold text-expense currency">{formatCurrency(total)}</span>
          </div>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block stat-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm data-table">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3.5 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Data</th>
                <th className="text-left py-3.5 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Descrição</th>
                <th className="text-left py-3.5 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Categoria</th>
                <th className="text-left py-3.5 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="text-right py-3.5 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Valor</th>
                {hourlyRate && <th className="text-center py-3.5 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Trabalho</th>}
                <th className="text-left py-3.5 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Conta</th>
                <th className="py-3.5 px-4 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const wt = calcWorkTime(Number(item.amount));
                return (
                  <tr key={item.id} className="border-b border-border/30 hover:bg-muted/40 transition-all group">
                    <td className="py-3.5 px-4">
                      <DatePicker date={item.date} onChange={d => handleDateChange(item.id, d)} />
                    </td>
                    <td className="py-3.5 px-4 font-medium">
                      <div className="flex items-center gap-1.5">
                        {item.description || 'Despesa'}
                        {item.attachment_url && (
                          <a href={item.attachment_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
                            <Paperclip className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <OptionPicker value={item.category_id} options={categories} placeholder="Categoria" onChange={v => handleCategoryChange(item.id, v)} />
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusPicker status={item.status} onChange={s => handleStatusChange(item.id, s)} />
                    </td>
                    <td className="py-3.5 px-4 text-right currency font-bold text-expense">{formatCurrency(Number(item.amount))}</td>
                    {hourlyRate && (
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent/50 text-xs font-semibold text-accent-foreground">
                          <Clock className="w-3 h-3" />
                          {formatWorkTime(wt)}
                        </span>
                      </td>
                    )}
                    <td className="py-3.5 px-4">
                      <OptionPicker value={item.account_id} options={accounts} placeholder="Conta" onChange={v => handleAccountChange(item.id, v)} />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => setEditing({ ...item, type: 'expense' })} className="text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all p-1.5 rounded-lg">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all p-1.5 rounded-lg">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {expenses.length === 0 && !isLoading && (
                <tr><td colSpan={hourlyRate ? 8 : 7} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center">
                      <Trash2 className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Nenhuma despesa neste mês</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">Adicione uma despesa para começar a acompanhar</p>
                    </div>
                  </div>
                </td></tr>
              )}
              {expenses.length > 0 && filtered.length === 0 && (
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
                  <td colSpan={4} className="py-3.5 px-4 font-bold text-xs uppercase tracking-wider text-muted-foreground">TOTAL</td>
                  <td className="py-3.5 px-4 text-right currency font-extrabold text-expense">{formatCurrency(total)}</td>
                  {hourlyRate && (
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent/50 text-xs font-bold text-accent-foreground">
                        <Clock className="w-3 h-3" />
                        {formatWorkTime(calcWorkTime(total))}
                      </span>
                    </td>
                  )}
                  <td colSpan={2}></td>
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
