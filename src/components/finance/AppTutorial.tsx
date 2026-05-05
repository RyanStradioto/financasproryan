import {
  createContext, useCallback, useContext, useEffect,
  useMemo, useRef, useState,
} from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Settings, Grid3X3, Landmark, CreditCard, BarChart3,
  TrendingUp, TrendingDown, ChevronRight, ChevronDown,
  ChevronUp, Check, X, ArrowRight, Rocket, GripHorizontal,
  BookOpen,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useCategories, useAccounts, useIncome, useExpenses } from '@/hooks/useFinanceData';
import { getMonthYear } from '@/lib/format';

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
const WIDGET_W = 300;

const tutorialSteps: TutorialStep[] = [
  {
    title: 'Configure seu app agora',
    description: '',
    icon: Rocket,
    badge: 'Início',
    color: 'from-violet-500 to-primary',
  },
  {
    title: 'Configurações',
    description: 'Preencha seu salário mensal e jornada de trabalho. Clique no campo destacado abaixo.',
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
    description: 'Clique em "Nova Categoria" (destacado) e crie categorias como Alimentação, Casa, Lazer.',
    icon: Grid3X3,
    badge: 'Passo 2 de 7',
    color: 'from-emerald-500 to-teal-500',
    route: '/categorias',
    highlightTarget: 'new-category',
    checklist: [
      { label: 'Criei pelo menos uma categoria', required: true },
      { label: 'Defini orçamento em pelo menos uma categoria' },
    ],
  },
  {
    title: 'Contas',
    description: 'Clique em "Nova Conta" e cadastre onde seu dinheiro fica: banco, carteira ou digital.',
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
    description: 'Clique em "Novo Cartão" para cadastrar seus cartões e controlar faturas.',
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
    description: 'Clique em "Novo Ativo" para registrar metas e investimentos.',
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
    description: 'Clique em "Nova Receita" e registre seu salário ou renda do mês.',
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
    description: 'Clique em "Nova Despesa" e registre seus gastos com categoria e conta.',
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

const getTutorialKey  = (uid: string) => `financaspro:tutorial:${TUTORIAL_VERSION}:${uid}`;
const getChecksKey    = (uid: string) => `financaspro:tutorial:checks:${TUTORIAL_VERSION}:${uid}`;
const POS_KEY = 'financaspro:tutorial:pos';

function defaultPos() {
  return {
    x: Math.max(0, window.innerWidth  - WIDGET_W - 16),
    y: Math.max(0, window.innerHeight - 440),
  };
}
function loadPos() {
  try { const s = localStorage.getItem(POS_KEY); return s ? JSON.parse(s) : null; } catch { return null; }
}
function savePos(p: { x: number; y: number }) {
  try { localStorage.setItem(POS_KEY, JSON.stringify(p)); } catch {}
}
function clampPos(p: { x: number; y: number }) {
  return {
    x: Math.max(0, Math.min(window.innerWidth  - WIDGET_W - 4, p.x)),
    y: Math.max(0, Math.min(window.innerHeight - 60,            p.y)),
  };
}

function applyHighlight(target: string | undefined) {
  clearHighlight();
  if (!target) return;
  const tryApply = (n = 0) => {
    const el = document.querySelector(`[data-tutorial-target="${target}"]`);
    if (el) {
      el.classList.add('tutorial-highlight');
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else if (n < 8) setTimeout(() => tryApply(n + 1), 300);
  };
  tryApply();
}
function clearHighlight() {
  document.querySelectorAll('.tutorial-highlight').forEach(el =>
    el.classList.remove('tutorial-highlight')
  );
}

function hasOpenDialog() {
  return !!(
    document.querySelector('[role="dialog"]') ||
    document.querySelector('[data-radix-dialog-overlay]') ||
    document.querySelector('[data-state="open"][role="dialog"]')
  );
}

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const month      = getMonthYear();

  const { data: profile }     = useProfile();
  const { data: categories = [] } = useCategories();
  const { data: accounts   = [] } = useAccounts();
  const { data: income     = [] } = useIncome(month);
  const { data: expenses   = [] } = useExpenses(month);

  const [open,       setOpen]       = useState(false);
  const [stepIndex,  setStepIndex]  = useState(0);
  const [manualChecks, setManualChecks] = useState<Record<number, number[]>>({});

  const [expanded,       setExpanded]       = useState(true);
  const [pos,            setPos]            = useState<{ x: number; y: number } | null>(null);
  const [isDragging,     setIsDragging]     = useState(false);
  const [isMobile,       setIsMobile]       = useState(() => window.innerWidth < 640);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  const dragRef = useRef({ startX: 0, startY: 0, origX: 0, origY: 0 });

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  useEffect(() => {
    const handler = () => setPos(p => p ? clampPos(p) : p);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  useEffect(() => {
    if (pos !== null || isMobile) return;
    const saved = loadPos();
    setPos(saved ? clampPos(saved) : defaultPos());
  }, [pos, isMobile]);

  // Auto-close mobile sheet when a dialog opens
  useEffect(() => {
    if (!isMobile) return;
    const obs = new MutationObserver(() => {
      if (hasOpenDialog()) setMobileSheetOpen(false);
    });
    obs.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-state', 'role'],
    });
    return () => obs.disconnect();
  }, [isMobile]);

  useEffect(() => {
    if (!user?.id) return;
    try {
      const s = localStorage.getItem(getChecksKey(user.id));
      if (s) setManualChecks(JSON.parse(s));
    } catch {}
  }, [user?.id]);

  const saveManualChecks = useCallback((next: Record<number, number[]>) => {
    if (!user?.id) return;
    setManualChecks(next);
    localStorage.setItem(getChecksKey(user.id), JSON.stringify(next));
  }, [user?.id]);

  const autoChecks = useMemo((): Set<number> => {
    const s = new Set<number>();
    switch (stepIndex) {
      case 1:
        if ((profile?.monthly_salary ?? 0) > 0) s.add(0);
        if ((profile?.work_hours_per_day ?? 0) > 0 && (profile?.work_days_per_week ?? 0) > 0) s.add(1);
        break;
      case 2:
        if (categories.length > 0) s.add(0);
        if (categories.some(c => Number(c.monthly_budget) > 0)) s.add(1);
        break;
      case 3:
        if (accounts.length > 0) s.add(0);
        if (accounts.some(a => Number(a.initial_balance) > 0)) s.add(1);
        break;
      case 6:
        if (income.length > 0) s.add(0);
        if (income.some(i => !!i.account_id)) s.add(1);
        break;
      case 7:
        if (expenses.length > 0) s.add(0);
        if (expenses.some(e => !!e.category_id && !!e.account_id)) s.add(1);
        break;
    }
    return s;
  }, [stepIndex, profile, categories, accounts, income, expenses]);

  const effectiveChecks = useMemo(() => {
    const manual = manualChecks[stepIndex] ?? [];
    return Array.from(new Set([...manual, ...autoChecks]));
  }, [manualChecks, stepIndex, autoChecks]);

  const step       = tutorialSteps[stepIndex];
  const isWelcome  = stepIndex === 0;
  const isLast     = stepIndex === tutorialSteps.length - 1;
  const required   = (step.checklist ?? []).map((c, i) => ({ ...c, i })).filter(c => c.required);
  const canAdvance = required.length === 0 || required.every(r => effectiveChecks.includes(r.i));
  const progress   = (stepIndex / (tutorialSteps.length - 1)) * 100;
  const doneCount  = effectiveChecks.length;
  const totalCount = step.checklist?.length ?? 0;

  const markSeen    = useCallback(() => { if (user?.id) localStorage.setItem(getTutorialKey(user.id), 'seen'); }, [user?.id]);
  const closeTutorial = useCallback(() => { clearHighlight(); markSeen(); setOpen(false); setMobileSheetOpen(false); }, [markSeen]);

  const openTutorial = useCallback((force = false) => {
    if (!user?.id) return;
    if (!force && localStorage.getItem(getTutorialKey(user.id)) === 'seen') return;
    setStepIndex(0);
    setOpen(true);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    if (localStorage.getItem(getTutorialKey(user.id)) === 'seen') return;
    const t = setTimeout(() => { setStepIndex(0); setOpen(true); }, 700);
    return () => clearTimeout(t);
  }, [user?.id]);

  useEffect(() => {
    if (!open || stepIndex === 0) { clearHighlight(); return; }
    applyHighlight(tutorialSteps[stepIndex]?.highlightTarget);
    return () => clearHighlight();
  }, [open, stepIndex]);

  const toggleCheck = (idx: number) => {
    if (autoChecks.has(idx)) return;
    const cur  = manualChecks[stepIndex] ?? [];
    const next = cur.includes(idx) ? cur.filter(i => i !== idx) : [...cur, idx];
    saveManualChecks({ ...manualChecks, [stepIndex]: next });
  };

  const handleNext = useCallback(() => {
    if (isLast) { closeTutorial(); navigate('/'); return; }
    const next = stepIndex + 1;
    setStepIndex(next);
    const route = tutorialSteps[next]?.route;
    if (route) navigate(route);
    if (isMobile) setMobileSheetOpen(false);
  }, [closeTutorial, isLast, navigate, stepIndex, isMobile]);

  const handleBack = useCallback(() => {
    const prev = Math.max(0, stepIndex - 1);
    setStepIndex(prev);
    const route = tutorialSteps[prev]?.route;
    if (route) navigate(route); else navigate('/');
    if (isMobile) setMobileSheetOpen(false);
  }, [navigate, stepIndex, isMobile]);

  // ── Drag handlers (desktop only) ────────────────────────────────────────────
  const startDrag = useCallback((clientX: number, clientY: number) => {
    setIsDragging(true);
    dragRef.current = { startX: clientX, startY: clientY, origX: pos?.x ?? 0, origY: pos?.y ?? 0 };
  }, [pos]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isMobile) return;
    e.preventDefault();
    startDrag(e.clientX, e.clientY);
  }, [isMobile, startDrag]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isMobile) return;
    const t = e.touches[0];
    startDrag(t.clientX, t.clientY);
  }, [isMobile, startDrag]);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
      const newPos = clampPos({
        x: dragRef.current.origX + clientX - dragRef.current.startX,
        y: dragRef.current.origY + clientY - dragRef.current.startY,
      });
      setPos(newPos);
      savePos(newPos);
    };
    const onEnd = () => setIsDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchend', onEnd);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchend', onEnd);
    };
  }, [isDragging]);
  // ───────────────────────────────────────────────────────────────────────────

  const contextValue = useMemo<TutorialContextValue>(() => ({ openTutorial }), [openTutorial]);

  if (!open) return <TutorialContext.Provider value={contextValue}>{children}</TutorialContext.Provider>;

  // ── Welcome screen (full-screen modal) ─────────────────────────────────────
  if (isWelcome) {
    return (
      <TutorialContext.Provider value={contextValue}>
        {children}
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-3xl bg-card border border-border/60 shadow-2xl shadow-black/40 overflow-hidden animate-slide-up">
            <div className={`h-1.5 w-full bg-gradient-to-r ${step.color}`} />
            <button onClick={closeTutorial} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
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
                  Vamos te guiar em <strong className="text-foreground">7 passos rápidos</strong>. Cada passo destaca exatamente o botão que você precisa clicar — e o progresso é detectado automaticamente.
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
                  Começar agora <ArrowRight className="w-4 h-4" />
                </button>
                <button onClick={closeTutorial} className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
                  Pular — já sei configurar
                </button>
              </div>
            </div>
          </div>
        </div>
      </TutorialContext.Provider>
    );
  }

  // ── Checklist content (shared between mobile sheet and desktop widget) ──────
  const ChecklistContent = () => (
    <>
      {/* Progress bar */}
      <div className="flex items-center gap-3 px-4 pb-3">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${step.color} transition-all duration-500`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs font-semibold text-muted-foreground shrink-0 tabular-nums">
          {stepIndex}/{tutorialSteps.length - 1}
        </span>
      </div>

      {/* Description */}
      {step.description && (
        <div className="px-4 pb-3">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
        </div>
      )}

      {/* Checklist */}
      {step.checklist && (
        <div className="px-4 pb-3 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Progresso</p>
          {step.checklist.map((item, idx) => {
            const isAuto = autoChecks.has(idx);
            const isDone = effectiveChecks.includes(idx);
            return (
              <button
                key={idx}
                onClick={() => !isAuto && !isDone && toggleCheck(idx)}
                disabled={isDone && isAuto}
                className={`w-full flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-all ${
                  isDone
                    ? 'border-primary/30 bg-primary/8 cursor-default'
                    : 'border-border bg-muted/20 text-muted-foreground hover:border-primary/20 hover:bg-muted/40 active:scale-[0.98]'
                }`}
              >
                <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                  isDone ? 'border-primary bg-primary' : 'border-muted-foreground/30'
                }`}>
                  {isDone && <Check className="w-2.5 h-2.5 text-white" />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className={`block text-sm leading-snug ${isDone ? 'line-through opacity-50' : ''}`}>
                    {item.label}
                  </span>
                  {!isDone && item.required && (
                    <span className="mt-1 inline-flex items-center text-[10px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                      obrigatório
                    </span>
                  )}
                  {isDone && isAuto && (
                    <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-primary/70 bg-primary/10 px-1.5 py-0.5 rounded-full">
                      <Check className="w-2.5 h-2.5" /> detectado automaticamente
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Footer nav */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-border/50 bg-muted/10">
        <button onClick={closeTutorial} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          Pular tutorial
        </button>
        <div className="flex gap-2 items-center">
          <button
            onClick={handleBack}
            disabled={stepIndex <= 1}
            className="h-8 px-3 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-all disabled:opacity-30"
          >
            ←
          </button>
          <button
            onClick={handleNext}
            disabled={!canAdvance}
            className={`h-8 px-4 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-40 ${
              canAdvance
                ? `bg-gradient-to-r ${step.color} text-white hover:opacity-90 active:scale-[0.97]`
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            }`}
          >
            {isLast ? '🎉 Concluir' : 'Próximo'}{!isLast && <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </>
  );

  // ── MOBILE: FAB pill + bottom sheet ────────────────────────────────────────
  if (isMobile) {
    return (
      <TutorialContext.Provider value={contextValue}>
        {children}

        {/* Floating pill button */}
        <button
          onClick={() => !hasOpenDialog() && setMobileSheetOpen(v => !v)}
          style={{ zIndex: 290 }}
          className={`fixed bottom-20 right-4 flex items-center gap-2 rounded-full shadow-2xl shadow-black/30 border border-white/10 backdrop-blur-md transition-all active:scale-95 bg-gradient-to-r ${step.color} text-white px-4 py-2.5`}
        >
          <step.icon className="w-4 h-4 shrink-0" />
          <span className="text-xs font-bold leading-none">{step.badge}</span>
          {totalCount > 0 && (
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-white/20 text-[10px] font-extrabold shrink-0">
              {doneCount}/{totalCount}
            </span>
          )}
          <BookOpen className="w-3.5 h-3.5 shrink-0 opacity-80" />
        </button>

        {/* Bottom sheet */}
        {mobileSheetOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-[2px]"
              style={{ zIndex: 295 }}
              onClick={() => setMobileSheetOpen(false)}
            />

            {/* Sheet */}
            <div
              className="fixed inset-x-0 bottom-0 rounded-t-3xl bg-card border-t border-border/60 shadow-2xl shadow-black/50 overflow-hidden animate-slide-up"
              style={{ zIndex: 296 }}
            >
              {/* Gradient stripe */}
              <div className={`h-1 w-full bg-gradient-to-r ${step.color}`} />

              {/* Drag handle + header */}
              <div className="flex items-center justify-between px-4 pt-3 pb-2">
                {/* Pill handle (visual) */}
                <div className="absolute left-1/2 -translate-x-1/2 top-2 w-10 h-1 rounded-full bg-muted-foreground/20" />

                <div className="flex items-center gap-3 mt-2">
                  <div className={`w-9 h-9 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-md shrink-0`}>
                    <step.icon className="w-4.5 h-4.5 text-white" style={{ width: 18, height: 18 }} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{step.badge}</p>
                    <p className="font-bold text-sm leading-tight">{step.title}</p>
                  </div>
                </div>

                <button
                  onClick={() => setMobileSheetOpen(false)}
                  className="mt-2 w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>

              <ChecklistContent />
            </div>
          </>
        )}
      </TutorialContext.Provider>
    );
  }

  // ── DESKTOP: draggable floating widget ─────────────────────────────────────
  const widgetStyle = {
    position: 'fixed' as const,
    left: pos?.x ?? 0,
    top: pos?.y ?? 0,
    width: WIDGET_W,
    zIndex: 300,
  };

  return (
    <TutorialContext.Provider value={contextValue}>
      {children}
      <div style={widgetStyle}>
        <div
          className={`rounded-2xl border border-border/70 bg-card/95 backdrop-blur-md shadow-2xl shadow-black/40 overflow-hidden ${isDragging ? 'select-none' : ''}`}
        >
          <div className={`h-1 w-full bg-gradient-to-r ${step.color}`} />

          {/* Drag handle */}
          <div
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            className="flex items-center justify-center h-5 bg-muted/30 hover:bg-muted/60 transition-colors cursor-grab active:cursor-grabbing"
          >
            <GripHorizontal className="w-4 h-4 text-muted-foreground/50" />
          </div>

          {/* Header row */}
          <div className="flex items-center justify-between px-3 pt-2 pb-1 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${step.color} flex items-center justify-center shadow-sm shrink-0`}>
                <step.icon className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{step.badge}</p>
                <p className="font-bold text-xs leading-tight truncate">{step.title}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setExpanded(v => !v)}
                className="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={closeTutorial}
                className="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {expanded && (
            <>
              {/* Progress */}
              <div className="px-3 pb-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full bg-gradient-to-r ${step.color} transition-all duration-500`} style={{ width: `${progress}%` }} />
                  </div>
                  <span className="text-[10px] font-semibold text-muted-foreground shrink-0">{stepIndex}/{tutorialSteps.length - 1}</span>
                </div>
              </div>

              {/* Description */}
              <div className="px-3 pb-2">
                <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
              </div>

              {/* Checklist */}
              {step.checklist && (
                <div className="px-3 pb-2 space-y-1">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Progresso</p>
                  {step.checklist.map((item, idx) => {
                    const isAuto = autoChecks.has(idx);
                    const isDone = effectiveChecks.includes(idx);
                    return (
                      <button
                        key={idx}
                        onClick={() => !isAuto && !isDone && toggleCheck(idx)}
                        disabled={isDone && isAuto}
                        className={`w-full flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition-all ${
                          isDone
                            ? 'border-primary/30 bg-primary/8 cursor-default'
                            : 'border-border bg-muted/20 text-muted-foreground hover:border-primary/20 hover:bg-muted/40'
                        }`}
                      >
                        <span className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border transition-all ${
                          isDone ? 'border-primary bg-primary' : 'border-muted-foreground/30'
                        }`}>
                          {isDone && <Check className="w-2 h-2 text-white" />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className={`block leading-relaxed ${isDone ? 'line-through opacity-50' : ''}`}>
                            {item.label}
                          </span>
                          {!isDone && item.required && (
                            <span className="text-[8px] font-bold text-amber-500 bg-amber-500/10 px-1 py-0.5 rounded-full">obrig.</span>
                          )}
                          {isDone && isAuto && (
                            <span className="text-[8px] font-bold text-primary/70 bg-primary/10 px-1 py-0.5 rounded-full">✓ auto</span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between px-3 py-2 border-t border-border/50 bg-muted/10">
                <button onClick={closeTutorial} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                  Pular
                </button>
                <div className="flex gap-1.5 items-center">
                  <div className="hidden sm:flex gap-0.5 mr-1">
                    {tutorialSteps.slice(1).map((_, i) => (
                      <div
                        key={i}
                        className={`rounded-full transition-all ${
                          i + 1 === stepIndex ? 'w-3 h-1.5 bg-primary' :
                          effectiveChecks.length > 0 && i + 1 < stepIndex ? 'w-1.5 h-1.5 bg-primary/50' :
                          'w-1.5 h-1.5 bg-muted-foreground/20'
                        }`}
                      />
                    ))}
                  </div>
                  <button
                    onClick={handleBack}
                    disabled={stepIndex <= 1}
                    className="h-7 px-2.5 rounded-lg border border-border text-[11px] font-medium hover:bg-muted transition-all disabled:opacity-30"
                  >
                    ←
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={!canAdvance}
                    className={`h-7 px-3 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 disabled:opacity-40 ${
                      canAdvance
                        ? `bg-gradient-to-r ${step.color} text-white hover:opacity-90 active:scale-[0.97]`
                        : 'bg-muted text-muted-foreground cursor-not-allowed'
                    }`}
                  >
                    {isLast ? '🎉' : 'Próximo'}{!isLast && <ChevronRight className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error('useTutorial must be used within TutorialProvider');
  return ctx;
}
