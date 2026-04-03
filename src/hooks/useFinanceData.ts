import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

export type Category = Tables<'categories'>;
export type Account = Tables<'accounts'>;
export type Income = Tables<'income'>;
export type Expense = Tables<'expenses'>;

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

function getLastDayOfMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return `${yearMonth}-${String(lastDay).padStart(2, '0')}`;
}

export function useIncome(month?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['income', user?.id, month],
    queryFn: async () => {
      let query = supabase.from('income').select('*').order('date', { ascending: false });
      if (month) {
        const start = `${month}-01`;
        const end = getLastDayOfMonth(month);
        query = query.gte('date', start).lte('date', end);
      }
      const { data, error } = await query;
      if (error) throw error;
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
      let query = supabase.from('expenses').select('*').order('date', { ascending: false });
      if (month) {
        const start = `${month}-01`;
        const end = getLastDayOfMonth(month);
        query = query.gte('date', start).lte('date', end);
      }
      const { data, error } = await query;
      if (error) throw error;
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
      const { data: inserted, error } = await supabase
        .from('income')
        .insert({ ...data, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
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
      const { data: inserted, error } = await supabase
        .from('expenses')
        .insert({ ...data, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
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
      const { error } = await supabase.from('expenses').insert(rows);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }).then(() => qc.invalidateQueries({ queryKey: ['accumulated-balance'] })),
  });
}

export function useDeleteIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('income').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['income'] }),
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  });
}

export function useAddCategory() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (data: Omit<TablesInsert<'categories'>, 'user_id'>) => {
      const { error } = await supabase.from('categories').insert({ ...data, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
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

export function useUpdateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<TablesInsert<'expenses'>>) => {
      const { error } = await supabase.from('expenses').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  });
}

export function useUpdateIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<TablesInsert<'income'>>) => {
      const { error } = await supabase.from('income').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['income'] }),
  });
}
