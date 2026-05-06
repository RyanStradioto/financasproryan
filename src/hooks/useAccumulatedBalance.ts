import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { queryWithSoftDeleteFallback } from '@/lib/softDeleteCompat';
import { resolveAccountBrand } from '@/lib/accountBrand';

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

      const [incomeData, expenseData, accountsData, creditCardsData] = await Promise.all([
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
        queryWithSoftDeleteFallback<{ amount: number; account_id: string; notes: string | null }>((supportsSoftDelete) => {
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
        supabase.from('credit_cards').select('id, name').eq('archived', false),
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

      const totalIncome = incomeData.reduce((s, i) => s + Number(i.amount), 0);
      const totalExpenses = expenseData.reduce((s, e) => s + Number(e.amount), 0);
      
      incomeData.forEach(i => {
        if (!i.account_id) return;
        byAccount[i.account_id] = (byAccount[i.account_id] || 0) + Number(i.amount);
      });
      expenseData.forEach(e => {
        if (e.account_id) {
          byAccount[e.account_id] = (byAccount[e.account_id] || 0) - Number(e.amount);
        } else if (e.notes?.includes('[Cartao de credito|card:')) {
          // Identify the credit card ID from the notes
          const match = e.notes.match(/\[Cartao de credito\|card:([^|]+)\|/);
          if (match && match[1]) {
            const cardId = match[1];
            const card = creditCardsData.data?.find(c => c.id === cardId);
            if (card) {
              const cardBrand = resolveAccountBrand(card.name).name;
              // Find matching account
              const matchingAccount = accountsData.data?.find(a => resolveAccountBrand(a.name).name === cardBrand);
              if (matchingAccount) {
                byAccount[matchingAccount.id] = (byAccount[matchingAccount.id] || 0) - Number(e.amount);
              }
            }
          }
        }
      });

      return {
        total: totalInitialBalance + totalIncome - totalExpenses,
        byAccount
      };
    },
    enabled: !!user && !!month,
    staleTime: 2 * 60 * 1000,
  });
}
