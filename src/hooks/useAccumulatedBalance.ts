import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { queryWithSoftDeleteFallback } from '@/lib/softDeleteCompat';

/**
 * Returns the accumulated balance (all income - all expenses)
 * from the very beginning up to the end of the given month.
 */
export function useAccumulatedBalance(month: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['accumulated-balance', user?.id, month],
    queryFn: async () => {
      const [y, m] = month.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;

      const [incomeData, expenseData] = await Promise.all([
        queryWithSoftDeleteFallback<{ amount: number; account_id: string }>((supportsSoftDelete) => {
          let query = supabase
            .from('income')
            .select('amount, account_id')
            .lte('date', endDate)
            .eq('status', 'concluido');
          if (supportsSoftDelete) {
            query = query.is('deleted_at', null);
          }
          return query;
        }),
        queryWithSoftDeleteFallback<{ amount: number; account_id: string }>((supportsSoftDelete) => {
          let query = supabase
            .from('expenses')
            .select('amount, account_id')
            .lte('date', endDate)
            .eq('status', 'concluido');
          if (supportsSoftDelete) {
            query = query.is('deleted_at', null);
          }
          return query;
        }),
      ]);

      const totalIncome = incomeData.reduce((s, i) => s + Number(i.amount), 0);
      const totalExpenses = expenseData.reduce((s, e) => s + Number(e.amount), 0);
      
      const byAccount: Record<string, number> = {};
      incomeData.forEach(i => {
        if (!i.account_id) return;
        byAccount[i.account_id] = (byAccount[i.account_id] || 0) + Number(i.amount);
      });
      expenseData.forEach(e => {
        if (!e.account_id) return;
        byAccount[e.account_id] = (byAccount[e.account_id] || 0) - Number(e.amount);
      });

      return {
        total: totalIncome - totalExpenses,
        byAccount
      };
    },
    enabled: !!user && !!month,
    staleTime: 2 * 60 * 1000,
  });
}
