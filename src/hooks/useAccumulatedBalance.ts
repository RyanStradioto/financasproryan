import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { queryWithSoftDeleteFallback } from '@/lib/softDeleteCompat';

/**
 * Returns the accumulated balance (all income - all expenses)
 * from the very beginning up to the end of the given month.
 *
 * IMPORTANT: CC mirror expenses (created alongside credit_card_transactions,
 * notes starting with [Cartao de credito|...) are intentionally EXCLUDED from
 * the bank-account balance. A CC purchase does NOT reduce your bank balance;
 * only the bill PAYMENT (which creates a real expense with account_id tagged
 * [FATURA_CARTAO]) does. This prevents false double-counting.
 */
export function useAccumulatedBalance(month: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['accumulated-balance', user?.id, month],
    queryFn: async () => {
      const [y, m] = month.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;

      const [incomeData, expenseData, accountsData] = await Promise.all([
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
        queryWithSoftDeleteFallback<{ amount: number; account_id: string | null; notes: string | null }>((supportsSoftDelete) => {
          let query = supabase
            .from('expenses')
            .select('amount, account_id, notes')
            .lte('date', endDate)
            .eq('status', 'concluido');
          if (supportsSoftDelete) {
            query = query.is('deleted_at', null);
          }
          return query;
        }),
        supabase.from('accounts').select('id, name, initial_balance').eq('archived', false),
      ]);

      const byAccount: Record<string, number> = {};
      let totalInitialBalance = 0;

      if (accountsData.data) {
        accountsData.data.forEach(acc => {
          const initBal = Number(acc.initial_balance) || 0;
          byAccount[acc.id] = initBal;
          totalInitialBalance += initBal;
        });
      }

      // Separate real expenses (those with account_id) from CC mirror rows
      // CC mirror rows: notes start with "[Cartao de credito|card:" and have no account_id.
      // These represent credit purchases — they should NOT reduce the bank account balance
      // because the bank account is only debited when the bill is actually paid.
      // Bill payments are tagged with [FATURA_CARTAO] and DO have account_id set.
      const realExpenses = expenseData.filter(
        e => e.account_id !== null && e.account_id !== undefined,
      );

      const totalIncome    = incomeData.reduce((s, i) => s + Number(i.amount), 0);
      const totalRealExpenses = realExpenses.reduce((s, e) => s + Number(e.amount), 0);

      // Build per-account balances
      incomeData.forEach(i => {
        if (!i.account_id) return;
        byAccount[i.account_id] = (byAccount[i.account_id] || 0) + Number(i.amount);
      });

      realExpenses.forEach(e => {
        if (!e.account_id) return;
        byAccount[e.account_id] = (byAccount[e.account_id] || 0) - Number(e.amount);
      });

      return {
        total: totalInitialBalance + totalIncome - totalRealExpenses,
        byAccount,
      };
    },
    enabled: !!user && !!month,
    staleTime: 2 * 60 * 1000,
  });
}
