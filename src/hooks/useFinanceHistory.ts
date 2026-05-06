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

export function useFinanceHistory(monthsBack = 6, accountId: string = '__all__') {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['finance-history', user?.id, monthsBack, accountId],
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

      const [incomeData, expenseData, ccData] = await Promise.all([
        queryWithSoftDeleteFallback<{ date: string; amount: number; status: string }>((supportsSoftDelete) => {
          let query = supabase
            .from('income')
            .select('date, amount, status')
            .gte('date', startDate)
            .lte('date', endDate);
          if (accountId !== '__all__') {
            query = query.eq('account_id', accountId);
          }
          if (supportsSoftDelete) {
            query = query.is('deleted_at', null);
          }
          return query;
        }),
        // Pull notes too so we can filter out CC mirror rows and bill payment markers
        // — otherwise the same charge gets counted twice (once via the mirror and once via cc_transactions).
        queryWithSoftDeleteFallback<{ date: string; amount: number; status: string; notes: string | null }>((supportsSoftDelete) => {
          let query = supabase
            .from('expenses')
            .select('date, amount, status, notes')
            .gte('date', startDate)
            .lte('date', endDate);
          if (accountId !== '__all__') {
            query = query.eq('account_id', accountId);
          }
          if (supportsSoftDelete) {
            query = query.is('deleted_at', null);
          }
          return query;
        }),
        // Credit card transactions are bucketed by bill_month, not date — that's the month the
        // user actually has to pay them, which is what we want to surface in the trend.
        (async () => {
          const { data, error } = await supabase
            .from('credit_card_transactions')
            .select('bill_month, amount')
            .gte('bill_month', firstMonth)
            .lte('bill_month', lastMonth);
          if (error) throw error;
          return (data ?? []) as { bill_month: string; amount: number }[];
        })(),
      ]);

      const isCCMirror = (notes: string | null | undefined) =>
        !!notes && /\[Cartao de credito\b/i.test(notes);
      const isBillPayment = (notes: string | null | undefined) =>
        !!notes && /\[FATURA_CARTAO\]/i.test(notes);

      // Real expenses = paid expenses excluding CC mirrors and bill payments.
      // CC charges then come in via ccData grouped by bill_month — counted exactly once.
      const realExpenses = expenseData.filter(e =>
        e.status === 'concluido' && !isCCMirror(e.notes) && !isBillPayment(e.notes),
      );

      const shortMonthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

      return months.map(m => {
        const [y, mo] = m.split('-').map(Number);
        const monthIncome = incomeData
          .filter(i => i.date?.startsWith(m) && i.status === 'concluido')
          .reduce((s, i) => s + Number(i.amount), 0);
        const monthRealExpenses = realExpenses
          .filter(e => e.date?.startsWith(m))
          .reduce((s, e) => s + Number(e.amount), 0);
        const monthCC = ccData
          .filter(t => t.bill_month === m)
          .reduce((s, t) => s + Number(t.amount), 0);
        const monthExpenses = monthRealExpenses + monthCC;

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
