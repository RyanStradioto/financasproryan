import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Settings, Grid3X3, Landmark, CreditCard, BarChart3,
  TrendingUp, TrendingDown, LayoutDashboard, Sparkles,
  ChevronRight, Check, X, ArrowRight, Rocket,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

type ChecklistItem = { label: string; required?: boolean };

type TutorialStep = {
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  badge: string;
  route?: string;
  checklist?: ChecklistItem[];
  highlightTarget?: string;
};

type TutorialContextValue = { openTutorial: (force?: boolean) => void };
const TutorialContext = createContext<TutorialContextValue | null>(null);

const TUTORIAL_VERSION = 'v4';

const tutorialSteps: TutorialStep[] = [
  {
    title: 'Configure seu app agora',
    description: 'Vamos te guiar em menos de 5 minutos. Cada passo te leva direto para a tela certa e mostra exatamente o que preencher.',
    icon: Rocket,
    badge: 'Início',
    color: 'from-violet-500 to-primary',
  },
  {
    title: 'Configurações',
    description: 'Informe seu salário e jornada de trabalho. O app usa isso nos cálculos e relatórios.',
    icon: Settings,
    badge: 'Passo 1 de 7',
    color: 'from-blue-500 to-cyan-500',
    route: '/configuracoes',
    highlightTarget: 'salary-input',
    checklist: [
      { label: 'Preenchi meu salário mensal', required: true },
      { label: 'Preenchi horas por dia e dias por semana' },
      { label: 'Cliquei em Salvar Configurações' },
    ],
  },
  {
    title: 'Categorias',
    description: 'Clique em "Nova Categoria" e crie suas primeiras categorias de gasto (ex: Alimentação, Casa, Lazer).',
    icon: Grid3X3,
    badge: 'Passo 2 de 7',
    color: 'from-emerald-500 to-teal-500',
    route: '/categorias',
    highlightTarget: 'new-category',
    checklist: [
      { label: 'Criei pelo menos uma categoria (ex: Alimentação)', required: true },
      { label: 'Defini orçamento em pelo menos uma categoria' },
    ],
  },
  {
    title: 'Contas',
    description: 'Clique em "Nova Conta" e cadastre onde seu dinheiro fica: banco, carteira ou conta digital.',
    icon: Landmark,
    badge: 'Passo 3 de 7',
    color: 'from-orange-500 to-amber-500',
    route: '/contas',
    highlightTarget: 'new-account',
    checklist: [
      { label: 'Cadastrei pelo menos uma conta', required: true },
      { label: 'Informei o saldo inicial' },
    ],
  },
  {
    title: 'Cartões de crédito',
    description: 'Clique em "Novo Cartão" para cadastrar seus cartões e controlar faturas separadamente.',
    icon: CreditCard,
    badge: 'Passo 4 de 7',
    color: 'from-pink-500 to-rose-500',
    route: '/cartoes',
    highlightTarget: 'new-card',
    checklist: [
      { label: 'Não uso cartão de crédito (pode avançar)' },
      { label: 'Cadastrei meu cartão com limite e vencimento' },
    ],
  },
  {
    title: 'Investimentos',
    description: 'Clique em "Novo Ativo" para registrar metas e investimentos separados dos gastos do dia a dia.',
    icon: BarChart3,
    badge: 'Passo 5 de 7',
    color: 'from-purple-500 to-indigo-500',
    route: '/investimentos',
    highlightTarget: 'new-investment',
    checklist: [
      { label: 'Não tenho investimentos ainda (pode avançar)' },
      { label: 'Cadastrei pelo menos um investimento ou meta' },
    ],
  },
  {
    title: 'Receitas',
    description: 'Clique em "Nova Receita" e registre suas entradas de dinheiro para os relatórios ficarem corretos.',
    icon: TrendingUp,
    badge: 'Passo 6 de 7',
    color: 'from-green-500 to-emerald-500',
    route: '/receitas',
    highlightTarget: 'new-income',
    checklist: [
      { label: 'Registrei meu salário ou renda deste mês', required: true },
      { label: 'Escolhi a conta que recebeu o dinheiro' },
    ],
  },
  {
    title: 'Despesas',
    description: 'Clique em "Nova Despesa" e registre seus gastos com categoria, conta e status.',
    icon: TrendingDown,
    badge: 'Passo 7 de 7',
    color: 'from-red-500 to-orange-500',
    route: '/despesas',
    highlightTarget: 'new-expense',
    checklist: [
      { label: 'Registrei pelo menos uma despesa', required: true },
      { label: 'Escolhi categoria e conta corretamente' },
    ],
  },
];

const getTutorialKey = (userId: string) => `financaspro:tutorial:${TUTORIAL_VERSION}:${userId}`;
const getChecksKey  = (userId: string) => `financaspro:tutorial:checks:${TUTORIAL_VERSION}:${userId}`;

function applyHighlight(target: string | undefined) {
  clearHighlight();
  if (!target) return;
  const tryApply = (attempts = 0) => {
    const el = document.querySelector(`[data-tutorial-target="${target}"]`);
    if (el) {
      el.classList.add('tutorial-highlight');
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else if (attempts < 6) {
      setTimeout(() => tryApply(attempts + 1), 250);
    }
  };
  tryApply();
}

function clearHighlight() {
  document.querySelectorAll('.tutorial-highlight').forEach(el =>
    el.classList.remove('tutorial-highlight')
  );
}

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen]           = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [checks, setChecks]       = useState<Record<number, number[]>>({});

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
    if (user?.id) localStorage.setItem(getTutorialKey(user.id), 'seen');
  }, [user?.id]);

  const openTutorial = useCallback((force = false) => {
    if (!user?.id) return;
    if (!force && localStorage.getItem(getTutorialKey(user.id)) === 'seen') return;
    setStepIndex(0);
    setOpen(true);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    if (localStorage.getItem(getTutorialKey(user.id)) === 'seen') return;
    const t = window.setTimeout(() => { setStepIndex(0); setOpen(true); }, 700);
    return () => window.clearTimeout(t);
  }, [user?.id]);

  const closeTutorial = useCallback(() => {
    clearHighlight();
    markSeen();
    setOpen(false);
  }, [markSeen]);

  // Apply highlight when step changes
  useEffect(() => {
    if (!open) { clearHighlight(); return; }
    const step = tutorialSteps[stepIndex];
    if (!step || stepIndex === 0) { clearHighlight(); return; }
    applyHighlight(step.highlightTarget);
    return () => clearHighlight();
  }, [open, stepIndex]);

  const step       = tutorialSteps[stepIndex];
  const isWelcome  = stepIndex === 0;
  const isLast     = stepIndex === tutorialSteps.length - 1;
  const stepChecks = checks[stepIndex] ?? [];
  const required   = (step.checklist ?? []).map((c, i) => ({ ...c, i })).filter(c => c.required);
  const canAdvance = required.length === 0 || required.every(r => stepChecks.includes(r.i));
  const progress   = (stepIndex / (tutorialSteps.length - 1)) * 100;

  const toggleCheck = (idx: number) => {
    const cur  = checks[stepIndex] ?? [];
    const next = cur.includes(idx) ? cur.filter(i => i !== idx) : [...cur, idx];
    saveChecks({ ...checks, [stepIndex]: next });
  };

  const handleNext = useCallback(() => {
    if (isLast) { closeTutorial(); navigate('/'); return; }
    const next = stepIndex + 1;
    setStepIndex(next);
    const route = tutorialSteps[next]?.route;
    if (route) navigate(route);
  }, [closeTutorial, isLast, navigate, stepIndex]);

  const handleBack = useCallback(() => {
    const prev = Math.max(0, stepIndex - 1);
    setStepIndex(prev);
    const route = tutorialSteps[prev]?.route;
    if (route) navigate(route);
    else navigate('/');
  }, [navigate, stepIndex]);

  const contextValue = useMemo<TutorialContextValue>(() => ({ openTutorial }), [openTutorial]);

  if (!open) return <TutorialContext.Provider value={contextValue}>{children}</TutorialContext.Provider>;

  return (
    <TutorialContext.Provider value={contextValue}>
      {children}

      {/* ── WELCOME SCREEN ── */}
      {isWelcome && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-3xl bg-card border border-border/60 shadow-2xl shadow-black/40 overflow-hidden animate-slide-up">
            <div className={`h-1.5 w-full bg-gradient-to-r ${step.color}`} />

            <button
              onClick={closeTutorial}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-8 text-center space-y-6">
              <div className="mx-auto w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center shadow-xl shadow-primary/30">
                <Rocket className="w-9 h-9 text-white" />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest text-primary">Configuração guiada</p>
                <h2 className="text-2xl font-extrabold tracking-tight">Configure seu app agora</h2>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                  Vamos te guiar em <strong className="text-foreground">7 passos rápidos</strong>. Cada passo te leva direto para a tela certa e destaca exatamente o botão que você precisa clicar.
                </p>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {tutorialSteps.slice(1).map((s, i) => (
                  <div key={i} className="flex flex-col items-center gap-1.5">
                    <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${s.color} flex items-center justify-center shadow-sm`}>
                      <s.icon className="w-[18px] h-[18px] text-white" />
                    </div>
                    <span className="text-[10px] text-muted-foreground text-center leading-tight">{s.title}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-2 pt-1">
                <button
                  onClick={handleNext}
                  className="w-full h-12 rounded-2xl bg-gradient-to-r from-primary to-violet-600 text-white font-bold text-sm shadow-lg shadow-primary/30 hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  Começar agora
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button onClick={closeTutorial} className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
                  Pular — já sei configurar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP PANEL (steps 1-7) — sem backdrop para o usuário interagir ── */}
      {!isWelcome && (
        <div className="fixed bottom-0 left-0 right-0 z-[300] flex justify-center pb-3 px-3 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-xl rounded-2xl border border-border/60 bg-card/95 backdrop-blur-md shadow-2xl shadow-black/50 overflow-hidden animate-slide-up">
            <div className={`h-1.5 w-full bg-gradient-to-r ${step.color}`} />

            {/* header */}
            <div className="flex items-center justify-between px-4 pt-3 pb-1 gap-3">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-sm shrink-0`}>
                  <step.icon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{step.badge}</p>
                  <p className="font-bold text-sm leading-tight">{step.title}</p>
                </div>
              </div>
              <button
                onClick={closeTutorial}
                className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* progress bar */}
            <div className="px-4 pb-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${step.color} transition-all duration-500`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-[10px] font-semibold text-muted-foreground shrink-0">
                  {stepIndex}/{tutorialSteps.length - 1}
                </span>
              </div>
            </div>

            {/* body */}
            <div className="px-4 pb-3">
              <p className="text-xs text-muted-foreground leading-relaxed mb-2">{step.description}</p>

              {step.checklist && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Marque ao concluir
                  </p>
                  {step.checklist.map((item, idx) => {
                    const checked = stepChecks.includes(idx);
                    return (
                      <button
                        key={idx}
                        onClick={() => toggleCheck(idx)}
                        className={`w-full flex items-start gap-2.5 rounded-xl border px-3 py-2 text-left text-xs transition-all group ${
                          checked
                            ? 'border-primary/30 bg-primary/8 text-foreground'
                            : 'border-border bg-muted/20 text-muted-foreground hover:border-primary/20 hover:bg-muted/40'
                        }`}
                      >
                        <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all ${
                          checked ? 'border-primary bg-primary' : 'border-muted-foreground/30 group-hover:border-primary/50'
                        }`}>
                          {checked && <Check className="w-2.5 h-2.5 text-white" />}
                        </span>
                        <span className={`flex-1 leading-relaxed ${checked ? 'line-through opacity-50' : ''}`}>
                          {item.label}
                          {item.required && !checked && (
                            <span className="ml-1.5 text-[9px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                              obrigatório
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* footer */}
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/50 bg-muted/10">
              <button
                onClick={closeTutorial}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Pular tudo
              </button>

              <div className="flex gap-2 items-center">
                <div className="hidden sm:flex gap-1 mr-1">
                  {tutorialSteps.slice(1).map((_, i) => (
                    <div
                      key={i}
                      className={`rounded-full transition-all ${
                        i + 1 === stepIndex ? 'w-4 h-2 bg-primary' :
                        (checks[i + 1]?.length ?? 0) > 0 ? 'w-2 h-2 bg-primary/40' :
                        'w-2 h-2 bg-muted-foreground/20'
                      }`}
                    />
                  ))}
                </div>

                <button
                  onClick={handleBack}
                  disabled={stepIndex <= 1}
                  className="h-8 px-3 rounded-xl border border-border text-xs font-medium hover:bg-muted transition-all disabled:opacity-30"
                >
                  Voltar
                </button>

                <button
                  onClick={handleNext}
                  disabled={!canAdvance}
                  className={`h-8 px-4 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5 disabled:opacity-40 ${
                    canAdvance
                      ? `bg-gradient-to-r ${step.color} text-white shadow-sm hover:opacity-90 active:scale-[0.98]`
                      : 'bg-muted text-muted-foreground cursor-not-allowed'
                  }`}
                >
                  {isLast ? '🎉 Concluir' : 'Próximo'}
                  {!isLast && <ChevronRight className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error('useTutorial must be used within TutorialProvider');
  return ctx;
}
