import { useState, useEffect } from 'react';
import { useProfile, useUpsertProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { User, Briefcase, Clock, CalendarDays, Mail, Save } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

export default function SettingsPage() {
  const { user } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const upsert = useUpsertProfile();

  const [salary, setSalary] = useState('');
  const [hoursPerDay, setHoursPerDay] = useState('');
  const [daysPerWeek, setDaysPerWeek] = useState('');
  const [weeklyEmail, setWeeklyEmail] = useState(true);

  useEffect(() => {
    if (profile) {
      setSalary(String(profile.monthly_salary || ''));
      setHoursPerDay(String(profile.work_hours_per_day || ''));
      setDaysPerWeek(String(profile.work_days_per_week || ''));
      setWeeklyEmail(profile.weekly_summary_enabled);
    }
  }, [profile]);

  const handleSave = async () => {
    try {
      await upsert.mutateAsync({
        monthly_salary: Number(salary) || 0,
        work_hours_per_day: Number(hoursPerDay) || 8,
        work_days_per_week: Number(daysPerWeek) || 5,
        weekly_summary_enabled: weeklyEmail,
      });
      toast.success('Perfil salvo com sucesso!');
    } catch {
      toast.error('Erro ao salvar perfil');
    }
  };

  const monthlySalary = Number(salary) || 0;
  const hpd = Number(hoursPerDay) || 8;
  const dpw = Number(daysPerWeek) || 5;
  const hourlyRate = monthlySalary > 0 ? monthlySalary / (dpw * 4.33 * hpd) : 0;
  const dailyRate = hourlyRate * hpd;

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">Seus dados pessoais e preferências</p>
      </div>

      <div className="stat-card space-y-6">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <User className="w-4 h-4 text-primary" />
          Dados da Conta
        </div>
        <div className="grid gap-4 pl-6">
          <div>
            <label className="text-xs text-muted-foreground">Email</label>
            <p className="text-sm font-medium">{user?.email}</p>
          </div>
        </div>
      </div>

      <div className="stat-card space-y-6">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Briefcase className="w-4 h-4 text-primary" />
          Dados Profissionais
        </div>
        <div className="grid gap-4 pl-6">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Salário Mensal (R$)</label>
            <input
              type="number"
              value={salary}
              onChange={e => setSalary(e.target.value)}
              placeholder="5000"
              className="flex h-10 w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Horas por dia
              </label>
              <input
                type="number"
                value={hoursPerDay}
                onChange={e => setHoursPerDay(e.target.value)}
                placeholder="8"
                className="flex h-10 w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <CalendarDays className="w-3 h-3" /> Dias por semana
              </label>
              <input
                type="number"
                value={daysPerWeek}
                onChange={e => setDaysPerWeek(e.target.value)}
                placeholder="5"
                className="flex h-10 w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
        </div>

        {hourlyRate > 0 && (
          <div className="pl-6 p-4 rounded-lg bg-primary/5 border border-primary/10 space-y-2">
            <p className="text-xs font-medium text-primary">📊 Seus Coeficientes</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Valor/hora:</span>
                <span className="ml-2 font-semibold currency">{formatCurrency(hourlyRate)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Valor/dia:</span>
                <span className="ml-2 font-semibold currency">{formatCurrency(dailyRate)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="stat-card space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Mail className="w-4 h-4 text-primary" />
          Notificações
        </div>
        <div className="pl-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setWeeklyEmail(!weeklyEmail)}
              className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${weeklyEmail ? 'bg-primary' : 'bg-muted-foreground/30'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${weeklyEmail ? 'translate-x-5' : 'translate-x-1'}`} />
            </div>
            <div>
              <p className="text-sm font-medium">Resumo Semanal por Email</p>
              <p className="text-xs text-muted-foreground">Receba toda segunda um resumo das suas finanças</p>
            </div>
          </label>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={upsert.isPending}
        className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        <Save className="w-4 h-4" />
        {upsert.isPending ? 'Salvando...' : 'Salvar Configurações'}
      </button>
    </div>
  );
}
