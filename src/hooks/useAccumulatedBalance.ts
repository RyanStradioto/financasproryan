import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { queryWithSoftDeleteFallback } from '@/lib/softDeleteCompat';

/**
 * Returns the accumulated balance (all income - all expenses)
 * from the very beginning up to the end of the given month.
 *
 * IMPORTANT: a CC mirror expense (notes starting with [Cartao de credito|...])
 * only reduces the bank balance once it is marked PAID. useToggleCCTransactionPaid
 * flips the same mirror to status='concluido' AND assigns its account_id, so it is
 * then counted exactly once as a normal real expense (an expense with account_id).
 * While unpaid, the mirror has no account_id / non-concluido status and is excluded.
 * The in-app pay-bill flow does NOT create any separate [FATURA_CARTAO] expense —
 * that legacy flow double-counted the bill against the mirror. ([FATURA_CARTAO]
 * today only comes from Nubank PDF imports of past bill payments.)
 *
 * Returns diagnostic fields to help users understand balance discrepancies:
 * - orphanExpenses: expenses with no account_id that are NOT CC mirrors (should have been assigned)
 * - orphanIncome: income with no account_id (should have been assigned)
 * - initialBalanceByAccount: initial balance per account for breakdown display
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
        queryWithSoftDeleteFallback<{ id: string; amount: number; account_id: string | null; description: string | null; date: string }>((supportsSoftDelete) => {
          let query = supabase
            .from('income')
            .select('id, amount, account_id, description, date')
            .lte('date', endDate)
            .eq('status', 'concluido');
          if (supportsSoftDelete) {
            query = query.is('deleted_at', null);
          }
          return query;
        }),
        queryWithSoftDeleteFallback<{ id: string; amount: number; account_id: string | null; notes: string | null; description: string | null; date: string }>((supportsSoftDelete) => {
          let query = supabase
            .from('expenses')
            .select('id, amount, account_id, notes, description, date')
            .lte('date', endDate)
            .eq('status', 'concluido');
          if (supportsSoftDelete) {
            query = query.is('deleted_at', null);
          }
          return query;
        }),
        supabase.from('accounts').select('id, name, initial_balance').eq('archived', false),
      ]);

      // Helper: convert a monetary value to integer cents to avoid floating-point drift.
      // e.g. 70.04 in IEEE-754 float is 70.0400000000000034... — summing many such values
      // accumulates a visible error in the cents column. Working in integers avoids this.
      const toCents = (v: number) => Math.round(Number(v) * 100);
      const fromCents = (c: number) => c / 100;

      const byAccount: Record<string, number> = {};
      const initialBalanceByAccount: Record<string, number> = {};
      let totalInitialBalanceCents = 0;

      if (accountsData.data) {
        accountsData.data.forEach(acc => {
          const initBal = toCents(Number(acc.initial_balance) || 0);
          byAccount[acc.id] = fromCents(initBal);
          initialBalanceByAccount[acc.id] = fromCents(initBal);
          totalInitialBalanceCents += initBal;
        });
      }

      // CC mirror rows: no account_id + notes contain '[Cartao de credito|card:'
      // These are tracking entries only — they do NOT reduce bank balance.
      // Bank balance only changes when the mirror is PAID: it then gets
      // status='concluido' + account_id and is counted as a normal real expense
      // (no [FATURA_CARTAO] involved in the in-app pay-bill flow).
      const isCCMirror = (e: { account_id: string | null; notes: string | null }) =>
        !e.account_id && !!e.notes?.includes('[Cartao de credito|card:');

      // Expenses that actually hit bank accounts (have account_id assigned)
      const realExpenses = expenseData.filter(e => e.account_id !== null && e.account_id !== undefined);

      // "Orphan" expenses: no account_id AND not a CC mirror.
      // They're usually input errors (forgot to pick account).
      const orphanExpenses = expenseData.filter(e => !e.account_id && !isCCMirror(e));

      // Income with no account assigned — not counted in any account balance
      const orphanIncome = incomeData.filter(i => !i.account_id);

      // Sum in cents to prevent floating-point accumulation errors
      const totalIncomeCents       = incomeData.reduce((s, i) => s + toCents(i.amount), 0);
      const totalRealExpensesCents = realExpenses.reduce((s, e) => s + toCents(e.amount), 0);
      const orphanExpensesCents    = orphanExpenses.reduce((s, e) => s + toCents(e.amount), 0);
      const orphanIncomeCents      = orphanIncome.reduce((s, i) => s + toCents(i.amount), 0);

      const totalIncome         = fromCents(totalIncomeCents);
      const totalRealExpenses   = fromCents(totalRealExpensesCents);
      const orphanExpensesTotal = fromCents(orphanExpensesCents);
      const orphanIncomeTotal   = fromCents(orphanIncomeCents);

      // Build per-account balances (only from rows with a known account_id)
      incomeData.forEach(i => {
        if (!i.account_id) return;
        byAccount[i.account_id] = fromCents(toCents(byAccount[i.account_id] || 0) + toCents(i.amount));
      });

      realExpenses.forEach(e => {
        if (!e.account_id) return;
        byAccount[e.account_id] = fromCents(toCents(byAccount[e.account_id] || 0) - toCents(e.amount));
      });

      // Cumulative income and expenses per account (for breakdown display)
      const cumulativeIncomeByAccount: Record<string, number> = {};
      const cumulativeExpensesByAccount: Record<string, number> = {};
      incomeData.forEach(i => {
        if (!i.account_id) return;
        cumulativeIncomeByAccount[i.account_id] = fromCents(
          toCents(cumulativeIncomeByAccount[i.account_id] || 0) + toCents(i.amount)
        );
      });
      realExpenses.forEach(e => {
        if (!e.account_id) return;
        cumulativeExpensesByAccount[e.account_id] = fromCents(
          toCents(cumulativeExpensesByAccount[e.account_id] || 0) + toCents(e.amount)
        );
      });

      return {
        total: fromCents(totalInitialBalanceCents + totalIncomeCents - totalRealExpensesCents),
        byAccount,
        initialBalanceByAccount,
        cumulativeIncomeByAccount,
        cumulativeExpensesByAccount,
        // Diagnostic fields
        orphanExpensesTotal,
        orphanIncomeTotal,
        orphanExpensesCount: orphanExpenses.length,
        orphanIncomeCount: orphanIncome.length,
        // Raw rows (for balance reconciliation diagnostic)
        _debug: {
          realExpenses: realExpenses.map(e => ({
            id: e.id,
            description: e.description,
            amount: Number(e.amount),
            date: e.date,
            account_id: e.account_id,
            isCCMarker: !!e.notes?.includes('[Cartao de credito|card:'),
            isFaturaItem: !!e.notes?.includes('[FATURA_CARTAO'),
          })),
          incomeRows: incomeData.map(i => ({
            id: i.id,
            description: i.description,
            amount: Number(i.amount),
            date: i.date,
            account_id: i.account_id,
          })),
          totalInitialBalance: fromCents(totalInitialBalanceCents),
          totalIncome: fromCents(totalIncomeCents),
          totalRealExpenses: fromCents(totalRealExpensesCents),
          endDate,
        },
      };
    },
    enabled: !!user && !!month,
    staleTime: 2 * 60 * 1000,
  });
}
