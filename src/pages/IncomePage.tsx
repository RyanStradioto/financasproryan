import { useState } from 'react';
import { useIncome, useDeleteIncome, useAccounts } from '@/hooks/useFinanceData';
import { getMonthYear, formatCurrency, formatDate, getStatusColor, getStatusLabel } from '@/lib/format';
import MonthSelector from '@/components/finance/MonthSelector';
import TransactionDialog from '@/components/finance/TransactionDialog';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function IncomePage() {
  const [month, setMonth] = useState(getMonthYear());
  const { data: income = [], isLoading } = useIncome(month);
  const { data: accounts = [] } = useAccounts();
  const deleteIncome = useDeleteIncome();

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

      <div className="stat-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Data</th>
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Descrição</th>
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Status</th>
                <th className="text-right py-3 px-2 font-medium text-muted-foreground">Valor</th>
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Conta</th>
                <th className="py-3 px-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {income.map((item) => (
                <tr key={item.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                  <td className="py-3 px-2 text-muted-foreground">{formatDate(item.date)}</td>
                  <td className="py-3 px-2 font-medium">{item.description || 'Receita'}</td>
                  <td className="py-3 px-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                      {getStatusLabel(item.status)}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-right currency font-semibold text-income">{formatCurrency(Number(item.amount))}</td>
                  <td className="py-3 px-2 text-muted-foreground">{getAccountName(item.account_id)}</td>
                  <td className="py-3 px-2">
                    <button onClick={() => handleDelete(item.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {income.length === 0 && !isLoading && (
                <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">Nenhuma receita neste mês</td></tr>
              )}
            </tbody>
            {income.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border">
                  <td colSpan={3} className="py-3 px-2 font-semibold text-muted-foreground">TOTAL</td>
                  <td className="py-3 px-2 text-right currency font-bold text-income">{formatCurrency(total)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
