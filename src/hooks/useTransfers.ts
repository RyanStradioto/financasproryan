import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { deleteWithSoftDeleteFallback, queryWithSoftDeleteFallback } from '@/lib/softDeleteCompat';
import { parseTransfer } from '@/lib/investmentMarker';

export type TransferRow = {
  id: string;            // id da transferência (compartilhado pelas 2 pernas)
  fromAccountId: string;
  toAccountId: string | null;
  amount: number;
  date: string;
  description: string;
};

/**
 * Cria uma transferência entre contas: uma DESPESA na conta de origem e uma
 * RECEITA na conta de destino, ambas marcadas como [TRANSFERENCIA]. Como o saldo
 * conta receitas/despesas concluídas por conta, o dinheiro simplesmente sai de
 * uma e entra na outra (neutro), sem virar gasto/receita nas análises.
 */
export function useTransferBetweenAccounts() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (data: { fromAccountId: string; toAccountId: string; amount: number; date: string; description?: string }) => {
      if (!user) throw new Error('Você precisa estar logado.');
      if (data.fromAccountId === data.toAccountId) throw new Error('Escolha contas diferentes.');
      if (!(data.amount > 0)) throw new Error('Informe um valor válido.');
      const tid = crypto.randomUUID();
      const desc = data.description?.trim() || 'Transferência entre contas';

      const { error: expError } = await supabase.from('expenses').insert({
        user_id: user.id,
        account_id: data.fromAccountId,
        amount: data.amount,
        date: data.date,
        description: desc,
        status: 'concluido',
        notes: `[TRANSFERENCIA|id:${tid}|para:${data.toAccountId}]`,
      });
      if (expError) throw expError;

      const { error: incError } = await supabase.from('income').insert({
        user_id: user.id,
        account_id: data.toAccountId,
        amount: data.amount,
        date: data.date,
        description: desc,
        status: 'concluido',
        notes: `[TRANSFERENCIA|id:${tid}|de:${data.fromAccountId}]`,
      });
      if (incError) throw incError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['income'] });
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['accumulated-balance'] });
      qc.invalidateQueries({ queryKey: ['transfers'] });
    },
  });
}

/** Lista as transferências recentes (a partir da perna de DESPESA = origem). */
export function useRecentTransfers(limit = 20) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['transfers', user?.id, limit],
    enabled: !!user,
    queryFn: async () => {
      const rows = await queryWithSoftDeleteFallback<{ id: string; account_id: string | null; amount: number; date: string; description: string; notes: string | null }>((soft) => {
        let q = supabase
          .from('expenses')
          .select('id, account_id, amount, date, description, notes')
          .like('notes', '%[TRANSFERENCIA%')
          .order('date', { ascending: false })
          .limit(limit);
        if (soft) q = q.is('deleted_at', null);
        return q;
      });
      return (rows || []).map((r) => {
        const meta = parseTransfer(r.notes);
        return {
          id: meta?.id ?? r.id,
          fromAccountId: r.account_id ?? '',
          toAccountId: meta?.para ?? null,
          amount: Number(r.amount),
          date: r.date,
          description: r.description,
        } as TransferRow;
      });
    },
  });
}

/** Exclui uma transferência (as duas pernas, casadas pelo id no marcador). */
export function useDeleteTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (transferId: string) => {
      const like = `%id:${transferId}%`;
      const del = new Date().toISOString();
      await deleteWithSoftDeleteFallback((soft) =>
        soft
          ? supabase.from('expenses').update({ deleted_at: del }).like('notes', like)
          : supabase.from('expenses').delete().like('notes', like),
      );
      await deleteWithSoftDeleteFallback((soft) =>
        soft
          ? supabase.from('income').update({ deleted_at: del }).like('notes', like)
          : supabase.from('income').delete().like('notes', like),
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['income'] });
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['accumulated-balance'] });
      qc.invalidateQueries({ queryKey: ['transfers'] });
    },
  });
}
