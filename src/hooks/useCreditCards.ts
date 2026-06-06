import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import { deleteWithSoftDeleteFallback, queryWithSoftDeleteFallback } from '@/lib/softDeleteCompat';

export type CreditCard = Tables<'credit_cards'>;
export type CreditCardTransaction = Tables<'credit_card_transactions'>;

/** localStorage key for per-card default payment account */
export const ccDefaultAccountKey = (cardId: string) => `cc_default_pay_account_${cardId}`;
export function getCardDefaultAccount(cardId: string): string | null {
  try {
    const v = localStorage.getItem(ccDefaultAccountKey(cardId));
    return v && v.length > 0 ? v : null;
  } catch { return null; }
}
export function setCardDefaultAccount(cardId: string, accountId: string | null) {
  try {
    if (accountId) localStorage.setItem(ccDefaultAccountKey(cardId), accountId);
    else localStorage.removeItem(ccDefaultAccountKey(cardId));
  } catch (err) {
    console.warn('setCardDefaultAccount: localStorage falhou', err);
  }
}

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
      const data = await queryWithSoftDeleteFallback<CreditCardTransaction>((supportsSoftDelete) => {
        let q = supabase
          .from('credit_card_transactions')
          .select('*')
          .order('date', { ascending: false });
        if (supportsSoftDelete) q = q.is('deleted_at', null);
        if (cardId) q = q.eq('credit_card_id', cardId);
        if (billMonth) q = q.eq('bill_month', billMonth);
        return q;
      });
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
      amount: number; // total purchase amount by default
      amount_mode?: 'total' | 'installment';
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
      const baseDescription = cleanInstallmentDescription(data.description);
      const purchaseTotal = data.amount_mode === 'installment'
        ? data.amount * total
        : data.amount;
      const purchaseTotalCents = Math.round(purchaseTotal * 100);
      const baseInstallmentCents = Math.floor(purchaseTotalCents / total);
      const remainderCents = purchaseTotalCents % total;
      const installmentAmounts = Array.from({ length: total }, (_, i) =>
        (baseInstallmentCents + (i < remainderCents ? 1 : 0)) / 100
      );

      const rows = Array.from({ length: remaining }, (_, i) => {
        const installmentNumber = start + i;
        // Calculate future bill month
        const [y, m] = data.bill_month.split('-').map(Number);
        const future = new Date(y, m - 1 + i, 1);
        const futureBill = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}`;
        const txId = crypto.randomUUID();
        return {
          id: txId,
          user_id: user!.id,
          credit_card_id: data.credit_card_id,
          category_id: data.category_id ?? null,
          description: total > 1 ? `${baseDescription} - PARCELA ${installmentNumber}/${total}` : baseDescription,
          amount: installmentAmounts[installmentNumber - 1],
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

      // Keep budget/discipline tracking in sync by mirroring credit-card purchases in expenses.
      // If the card has a default payment account configured, the mirror expenses inherit
      // that account_id — meaning the bank balance reflects the upcoming CC obligation
      // immediately (instead of waiting for "Pagar Fatura").
      const defaultAccountId = getCardDefaultAccount(data.credit_card_id);
      const baseDate = new Date(`${data.date}T00:00:00`);
      const expenseRows = rows.map((tx, i) => {
        const installmentNumber = start + i;
        const d = new Date(baseDate);
        d.setMonth(d.getMonth() + i);
        const expenseDate = d.toISOString().split('T')[0];
        const baseNote = data.notes?.trim();
        const cardMarker = `[Cartao de credito|card:${data.credit_card_id}|bill:${tx.bill_month}|tx:${tx.id}]`;
        return {
          user_id: user!.id,
          date: expenseDate,
          description: total > 1 ? `${baseDescription} (${installmentNumber}/${total})` : baseDescription,
          amount: installmentAmounts[installmentNumber - 1],
          category_id: data.category_id ?? null,
          account_id: defaultAccountId,
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
      qc.invalidateQueries({ queryKey: ['cc-transactions-month'] });
      qc.invalidateQueries({ queryKey: ['cc-all-future'] });
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['accumulated-balance'] });
    },
  });
}

export function useToggleCCTransactionPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, paid, accountId }: { id: string; paid: boolean; accountId?: string | null }) => {
      // 1) Toggle on credit_card_transactions
      const { error } = await supabase
        .from('credit_card_transactions')
        .update({ paid })
        .eq('id', id);
      if (error) throw error;

      // 2) Sync the mirror expense (notes contain "tx:<id>").
      //
      // The mirror IS how a CC purchase hits the bank balance — and it must do
      // so EXACTLY ONCE. We deliberately never create a separate [FATURA_CARTAO]
      // expense on payment (that legacy flow double-counted the bill against the
      // mirror). So here, when marking as paid we ALSO ensure the mirror has an
      // account_id, otherwise the balance wouldn't reflect the payment at all.
      const { data: mirrors } = await supabase
        .from('expenses')
        .select('id, account_id, status, notes')
        .like('notes', `%tx:${id}%`);

      const linkedMirror = (mirrors || []).find(m => m.notes?.includes(`tx:${id}`));
      if (!linkedMirror) return;

      const update: { status: string; account_id?: string } = {
        status: paid ? 'concluido' : 'pendente',
      };
      // Assign the chosen account when paying an account-less mirror so it
      // actually debits the bank balance. When un-paying, leave the account.
      if (paid && !linkedMirror.account_id && accountId) {
        update.account_id = accountId;
      }
      await supabase
        .from('expenses')
        .update(update)
        .eq('id', linkedMirror.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cc-transactions'] });
      qc.invalidateQueries({ queryKey: ['cc-transactions-month'] });
      qc.invalidateQueries({ queryKey: ['cc-all-future'] });
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['accumulated-balance'] });
    },
  });
}

export function useDeleteCCTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const deletedAt = new Date().toISOString();

      await deleteWithSoftDeleteFallback((supportsSoftDelete) => {
        if (supportsSoftDelete) {
          return supabase
            .from('credit_card_transactions')
            .update({ deleted_at: deletedAt })
            .eq('id', id);
        }

        return supabase.from('credit_card_transactions').delete().eq('id', id);
      });

      await deleteWithSoftDeleteFallback((supportsSoftDelete) => {
        if (supportsSoftDelete) {
          return supabase
            .from('expenses')
            .update({ deleted_at: deletedAt })
            .like('notes', `%tx:${id}%`);
        }

        return supabase.from('expenses').delete().like('notes', `%tx:${id}%`);
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cc-transactions'] });
      qc.invalidateQueries({ queryKey: ['cc-transactions-month'] });
      qc.invalidateQueries({ queryKey: ['cc-all-future'] });
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['trash'] });
      qc.invalidateQueries({ queryKey: ['accumulated-balance'] });
    },
  });
}

export function useUpdateCCTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Pick<
      TablesUpdate<'credit_card_transactions'>,
      'amount' | 'bill_month' | 'category_id' | 'date' | 'description' | 'notes' | 'paid'
    >) => {
      const payload = Object.fromEntries(
        Object.entries(data).filter(([, value]) => value !== undefined),
      ) as TablesUpdate<'credit_card_transactions'>;

      const { data: updated, error } = await supabase
        .from('credit_card_transactions')
        .update(payload)
        .eq('id', id)
        .select('credit_card_id,bill_month')
        .single();
      if (error) throw error;

      const hasField = (key: keyof typeof data) => Object.prototype.hasOwnProperty.call(data, key);
      const mirrorPayload: TablesUpdate<'expenses'> = {};
      if (hasField('amount')) mirrorPayload.amount = data.amount;
      if (hasField('category_id')) mirrorPayload.category_id = data.category_id ?? null;
      if (hasField('date')) mirrorPayload.date = data.date;
      if (hasField('description')) mirrorPayload.description = data.description;
      if (hasField('paid')) mirrorPayload.status = data.paid ? 'concluido' : 'pendente';

      const { data: mirrors, error: mirrorsError } = await supabase
        .from('expenses')
        .select('id, notes')
        .like('notes', `%tx:${id}%`);
      if (mirrorsError) throw mirrorsError;

      const mirrorIds = (mirrors || []).map((mirror) => mirror.id);
      if (mirrorIds.length > 0 && Object.keys(mirrorPayload).length > 0) {
        const { error: mirrorUpdateError } = await supabase
          .from('expenses')
          .update(mirrorPayload)
          .in('id', mirrorIds);
        if (mirrorUpdateError) throw mirrorUpdateError;
      }

      if (hasField('bill_month') && updated?.credit_card_id && updated.bill_month) {
        await Promise.all((mirrors || []).map((mirror) => {
          const marker = `[Cartao de credito|card:${updated.credit_card_id}|bill:${updated.bill_month}|tx:${id}]`;
          const notes = mirror.notes?.match(/\[Cartao de credito[^\]]*\]/i)
            ? mirror.notes.replace(/\[Cartao de credito[^\]]*\]/i, marker)
            : `${marker} ${mirror.notes || ''}`.trim();
          return supabase.from('expenses').update({ notes }).eq('id', mirror.id);
        }));
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cc-transactions'] });
      qc.invalidateQueries({ queryKey: ['cc-transactions-month'] });
      qc.invalidateQueries({ queryKey: ['cc-all-future'] });
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['accumulated-balance'] });
    },
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
      const data = await queryWithSoftDeleteFallback<CreditCardTransaction>((supportsSoftDelete) => {
        let q = supabase
          .from('credit_card_transactions')
          .select('*')
          .eq('is_installment', true)
          .in('bill_month', months)
          .order('bill_month', { ascending: true });
        if (supportsSoftDelete) q = q.is('deleted_at', null);
        return q;
      });
      return data as CreditCardTransaction[];
    },
    enabled: !!user,
  });
}

/** ALL future installments + transactions from current month onwards — used by CreditCardsPage */
export function useAllFutureCCTransactions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['cc-all-future', user?.id],
    queryFn: async () => {
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const data = await queryWithSoftDeleteFallback<CreditCardTransaction>((supportsSoftDelete) => {
        let q = supabase
          .from('credit_card_transactions')
          .select('*')
          .gte('bill_month', currentMonth)
          .order('bill_month', { ascending: true })
          .order('date', { ascending: false });
        if (supportsSoftDelete) q = q.is('deleted_at', null);
        return q;
      });
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
      const data = await queryWithSoftDeleteFallback<CreditCardTransaction>((supportsSoftDelete) => {
        let q = supabase
          .from('credit_card_transactions')
          .select('*')
          .eq('bill_month', billMonth)
          .order('date', { ascending: false });
        if (supportsSoftDelete) q = q.is('deleted_at', null);
        return q;
      });
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

/**
 * ALL unpaid transactions for a card across every bill month (past, current,
 * future). This is the real "outstanding debt" used to compute the available
 * limit — NOT just the current/future months. Returns the rows so callers can
 * both sum the total and inspect installments.
 */
export function useCardOutstanding(cardId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['cc-outstanding', user?.id, cardId],
    queryFn: async () => {
      const data = await queryWithSoftDeleteFallback<CreditCardTransaction>((supportsSoftDelete) => {
        let q = supabase
          .from('credit_card_transactions')
          .select('*')
          .eq('paid', false)
          .order('bill_month', { ascending: true });
        if (supportsSoftDelete) q = q.is('deleted_at', null);
        if (cardId) q = q.eq('credit_card_id', cardId);
        return q;
      });
      return data as CreditCardTransaction[];
    },
    enabled: !!user && !!cardId,
  });
}

