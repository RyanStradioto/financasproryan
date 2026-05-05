import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

export type Investment = Tables<'investments'>;
export type InvestmentTransaction = Tables<'investment_transactions'>;

const OPTIONAL_INVESTMENT_COLUMNS = ['annual_rate', 'liquidity', 'photo_url'] as const;

function stripUnsupportedColumns<T extends Record<string, unknown>>(payload: T, message?: string): Partial<T> {
  if (!message) return payload;
  let next: Record<string, unknown> = { ...payload };

  for (const key of OPTIONAL_INVESTMENT_COLUMNS) {
    if (message.includes(`'${key}'`) || message.includes(`"${key}"`) || message.includes(key)) {
      delete next[key];
    }
  }

  return next as Partial<T>;
}

export function useInvestments() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['investments', user?.id],
    queryFn: async () => {
      const [{ data: investments, error: investmentsError }, { data: transactions, error: transactionsError }] = await Promise.all([
        supabase
          .from('investments')
          .select('*')
          .or('archived.is.null,archived.eq.false')
          .order('name'),
        supabase
          .from('investment_transactions')
          .select('investment_id, type, amount'),
      ]);

      if (investmentsError) throw investmentsError;
      if (transactionsError) throw transactionsError;

      const transactionsByInvestment = (transactions ?? []).reduce<Record<string, { current: number; invested: number; count: number }>>((acc, item) => {
        const bucket = acc[item.investment_id] ?? { current: 0, invested: 0, count: 0 };
        const amount = Number(item.amount) || 0;

        if (item.type === 'aporte') {
          bucket.current += amount;
          bucket.invested += amount;
        } else if (item.type === 'resgate') {
          bucket.current -= amount;
          bucket.invested -= amount;
        } else if (item.type === 'rendimento') {
          bucket.current += amount;
        } else if (item.type === 'taxa' || item.type === 'ir') {
          bucket.current -= amount;
        }

        bucket.count += 1;
        acc[item.investment_id] = bucket;
        return acc;
      }, {});

      return (investments as Investment[]).map((investment) => {
        const currentValue = Number(investment.current_value) || 0;
        const totalInvested = Number(investment.total_invested) || 0;
        const derived = transactionsByInvestment[investment.id];

        if (!derived || derived.count === 0) {
          return investment;
        }

        const shouldHydrateFromTransactions = currentValue === 0 && totalInvested === 0;

        return shouldHydrateFromTransactions
          ? {
              ...investment,
              current_value: derived.current,
              total_invested: derived.invested,
            }
          : investment;
      });
    },
    enabled: !!user,
  });
}

export function useInvestmentTransactions(investmentId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['investment-transactions', user?.id, investmentId],
    queryFn: async () => {
      let q = supabase
        .from('investment_transactions')
        .select('*')
        .order('date', { ascending: false });
      if (investmentId) q = q.eq('investment_id', investmentId);
      const { data, error } = await q;
      if (error) throw error;
      return data as InvestmentTransaction[];
    },
    enabled: !!user,
  });
}

export function useNetWorth() {
  const { user } = useAuth();
  const { data: investments = [] } = useInvestments();
  // Sum all investment current values
  const investmentTotal = investments.reduce((s, i) => s + Number(i.current_value), 0);
  return { investmentTotal };
}

export function useAddInvestment() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (data: Omit<TablesInsert<'investments'>, 'user_id'>) => {
      const firstPayload = { ...data, user_id: user!.id };
      const { error } = await supabase
        .from('investments')
        .insert(firstPayload);
      if (!error) return;

      const fallbackPayload = stripUnsupportedColumns(firstPayload, error.message);
      if (Object.keys(fallbackPayload).length === Object.keys(firstPayload).length) throw error;

      const { error: fallbackError } = await supabase
        .from('investments')
        .insert(fallbackPayload as TablesInsert<'investments'>);
      if (fallbackError) throw fallbackError;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['investments'] }),
  });
}

export function useUpdateInvestment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<TablesInsert<'investments'>>) => {
      const { error } = await supabase.from('investments').update(data).eq('id', id);
      if (!error) return;

      const fallbackPayload = stripUnsupportedColumns(data, error.message);
      if (Object.keys(fallbackPayload).length === Object.keys(data).length) throw error;

      const { error: fallbackError } = await supabase.from('investments').update(fallbackPayload).eq('id', id);
      if (fallbackError) throw fallbackError;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['investments'] }),
  });
}

export function useDeleteInvestment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('investments').update({ archived: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['investments'] }),
  });
}

/** 
 * PATRIMONIAL TRANSFER — records investment and updates the investment balance.
 * This is NOT an expense. Transfers money from account to investment.
 */
export function useAddInvestmentTransaction() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (data: {
      investment_id: string;
      account_id?: string | null;
      type: 'aporte' | 'resgate' | 'rendimento' | 'taxa' | 'ir';
      amount: number;
      date: string;
      description?: string;
      notes?: string;
      skipLedgerSync?: boolean;
    }) => {
      // 1. Insert transaction record
      const { error: txError } = await supabase
        .from('investment_transactions')
        .insert({ ...data, user_id: user!.id, description: data.description ?? '' });
      if (txError) throw txError;

      // 2. Update investment current_value and total_invested
      const { data: inv, error: invError } = await supabase
        .from('investments')
        .select('current_value, total_invested, name')
        .eq('id', data.investment_id)
        .single();
      if (invError) throw invError;

      let newCurrent = Number(inv.current_value);
      let newInvested = Number(inv.total_invested);

      if (data.type === 'aporte') {
        newCurrent += data.amount;
        newInvested += data.amount;
      } else if (data.type === 'resgate') {
        newCurrent -= data.amount;
        newInvested -= data.amount;
      } else if (data.type === 'rendimento') {
        newCurrent += data.amount;
      } else if (data.type === 'taxa' || data.type === 'ir') {
        newCurrent -= data.amount;
      }

      const { error: updateError } = await supabase
        .from('investments')
        .update({ current_value: newCurrent, total_invested: newInvested })
        .eq('id', data.investment_id);
      if (updateError) throw updateError;

      // 3. INTEGRATION: Deduct/add from account balance via expense/income records
      // This makes investments "talk" to the rest of the financial system
      if (!data.skipLedgerSync && data.account_id && (data.type === 'aporte' || data.type === 'resgate')) {
        if (data.type === 'aporte') {
          // Aporte = money leaves the account -> create an expense marked as investment transfer
          // We use a special note so it's identifiable as patrimonial transfer
          const { error: expError } = await supabase
            .from('expenses')
            .insert({
              user_id: user!.id,
              date: data.date,
              description: `📊 Aporte: ${inv.name}`,
              amount: data.amount,
              account_id: data.account_id,
              status: 'concluido',
              notes: `[INVESTIMENTO] Transferência patrimonial para ${inv.name}. Não é um gasto real.`,
              is_recurring: false,
            });
          if (expError) console.warn('Falha ao registrar saída de conta:', expError);
        } else if (data.type === 'resgate') {
          // Resgate = money returns to the account -> create an income record
          const { error: incError } = await supabase
            .from('income')
            .insert({
              user_id: user!.id,
              date: data.date,
              description: `📊 Resgate: ${inv.name}`,
              amount: data.amount,
              account_id: data.account_id,
              status: 'concluido',
              notes: `[INVESTIMENTO] Resgate patrimonial de ${inv.name}.`,
            });
          if (incError) console.warn('Falha ao registrar entrada na conta:', incError);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['investments'] });
      qc.invalidateQueries({ queryKey: ['investment-transactions'] });
      qc.invalidateQueries({ queryKey: ['income'] });
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
      qc.invalidateQueries({ queryKey: ['accumulated-balance'] });
    },
  });
}
