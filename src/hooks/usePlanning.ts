import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type PlanningFixedCost = Tables<'planning_fixed_costs'>;
export type PlanningSalaryConfig = Tables<'planning_salary_configs'>;

type FixedCostInput = Omit<TablesInsert<'planning_fixed_costs'>, 'user_id'>;
type FixedCostUpdate = TablesUpdate<'planning_fixed_costs'> & { id: string };
type SalaryInput = Omit<TablesInsert<'planning_salary_configs'>, 'user_id'>;

export function usePlanningFixedCosts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['planning-fixed-costs', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planning_fixed_costs')
        .select('*')
        .eq('active', true)
        .order('day', { ascending: true })
        .order('description', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });
}

export function useAddPlanningFixedCost() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: FixedCostInput) => {
      const { data, error } = await supabase
        .from('planning_fixed_costs')
        .insert({ ...input, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['planning-fixed-costs'] }),
  });
}

export function useUpdatePlanningFixedCost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: FixedCostUpdate) => {
      const { data, error } = await supabase
        .from('planning_fixed_costs')
        .update(input)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['planning-fixed-costs'] }),
  });
}

export function useArchivePlanningFixedCost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('planning_fixed_costs')
        .update({ active: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['planning-fixed-costs'] }),
  });
}

export function usePlanningSalaryConfig() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['planning-salary-config', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planning_salary_configs')
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useUpsertPlanningSalaryConfig() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: SalaryInput) => {
      const { data, error } = await supabase
        .from('planning_salary_configs')
        .upsert({ ...input, user_id: user!.id }, { onConflict: 'user_id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['planning-salary-config'] }),
  });
}


