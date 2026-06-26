import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { mutateWithOptionalColumnsFallback } from '@/lib/softDeleteCompat';
import { useAuth } from './useAuth';
import { useAccounts } from './useFinanceData';

// Colunas de agendamento de e-mail — opcionais para que o app funcione mesmo
// antes da migration ser aplicada (o upsert reenvia sem elas se nao existirem).
const PROFILE_OPTIONAL_COLUMNS = [
  'email_weekly_days',
  'email_monthly_day',
  'email_hour',
  'email_per_account_enabled',
  'email_account_ids',
];

export type Profile = {
  id: string;
  user_id: string;
  first_name?: string;
  monthly_salary: number;
  work_hours_per_day: number;
  work_days_per_week: number;
  weekly_summary_enabled: boolean;
  monthly_summary_enabled: boolean;
  // Agendamento de e-mails (defaults reproduzem o comportamento atual: seg 9h / dia 1 9h)
  email_weekly_days?: number[] | null;       // 0=Dom .. 6=Sab
  email_monthly_day?: number | null;         // 1..28
  email_hour?: number | null;                // 0..23 (horario de Brasilia)
  email_per_account_enabled?: boolean | null;
  email_account_ids?: string[] | null;       // null = todas as contas
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
      await mutateWithOptionalColumnsFallback(
        { ...data, user_id: user!.id },
        PROFILE_OPTIONAL_COLUMNS,
        (payload) => supabase.from('profiles').upsert(payload, { onConflict: 'user_id' }).select().maybeSingle(),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  });
}

/**
 * Salário TOTAL = soma da renda mensal de todas as contas (fonte da verdade).
 * Faz fallback para profile.monthly_salary enquanto as contas não tiverem renda
 * definida (compatibilidade com o modelo antigo de salário único).
 */
export function useTotalSalary(): number {
  const { data: profile } = useProfile();
  const { data: accounts = [] } = useAccounts();
  const sumAccounts = accounts.reduce((s, a) => s + (Number(a.monthly_salary) || 0), 0);
  return sumAccounts > 0 ? sumAccounts : Number(profile?.monthly_salary) || 0;
}

export function useWorkTimeCalc() {
  const { data: profile } = useProfile();
  const totalSalary = useTotalSalary();

  const hourlyRate = profile && totalSalary > 0 && profile.work_hours_per_day > 0 && profile.work_days_per_week > 0
    ? totalSalary / (profile.work_days_per_week * 4.33 * profile.work_hours_per_day)
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
