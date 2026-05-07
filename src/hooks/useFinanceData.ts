import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';
import {
  deleteWithSoftDeleteFallback,
  isMissingRelationError,
  mutateManyWithOptionalColumnsFallback,
  mutateWithOptionalColumnsFallback,
  queryWithSoftDeleteFallback,
} from '@/lib/softDeleteCompat';

export type Category = Tables<'categories'>;
export type CategoryAccountBudget = Tables<'category_account_budgets'>;
export type Account = Tables<'accounts'>;
export type Income = Tables<'income'>;
export type Expense = Tables<'expenses'>;
export type RecentDeletion = Tables<'recent_deletions'>;

const ATTACHMENT_OPTIONAL_COLUMNS = ['attachment_url'];

export function useCategories() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['categories', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Category[];
    },
    enabled: !!user,
  });
}

export function useAccounts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['accounts', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Account[];
    },
    enabled: !!user,
  });
}

export function useCategoryAccountBudgets() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['category-account-budgets', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('category_account_budgets')
        .select('*')
        .order('created_at');
      if (!error) return data as CategoryAccountBudget[];
      if (isMissingRelationError(error, 'category_account_budgets')) {
        console.warn('[schema-compat] category_account_budgets ausente; usando orçamento legado por categoria');
        return [] as CategoryAccountBudget[];
      }
      throw error;
    },
    enabled: !!user,
  });
}

function getLastDayOfMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return `${yearMonth}-${String(lastDay).padStart(2, '0')}`;
}

function isSkippedMonth(month?: string) {
  return month === '__skip__';
}

export function useIncome(month?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['income', user?.id, month],
    queryFn: async () => {
      if (isSkippedMonth(month)) return [] as Income[];

      const data = await queryWithSoftDeleteFallback<Income>((supportsSoftDelete) => {
        let query = supabase.from('income').select('*');
        if (supportsSoftDelete) {
          query = query.is('deleted_at', null);
        }
        query = query.order('date', { ascending: false });
        if (month) {
          const start = `${month}-01`;
          const end = getLastDayOfMonth(month);
          query = query.gte('date', start).lte('date', end);
        }
        return query;
      });

      return data as Income[];
    },
    enabled: !!user,
  });
}

export function useExpenses(month?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['expenses', user?.id, month],
    queryFn: async () => {
      if (isSkippedMonth(month)) return [] as Expense[];

      const data = await queryWithSoftDeleteFallback<Expense>((supportsSoftDelete) => {
        let query = supabase.from('expenses').select('*');
        if (supportsSoftDelete) {
          query = query.is('deleted_at', null);
        }
        query = query.order('date', { ascending: false });
        if (month) {
          const start = `${month}-01`;
          const end = getLastDayOfMonth(month);
          query = query.gte('date', start).lte('date', end);
        }
        return query;
      });

      return data as Expense[];
    },
    enabled: !!user,
  });
}

export function useRecentDescriptions(type: 'income' | 'expenses') {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['recent-descriptions', type, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(type)
        .select('description')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      const unique = [...new Set((data || []).map(d => d.description).filter(Boolean))];
      return unique.slice(0, 50);
    },
    enabled: !!user,
  });
}

export function useAddIncome() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (data: Omit<TablesInsert<'income'>, 'user_id'>): Promise<Income> => {
      const inserted = await mutateWithOptionalColumnsFallback<Income>(
        { ...data, user_id: user!.id },
        ATTACHMENT_OPTIONAL_COLUMNS,
        (payload) =>
          supabase
            .from('income')
            .insert(payload as TablesInsert<'income'>)
            .select()
            .single(),
      );
      if (!inserted) throw new Error('Falha ao criar a receita.');
      return inserted as Income;
    },
    onSuccess: (newItem) => {
      const itemMonth = newItem.date.substring(0, 7);
      qc.setQueryData<Income[]>(['income', user!.id, itemMonth], (old) =>
        old ? [newItem, ...old.filter(i => i.id !== newItem.id)] : [newItem]
      );
      qc.invalidateQueries({ queryKey: ['income'] });
      qc.invalidateQueries({ queryKey: ['accumulated-balance'] });
    },
  });
}

export function useAddExpense() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (data: Omit<TablesInsert<'expenses'>, 'user_id'>): Promise<Expense> => {
      const inserted = await mutateWithOptionalColumnsFallback<Expense>(
        { ...data, user_id: user!.id },
        ATTACHMENT_OPTIONAL_COLUMNS,
        (payload) =>
          supabase
            .from('expenses')
            .insert(payload as TablesInsert<'expenses'>)
            .select()
            .single(),
      );
      if (!inserted) throw new Error('Falha ao criar a despesa.');
      return inserted as Expense;
    },
    onSuccess: (newItem) => {
      const itemMonth = newItem.date.substring(0, 7);
      qc.setQueryData<Expense[]>(['expenses', user!.id, itemMonth], (old) =>
        old ? [newItem, ...old.filter(i => i.id !== newItem.id)] : [newItem]
      );
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['accumulated-balance'] });
    },
  });
}

export function useAddExpenseBatch() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (items: Omit<TablesInsert<'expenses'>, 'user_id'>[]) => {
      const rows = items.map(d => ({ ...d, user_id: user!.id }));
      await mutateManyWithOptionalColumnsFallback(
        rows as Record<string, unknown>[],
        ATTACHMENT_OPTIONAL_COLUMNS,
        (payloads) => supabase.from('expenses').insert(payloads as TablesInsert<'expenses'>[]),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }).then(() => qc.invalidateQueries({ queryKey: ['accumulated-balance'] })),
  });
}

export function useDeleteIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return deleteWithSoftDeleteFallback((supportsSoftDelete) => {
        if (supportsSoftDelete) {
          return supabase
            .from('income')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id);
        }

        return supabase
          .from('income')
          .delete()
          .eq('id', id);
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['income'] });
      qc.invalidateQueries({ queryKey: ['trash'] });
      qc.invalidateQueries({ queryKey: ['accumulated-balance'] });
    },
  });
}

export function useDeleteIncomeWithHistory() {
  const qc = useQueryClient();
  const { user } = useAuth();

  console.log('🔧 Hook useDeleteIncomeWithHistory inicializado, user:', user?.id);

  return useMutation({
    mutationFn: async (item: Income) => {
      console.log('🔄 Iniciando exclusão com histórico para receita:', item.id, 'user:', user?.id);

      if (!user?.id) {
        throw new Error('Usuário não autenticado');
      }

      // Primeiro, vamos tentar apenas excluir sem backup para testar
      console.log('🧪 Testando exclusão direta primeiro...');

      const { error } = await supabase.from('income').delete().eq('id', item.id);

      if (error) {
        console.error('❌ Erro na exclusão direta:', error);
        throw new Error(`Erro na exclusão: ${error.message}`);
      }

      console.log('✅ Exclusão direta funcionou! Agora tentando backup...');

      // Agora tenta o backup
      try {
        const { error: backupError } = await supabase.from('recent_deletions').insert({
          user_id: user.id,
          table_name: 'income',
          record_id: item.id,
          payload: item,
        });

        if (backupError) {
          console.warn('⚠️ Backup falhou, mas exclusão foi bem-sucedida:', backupError);
          // Não lança erro aqui, pois a exclusão principal funcionou
        } else {
          console.log('✅ Backup criado com sucesso');
        }
      } catch (backupErr) {
        console.warn('⚠️ Erro no backup (não crítico):', backupErr);
      }

      console.log('✅ Receita excluída com sucesso');
      return item;
    },
    onSuccess: (data) => {
      console.log('🎉 Exclusão completada com sucesso:', data.id);
      qc.invalidateQueries({ queryKey: ['income'] });
      qc.invalidateQueries({ queryKey: ['recent-deletions'] });
    },
    onError: (error) => {
      console.error('💥 Erro na mutation:', error);
    },
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return deleteWithSoftDeleteFallback((supportsSoftDelete) => {
        if (supportsSoftDelete) {
          return supabase
            .from('expenses')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id);
        }

        return supabase
          .from('expenses')
          .delete()
          .eq('id', id);
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['trash'] });
      qc.invalidateQueries({ queryKey: ['accumulated-balance'] });
    },
  });
}

export function useDeleteExpenseWithHistory() {
  const qc = useQueryClient();
  const { user } = useAuth();

  console.log('🔧 Hook useDeleteExpenseWithHistory inicializado, user:', user?.id);

  return useMutation({
    mutationFn: async (item: Expense) => {
      console.log('🔄 Iniciando exclusão com histórico para despesa:', item.id, 'user:', user?.id);

      if (!user?.id) {
        throw new Error('Usuário não autenticado');
      }

      const { error: backupError } = await supabase.from('recent_deletions').insert({
        user_id: user.id,
        table_name: 'expenses',
        record_id: item.id,
        payload: item,
      });

      if (backupError) {
        console.error('❌ Erro ao fazer backup:', backupError);
        throw new Error(`Erro no backup: ${backupError.message}`);
      }

      console.log('✅ Backup criado com sucesso');

      const { error } = await supabase.from('expenses').delete().eq('id', item.id);

      if (error) {
        console.error('❌ Erro ao excluir despesa:', error);
        throw new Error(`Erro na exclusão: ${error.message}`);
      }

      console.log('✅ Despesa excluída com sucesso');
      return item;
    },
    onSuccess: (data) => {
      console.log('🎉 Exclusão completada com sucesso:', data.id);
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['recent-deletions'] });
    },
    onError: (error) => {
      console.error('💥 Erro na mutation:', error);
    },
  });
}

export function useRecentDeletions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['recent-deletions', user?.id],
    queryFn: async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('recent_deletions')
        .select('*')
        .gte('deleted_at', thirtyDaysAgo)
        .order('deleted_at', { ascending: false });
      if (error) {
        if (isMissingRelationError(error, 'recent_deletions')) return [] as RecentDeletion[];
        throw error;
      }
      return data as RecentDeletion[];
    },
    enabled: !!user,
  });
}

export function useRestoreDeletion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: deletion, error: fetchError } = await supabase
        .from('recent_deletions')
        .select('*')
        .eq('id', id)
        .single();
      if (fetchError || !deletion) throw fetchError || new Error('Exclusão não encontrada');

      const { table_name, payload } = deletion;

      // Clean the payload by removing system fields that shouldn't be inserted
      const cleanPayload = { ...(payload as Record<string, unknown>) };
      delete cleanPayload.id;
      delete cleanPayload.created_at;
      delete cleanPayload.updated_at;
      cleanPayload.user_id = deletion.user_id;

      const { error: restoreError } = table_name === 'income'
        ? await supabase.from('income').insert(cleanPayload as TablesInsert<'income'>)
        : await supabase.from('expenses').insert(cleanPayload as TablesInsert<'expenses'>);
      if (restoreError) throw restoreError;

      const { error: deleteHistoryError } = await supabase
        .from('recent_deletions')
        .delete()
        .eq('id', id);
      if (deleteHistoryError) throw deleteHistoryError;

      return deletion;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recent-deletions'] }).then(() => {
      qc.invalidateQueries({ queryKey: ['income'] });
      qc.invalidateQueries({ queryKey: ['expenses'] });
    }),
  });
}

export function useAddCategory() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (data: Omit<TablesInsert<'categories'>, 'user_id'>) => {
      const { data: inserted, error } = await supabase
        .from('categories')
        .insert({ ...data, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return inserted as Category;
    },
    onSuccess: (newCategory) => {
      qc.setQueryData<Category[]>(['categories', user?.id], (old = []) =>
        [...old, newCategory].sort((a, b) => a.name.localeCompare(b.name))
      );
    },
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<TablesInsert<'categories'>>) => {
      const { error } = await supabase.from('categories').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useReplaceCategoryAccountBudgets() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({
      categoryId,
      budgets,
    }: {
      categoryId: string;
      budgets: Array<{ account_id: string; monthly_budget: number }>;
    }) => {
      const { error: deleteError } = await supabase
        .from('category_account_budgets')
        .delete()
        .eq('category_id', categoryId);
      if (deleteError) {
        if (isMissingRelationError(deleteError, 'category_account_budgets')) return;
        throw deleteError;
      }

      const rows = budgets
        .filter((budget) => budget.account_id && budget.monthly_budget > 0)
        .map((budget) => ({
          category_id: categoryId,
          account_id: budget.account_id,
          monthly_budget: budget.monthly_budget,
          user_id: user!.id,
        }));

      if (rows.length === 0) return;

      const { error: insertError } = await supabase
        .from('category_account_budgets')
        .insert(rows as TablesInsert<'category_account_budgets'>[]);
      if (insertError) throw insertError;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['category-account-budgets'] }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('categories').update({ archived: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useAddAccount() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (data: Omit<TablesInsert<'accounts'>, 'user_id'>) => {
      const { error } = await supabase.from('accounts').insert({ ...data, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<TablesInsert<'accounts'>>) => {
      const { error } = await supabase.from('accounts').update(data as TablesInsert<'accounts'>).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] });
      qc.invalidateQueries({ queryKey: ['accumulated-balance'] });
    },
  });
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<TablesInsert<'expenses'>>) => {
      await mutateWithOptionalColumnsFallback<null>(
        data as Record<string, unknown>,
        ATTACHMENT_OPTIONAL_COLUMNS,
        (payload) => supabase.from('expenses').update(payload as TablesInsert<'expenses'>).eq('id', id),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  });
}

export function useUpdateIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<TablesInsert<'income'>>) => {
      await mutateWithOptionalColumnsFallback<null>(
        data as Record<string, unknown>,
        ATTACHMENT_OPTIONAL_COLUMNS,
        (payload) => supabase.from('income').update(payload as TablesInsert<'income'>).eq('id', id),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['income'] }),
  });
}


