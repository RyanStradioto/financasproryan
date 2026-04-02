import { useState } from 'react';
import { useIncome, useDeleteIncome, useAccounts, type Income } from '@/hooks/useFinanceData';
import { getMonthYear, formatCurrency, formatDate, getStatusColor, getStatusLabel } from '@/lib/format';
import { formatWorkTime } from '@/lib/workTime';
import { useWorkTimeCalc } from '@/hooks/useProfile';
import MonthSelector from '@/components/finance/MonthSelector';
import TransactionDialog from '@/components/finance/TransactionDialog';
import EditTransactionDialog from '@/components/finance/EditTransactionDialog';
import { Trash2, Pencil, Paperclip, Clock, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

export default function IncomePage() {
  const [month, setMonth] = useState(getMonthYear());
  const { data: income = [], isLoading } = useIncome(month);
  const { data: accounts = [] } = useAccounts();
  const deleteIncome = useDeleteIncome();
  const [editing, setEditing] = useState<(Income & { type: 'income' }) | null>(null);
  const { calcWorkTime, hourlyRate } = useWorkTimeCalc();

  const total = income.reduce((s, i) => s + Number(i.amount), 0);

  const getAccountName = (id: string | null) => {
    if (!id) return '—';
    const acc = accounts.find(a => a.id === id);
    return acc ? `${acc.icon} ${acc.name}` : '—';
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteIncome.mutateAsync(id);
      toast.success('Receita removida');
    } catch { toast.error('Erro ao remover'); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Receitas</h1>
          <p className="text-sm text-muted-foreground">Acompanhe suas entradas</p>
        </div>
        <div className="flex items-center gap-3">
          <MonthSelector month={month} onChange={setMonth} />
          <TransactionDialog type="income" />
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-income/8 to-income/2 border border-income/15 shadow-sm">
        <div className="w-10 h-10 rounded-xl bg-income/15 flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-income" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total do Mês</p>
          <p className="text-xl font-extrabold text-income currency">{formatCurrency(total)}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-muted-foreground">{income.length} transação(ões)</p>
        </div>
      </div>

      <div className="stat-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm data-table">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3.5 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Data</th>
                <th className="text-left py-3.5 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Descrição</th>
                <th className="text-left py-3.5 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="text-right py-3.5 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Valor</th>
                {hourlyRate && <th className="text-center py-3.5 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Equivalente</th>}
                <th className="text-left py-3.5 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Conta</th>
                <th className="py-3.5 px-4 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {income.map((item) => {
                const wt = calcWorkTime(Number(item.amount));
                return (
                  <tr key={item.id} className="border-b border-border/30 hover:bg-muted/40 transition-all group">
                    <td className="py-3.5 px-4 text-muted-foreground">{formatDate(item.date)}</td>
                    <td className="py-3.5 px-4 font-medium">
                      <div className="flex items-center gap-1.5">
                        {item.description || 'Receita'}
                        {item.attachment_url && (
                          <a href={item.attachment_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
                            <Paperclip className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${getStatusColor(item.status)}`}>
                        {getStatusLabel(item.status)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right currency font-bold text-income">{formatCurrency(Number(item.amount))}</td>
                    {hourlyRate && (
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent/50 text-xs font-semibold text-accent-foreground">
                          <Clock className="w-3 h-3" />
                          {formatWorkTime(wt)}
                        </span>
                      </td>
                    )}
                    <td className="py-3.5 px-4 text-muted-foreground">{getAccountName(item.account_id)}</td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => setEditing({ ...item, type: 'income' })} className="text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all p-1.5 rounded-lg">
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
              {income.length === 0 && !isLoading && (
                <tr><td colSpan={hourlyRate ? 7 : 6} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Nenhuma receita neste mês</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">Adicione uma receita para começar a acompanhar</p>
                    </div>
                  </div>
                </td></tr>
              )}
            </tbody>
            {income.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/20">
                  <td colSpan={3} className="py-3.5 px-4 font-bold text-xs uppercase tracking-wider text-muted-foreground">TOTAL</td>
                  <td className="py-3.5 px-4 text-right currency font-extrabold text-income">{formatCurrency(total)}</td>
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
