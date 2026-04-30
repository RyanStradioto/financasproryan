import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Settings, Grid3X3, Landmark, CreditCard, BarChart3,
  TrendingUp, TrendingDown, LayoutDashboard, Sparkles,
  ChevronLeft, ChevronRight, Check, Minus, ArrowRight, X,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

type ChecklistItem = { label: string; required?: boolean };

type TutorialStep = {
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  badge: string;
  route?: string;
  actionLabel?: string;
  checklist?: ChecklistItem[];
};

type TutorialContextValue = { openTutorial: (force?: boolean) => void };

const TUTORIAL_VERSION = 'v3';
const TutorialContext = createContext<TutorialContextValue | null>(null);

const tutorialSteps: TutorialStep[] = [
  {
    title: 'Bem-vindo ao FinançasPro!',
    description: 'Este guia vai te levar passo a passo pela configuração ideal. Você pode minimizar e preencher os dados enquanto avança.',
    icon: Sparkles,
    badge: 'Início',
    color: 'from-violet-500 to-primary',
    checklist: [
      { label: 'Você pode minimizar o painel e voltar quando quiser.' },
      { label: 'Cada etapa tem itens para marcar conforme conclui.' },
      { label: 'Itens obrigatórios precisam ser marcados para avançar.' },
    ],
  },
  {
    title: 'Configurações e dados profissionais',
    description: 'Define salário, horas de trabalho e preferências que o app usa nos cálculos e relatórios.',
    icon: Settings,
    badge: 'Passo 1',
    color: 'from-blue-500 to-cyan-500',
    route: '/configuracoes',
    actionLabel: 'Abrir Configurações',
    checklist: [
      { label: 'Preenchi meu salário mensal.', required: true },
      { label: 'Preenchi horas por dia e dias por semana.' },
      { label: 'Salvei as configurações.' },
    ],
  },
  {
    title: 'Categorias de gastos',
    description: 'Organize os tipos de gasto do dia a dia. Isso melhora gráficos, relatórios e alertas.',
    icon: Grid3X3,
    badge: 'Passo 2',
    color: 'from-emerald-500 to-teal-500',
    route: '/categorias',
    actionLabel: 'Abrir Categorias',
    checklist: [
      { label: 'Criei pelo menos uma categoria (ex: Alimentação).', required: true },
      { label: 'Defini orçamento mensal em pelo menos uma categoria.' },
    ],
  },
  {
    title: 'Contas bancárias',
    description: 'Cadastre onde seu dinheiro fica: banco, carteira, conta digital ou saldo inicial.',
    icon: Landmark,
    badge: 'Passo 3',
    color: 'from-orange-500 to-amber-500',
    route: '/contas',
    actionLabel: 'Abrir Contas',
    checklist: [
      { label: 'Cadastrei pelo menos uma conta.', required: true },
      { label: 'Informei o saldo inicial se tiver.' },
    ],
  },
  {
    title: 'Cartões de crédito',
    description: 'Cadastre seus cartões para controlar faturas e separar gastos que não saem da conta no mesmo dia.',
    icon: CreditCard,
    badge: 'Passo 4',
    color: 'from-pink-500 to-rose-500',
    route: '/cartoes',
    actionLabel: 'Abrir Cartões',
    checklist: [
      { label: 'Não uso cartão de crédito (pode avançar).' },
      { label: 'Cadastrei meu cartão com limite e vencimento.' },
    ],
  },
  {
    title: 'Investimentos e metas',
    description: 'Monte suas caixinhas e investimentos. Aportes e resgates ficam separados dos gastos do dia a dia.',
    icon: BarChart3,
    badge: 'Passo 5',
    color: 'from-purple-500 to-indigo-500',
    route: '/investimentos',
    actionLabel: 'Abrir Investimentos',
    checklist: [
      { label: 'Não tenho investimentos ainda (pode avançar).' },
      { label: 'Cadastrei pelo menos um investimento ou meta.' },
    ],
  },
  {
    title: 'Receitas',
    description: 'Registre suas entradas de dinheiro. Isso mantém saldo, economia e relatórios coerentes.',
    icon: TrendingUp,
    badge: 'Passo 6',
    color: 'from-green-500 to-emerald-500',
    route: '/receitas',
    actionLabel: 'Abrir Receitas',
    checklist: [
      { label: 'Registrei meu salário ou renda deste mês.', required: true },
      { label: 'Escolhi a conta que recebeu o dinheiro.' },
    ],
  },
  {
    title: 'Despesas',
    description: 'Registre seus gastos com categoria, conta e status. Parcele quando necessário.',
    icon: TrendingDown,
    badge: 'Passo 7',
    color: 'from-red-500 to-orange-500',
    route: '/despesas',
    actionLabel: 'Abrir Despesas',
    checklist: [
      { label: 'Registrei pelo menos uma despesa.', required: true },
      { label: 'Escolhi categoria e conta corretamente.' },
    ],
  },
  {
    title: 'Tudo pronto! Explore o Dashboard',
    description: 'Com os dados preenchidos, o Dashboard e os Insights mostram sua vida financeira em tempo real.',
    icon: LayoutDashboard,
    badge: 'Concluído',
    color: 'from-primary to-violet-500',
    route: '/',
    actionLabel: 'Ver Dashboard',
    checklist: [
      { label: 'Explorei o painel principal.' },
      { label: 'Conferi os alertas e gráficos.' },
      { label: 'Verei os Insights quando quiser análise por IA.' },
    ],
  },
];

const getTutorialKey = (userId: string) => `financaspro:tutorial:${TUTORIAL_VERSION}:${userId}`;
const getChecksKey = (userId: string) => `financaspro:tutorial:checks:${TUTORIAL_VERSION}:${userId}`;

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [checks, setChecks] = useState<Record<number, number[]>>({});

  // Load saved checks from localStorage
  useEffect(() => {
    if (!user?.id) return;
    try {
      const saved = localStorage.getItem(getChecksKey(user.id));
      if (saved) setChecks(JSON.parse(saved));
    } catch {}
  }, [user?.id]);

  const saveChecks = useCallback((next: Record<number, number[]>) => {
    if (!user?.id) return;
    setChecks(next);
    localStorage.setItem(getChecksKey(user.id), JSON.stringify(next));
  }, [user?.id]);

  const markSeen = useCallback(() => {
    if (!user?.id) return;
    localStorage.setItem(getTutorialKey(user.id), 'seen');
  }, [user?.id]);

  const openTutorial = useCallback((force = false) => {
    if (!user?.id) return;
    if (!force && localStorage.getItem(getTutorialKey(user.id)) === 'seen') return;
    setStepIndex(0);
    setMinimized(false);
    setOpen(true);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    if (localStorage.getItem(getTutorialKey(user.id)) === 'seen') return;
    const timeout = window.setTimeout(() => { setStepIndex(0); setOpen(true); }, 700);
    return () => window.clearTimeout(timeout);
  }, [user?.id]);

  const closeTutorial = useCallback(() => {
    markSeen();
    setOpen(false);
    setMinimized(false);
  }, [markSeen]);

  const step = tutorialSteps[stepIndex];
  const progress = ((stepIndex + 1) / tutorialSteps.length) * 100;
  const stepChecks = checks[stepIndex] ?? [];

  const requiredItems = (step.checklist ?? [])
    .map((item, i) => ({ ...item, i }))
    .filter(item => item.required);

  const canAdvance = requiredItems.length === 0
    || requiredItems.every(item => stepChecks.includes(item.i));

  const toggleCheck = (idx: number) => {
    const current = checks[stepIndex] ?? [];
    const next = current.includes(idx)
      ? current.filter(i => i !== idx)
      : [...current, idx];
    saveChecks({ ...checks, [stepIndex]: next });
  };

  const handleNext = useCallback(() => {
    if (stepIndex >= tutorialSteps.length - 1) { closeTutorial(); return; }
    setStepIndex(i => i + 1);
  }, [closeTutorial, stepIndex]);

  const handleBack = useCallback(() => {
    setStepIndex(i => Math.max(0, i - 1));
  }, []);

  const handleNavigate = useCallback(() => {
    if (!step.route) return;
    navigate(step.route);
    setMinimized(true);
  }, [navigate, step.route]);

  const isOnStepRoute = !!step.route && location.pathname === step.route;

  const contextValue = useMemo<TutorialContextValue>(() => ({ openTutorial }), [openTutorial]);

  if (!open) {
    return <TutorialContext.Provider value={contextValue}>{children}</TutorialContext.Provider>;
  }

  return (
    <TutorialContext.Provider value={contextValue}>
      {children}

      {/* Minimized FAB */}
      {minimized && (
        <button
          onClick={() => setMinimized(false)}
          className="fixed bottom-5 right-5 z-[300] flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-2xl shadow-primary/40 hover:bg-primary/90 transition-all hover:scale-105 active:scale-95"
        >
          <Sparkles className="w-4 h-4" />
          <span className="text-sm font-semibold">Tutorial</span>
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
            {stepIndex + 1}
          </span>
        </button>
      )}

      {/* Floating panel */}
      {!minimized && (
        <div className="fixed bottom-5 right-5 z-[300] w-[360px] max-w-[calc(100vw-2.5rem)] rounded-2xl border border-border/60 bg-card shadow-2xl shadow-black/30 flex flex-col overflow-hidden animate-slide-up">

          {/* Gradient top bar */}
          <div className={`h-1 w-full bg-gradient-to-r ${step.color}`} />

          {/* Header */}
          <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
            <div className="flex items-center gap-2">
              <div className={`flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br ${step.color}`}>
                <step.icon className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{step.badge}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground mr-1">{stepIndex + 1}/{tutorialSteps.length}</span>
              <button
                onClick={() => setMinimized(true)}
                className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="Minimizar"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={closeTutorial}
                className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                title="Encerrar tutorial"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mx-4 mb-3 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${step.color} transition-all duration-500`}
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Step dots */}
          <div className="flex items-center justify-center gap-1 px-4 mb-3">
            {tutorialSteps.map((_, i) => (
              <button
                key={i}
                onClick={() => setStepIndex(i)}
                className={`transition-all duration-200 rounded-full ${
                  i === stepIndex
                    ? 'w-5 h-2 bg-primary'
                    : (checks[i]?.length ?? 0) > 0
                    ? 'w-2 h-2 bg-primary/40'
                    : 'w-2 h-2 bg-muted-foreground/20 hover:bg-muted-foreground/40'
                }`}
              />
            ))}
          </div>

          {/* Content */}
          <div className="px-4 pb-1 space-y-3 max-h-[55vh] overflow-y-auto">
            <div>
              <h3 className="font-bold text-base leading-tight">{step.title}</h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{step.description}</p>
            </div>

            {/* Navigate button */}
            {step.route && (
              <button
                onClick={handleNavigate}
                className={`w-full flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99] ${
                  isOnStepRoute
                    ? 'border-primary/30 bg-primary/5 text-primary'
                    : 'border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/30 hover:bg-primary/90'
                }`}
              >
                <span>{isOnStepRoute ? '✓ Você já está aqui' : step.actionLabel}</span>
                {!isOnStepRoute && <ArrowRight className="w-4 h-4" />}
              </button>
            )}

            {/* Checklist */}
            {step.checklist && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  O que fazer {requiredItems.length > 0 ? '(marque ao concluir)' : ''}
                </p>
                {step.checklist.map((item, idx) => {
                  const checked = stepChecks.includes(idx);
                  return (
                    <button
                      key={idx}
                      onClick={() => toggleCheck(idx)}
                      className={`w-full flex items-start gap-2.5 rounded-xl border px-3 py-2 text-left text-xs transition-all ${
                        checked
                          ? 'border-primary/30 bg-primary/8 text-foreground'
                          : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/20 hover:bg-muted/50'
                      }`}
                    >
                      <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all ${
                        checked ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                      }`}>
                        {checked && <Check className="w-2.5 h-2.5 text-white" />}
                      </span>
                      <span className={`flex-1 leading-relaxed ${checked ? 'line-through opacity-60' : ''}`}>
                        {item.label}
                        {item.required && !checked && (
                          <span className="ml-1 text-[10px] font-bold text-primary/80 bg-primary/10 px-1 rounded">obrigatório</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-border/50 mt-2">
            <button
              onClick={closeTutorial}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
            >
              Pular tudo
            </button>
            <div className="flex gap-2">
              <button
                onClick={handleBack}
                disabled={stepIndex === 0}
                className="flex items-center gap-1 h-8 px-3 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-all disabled:opacity-30"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Voltar
              </button>
              <button
                onClick={handleNext}
                disabled={!canAdvance}
                className={`flex items-center gap-1 h-8 px-4 rounded-lg text-xs font-bold transition-all disabled:opacity-40 ${
                  stepIndex === tutorialSteps.length - 1
                    ? `bg-gradient-to-r ${step.color} text-white shadow-sm hover:opacity-90`
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                }`}
              >
                {stepIndex === tutorialSteps.length - 1 ? 'Concluir 🎉' : 'Próximo'}
                {stepIndex < tutorialSteps.length - 1 && <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const context = useContext(TutorialContext);
  if (!context) throw new Error('useTutorial must be used within TutorialProvider');
  return context;
}
