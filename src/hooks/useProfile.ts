import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type Profile = {
  id: string;
  user_id: string;
  first_name?: string;
  monthly_salary: number;
  work_hours_per_day: number;
  work_days_per_week: number;
  weekly_summary_enabled: boolean;
  monthly_summary_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
    enabled: !!user,
  });
}

export function useUpsertProfile() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (data: Partial<Omit<Profile, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => {
      const { error } = await supabase
        .from('profiles')
        .upsert({ ...data, user_id: user!.id }, { onConflict: 'user_id' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  });
}

export function useWorkTimeCalc() {
  const { data: profile } = useProfile();

  const hourlyRate = profile && profile.monthly_salary > 0 && profile.work_hours_per_day > 0 && profile.work_days_per_week > 0
    ? profile.monthly_salary / (profile.work_days_per_week * 4.33 * profile.work_hours_per_day)
    : null;

  const calcWorkTime = (amount: number) => {
    if (!hourlyRate || hourlyRate <= 0) return null;
    const totalHours = amount / hourlyRate;
    const hoursPerDay = profile!.work_hours_per_day;
    const days = Math.floor(totalHours / hoursPerDay);
    const remainingHours = totalHours % hoursPerDay;
    return { totalHours, days, hours: Math.round(remainingHours * 10) / 10 };
  };

  return { calcWorkTime, hourlyRate, profile };
}
