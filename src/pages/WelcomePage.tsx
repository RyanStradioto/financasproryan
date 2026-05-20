/**
 * WelcomePage — Onboarding screen displayed to new users right after sign-in.
 *
 * Why this exists: a blank dashboard is intimidating for first-time users.
 * This screen gives them a clear "what to do next" path with four bite-sized
 * setup cards (perfil → contas → categorias → primeira transação).
 *
 * Each card auto-checks when its step is done (e.g. accounts.length > 0),
 * so a returning user who completes a step elsewhere sees it ticked.
 * The user can dismiss the screen at any time via "Pular para o dashboard";
 * dismissal is persisted in localStorage so they don't see it again.
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Sparkles, ChevronRight, Rocket } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useAccounts, useCategories, useIncome, useExpenses } from '@/hooks/useFinanceData';
import { cn } from '@/lib/utils';
import { dismissWelcome } from '@/lib/welcomeState';

type StepCard = {
  key: string;
  title: string;
  description: string;
  emoji: string;
  /** Tailwind gradient classes for the icon bubble */
  gradient: string;
  /** Soft glow color behind the bubble */
  glow: string;
  href: string;
  done: boolean;
};

export default function WelcomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: income = [] } = useIncome();
  const { data: expenses = [] } = useExpenses();

  const firstName = profile?.first_name?.trim() || '';
  const greetingName = firstName || (user?.email ? user.email.split('@')[0] : '');

  const steps: StepCard[] = useMemo(() => [
    {
      key: 'profile',
      title: 'Configure seu perfil',
      description: 'Personalize seu nome e dados de trabalho.',
      emoji: '👤',
      gradient: 'from-sky-400 via-blue-500 to-indigo-500',
      glow: 'bg-sky-400/30',
      href: '/configuracoes',
      done: Boolean(profile?.first_name),
    },
    {
      key: 'accounts',
      title: 'Cadastre suas contas',
      description: 'Bancos, carteiras e cartões em um só lugar.',
      emoji: '🏦',
      gradient: 'from-emerald-400 via-teal-500 to-cyan-500',
      glow: 'bg-emerald-400/30',
      href: '/contas',
      done: accounts.length > 0,
    },
    {
      key: 'categories',
      title: 'Crie suas categorias',
      description: 'Organize receitas e despesas do seu jeito.',
      emoji: '🏷️',
      gradient: 'from-violet-400 via-fuchsia-500 to-pink-500',
      glow: 'bg-fuchsia-400/30',
      href: '/categorias',
      done: categories.length > 0,
    },
    {
      key: 'first-tx',
      title: 'Sua primeira transação',
      description: 'Lance uma receita ou despesa e veja o app ganhar vida.',
      emoji: '✨',
      gradient: 'from-amber-400 via-orange-500 to-rose-500',
      glow: 'bg-amber-400/30',
      href: '/receitas',
      done: income.length + expenses.length > 0,
    },
  ], [profile?.first_name, accounts.length, categories.length, income.length, expenses.length]);

  const completedCount = steps.filter(s => s.done).length;
  const totalSteps = steps.length;
  const progressPct = (completedCount / totalSteps) * 100;
  const allDone = completedCount === totalSteps;

  // The first incomplete step is the "active" highlighted call-to-action.
  const activeIndex = steps.findIndex(s => !s.done);

  const handleSkip = () => {
    dismissWelcome(user?.id);
    navigate('/');
  };

  const handleCardClick = (step: StepCard) => {
    navigate(step.href);
  };

  return (
    <div className="relative min-h-[calc(100vh-12rem)] w-full overflow-hidden animate-fade-in">
      {/* Decorative background glows */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-20 h-80 w-80 rounded-full bg-sky-400/20 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-violet-400/10 blur-3xl" />

      <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-6 px-1 py-2 sm:gap-8 sm:py-4">
        {/* ── Header ───────────────────────────────────────── */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-primary mb-3">
              <Sparkles className="h-3 w-3" />
              Bem-vindo ao FinancasPro
            </div>
            <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-4xl">
              Olá{greetingName ? `, ${greetingName}` : ''}! <span className="inline-block animate-float">👋</span>
            </h1>
            <p className="mt-2 text-sm font-medium text-muted-foreground sm:text-base">
              Vamos deixar seu app pronto em <span className="font-black text-foreground">4 passos rápidos</span>.
            </p>
          </div>

          {/* Progress */}
          <div className="rounded-2xl border border-border/60 bg-card/70 backdrop-blur-md px-4 py-3 shadow-sm shrink-0 sm:min-w-[220px]">
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Progresso</span>
              <span className="text-xs font-black text-primary">{completedCount}/{totalSteps}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </header>

        {/* ── Step cards ──────────────────────────────────── */}
        <section className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          {steps.map((step, index) => {
            const isActive = !step.done && index === activeIndex;
            return (
              <button
                key={step.key}
                type="button"
                onClick={() => handleCardClick(step)}
                className={cn(
                  'group relative flex flex-col items-center gap-3 overflow-hidden rounded-3xl border bg-card p-5 text-left shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl active:scale-[0.98]',
                  step.done
                    ? 'border-emerald-300/50 hover:border-emerald-400/60 hover:shadow-emerald-500/10'
                    : isActive
                    ? 'border-primary/40 hover:border-primary/60 hover:shadow-primary/15'
                    : 'border-border/60 hover:border-border',
                )}
                style={{ animationDelay: `${index * 80}ms` }}
              >
                {/* Done badge */}
                {step.done && (
                  <span className="absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                )}

                {/* Step number ribbon */}
                {!step.done && (
                  <span className="absolute left-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[11px] font-black text-muted-foreground">
                    {index + 1}
                  </span>
                )}

                {/* Illustration bubble */}
                <div className="relative mt-3">
                  <div className={cn('absolute inset-0 -z-10 rounded-full blur-2xl', step.glow)} />
                  <div
                    className={cn(
                      'flex h-28 w-28 items-center justify-center rounded-[2rem] bg-gradient-to-br shadow-xl transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3',
                      step.gradient,
                    )}
                  >
                    <span className="text-6xl drop-shadow-md select-none" aria-hidden>
                      {step.emoji}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="mt-1 flex flex-col items-center gap-1.5 text-center">
                  <h3 className="text-base font-black tracking-tight text-foreground">{step.title}</h3>
                  <p className="text-xs font-medium text-muted-foreground leading-relaxed line-clamp-2 min-h-[2.5rem]">
                    {step.description}
                  </p>
                </div>

                {/* CTA */}
                <span
                  className={cn(
                    'mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-black transition-all',
                    step.done
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                      : isActive
                      ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25 group-hover:bg-primary/90'
                      : 'bg-muted text-muted-foreground group-hover:bg-muted/80',
                  )}
                >
                  {step.done ? (
                    <>
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      Concluído
                    </>
                  ) : (
                    <>
                      {isActive ? 'Cadastrar agora' : 'Configurar'}
                      <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </>
                  )}
                </span>
              </button>
            );
          })}
        </section>

        {/* ── Footer actions ──────────────────────────────── */}
        <footer className="flex flex-col items-center gap-3 pt-2 sm:flex-row sm:justify-between">
          {allDone ? (
            <div className="flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-between">
              <p className="text-sm font-bold text-foreground flex items-center gap-2">
                <Rocket className="h-4 w-4 text-primary" />
                Tudo pronto! Hora de explorar.
              </p>
              <button
                onClick={handleSkip}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-black text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 active:scale-95"
              >
                Ir para o dashboard
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <p className="text-xs font-semibold text-muted-foreground text-center sm:text-left">
                Você pode completar esses passos depois, sem problema.
              </p>
              <button
                onClick={handleSkip}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-card px-4 py-2.5 text-xs font-black text-foreground/80 transition-all hover:bg-muted hover:border-border active:scale-95"
              >
                Pular para o dashboard
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
