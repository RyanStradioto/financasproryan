import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

export type Investment = Tables<'investments'>;
export type InvestmentTransaction = Tables<'investment_transactions'>;

export function useInvestments() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['investments', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('investments')
        .select('*')
        .eq('archived', false)
        .order('name');
      if (error) throw error;
      return data as Investment[];
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
      const { error } = await supabase
        .from('investments')
        .insert({ ...data, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['investments'] }),
  });
}

export function useUpdateInvestment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<TablesInsert<'investments'>>) => {
      const { error } = await supabase.from('investments').update(data).eq('id', id);
      if (error) throw error;
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
      if (data.account_id && (data.type === 'aporte' || data.type === 'resgate')) {
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
