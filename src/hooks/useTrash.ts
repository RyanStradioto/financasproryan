import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { isMissingDeletedAtError } from '@/lib/softDeleteCompat';

export type TrashedItem = {
  id: string;
  table: 'income' | 'expenses' | 'credit_card_transactions';
  description: string;
  amount: number;
  date: string;
  deleted_at: string;
  days_remaining: number;
};

export function useTrash() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['trash', user?.id],
    queryFn: async () => {
      const now = new Date();
      const [incomeRes, expensesRes, creditCardRes] = await Promise.all([
        supabase
          .from('income')
          .select('id, description, amount, date, deleted_at')
          .not('deleted_at', 'is', null)
          .order('deleted_at', { ascending: false }),
        supabase
          .from('expenses')
          .select('id, description, amount, date, deleted_at, notes')
          .not('deleted_at', 'is', null)
          .order('deleted_at', { ascending: false }),
        supabase
          .from('credit_card_transactions')
          .select('id, description, amount, date, deleted_at')
          .not('deleted_at', 'is', null)
          .order('deleted_at', { ascending: false }),
      ]);

      const compatError = [incomeRes.error, expensesRes.error].find(isMissingDeletedAtError);
      if (compatError) {
        console.warn('[soft-delete] lixeira indisponivel; coluna deleted_at ausente');
        return [] as TrashedItem[];
      }
      if (incomeRes.error) throw incomeRes.error;
      if (expensesRes.error) throw expensesRes.error;
      if (creditCardRes.error && !isMissingDeletedAtError(creditCardRes.error)) throw creditCardRes.error;

      const items: TrashedItem[] = [];

      for (const item of (incomeRes.data || [])) {
        const deletedDate = new Date(item.deleted_at!);
        const diffDays = Math.ceil((deletedDate.getTime() + 30 * 86400000 - now.getTime()) / 86400000);
        if (diffDays > 0) {
          items.push({
            id: item.id,
            table: 'income',
            description: item.description || 'Receita',
            amount: Number(item.amount),
            date: item.date,
            deleted_at: item.deleted_at!,
            days_remaining: diffDays,
          });
        }
      }

      for (const item of (expensesRes.data || [])) {
        if (item.notes && /\[Cartao de credito\b/i.test(item.notes)) continue;
        const deletedDate = new Date(item.deleted_at!);
        const diffDays = Math.ceil((deletedDate.getTime() + 30 * 86400000 - now.getTime()) / 86400000);
        if (diffDays > 0) {
          items.push({
            id: item.id,
            table: 'expenses',
            description: item.description || 'Despesa',
            amount: Number(item.amount),
            date: item.date,
            deleted_at: item.deleted_at!,
            days_remaining: diffDays,
          });
        }
      }

      if (!creditCardRes.error) {
        for (const item of (creditCardRes.data || [])) {
          const deletedDate = new Date(item.deleted_at!);
          const diffDays = Math.ceil((deletedDate.getTime() + 30 * 86400000 - now.getTime()) / 86400000);
          if (diffDays > 0) {
            items.push({
              id: item.id,
              table: 'credit_card_transactions',
              description: item.description || 'Compra no cartao',
              amount: Number(item.amount),
              date: item.date,
              deleted_at: item.deleted_at!,
              days_remaining: diffDays,
            });
          }
        }
      }

      return items.sort((a, b) => new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime());
    },
    enabled: !!user,
  });
}

export function useRestoreItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, table }: { id: string; table: TrashedItem['table'] }) => {
      const { error } = await supabase.from(table).update({ deleted_at: null }).eq('id', id);
      if (error) throw error;

      if (table === 'credit_card_transactions') {
        const { error: mirrorError } = await supabase
          .from('expenses')
          .update({ deleted_at: null })
          .like('notes', `%tx:${id}%`);
        if (mirrorError && !isMissingDeletedAtError(mirrorError)) throw mirrorError;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trash'] });
      qc.invalidateQueries({ queryKey: ['income'] });
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['cc-transactions'] });
      qc.invalidateQueries({ queryKey: ['cc-all-future'] });
      qc.invalidateQueries({ queryKey: ['accumulated-balance'] });
    },
  });
}

export function usePermanentDelete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, table }: { id: string; table: TrashedItem['table'] }) => {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;

      if (table === 'credit_card_transactions') {
        const { error: mirrorError } = await supabase
          .from('expenses')
          .delete()
          .like('notes', `%tx:${id}%`);
        if (mirrorError) throw mirrorError;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trash'] });
      qc.invalidateQueries({ queryKey: ['cc-transactions'] });
      qc.invalidateQueries({ queryKey: ['cc-all-future'] });
      qc.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}

export function useTrashCount() {
  const { data: items = [] } = useTrash();
  return items.length;
}

