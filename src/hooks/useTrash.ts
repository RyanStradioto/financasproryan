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
      // Ids cujo prazo de 30 dias venceu — devem ser apagados de vez (purga).
      const expired = { income: [] as string[], expenses: [] as string[], credit_card_transactions: [] as string[] };
      const daysLeft = (deletedAt: string) =>
        Math.ceil((new Date(deletedAt).getTime() + 30 * 86400000 - now.getTime()) / 86400000);

      for (const item of (incomeRes.data || [])) {
        const diffDays = daysLeft(item.deleted_at!);
        if (diffDays > 0) {
          items.push({ id: item.id, table: 'income', description: item.description || 'Receita', amount: Number(item.amount), date: item.date, deleted_at: item.deleted_at!, days_remaining: diffDays });
        } else {
          expired.income.push(item.id);
        }
      }

      for (const item of (expensesRes.data || [])) {
        if (item.notes && /\[Cartao de credito\b/i.test(item.notes)) continue;
        const diffDays = daysLeft(item.deleted_at!);
        if (diffDays > 0) {
          items.push({ id: item.id, table: 'expenses', description: item.description || 'Despesa', amount: Number(item.amount), date: item.date, deleted_at: item.deleted_at!, days_remaining: diffDays });
        } else {
          expired.expenses.push(item.id);
        }
      }

      if (!creditCardRes.error) {
        for (const item of (creditCardRes.data || [])) {
          const diffDays = daysLeft(item.deleted_at!);
          if (diffDays > 0) {
            items.push({ id: item.id, table: 'credit_card_transactions', description: item.description || 'Compra no cartao', amount: Number(item.amount), date: item.date, deleted_at: item.deleted_at!, days_remaining: diffDays });
          } else {
            expired.credit_card_transactions.push(item.id);
          }
        }
      }

      // ── Purga automática: apaga de vez o que passou de 30 dias ──
      // (Roda sempre que a lixeira é carregada — inclusive no load do app, via
      //  useTrashCount na sidebar. Substitui o cron que não existia.)
      try {
        if (expired.income.length) {
          await supabase.from('income').delete().in('id', expired.income);
        }
        if (expired.expenses.length) {
          await supabase.from('expenses').delete().in('id', expired.expenses);
        }
        if (expired.credit_card_transactions.length) {
          await supabase.from('credit_card_transactions').delete().in('id', expired.credit_card_transactions);
          // Limpa os espelhos em expenses ligados a essas compras de cartão
          for (const txId of expired.credit_card_transactions) {
            await supabase.from('expenses').delete().like('notes', `%tx:${txId}%`);
          }
        }
      } catch (purgeErr) {
        console.warn('[trash] falha ao purgar itens expirados', purgeErr);
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

