import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Settings,
  Grid3X3,
  Landmark,
  CreditCard,
  BarChart3,
  TrendingUp,
  TrendingDown,
  LayoutDashboard,
  Brain,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

type TutorialStep = {
  title: string;
  description: string;
  icon: LucideIcon;
  badge: string;
  route?: string;
  actionLabel?: string;
  checklist?: string[];
};

type TutorialContextValue = {
  openTutorial: (force?: boolean) => void;
};

const TUTORIAL_VERSION = 'v2';
const TutorialContext = createContext<TutorialContextValue | null>(null);

const tutorialSteps: TutorialStep[] = [
  {
    title: 'Vamos configurar seu app do jeito certo',
    description:
      'Esse onboarding agora segue a ordem ideal de preenchimento para o usuario aprender e ja sair com a base pronta.',
    icon: Sparkles,
    badge: 'Onboarding',
    checklist: [
      'Voce pode pular ou concluir quando quiser.',
      'O tutorial abre uma unica vez por usuario.',
      'Em Configuracoes existe um botao para rever depois.',
    ],
  },
  {
    title: '1. Configuracoes e dados profissionais',
    description:
      'Comece por aqui. Essa etapa define salario, horas de trabalho, dias por semana e preferencias que o app usa nos calculos e relatorios.',
    icon: Settings,
    badge: 'Primeiro passo',
    route: '/configuracoes',
    actionLabel: 'Abrir Configuracoes',
    checklist: [
      'Preencha salario mensal.',
      'Preencha horas por dia e dias por semana.',
      'Ajuste emails semanais e mensais se quiser.',
      'Salve antes de seguir.',
    ],
  },
  {
    title: '2. Categorias',
    description:
      'Depois organize os tipos de gasto que voce usa no dia a dia. Isso faz seus graficos, relatorios e alertas funcionarem melhor.',
    icon: Grid3X3,
    badge: 'Organizacao',
    route: '/categorias',
    actionLabel: 'Abrir Categorias',
    checklist: [
      'Crie categorias principais como Casa, Alimentacao, Transporte e Lazer.',
      'Defina orcamento mensal quando fizer sentido.',
      'Pense nas categorias que voce realmente usa para nao poluir o app.',
    ],
  },
  {
    title: '3. Contas',
    description:
      'Cadastre onde seu dinheiro fica: banco, carteira, conta digital, beneficios ou saldo inicial. Isso ajuda a separar melhor receitas e despesas.',
    icon: Landmark,
    badge: 'Base financeira',
    route: '/contas',
    actionLabel: 'Abrir Contas',
    checklist: [
      'Cadastre Nubank, carteira, bancos e outras contas que voce usa.',
      'Se tiver saldo inicial, informe aqui.',
      'Depois disso os lancamentos vao ter para onde entrar ou sair.',
    ],
  },
  {
    title: '4. Cartoes',
    description:
      'Se voce usa cartao de credito, essa e a hora de cadastrar. Isso ajuda a controlar faturas e separar gastos que nao saem da conta no mesmo dia.',
    icon: CreditCard,
    badge: 'Credito',
    route: '/cartoes',
    actionLabel: 'Abrir Cartoes',
    checklist: [
      'Cadastre nome do cartao, limite, fechamento e vencimento.',
      'Use essa aba para compras parceladas e controle de fatura.',
    ],
  },
  {
    title: '5. Investimentos e caixinhas',
    description:
      'Agora monte suas caixinhas e investimentos. Aqui ficam aportes, resgates e patrimonio, sem misturar com gastos do dia a dia.',
    icon: BarChart3,
    badge: 'Patrimonio',
    route: '/investimentos',
    actionLabel: 'Abrir Investimentos',
    checklist: [
      'Cadastre cada caixinha ou investimento separadamente.',
      'Se fizer aporte por despesa, selecione a caixinha ao lancar.',
      'Acompanhe o saldo patrimonial aqui.',
    ],
  },
  {
    title: '6. Receitas',
    description:
      'Com a base pronta, comeca a alimentar o app com entradas de dinheiro. Isso deixa saldo, economia e relatorios coerentes.',
    icon: TrendingUp,
    badge: 'Entradas',
    route: '/receitas',
    actionLabel: 'Abrir Receitas',
    checklist: [
      'Cadastre salario, renda extra, reembolsos ou qualquer entrada.',
      'Escolha a conta que recebeu o dinheiro.',
      'Use observacoes e comprovantes quando precisar.',
    ],
  },
  {
    title: '7. Despesas',
    description:
      'Depois registre seus gastos. Aqui voce categoriza, escolhe a conta, define status e faz parcelamentos quando for necessario.',
    icon: TrendingDown,
    badge: 'Saidas',
    route: '/despesas',
    actionLabel: 'Abrir Despesas',
    checklist: [
      'Escolha categoria e conta corretamente.',
      'Se for aporte de investimento, vincule a caixinha.',
      'Use parcelas e comprovantes quando fizer sentido.',
    ],
  },
  {
    title: '8. Dashboard e Insights',
    description:
      'Depois de preencher o basico, o Dashboard e os Insights vao comecar a fazer sentido e te mostrar leitura real do seu comportamento financeiro.',
    icon: LayoutDashboard,
    badge: 'Leitura final',
    route: '/',
    actionLabel: 'Ir para Dashboard',
    checklist: [
      'Veja receitas, despesas, saldo e graficos.',
      'Confira alertas e categorias mais pesadas.',
      'Abra a aba de Insights IA quando quiser analise adicional.',
    ],
  },
];

const getTutorialKey = (userId: string) => `financaspro:tutorial:${TUTORIAL_VERSION}:${userId}`;

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const markSeen = useCallback(() => {
    if (!user?.id) return;
    localStorage.setItem(getTutorialKey(user.id), 'seen');
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
  const isOnStepRoute = !!step.route && location.pathname === step.route;

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
        <DialogContent className="sm:max-w-2xl">
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

          <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-4">
            {step.route && (
              <div className="flex flex-col gap-2 rounded-xl border border-primary/15 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">Etapa pratica</p>
                  <p className="text-xs text-muted-foreground">
                    {isOnStepRoute ? 'Voce ja esta na tela certa.' : `A proxima tela desta etapa e ${step.route}.`}
                  </p>
                </div>
                <Button
                  type="button"
                  variant={isOnStepRoute ? 'outline' : 'default'}
                  onClick={() => step.route && navigate(step.route)}
                  className="gap-2"
                >
                  <ArrowRight className="w-4 h-4" />
                  {step.actionLabel || 'Abrir etapa'}
                </Button>
              </div>
            )}

            {step.checklist && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">O que fazer agora</p>
                <div className="grid gap-2">
                  {step.checklist.map((item) => (
                    <div key={item} className="flex items-start gap-2 rounded-xl bg-background/80 px-3 py-2 text-sm">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
