import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle2, Clock, CalendarDays, X } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Expense } from '@/hooks/useFinanceData';
import { useFinanceMutations } from '@/hooks/useFinanceData';
import { useSensitiveData } from '@/components/finance/SensitiveData';
import { toast } from 'sonner';

interface PendingExpensesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expenses: Expense[];
}

export default function PendingExpensesDialog({ open, onOpenChange, expenses }: PendingExpensesDialogProps) {
  const { maskCurrency } = useSensitiveData();
  const { updateExpense } = useFinanceMutations();
  const [loading, setLoading] = useState<string | null>(null);

  const pendingExpenses = expenses.filter(e => e.status !== 'concluido').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const handleMarkAsPaid = async (expense: Expense) => {
    setLoading(expense.id);
    try {
      await updateExpense.mutateAsync({
        ...expense,
        status: 'concluido',
      });
      toast.success('Despesa marcada como paga!');
      if (pendingExpenses.length === 1) {
        onOpenChange(false);
      }
    } catch (error) {
      toast.error('Erro ao atualizar a despesa.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden bg-card/95 backdrop-blur-xl border-border/50">
        <DialogHeader className="p-6 pb-4 bg-gradient-to-br from-warning/10 to-transparent border-b border-warning/10 relative">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-warning/10 rounded-full blur-2xl" />
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-warning/20 text-warning flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            Despesas Pendentes
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-2">Você tem {pendingExpenses.length} despesa(s) aguardando pagamento.</p>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-3">
          {pendingExpenses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Tudo em dia!
            </div>
          ) : (
            pendingExpenses.map(expense => {
              const isOverdue = expense.status === 'pendente' && new Date(expense.date) < new Date(new Date().setHours(0,0,0,0));
              
              return (
                <div key={expense.id} className={cn("flex flex-col gap-3 p-3 rounded-xl border bg-card/50 transition-all hover:bg-card", isOverdue ? "border-expense/30 shadow-[0_0_15px_-5px_hsl(var(--expense)/0.2)]" : "border-border/50")}>
                  <div className="flex items-start justify-between min-w-0">
                    <div className="min-w-0 pr-2">
                      <p className="font-semibold text-sm truncate">{expense.description}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" /> {formatDate(expense.date)}
                        </span>
                        {isOverdue && <span className="text-expense font-medium flex items-center gap-1"><X className="w-3 h-3" /> Atrasada</span>}
                      </div>
                    </div>
                    <span className="font-bold currency text-warning shrink-0">{maskCurrency(formatCurrency(Number(expense.amount)))}</span>
                  </div>
                  <button
                    onClick={() => handleMarkAsPaid(expense)}
                    disabled={loading === expense.id}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-success/10 text-success hover:bg-success/20 transition-colors text-xs font-bold"
                  >
                    {loading === expense.id ? (
                      <div className="w-4 h-4 border-2 border-success border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Marcar como Pago
                      </>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
