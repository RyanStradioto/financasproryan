import { useState } from 'react';
import { useExpenses, useDeleteExpense, useUpdateExpense, useCategories, useAccounts, type Expense } from '@/hooks/useFinanceData';
import { getMonthYear, formatCurrency, formatDate, getStatusColor, getStatusLabel } from '@/lib/format';
import { formatWorkTime } from '@/lib/workTime';
import { useWorkTimeCalc } from '@/hooks/useProfile';
import MonthSelector from '@/components/finance/MonthSelector';
import TransactionDialog from '@/components/finance/TransactionDialog';
import EditTransactionDialog from '@/components/finance/EditTransactionDialog';
import { Trash2, Pencil, Paperclip, Clock, ChevronDown, Filter, Search, X } from 'lucide-react';
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

interface PickerOption { id: string; icon?: string | null; name: string; }
function OptionPicker({ value, options, placeholder, onChange }: {
  value: string | null;
  options: PickerOption[];
  placeholder: string;
  onChange: (id: string | null) => void;
}) {
  const selected = options.find(o => o.id === value);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 px-1.5 py-0.5 rounded-md transition-colors group/pick whitespace-nowrap">
          {selected ? `${selected.icon ?? ''} ${selected.name}`.trim() : <span className="opacity-40">—</span>}
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

  const getAccountName = (id: string | null) => {
    if (!id) return '—';
    const acc = accounts.find(a => a.id === id);
    return acc ? `${acc.icon} ${acc.name}` : '—';
  };

  const handleDelete = async (id: string) => {
    const item = expenses.find(e => e.id === id);
    try {
      await deleteExpense.mutateAsync(id);
      toast.success('Despesa movida para lixeira', {
        description: item ? `"${item.description || 'Despesa'}" pode ser restaurada em até 30 dias` : undefined,
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
    } catch { toast.error('Erro ao remover'); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Despesas</h1>
          <p className="text-sm text-muted-foreground">Acompanhe seus gastos</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <MonthSelector month={month} onChange={setMonth} />
          <TransactionDialog type="expense" />
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-expense/8 to-expense/2 border border-expense/15 shadow-sm">
        <div className="w-10 h-10 rounded-xl bg-expense/15 flex items-center justify-center">
          <Trash2 className="w-5 h-5 text-expense" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total do Mês</p>
          <p className="text-xl font-extrabold text-expense currency">{formatCurrency(total)}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-muted-foreground">
            {activeFilters ? `${filtered.length} de ` : ''}{expenses.length} transação(ões)
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar despesa..."
            value={filterSearch}
            onChange={e => setFilterSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-muted/50 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {filterSearch && (
            <button onClick={() => setFilterSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="h-9 rounded-lg border border-border bg-muted/50 px-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
          >
            <option value="">Status</option>
            <option value="concluido">Concluído</option>
            <option value="pendente">Pendente</option>
            <option value="agendado">Agendado</option>
          </select>
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="h-9 rounded-lg border border-border bg-muted/50 px-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
          >
            <option value="">Categoria</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
          {accounts.length > 0 && (
            <select
              value={filterAccount}
              onChange={e => setFilterAccount(e.target.value)}
              className="h-9 rounded-lg border border-border bg-muted/50 px-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer max-w-[140px]"
            >
              <option value="">Conta</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
            </select>
          )}
          {activeFilters && (
            <button
              onClick={clearFilters}
              className="h-9 flex items-center gap-1.5 px-3 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 text-xs font-medium transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Limpar
            </button>
          )}
        </div>
      </div>

      {/* Mobile card list */}
      <div className="sm:hidden space-y-3">
        {expenses.length === 0 && !isLoading && (
          <div className="stat-card flex flex-col items-center py-12 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center">
              <Trash2 className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Nenhuma despesa neste mês</p>
          </div>
        )}
        {expenses.length > 0 && filtered.length === 0 && (
          <div className="stat-card flex flex-col items-center py-12 gap-3">
            <Filter className="w-8 h-8 text-muted-foreground opacity-40" />
            <p className="text-sm font-medium text-muted-foreground">Nenhuma despesa encontrada com esses filtros</p>
            <button onClick={clearFilters} className="text-xs text-primary underline">Limpar filtros</button>
          </div>
        )}
        {filtered.map((item) => (
          <div key={item.id} className="stat-card p-3.5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <p className="font-bold text-sm leading-snug">{item.description || 'Despesa'}</p>
                  {item.attachment_url && (
                    <a href={item.attachment_url} target="_blank" rel="noopener noreferrer" className="text-primary shrink-0">
                      <Paperclip className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  <DatePicker date={item.date} onChange={d => handleDateChange(item.id, d)} />
                  <span className="text-border/80 text-xs">·</span>
                  <OptionPicker value={item.category_id} options={categories} placeholder="Categoria" onChange={v => handleCategoryChange(item.id, v)} />
                  <span className="text-border/80 text-xs">·</span>
                  <OptionPicker value={item.account_id} options={accounts} placeholder="Conta" onChange={v => handleAccountChange(item.id, v)} />
                </div>
              </div>
              <div className="shrink-0 flex flex-col items-end gap-1.5">
                <p className="font-extrabold text-expense text-lg tabular-nums leading-none currency">{formatCurrency(Number(item.amount))}</p>
                <StatusPicker status={item.status} onChange={s => handleStatusChange(item.id, s)} />
                {hourlyRate > 0 && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5" />{formatWorkTime(calcWorkTime(Number(item.amount)))}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2.5 border-t border-border/40">
              <button
                onClick={() => setEditing({ ...item, type: 'expense' })}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
              >
                <Pencil className="w-3.5 h-3.5" /> Editar
              </button>
              <div className="w-px h-5 bg-border" />
              <button
                onClick={() => handleDelete(item.id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" /> Excluir
              </button>
            </div>
          </div>
        ))}
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
