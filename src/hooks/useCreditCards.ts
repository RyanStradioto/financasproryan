import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

export type CreditCard = Tables<'credit_cards'>;
export type CreditCardTransaction = Tables<'credit_card_transactions'>;

export function useCreditCards() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['credit-cards', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credit_cards')
        .select('*')
        .eq('archived', false)
        .order('name');
      if (error) throw error;
      return data as CreditCard[];
    },
    enabled: !!user,
  });
}

export function useCreditCardTransactions(cardId?: string, billMonth?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['cc-transactions', user?.id, cardId, billMonth],
    queryFn: async () => {
      let q = supabase
        .from('credit_card_transactions')
        .select('*')
        .order('date', { ascending: false });
      if (cardId) q = q.eq('credit_card_id', cardId);
      if (billMonth) q = q.eq('bill_month', billMonth);
      const { data, error } = await q;
      if (error) throw error;
      return data as CreditCardTransaction[];
    },
    enabled: !!user,
  });
}

export function useAddCreditCard() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (data: Omit<TablesInsert<'credit_cards'>, 'user_id'>) => {
      const { error } = await supabase
        .from('credit_cards')
        .insert({ ...data, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['credit-cards'] }),
  });
}

export function useDeleteCreditCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('credit_cards').update({ archived: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['credit-cards'] }),
  });
}

export function useUpdateCreditCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<Omit<TablesInsert<'credit_cards'>, 'user_id'>>;
    }) => {
      const { error } = await supabase.from('credit_cards').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['credit-cards'] }),
  });
}

/** 
 * Adds a credit card purchase and auto-generates installment records.
 * E.g. R$300 in 3x → creates 3 records of R$100 for 3 consecutive bill months.
 */
export function useAddCreditCardTransaction() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (data: {
      credit_card_id: string;
      category_id?: string | null;
      description: string;
      amount: number; // total amount
      date: string;
      bill_month: string; // YYYY-MM of the first bill
      installments?: number; // defaults to 1 (no installment)
      is_recurring?: boolean;
      notes?: string;
      paid?: boolean;
    }) => {
      const total = data.installments ?? 1;
      const groupId = total > 1 ? crypto.randomUUID() : null;
      const perInstallment = +(data.amount / total).toFixed(2);

      const rows = Array.from({ length: total }, (_, i) => {
        // Calculate future bill month
        const [y, m] = data.bill_month.split('-').map(Number);
        const future = new Date(y, m - 1 + i, 1);
        const futureBill = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}`;
        return {
          user_id: user!.id,
          credit_card_id: data.credit_card_id,
          category_id: data.category_id ?? null,
          description: total > 1 ? `${data.description} (${i + 1}/${total})` : data.description,
          amount: perInstallment,
          date: data.date,
          bill_month: futureBill,
          is_installment: total > 1,
          installment_number: total > 1 ? i + 1 : null,
          total_installments: total > 1 ? total : null,
          installment_group_id: groupId,
          is_recurring: data.is_recurring ?? false,
          notes: data.notes ?? null,
          paid: data.paid ?? false,
        };
      });

      const { error } = await supabase.from('credit_card_transactions').insert(rows);
      if (error) throw error;

      // Keep budget/discipline tracking in sync by mirroring credit-card purchases in expenses.
      const installmentAmount = +(data.amount / total).toFixed(2);
      const baseDate = new Date(`${data.date}T00:00:00`);
      const expenseRows = Array.from({ length: total }, (_, i) => {
        const d = new Date(baseDate);
        d.setMonth(d.getMonth() + i);
        const expenseDate = d.toISOString().split('T')[0];
        const baseNote = data.notes?.trim();
        const [y, m] = data.bill_month.split('-').map(Number);
        const billD = new Date(y, m - 1 + i, 1);
        const futureBill = `${billD.getFullYear()}-${String(billD.getMonth() + 1).padStart(2, '0')}`;
        const cardMarker = `[Cartao de credito|card:${data.credit_card_id}|bill:${futureBill}]`;
        return {
          user_id: user!.id,
          date: expenseDate,
          description: total > 1 ? `${data.description} (${i + 1}/${total})` : data.description,
          amount: installmentAmount,
          category_id: data.category_id ?? null,
          account_id: null,
          status: i === 0 ? (data.paid ? 'concluido' : 'pendente') : 'agendado',
          notes: baseNote ? `${cardMarker} ${baseNote}` : cardMarker,
          is_recurring: data.is_recurring ?? false,
        };
      });

      const { error: expenseError } = await supabase.from('expenses').insert(expenseRows);
      if (expenseError) throw expenseError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cc-transactions'] });
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['accumulated-balance'] });
    },
  });
}

export function useToggleCCTransactionPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, paid }: { id: string; paid: boolean }) => {
      const { error } = await supabase
        .from('credit_card_transactions')
        .update({ paid })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cc-transactions'] }),
  });
}

export function useDeleteCCTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('credit_card_transactions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cc-transactions'] }),
  });
}

/** Current bill total for a card */
export function useCurrentBillTotal(cardId: string, billMonth: string) {
  const { data: txns = [] } = useCreditCardTransactions(cardId, billMonth);
  return txns.reduce((s, t) => s + Number(t.amount), 0);
}
