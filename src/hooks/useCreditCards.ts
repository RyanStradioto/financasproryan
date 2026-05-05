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
const cleanInstallmentDescription = (description: string) => {
  return (description || 'Compra')
    .replace(/\s*[-–—]?\s*PARCELA\s+\d+\s*\/\s*\d+/i, '')
    .replace(/\s*\(\s*\d+\s*\/\s*\d+\s*\)\s*$/i, '')
    .trim();
};

export function useAddCreditCardTransaction() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (data: {
      credit_card_id: string;
      category_id?: string | null;
      description: string;
      amount: number; // amount of each installment
      date: string;
      bill_month: string; // YYYY-MM of the first bill
      installments?: number; // defaults to 1 (no installment)
      start_installment?: number;
      is_recurring?: boolean;
      notes?: string;
      paid?: boolean;
    }) => {
      const total = data.installments ?? 1;
      const start = Math.min(Math.max(data.start_installment ?? 1, 1), total);
      const remaining = total - start + 1;
      const groupId = total > 1 ? crypto.randomUUID() : null;
      const perInstallment = +data.amount.toFixed(2);
      const baseDescription = cleanInstallmentDescription(data.description);

      const rows = Array.from({ length: remaining }, (_, i) => {
        const installmentNumber = start + i;
        // Calculate future bill month
        const [y, m] = data.bill_month.split('-').map(Number);
        const future = new Date(y, m - 1 + i, 1);
        const futureBill = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}`;
        return {
          user_id: user!.id,
          credit_card_id: data.credit_card_id,
          category_id: data.category_id ?? null,
          description: total > 1 ? `${baseDescription} - PARCELA ${installmentNumber}/${total}` : baseDescription,
          amount: perInstallment,
          date: data.date,
          bill_month: futureBill,
          is_installment: total > 1,
          installment_number: total > 1 ? installmentNumber : null,
          total_installments: total > 1 ? total : null,
          installment_group_id: groupId,
          is_recurring: data.is_recurring ?? false,
          notes: data.notes ?? null,
          paid: data.paid ?? false,
        };
      });

      const { error } = await supabase.from('credit_card_transactions').insert(rows);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cc-transactions'] }),
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

/** Upcoming installments for the next N months (is_installment = true) — used by CreditCardsPage */
export function useUpcomingInstallments(monthsAhead = 3) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['cc-upcoming-installments', user?.id, monthsAhead],
    queryFn: async () => {
      const months: string[] = [];
      const now = new Date();
      for (let i = 0; i < monthsAhead; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
      const { data, error } = await supabase
        .from('credit_card_transactions')
        .select('*')
        .eq('is_installment', true)
        .in('bill_month', months)
        .order('bill_month', { ascending: true });
      if (error) throw error;
      return data as CreditCardTransaction[];
    },
    enabled: !!user,
  });
}

/** All CC transactions for a given bill month (all cards) — used by Dashboard */
export function useCCTransactionsForMonth(billMonth: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['cc-transactions-month', user?.id, billMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credit_card_transactions')
        .select('*')
        .eq('bill_month', billMonth)
        .order('date', { ascending: false });
      if (error) throw error;
      return data as CreditCardTransaction[];
    },
    enabled: !!user && !!billMonth,
  });
}

/** Current bill total for a card */
export function useCurrentBillTotal(cardId: string, billMonth: string) {
  const { data: txns = [] } = useCreditCardTransactions(cardId, billMonth);
  return txns.reduce((s, t) => s + Number(t.amount), 0);
}

