import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { getMonthYear } from '@/lib/format';
import { queryWithSoftDeleteFallback } from '@/lib/softDeleteCompat';

export type MonthSummary = {
  month: string;
  label: string;
  income: number;
  expenses: number;
  balance: number;
};

export function useFinanceHistory(monthsBack = 6) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['finance-history', user?.id, monthsBack],
    queryFn: async () => {
      const months: string[] = [];
      const now = new Date();
      for (let i = monthsBack - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(getMonthYear(d));
      }

      const firstMonth = months[0];
      const lastMonth = months[months.length - 1];
      const startDate = `${firstMonth}-01`;
      const [ly, lm] = lastMonth.split('-').map(Number);
      const endDate = `${lastMonth}-${String(new Date(ly, lm, 0).getDate()).padStart(2, '0')}`;

      const [incomeData, expenseData] = await Promise.all([
        queryWithSoftDeleteFallback<{ date: string; amount: number; status: string }>((supportsSoftDelete) => {
          let query = supabase
            .from('income')
            .select('date, amount, status')
            .gte('date', startDate)
            .lte('date', endDate);
          if (supportsSoftDelete) {
            query = query.is('deleted_at', null);
          }
          return query;
        }),
        queryWithSoftDeleteFallback<{ date: string; amount: number; status: string }>((supportsSoftDelete) => {
          let query = supabase
            .from('expenses')
            .select('date, amount, status')
            .gte('date', startDate)
            .lte('date', endDate);
          if (supportsSoftDelete) {
            query = query.is('deleted_at', null);
          }
          return query;
        }),
      ]);

      const shortMonthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

      return months.map(m => {
        const [y, mo] = m.split('-').map(Number);
        const monthIncome = incomeData
          .filter(i => i.date?.startsWith(m) && i.status === 'concluido')
          .reduce((s, i) => s + Number(i.amount), 0);
        const monthExpenses = expenseData
          .filter(e => e.date?.startsWith(m) && e.status === 'concluido')
          .reduce((s, e) => s + Number(e.amount), 0);

        return {
          month: m,
          label: `${shortMonthNames[mo - 1]}/${String(y).slice(2)}`,
          income: monthIncome,
          expenses: monthExpenses,
          balance: monthIncome - monthExpenses,
        } as MonthSummary;
      });
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}
