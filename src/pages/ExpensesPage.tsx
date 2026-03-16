import { useState } from 'react';
import { useExpenses, useDeleteExpense, useCategories, useAccounts, type Expense } from '@/hooks/useFinanceData';
import { getMonthYear, formatCurrency, formatDate, getStatusColor, getStatusLabel } from '@/lib/format';
import MonthSelector from '@/components/finance/MonthSelector';
import TransactionDialog from '@/components/finance/TransactionDialog';
import EditTransactionDialog from '@/components/finance/EditTransactionDialog';
import { Trash2, Pencil, Paperclip } from 'lucide-react';
import { toast } from 'sonner';

export default function ExpensesPage() {
  const [month, setMonth] = useState(getMonthYear());
  const { data: expenses = [], isLoading } = useExpenses(month);
  const { data: categories = [] } = useCategories();
  const { data: accounts = [] } = useAccounts();
  const deleteExpense = useDeleteExpense();
  const [editing, setEditing] = useState<(Expense & { type: 'expense' }) | null>(null);

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

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
    try {
      await deleteExpense.mutateAsync(id);
      toast.success('Despesa removida');
    } catch { toast.error('Erro ao remover'); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Despesas</h1>
          <p className="text-sm text-muted-foreground">Acompanhe seus gastos</p>
        </div>
        <div className="flex items-center gap-3">
          <MonthSelector month={month} onChange={setMonth} />
          <TransactionDialog type="expense" />
        </div>
      </div>

      <div className="stat-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Data</th>
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Descrição</th>
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Categoria</th>
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Status</th>
                <th className="text-right py-3 px-2 font-medium text-muted-foreground">Valor</th>
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Conta</th>
                <th className="py-3 px-2 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((item) => (
                <tr key={item.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors group">
                  <td className="py-3 px-2 text-muted-foreground">{formatDate(item.date)}</td>
                  <td className="py-3 px-2 font-medium">
                    <div className="flex items-center gap-1.5">
                      {item.description || 'Despesa'}
                      {(item as any).attachment_url && (
                        <a href={(item as any).attachment_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
                          <Paperclip className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-2 text-muted-foreground">{getCategoryName(item.category_id)}</td>
                  <td className="py-3 px-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                      {getStatusLabel(item.status)}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-right currency font-semibold text-expense">{formatCurrency(Number(item.amount))}</td>
                  <td className="py-3 px-2 text-muted-foreground">{getAccountName(item.account_id)}</td>
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditing({ ...item, type: 'expense' })} className="text-muted-foreground hover:text-primary transition-colors p-1">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(item.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {expenses.length === 0 && !isLoading && (
                <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">Nenhuma despesa neste mês</td></tr>
              )}
            </tbody>
            {expenses.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border">
                  <td colSpan={4} className="py-3 px-2 font-semibold text-muted-foreground">TOTAL</td>
                  <td className="py-3 px-2 text-right currency font-bold text-expense">{formatCurrency(total)}</td>
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
