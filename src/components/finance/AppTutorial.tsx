import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  BarChart3,
  CreditCard,
  Grid3X3,
  Landmark,
  CalendarDays,
  FileText,
  Brain,
  Trash2,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

type TutorialStep = {
  title: string;
  description: string;
  icon: LucideIcon;
  badge: string;
};

type TutorialContextValue = {
  openTutorial: (force?: boolean) => void;
};

const TUTORIAL_VERSION = 'v1';
const TutorialContext = createContext<TutorialContextValue | null>(null);

const tutorialSteps: TutorialStep[] = [
  {
    title: 'Bem-vindo ao FinancasPro',
    description:
      'Aqui voce acompanha entradas, saidas, investimentos, relatorios e organizacao financeira em um so lugar. Este passo a passo aparece uma unica vez por usuario.',
    icon: Sparkles,
    badge: 'Comeco rapido',
  },
  {
    title: 'Dashboard',
    description:
      'A tela inicial mostra sua visao geral do mes: receitas, despesas, saldo, graficos, alertas e atalhos para lancar novas movimentacoes.',
    icon: LayoutDashboard,
    badge: 'Visao geral',
  },
  {
    title: 'Receitas',
    description:
      'Na aba de receitas voce cadastra tudo o que entrou, define status, data, conta de destino e ainda pode anexar comprovantes.',
    icon: TrendingUp,
    badge: 'Entradas',
  },
  {
    title: 'Despesas',
    description:
      'Aqui ficam seus gastos. Voce pode categorizar, parcelar, escolher a conta e, quando for aporte, vincular a despesa a uma caixinha de investimento.',
    icon: TrendingDown,
    badge: 'Saidas',
  },
  {
    title: 'Investimentos e Caixinhas',
    description:
      'Nesta area voce acompanha caixinhas e outros ativos, registra aportes e resgates e ve o patrimonio separado dos gastos do dia a dia.',
    icon: BarChart3,
    badge: 'Patrimonio',
  },
  {
    title: 'Cartoes',
    description:
      'A aba de cartoes ajuda a controlar compras no credito, visualizar faturas e acompanhar lancamentos ligados ao cartao.',
    icon: CreditCard,
    badge: 'Credito',
  },
  {
    title: 'Categorias e Contas',
    description:
      'Categorias organizam seus tipos de gasto. Contas separam onde o dinheiro esta, como Nubank, carteira, bancos e beneficios.',
    icon: Grid3X3,
    badge: 'Organizacao',
  },
  {
    title: 'Calendario e Relatorio',
    description:
      'No calendario voce enxerga seus lancamentos por data. Nos relatorios, acompanha consolidacoes e exportacoes para entender melhor seu historico.',
    icon: CalendarDays,
    badge: 'Analise',
  },
  {
    title: 'Insights IA',
    description:
      'Os insights mostram recomendacoes e leituras do seu comportamento financeiro. O diagnostico automatico e a consultoria IA ficam ali.',
    icon: Brain,
    badge: 'Inteligencia',
  },
  {
    title: 'Lixeira e Configuracoes',
    description:
      'A lixeira guarda itens excluidos por 30 dias. Em Configuracoes voce ajusta perfil, emails, limpeza de dados e tambem pode rever este tutorial.',
    icon: Settings,
    badge: 'Controle final',
  },
];

const getTutorialKey = (userId: string) => `financaspro:tutorial:${TUTORIAL_VERSION}:${userId}`;

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const markSeen = useCallback(() => {
    if (!user?.id) return;
    localStorage.setItem(getTutorialKey(user.id), 'seen');
  }, [user?.id]);

  const openTutorial = useCallback((force = false) => {
    if (!user?.id) return;
    if (!force) {
      const seen = localStorage.getItem(getTutorialKey(user.id));
      if (seen === 'seen') return;
    }
    setStepIndex(0);
    setOpen(true);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const seen = localStorage.getItem(getTutorialKey(user.id));
    if (seen === 'seen') return;

    const timeout = window.setTimeout(() => {
      setStepIndex(0);
      setOpen(true);
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [user?.id]);

  const closeTutorial = useCallback(() => {
    markSeen();
    setOpen(false);
  }, [markSeen]);

  const handleNext = useCallback(() => {
    if (stepIndex >= tutorialSteps.length - 1) {
      closeTutorial();
      return;
    }
    setStepIndex((current) => current + 1);
  }, [closeTutorial, stepIndex]);

  const handleBack = useCallback(() => {
    setStepIndex((current) => Math.max(0, current - 1));
  }, []);

  const step = tutorialSteps[stepIndex];
  const progress = ((stepIndex + 1) / tutorialSteps.length) * 100;

  const contextValue = useMemo<TutorialContextValue>(() => ({
    openTutorial,
  }), [openTutorial]);

  return (
    <TutorialContext.Provider value={contextValue}>
      {children}

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            closeTutorial();
          } else {
            setOpen(true);
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <step.icon className="w-3.5 h-3.5" />
                {step.badge}
              </div>
              <span className="text-xs text-muted-foreground">
                {stepIndex + 1} de {tutorialSteps.length}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <DialogTitle className="text-xl leading-tight">{step.title}</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
              {step.description}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-2xl border border-border bg-muted/25 p-4">
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-3">
              {tutorialSteps.slice(1).map((item, index) => {
                const absoluteIndex = index + 1;
                return (
                  <div
                    key={item.title}
                    className={`rounded-xl px-3 py-2 transition-colors ${
                      absoluteIndex === stepIndex ? 'bg-primary/10 text-primary font-semibold' : 'bg-background/70'
                    }`}
                  >
                    {item.title}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="ghost" onClick={closeTutorial}>
              Pular tutorial
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleBack} disabled={stepIndex === 0}>
                <ChevronLeft className="w-4 h-4" />
                Voltar
              </Button>
              <Button onClick={handleNext}>
                {stepIndex === tutorialSteps.length - 1 ? 'Concluir' : 'Proximo'}
                {stepIndex < tutorialSteps.length - 1 && <ChevronRight className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error('useTutorial must be used within TutorialProvider');
  }
  return context;
}
