import { useState, useEffect } from 'react';
import { useProfile, useUpsertProfile, useTotalSalary } from '@/hooks/useProfile';
import { useAccounts, useUpdateAccount, useIncome } from '@/hooks/useFinanceData';
import { notNeutralTransfer } from '@/lib/investmentMarker';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { User, Briefcase, Clock, CalendarDays, CalendarClock, Landmark, Mail, Save, Trash2, AlertTriangle, Send, Sparkles, Lock, Eye, EyeOff, Palette, Sun, Moon, Check } from 'lucide-react';
import { formatCurrency, getMonthYear } from '@/lib/format';
import { useSensitiveData } from '@/components/finance/SensitiveData';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useQueryClient } from '@tanstack/react-query';
import { useTutorial } from '@/components/finance/AppTutorial';
import { useTheme } from '@/hooks/useTheme';
import { usePalette } from '@/hooks/usePalette';
import { PALETTES } from '@/lib/palettes';
import { cn } from '@/lib/utils';

const WEEKDAYS: { v: number; short: string; full: string }[] = [
  { v: 0, short: 'D', full: 'domingo' },
  { v: 1, short: 'S', full: 'segunda' },
  { v: 2, short: 'T', full: 'terça' },
  { v: 3, short: 'Q', full: 'quarta' },
  { v: 4, short: 'Q', full: 'quinta' },
  { v: 5, short: 'S', full: 'sexta' },
  { v: 6, short: 'S', full: 'sábado' },
];

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const MONTH_DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

/** Junta uma lista em portugues: ['seg','qui'] -> 'segunda e quinta'. */
const joinPt = (items: string[]): string => {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
};

const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`;

const getErrorMessage = (value: unknown): string | null => {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const error = typeof record.error === 'string' ? record.error : null;
  const message = typeof record.message === 'string' ? record.message : null;
  return error || message;
};

export default function SettingsPage() {
  const { user } = useAuth();
  const { openTutorial } = useTutorial();
  const { data: profile, isLoading } = useProfile();
  const upsert = useUpsertProfile();
  const { maskCurrency, isVisible } = useSensitiveData();
  const fmt = (v: number) => maskCurrency(formatCurrency(v));
  const { theme, toggleTheme } = useTheme();
  const { palette, setPalette } = usePalette();

  const [firstName, setFirstName] = useState('');
  const [salaryByAccount, setSalaryByAccount] = useState<Record<string, string>>({});
  const [hoursPerDay, setHoursPerDay] = useState('');
  const [daysPerWeek, setDaysPerWeek] = useState('');
  const [weeklyEmail, setWeeklyEmail] = useState(true);
  const [monthlyEmail, setMonthlyEmail] = useState(true);
  const [sendingTest, setSendingTest] = useState(false);
  const [sendingMonthly, setSendingMonthly] = useState(false);

  // Agendamento de e-mails
  const [weeklyDays, setWeeklyDays] = useState<number[]>([1]);
  const [monthlyDay, setMonthlyDay] = useState(1);
  const [emailHour, setEmailHour] = useState(9);
  const [perAccountEnabled, setPerAccountEnabled] = useState(true);
  // null = todas as contas (incl. futuras); array = selecao explicita
  const [accountIds, setAccountIds] = useState<string[] | null>(null);
  const { data: accounts = [] } = useAccounts();
  const activeAccounts = accounts.filter((a) => !a.archived);
  const updateAccount = useUpdateAccount();
  // Renda REAL recebida no mês atual (para os coeficientes valor/hora e valor/dia).
  const realTotal = useTotalSalary();
  const { data: incomeThisMonth = [] } = useIncome(getMonthYear());

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Delete by month state
  const [deleteMonthsOpen, setDeleteMonthsOpen] = useState(false);
  const [availableMonths, setAvailableMonths] = useState<{ month: string; count: number }[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [confirmDeleteText, setConfirmDeleteText] = useState('');
  const [isLoadingMonths, setIsLoadingMonths] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || '');
      setHoursPerDay(String(profile.work_hours_per_day || ''));
      setDaysPerWeek(String(profile.work_days_per_week || ''));
      setWeeklyEmail(profile.weekly_summary_enabled);
      setMonthlyEmail(profile.monthly_summary_enabled);
      setWeeklyDays(Array.isArray(profile.email_weekly_days) && profile.email_weekly_days.length ? profile.email_weekly_days : [1]);
      setMonthlyDay(typeof profile.email_monthly_day === 'number' ? profile.email_monthly_day : 1);
      setEmailHour(typeof profile.email_hour === 'number' ? profile.email_hour : 9);
      setPerAccountEnabled(profile.email_per_account_enabled !== false);
      setAccountIds(Array.isArray(profile.email_account_ids) ? profile.email_account_ids : null);
    }
  }, [profile]);

  // Carrega a renda por conta a partir das contas (fonte da verdade).
  useEffect(() => {
    const map: Record<string, string> = {};
    for (const a of accounts) map[a.id] = a.monthly_salary ? String(a.monthly_salary) : '';
    setSalaryByAccount(map);
  }, [accounts]);

  // Salário total = soma da renda das contas; fallback para o valor antigo do
  // perfil enquanto o usuário não distribuir a renda entre as contas.
  const accountsSalaryTotal = activeAccounts.reduce((s, a) => s + (Number(salaryByAccount[a.id]) || 0), 0);
  const monthlySalary = accountsSalaryTotal > 0 ? accountsSalaryTotal : Number(profile?.monthly_salary) || 0;

  // Persiste a renda de cada conta que mudou.
  const persistAccountSalaries = async () => {
    await Promise.all(
      activeAccounts
        .filter((a) => (Number(salaryByAccount[a.id]) || 0) !== (Number(a.monthly_salary) || 0))
        .map((a) => updateAccount.mutateAsync({ id: a.id, monthly_salary: Number(salaryByAccount[a.id]) || 0 })),
    );
  };

  const handleSave = async () => {
    try {
      await persistAccountSalaries();
      await upsert.mutateAsync({
        first_name: firstName.trim() || undefined,
        monthly_salary: monthlySalary, // espelho do total p/ compatibilidade (insights/edge)
        work_hours_per_day: Number(hoursPerDay) || 8,
        work_days_per_week: Number(daysPerWeek) || 5,
        weekly_summary_enabled: weeklyEmail,
        monthly_summary_enabled: monthlyEmail,
        email_weekly_days: weeklyDays.length ? [...weeklyDays].sort((a, b) => a - b) : [1],
        email_monthly_day: monthlyDay,
        email_hour: emailHour,
        email_per_account_enabled: perAccountEnabled,
        email_account_ids: accountIds,
      });
      toast.success('Perfil salvo com sucesso!');
    } catch {
      toast.error('Erro ao salvar perfil');
    }
  };

  // ── Helpers de agendamento (UI) ──
  const toggleWeekday = (v: number) => {
    setWeeklyDays((prev) => {
      if (prev.includes(v)) {
        const next = prev.filter((d) => d !== v);
        return next.length ? next : prev; // mantem ao menos 1 dia
      }
      return [...prev, v];
    });
  };

  const allAccountIds = activeAccounts.map((a) => a.id);
  const isAllAccounts = accountIds === null;
  const accountSelected = (id: string) => isAllAccounts || (accountIds?.includes(id) ?? false);
  const toggleAccount = (id: string) => {
    setAccountIds((prev) => {
      const base = prev === null ? allAccountIds : prev;
      const next = base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
      if (next.length === 0) return prev; // mantem ao menos 1 conta
      if (next.length === allAccountIds.length) return null; // todas -> null (inclui futuras)
      return next;
    });
  };

  const handleSavePassword = async () => {
    if (!currentPassword) {
      toast.error('Informe sua senha atual');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('A nova senha deve ter pelo menos 6 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }
    setSavingPassword(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user!.email!,
        password: currentPassword,
      });
      if (signInError) {
        toast.error('Senha atual incorreta');
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Senha alterada com sucesso!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e) {
      const err = e as Error;
      toast.error(`Erro: ${err.message}`);
    } finally {
      setSavingPassword(false);
    }
  };

  const MONTH_LABELS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  const formatMonthLabel = (m: string) => {
    const [y, mo] = m.split('-');
    return `${MONTH_LABELS[+mo - 1]}/${y}`;
  };

  const loadAvailableMonths = async () => {
    setIsLoadingMonths(true);
    try {
      const [{ data: incData }, { data: expData }, { data: ccData }] = await Promise.all([
        supabase.from('income').select('date'),
        supabase.from('expenses').select('date'),
        supabase.from('credit_card_transactions').select('date'),
      ]);
      const countMap = new Map<string, number>();
      [...(incData ?? []), ...(expData ?? []), ...(ccData ?? [])].forEach(r => {
        const mo = (r.date as string).substring(0, 7);
        countMap.set(mo, (countMap.get(mo) ?? 0) + 1);
      });
      const sorted = Array.from(countMap.entries())
        .map(([month, count]) => ({ month, count }))
        .sort((a, b) => b.month.localeCompare(a.month));
      setAvailableMonths(sorted);
    } finally {
      setIsLoadingMonths(false);
    }
  };

  const handleOpenDeleteMonths = () => {
    setDeleteMonthsOpen(true);
    setSelectedMonths([]);
    setConfirmDeleteText('');
    loadAvailableMonths();
  };

  const toggleMonth = (m: string) =>
    setSelectedMonths(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);

  const handleDeleteSelectedMonths = async () => {
    if (confirmDeleteText !== 'EXCLUIR') {
      toast.error('Digite EXCLUIR para confirmar');
      return;
    }
    if (selectedMonths.length === 0) {
      toast.error('Selecione ao menos um mês');
      return;
    }
    setIsDeleting(true);
    try {
      for (const month of selectedMonths) {
        const [y, mo] = month.split('-').map(Number);
        const lastDay = new Date(y, mo, 0).getDate();
        const start = `${month}-01`;
        const end = `${month}-${String(lastDay).padStart(2, '0')}`;
        const results = await Promise.all([
          supabase.from('income').delete().gte('date', start).lte('date', end),
          supabase.from('expenses').delete().gte('date', start).lte('date', end),
          supabase.from('credit_card_transactions').delete().gte('date', start).lte('date', end),
        ]);
        const errs = results.map(r => r.error).filter(Boolean);
        if (errs.length > 0) throw new Error(errs[0]!.message);
      }
      await queryClient.invalidateQueries();
      const label = selectedMonths.map(formatMonthLabel).join(', ');
      toast.success(`✅ Dados de ${label} excluídos!`);
      setDeleteMonthsOpen(false);
    } catch (e) {
      const error = e as Error;
      toast.error(error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const FUNCTIONS_BASE_URL = 'https://gashcjenhwamgxrrmbsa.supabase.co/functions/v1';

  const callTestFunction = async (path: 'weekly-summary' | 'monthly-summary', jwt: string) => {
    const attempt = async () => {
      const res = await fetch(`${FUNCTIONS_BASE_URL}/${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`,
        },
        body: '{}',
      });

      const raw = await res.text();
      let parsed: unknown = null;
      try {
        parsed = raw ? JSON.parse(raw) : null;
      } catch {
        parsed = null;
      }

      if (!res.ok) {
        const message = getErrorMessage(parsed) || raw || `HTTP ${res.status}`;
        throw new Error(message);
      }

      return parsed;
    };

    try {
      return await attempt();
    } catch (firstErr) {
      // Retry once for transient network/proxy failures
      return await attempt().catch(() => {
        throw firstErr;
      });
    }
  };

  const handleTestEmail = async () => {
    setSendingTest(true);
    try {
      let { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const refreshed = await supabase.auth.refreshSession();
        session = refreshed.data.session;
      }
      const jwt = session?.access_token;
      if (!jwt) throw new Error('Sessao expirada. Faca login novamente e tente de novo.');
      await callTestFunction('weekly-summary', jwt);
      toast.success('Resumo semanal enviado! Verifique sua caixa de entrada.');
    } catch (e) {
      const err = e as Error;
      toast.error(`Erro: ${err.message}`);
    } finally {
      setSendingTest(false);
    }
  };

  const handleTestMonthly = async () => {
    setSendingMonthly(true);
    try {
      let { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const refreshed = await supabase.auth.refreshSession();
        session = refreshed.data.session;
      }
      const jwt = session?.access_token;
      if (!jwt) throw new Error('Sessao expirada. Faca login novamente e tente de novo.');
      await callTestFunction('monthly-summary', jwt);
      toast.success('Relatório mensal enviado! Verifique sua caixa de entrada.');
    } catch (e) {
      const err = e as Error;
      toast.error(`Erro: ${err.message}`);
    } finally {
      setSendingMonthly(false);
    }
  };

  const hpd = Number(hoursPerDay) || 8;
  const dpw = Number(daysPerWeek) || 5;
  const monthlyHoursLocal = dpw * 4.33 * hpd;
  // Coeficientes com base na RENDA REAL recebida no mês (não na meta).
  const hourlyRate = realTotal > 0 && monthlyHoursLocal > 0 ? realTotal / monthlyHoursLocal : 0;
  const dailyRate = hourlyRate * hpd;
  // Renda real por conta (mês atual) → valor/hora por conta.
  const realByAccount: Record<string, number> = {};
  for (const i of incomeThisMonth) {
    if (i.status === 'concluido' && notNeutralTransfer(i) && i.account_id) {
      realByAccount[i.account_id] = (realByAccount[i.account_id] || 0) + Number(i.amount);
    }
  }
  const perAccountHourly = activeAccounts
    .map((a) => ({ acc: a, income: realByAccount[a.id] || 0, hourly: monthlyHoursLocal > 0 ? (realByAccount[a.id] || 0) / monthlyHoursLocal : 0 }))
    .filter((x) => x.income > 0)
    .sort((a, b) => b.hourly - a.hourly);
  const weeklyDaysLabel = weeklyDays.length >= 7
    ? 'todos os dias'
    : joinPt(WEEKDAYS.filter((d) => weeklyDays.includes(d.v)).map((d) => d.full));
  const accountsScheduleLabel = isAllAccounts
    ? `Todas as contas (${activeAccounts.length})`
    : `${accountIds?.length ?? 0} de ${activeAccounts.length} contas`;

  return (
    <div className="w-full space-y-6 animate-fade-in">
      {/* ─── Hero Header ─── */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-primary/[0.05] p-4 shadow-sm sm:rounded-3xl sm:p-7">
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary/15 blur-3xl rounded-full pointer-events-none" />
        <div className="relative z-10 flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-primary/25 to-primary/5 flex items-center justify-center shadow-inner border border-primary/15 shrink-0">
            <User className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-none">Configurações</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1.5">Seus dados pessoais e preferências</p>
          </div>
        </div>
      </div>

      <div className="lg:columns-2 lg:gap-6 space-y-6 lg:space-y-0 [&>*]:break-inside-avoid [&>*]:lg:mb-6">

      {/* ─── Aparência: tema + paleta de cores ─── */}
      <div className="stat-card space-y-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Palette className="w-4 h-4 text-primary" />
          Aparência
        </div>

        {/* Modo claro / escuro */}
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">Modo</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => { if (theme !== 'light') toggleTheme(); }}
              className={cn(
                'flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-3 text-sm font-semibold transition-all',
                theme === 'light' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/40',
              )}
            >
              <Sun className="w-4 h-4" /> Claro
            </button>
            <button
              type="button"
              onClick={() => { if (theme !== 'dark') toggleTheme(); }}
              className={cn(
                'flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-3 text-sm font-semibold transition-all',
                theme === 'dark' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/40',
              )}
            >
              <Moon className="w-4 h-4" /> Escuro
            </button>
          </div>
        </div>

        {/* Paleta de cores */}
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">Paleta de cores</label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {PALETTES.map((p) => {
              const active = palette === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPalette(p.id)}
                  className={cn(
                    'group relative flex items-center gap-3 rounded-xl border-2 p-2.5 text-left transition-all',
                    active ? 'border-primary bg-primary/[0.06]' : 'border-border bg-muted/20 hover:border-primary/40',
                  )}
                >
                  {/* Swatch stack */}
                  <div className="flex shrink-0 -space-x-1.5">
                    {p.swatches.map((c, i) => (
                      <span
                        key={i}
                        className="h-6 w-6 rounded-full border-2 border-card shadow-sm"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold leading-tight">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground leading-tight mt-0.5 truncate">{p.description}</p>
                  </div>
                  {active && (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2.5 leading-relaxed">
            A paleta muda as cores do app inteiro e funciona em modo claro e escuro. Verde (receitas) e vermelho (despesas) permanecem para facilitar a leitura.
          </p>
        </div>
      </div>

      <div className="stat-card space-y-6">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <User className="w-4 h-4 text-primary" />
          Dados da Conta
        </div>
        <div className="grid gap-4 pl-0 sm:pl-6">
          <div>
            <label className="text-xs text-muted-foreground">Email</label>
            <p className="text-sm font-medium">{user?.email}</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Nome</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="Como quer ser chamado?"
                className="flex h-11 md:h-10 w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                onClick={async () => {
                  try {
                    await upsert.mutateAsync({
                      first_name: firstName.trim() || undefined,
                      monthly_salary: monthlySalary,
                      work_hours_per_day: Number(hoursPerDay) || 8,
                      work_days_per_week: Number(daysPerWeek) || 5,
                      weekly_summary_enabled: weeklyEmail,
                      monthly_summary_enabled: monthlyEmail,
                    });
                    toast.success('Nome salvo!');
                  } catch {
                    toast.error('Erro ao salvar nome');
                  }
                }}
                disabled={upsert.isPending}
                className="shrink-0 h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all disabled:opacity-50"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="stat-card space-y-6">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Lock className="w-4 h-4 text-primary" />
          Alterar Senha
        </div>
        <div className="grid gap-4 pl-0 sm:pl-6">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Senha Atual</label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="Digite sua senha atual"
                className="flex h-11 md:h-10 w-full rounded-lg border border-border bg-muted/50 px-3 py-2 pr-10 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Nova Senha</label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="flex h-11 md:h-10 w-full rounded-lg border border-border bg-muted/50 px-3 py-2 pr-10 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Confirmar Nova Senha</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
                className="flex h-11 md:h-10 w-full rounded-lg border border-border bg-muted/50 px-3 py-2 pr-10 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <button
            onClick={handleSavePassword}
            disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
            className="flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all disabled:opacity-50"
          >
            <Lock className="w-4 h-4" />
            {savingPassword ? 'Salvando...' : 'Alterar Senha'}
          </button>
        </div>
      </div>

      <div className="stat-card space-y-6">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Briefcase className="w-4 h-4 text-primary" />
          Dados Profissionais
        </div>
        <div className="grid gap-4 pl-0 sm:pl-6">
          {/* Renda planejada (META) POR CONTA — a soma vira a meta total */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Landmark className="h-3.5 w-3.5" /> Renda planejada (meta) por conta
            </label>
            {activeAccounts.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
                Cadastre suas contas para informar quanto você recebe em cada uma.
              </p>
            ) : (
              <div className="space-y-2" data-tutorial-target="salary-input">
                {activeAccounts.map((acc) => (
                  <div key={acc.id} className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-base" style={{ background: `${acc.color || 'hsl(var(--primary))'}22` }}>{acc.icon || '🏦'}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{acc.name}</span>
                    <div className="relative w-32 shrink-0">
                      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                      <input
                        type={isVisible ? 'number' : 'password'}
                        inputMode="decimal"
                        value={salaryByAccount[acc.id] ?? ''}
                        onChange={(e) => setSalaryByAccount((p) => ({ ...p, [acc.id]: e.target.value }))}
                        placeholder={isVisible ? '0' : '••••'}
                        className="h-10 w-full rounded-lg border border-border bg-background pl-8 pr-2 text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between rounded-xl border border-primary/25 bg-primary/[0.06] px-3 py-2.5">
                  <span className="flex items-center gap-1.5 text-sm font-semibold"><Briefcase className="h-3.5 w-3.5 text-primary" /> Meta total</span>
                  <span className="currency text-base font-black tabular-nums text-primary">{fmt(monthlySalary)}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">A meta é só uma <b>referência</b>. Os cálculos (valor/hora, orçamento, insights) usam a <b>renda real recebida</b> — o que você registra em Receitas cada mês.</p>
              </div>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Horas por dia
              </label>
              <input
                type="number"
                value={hoursPerDay}
                onChange={e => setHoursPerDay(e.target.value)}
                placeholder="8"
                className="flex h-11 md:h-10 w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
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
                className="flex h-11 md:h-10 w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
        </div>

        {hourlyRate > 0 && (
          <div className="ml-0 sm:ml-6 p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-3">
            <p className="text-xs font-semibold text-primary flex items-center gap-1.5">📊 Seus Coeficientes</p>
            <p className="text-[11px] text-muted-foreground -mt-1">
              Com base na renda <b>real recebida</b> este mês ({fmt(realTotal)}) ÷ {Math.round(monthlyHoursLocal)}h de jornada.
            </p>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Valor/hora</span>
                <span className="font-bold currency text-foreground">{fmt(hourlyRate)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Valor/dia</span>
                <span className="font-bold currency text-foreground">{fmt(dailyRate)}</span>
              </div>
            </div>
            {perAccountHourly.length > 1 && (
              <div className="border-t border-primary/10 pt-2.5 space-y-1.5">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Valor/hora por conta</p>
                {perAccountHourly.map((x) => (
                  <div key={x.acc.id} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <span>{x.acc.icon || '💰'}</span> {x.acc.name}
                    </span>
                    <span className="font-semibold currency text-foreground tabular-nums">{fmt(x.hourly)}<span className="text-[11px] font-normal text-muted-foreground">/h</span></span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="stat-card space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Mail className="w-4 h-4 text-primary" />
          Notificações
        </div>
        <div className="space-y-4 pl-0 sm:pl-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setWeeklyEmail(!weeklyEmail)}
              className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${weeklyEmail ? 'bg-primary' : 'bg-muted-foreground/30'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${weeklyEmail ? 'translate-x-5' : 'translate-x-1'}`} />
            </div>
            <div>
              <p className="text-sm font-medium">Resumo Semanal por Email</p>
              <p className="text-xs text-muted-foreground">Um resumo das suas finanças nos dias que você escolher</p>
            </div>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setMonthlyEmail(!monthlyEmail)}
              className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${monthlyEmail ? 'bg-primary' : 'bg-muted-foreground/30'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${monthlyEmail ? 'translate-x-5' : 'translate-x-1'}`} />
            </div>
            <div>
              <p className="text-sm font-medium">Relatório Mensal por Email</p>
              <p className="text-xs text-muted-foreground">Consolidado completo do mês anterior no dia que você escolher</p>
            </div>
          </label>

          {/* ─── Agendamento ─── */}
          <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <CalendarClock className="w-4 h-4 text-primary" />
              Quando receber
            </div>

            {/* Horário */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Horário de envio</p>
                <p className="text-xs text-muted-foreground">Mesmo horário para o semanal e o mensal (horário de Brasília)</p>
              </div>
              <select
                value={emailHour}
                onChange={(e) => setEmailHour(Number(e.target.value))}
                className="h-10 rounded-lg border border-border bg-background px-3 text-base md:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
              </select>
            </div>

            {/* Dias do semanal */}
            <div className={cn('space-y-2 transition-opacity', !weeklyEmail && 'opacity-40 pointer-events-none')}>
              <p className="text-sm font-medium">Dias do resumo semanal</p>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((d) => {
                  const on = weeklyDays.includes(d.v);
                  return (
                    <button
                      key={d.v}
                      type="button"
                      onClick={() => toggleWeekday(d.v)}
                      aria-pressed={on}
                      title={d.full}
                      className={cn(
                        'h-9 w-9 rounded-full text-xs font-bold transition-all',
                        on ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/30 scale-105' : 'bg-muted text-muted-foreground hover:bg-muted-foreground/20',
                      )}
                    >
                      {d.short}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">Envio {weeklyDaysLabel === 'todos os dias' ? 'todos os dias' : `toda ${weeklyDaysLabel}`} às {hourLabel(emailHour)}.</p>
            </div>

            {/* Dia do mensal */}
            <div className={cn('flex items-center justify-between gap-3 transition-opacity', !monthlyEmail && 'opacity-40 pointer-events-none')}>
              <div>
                <p className="text-sm font-medium">Dia do relatório mensal</p>
                <p className="text-xs text-muted-foreground">Dia do mês em que o consolidado é enviado</p>
              </div>
              <select
                value={monthlyDay}
                onChange={(e) => setMonthlyDay(Number(e.target.value))}
                className="h-10 rounded-lg border border-border bg-background px-3 text-base md:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {MONTH_DAYS.map((d) => <option key={d} value={d}>Dia {d}</option>)}
              </select>
            </div>
          </div>

          {/* ─── Análise por conta ─── */}
          <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setPerAccountEnabled(!perAccountEnabled)}
                className={`w-10 h-6 shrink-0 rounded-full transition-colors relative cursor-pointer ${perAccountEnabled ? 'bg-primary' : 'bg-muted-foreground/30'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${perAccountEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
              </div>
              <div>
                <p className="flex items-center gap-1.5 text-sm font-medium"><Landmark className="w-3.5 h-3.5 text-primary" /> E-mail separado por conta</p>
                <p className="text-xs text-muted-foreground">Além do consolidado, receba uma análise individual de cada conta</p>
              </div>
            </label>

            {perAccountEnabled && (
              <div className="space-y-2 pl-0 sm:pl-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contas incluídas</p>
                  {!isAllAccounts && (
                    <button type="button" onClick={() => setAccountIds(null)} className="text-xs font-semibold text-primary hover:underline">
                      Selecionar todas
                    </button>
                  )}
                </div>
                {activeAccounts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma conta cadastrada ainda.</p>
                ) : (
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {activeAccounts.map((a) => {
                      const on = accountSelected(a.id);
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => toggleAccount(a.id)}
                          className={cn(
                            'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all',
                            on ? 'border-primary/40 bg-primary/10' : 'border-border bg-background hover:border-primary/30',
                          )}
                        >
                          <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors', on ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40')}>
                            {on && <Check className="h-3.5 w-3.5" />}
                          </span>
                          <span className="text-base shrink-0">{a.icon || '🏦'}</span>
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">{a.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">{accountsScheduleLabel}{isAllAccounts ? ' — inclui contas novas automaticamente' : ''}.</p>
              </div>
            )}
          </div>

          <div className="grid gap-2 sm:flex sm:flex-wrap">
            <button
              onClick={handleTestEmail}
              disabled={sendingTest}
              className="flex h-9 items-center justify-center gap-2 rounded-xl border border-border bg-muted/50 px-4 text-sm font-medium transition-all hover:bg-muted disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {sendingTest ? 'Enviando...' : 'Testar Resumo Semanal'}
            </button>
            <button
              onClick={handleTestMonthly}
              disabled={sendingMonthly}
              className="flex h-9 items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 text-sm font-medium transition-all hover:bg-primary/20 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {sendingMonthly ? 'Enviando...' : 'Testar Relatório Mensal'}
            </button>
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={upsert.isPending}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50"
      >
        <Save className="w-4 h-4" />
        {upsert.isPending ? 'Salvando...' : 'Salvar Configurações'}
      </button>

      <div className="stat-card space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="w-4 h-4 text-primary" />
          Tutorial do App
        </div>
        <div className="space-y-3 pl-0 sm:pl-6">
          <p className="text-sm text-muted-foreground">
            O passo a passo do aplicativo aparece automaticamente uma unica vez para cada usuario. Se quiser rever depois, e so abrir novamente aqui.
          </p>
          <button
            type="button"
            onClick={() => openTutorial(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/15 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            Rever tutorial
          </button>
        </div>
      </div>

      {/* â"€â"€ Zona de Perigo â"€â"€ */}
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 space-y-4">
        <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
          <AlertTriangle className="w-4 h-4" />
          Zona de Perigo — Limpeza de Dados
        </div>
        <p className="text-xs text-muted-foreground">
          Exclui <strong>todas as receitas, despesas e lançamentos de cartão</strong> dos meses selecionados.
          Esta ação é <strong>irreversível</strong>.
        </p>
        <button
          onClick={handleOpenDeleteMonths}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-destructive text-destructive-foreground rounded-xl text-sm font-semibold hover:bg-destructive/90 active:scale-[0.98] transition-all"
        >
          <Trash2 className="w-4 h-4" />
          Excluir dados por mês
        </button>
      </div>
      </div>

      {/* â"€â"€ Dialog: selecionar meses para excluir â"€â"€ */}
      <Dialog open={deleteMonthsOpen} onOpenChange={setDeleteMonthsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-4 h-4" />
              Excluir dados por mês
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Selecione os meses cujos dados você quer excluir permanentemente (receitas, despesas e fatura do cartão).
            </p>

            {/* Month checklist */}
            <div className="max-h-60 overflow-y-auto space-y-1 rounded-lg border border-border p-2 bg-muted/30">
              {isLoadingMonths ? (
                <p className="text-sm text-muted-foreground text-center py-4">Carregando meses...</p>
              ) : availableMonths.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum dado encontrado</p>
              ) : (
                availableMonths.map(({ month, count }) => (
                  <label key={month} className="flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer hover:bg-muted/60 transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedMonths.includes(month)}
                      onChange={() => toggleMonth(month)}
                      className="accent-destructive w-4 h-4 shrink-0"
                    />
                    <span className="flex-1 text-sm font-medium">{formatMonthLabel(month)}</span>
                    <span className="text-xs text-muted-foreground">{count} lançamento{count !== 1 ? 's' : ''}</span>
                  </label>
                ))
              )}
            </div>

            {/* Select all / clear */}
            {availableMonths.length > 0 && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedMonths(availableMonths.map(m => m.month))}
                  className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
                >
                  Selecionar todos
                </button>
                <span className="text-xs text-muted-foreground">·</span>
                <button
                  type="button"
                  onClick={() => setSelectedMonths([])}
                  className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
                >
                  Limpar seleção
                </button>
                {selectedMonths.length > 0 && (
                  <span className="text-xs text-destructive font-medium ml-auto">{selectedMonths.length} mês(es) selecionado(s)</span>
                )}
              </div>
            )}

            {/* Confirmation input */}
            {selectedMonths.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground block">
                  Digite <strong className="text-destructive">EXCLUIR</strong> para confirmar
                </label>
                <input
                  type="text"
                  value={confirmDeleteText}
                  onChange={e => setConfirmDeleteText(e.target.value)}
                  placeholder="EXCLUIR"
                  className="flex h-11 md:h-10 w-full rounded-lg border border-destructive/30 bg-muted/50 px-3 py-2 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-destructive/30"
                />
                <button
                  onClick={handleDeleteSelectedMonths}
                  disabled={isDeleting || confirmDeleteText !== 'EXCLUIR'}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-destructive text-destructive-foreground rounded-xl text-sm font-semibold hover:bg-destructive/90 active:scale-[0.98] transition-all disabled:opacity-40"
                >
                  <Trash2 className="w-4 h-4" />
                  {isDeleting ? 'Excluindo...' : `Excluir ${selectedMonths.length} mês(es)`}
                </button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


