import { useState, useEffect } from 'react';
import { useProfile, useUpsertProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { User, Briefcase, Clock, CalendarDays, Mail, Save, Trash2, AlertTriangle, Send } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useQueryClient } from '@tanstack/react-query';

const formatScheduleDate = (date: Date) => {
  const weekday = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    timeZone: 'America/Sao_Paulo',
  }).format(date);
  const day = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).format(date);
  const time = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Sao_Paulo',
  }).format(date);

  return `${weekday}, ${day} às ${time}`;
};

const getNextWeeklySend = (now = new Date()) => {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0));
  let daysUntilMonday = (1 - next.getUTCDay() + 7) % 7;

  if (daysUntilMonday === 0 && now >= next) {
    daysUntilMonday = 7;
  }

  next.setUTCDate(next.getUTCDate() + daysUntilMonday);
  return formatScheduleDate(next);
};

const getNextMonthlySend = (now = new Date()) => {
  let next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 12, 0, 0));

  if (now >= next) {
    next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 12, 0, 0));
  }

  return formatScheduleDate(next);
};

export default function SettingsPage() {
  const { user } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const upsert = useUpsertProfile();

  const [salary, setSalary] = useState('');
  const [hoursPerDay, setHoursPerDay] = useState('');
  const [daysPerWeek, setDaysPerWeek] = useState('');
  const [weeklyEmail, setWeeklyEmail] = useState(true);
  const [monthlyEmail, setMonthlyEmail] = useState(true);
  const [sendingTest, setSendingTest] = useState(false);
  const [sendingMonthly, setSendingMonthly] = useState(false);

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
      setSalary(String(profile.monthly_salary || ''));
      setHoursPerDay(String(profile.work_hours_per_day || ''));
      setDaysPerWeek(String(profile.work_days_per_week || ''));
      setWeeklyEmail(profile.weekly_summary_enabled);
      setMonthlyEmail(profile.monthly_summary_enabled);
    }
  }, [profile]);

  const handleSave = async () => {
    try {
      await upsert.mutateAsync({
        monthly_salary: Number(salary) || 0,
        work_hours_per_day: Number(hoursPerDay) || 8,
        work_days_per_week: Number(daysPerWeek) || 5,
        weekly_summary_enabled: weeklyEmail,
        monthly_summary_enabled: monthlyEmail,
      });
      toast.success('Perfil salvo com sucesso!');
    } catch {
      toast.error('Erro ao salvar perfil');
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

  const monthlySalary = Number(salary) || 0;

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
      let parsed: any = null;
      try {
        parsed = raw ? JSON.parse(raw) : null;
      } catch {
        parsed = null;
      }

      if (!res.ok) {
        const message = parsed?.error || parsed?.message || raw || `HTTP ${res.status}`;
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
  const hourlyRate = monthlySalary > 0 ? monthlySalary / (dpw * 4.33 * hpd) : 0;
  const dailyRate = hourlyRate * hpd;
  const nextWeeklySend = getNextWeeklySend();
  const nextMonthlySend = getNextMonthlySend();

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
          <div className="ml-0 sm:ml-6 p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-3">
            <p className="text-xs font-semibold text-primary flex items-center gap-1.5">📊 Seus Coeficientes</p>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Valor/hora</span>
                <span className="font-bold currency text-foreground">{formatCurrency(hourlyRate)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Valor/dia</span>
                <span className="font-bold currency text-foreground">{formatCurrency(dailyRate)}</span>
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
        <div className="pl-6 space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setWeeklyEmail(!weeklyEmail)}
              className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${weeklyEmail ? 'bg-primary' : 'bg-muted-foreground/30'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${weeklyEmail ? 'translate-x-5' : 'translate-x-1'}`} />
            </div>
            <div>
              <p className="text-sm font-medium">Resumo Semanal por Email</p>
              <p className="text-xs text-muted-foreground">Receba toda segunda-feira um resumo das suas finanças</p>
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
              <p className="text-xs text-muted-foreground">Receba no dia 1 um consolidado completo do mês anterior</p>
            </div>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Próximo semanal</p>
              <p className="mt-1 text-sm font-medium text-foreground">{nextWeeklySend}</p>
              <p className="mt-1 text-xs text-muted-foreground">Envio automático toda segunda-feira às 09:00.</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Próximo mensal</p>
              <p className="mt-1 text-sm font-medium text-foreground">{nextMonthlySend}</p>
              <p className="mt-1 text-xs text-muted-foreground">Envio automático no dia 1 de cada mês às 09:00.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleTestEmail}
              disabled={sendingTest}
              className="flex items-center gap-2 h-9 px-4 rounded-xl border border-border bg-muted/50 text-sm font-medium hover:bg-muted transition-all disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {sendingTest ? 'Enviando...' : 'Testar Resumo Semanal'}
            </button>
            <button
              onClick={handleTestMonthly}
              disabled={sendingMonthly}
              className="flex items-center gap-2 h-9 px-4 rounded-xl border border-primary/30 bg-primary/10 text-sm font-medium hover:bg-primary/20 transition-all disabled:opacity-50"
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

      {/* ── Zona de Perigo ── */}
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

      {/* ── Dialog: selecionar meses para excluir ── */}
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
                  className="flex h-10 w-full rounded-lg border border-destructive/30 bg-muted/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-destructive/30"
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
