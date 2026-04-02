import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

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

      const [incomeRes, expenseRes] = await Promise.all([
        supabase
          .from('income')
          .select('amount')
          .lte('date', endDate)
          .eq('status', 'concluido'),
        supabase
          .from('expenses')
          .select('amount')
          .lte('date', endDate)
          .eq('status', 'concluido'),
      ]);

      if (incomeRes.error) throw incomeRes.error;
      if (expenseRes.error) throw expenseRes.error;

      const totalIncome = (incomeRes.data || []).reduce((s, i) => s + Number(i.amount), 0);
      const totalExpenses = (expenseRes.data || []).reduce((s, e) => s + Number(e.amount), 0);

      return totalIncome - totalExpenses;
    },
    enabled: !!user && !!month,
    staleTime: 2 * 60 * 1000,
  });
}
