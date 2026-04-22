import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { isMissingDeletedAtError } from '@/lib/softDeleteCompat';

export type TrashedItem = {
  id: string;
  table: 'income' | 'expenses';
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
      const [incomeRes, expensesRes] = await Promise.all([
        supabase
          .from('income')
          .select('id, description, amount, date, deleted_at')
          .not('deleted_at', 'is', null)
          .order('deleted_at', { ascending: false }),
        supabase
          .from('expenses')
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

      return items.sort((a, b) => new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime());
    },
    enabled: !!user,
  });
}

export function useRestoreItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, table }: { id: string; table: 'income' | 'expenses' }) => {
      const { error } = await supabase
        .from(table)
        .update({ deleted_at: null } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trash'] });
      qc.invalidateQueries({ queryKey: ['income'] });
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['accumulated-balance'] });
    },
  });
}

export function usePermanentDelete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, table }: { id: string; table: 'income' | 'expenses' }) => {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trash'] });
    },
  });
}

export function useTrashCount() {
  const { data: items = [] } = useTrash();
  return items.length;
}
