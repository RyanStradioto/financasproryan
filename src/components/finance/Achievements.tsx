import { Trophy, Flame, Target, Shield, Coins } from 'lucide-react';
import type { Expense, Income, Category } from '@/hooks/useFinanceData';
import { cn } from '@/lib/utils';

type Achievement = {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  unlocked: boolean;
  progress?: number;
};

type Props = {
  expenses: Expense[];
  income: Income[];
  categories: Category[];
};

export default function Achievements({ expenses, income, categories }: Props) {
  const totalIncome = income.filter(i => i.status === 'concluido').reduce((s, i) => s + Number(i.amount), 0);
  const totalExpenses = expenses.filter(e => e.status === 'concluido').reduce((s, e) => s + Number(e.amount), 0);
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

  const categorizedExpenses = expenses.filter(e => e.category_id);
  const catPct = expenses.length > 0 ? (categorizedExpenses.length / expenses.length) * 100 : 0;

  const withinBudget = categories.filter(c => {
    if (c.archived || Number(c.monthly_budget) <= 0) return false;
    const spent = expenses.filter(e => e.category_id === c.id).reduce((s, e) => s + Number(e.amount), 0);
    return spent <= Number(c.monthly_budget);
  }).length;
  const budgetedCats = categories.filter(c => !c.archived && Number(c.monthly_budget) > 0).length;

  const achievements: Achievement[] = [
    {
      id: 'saver',
      icon: <Coins className="w-5 h-5" />,
      title: 'Economizador',
      description: 'Poupe pelo menos 20% da renda',
      unlocked: savingsRate >= 20,
      progress: Math.min(savingsRate / 20 * 100, 100),
    },
    {
      id: 'organizer',
      icon: <Target className="w-5 h-5" />,
      title: 'Organizador',
      description: 'Categorize 90% das despesas',
      unlocked: catPct >= 90,
      progress: Math.min(catPct / 90 * 100, 100),
    },
    {
      id: 'disciplined',
      icon: <Shield className="w-5 h-5" />,
      title: 'Disciplinado',
      description: 'Mantenha todos orçamentos',
      unlocked: budgetedCats > 0 && withinBudget === budgetedCats,
      progress: budgetedCats > 0 ? (withinBudget / budgetedCats) * 100 : 0,
    },
    {
      id: 'streak',
      icon: <Flame className="w-5 h-5" />,
      title: 'Controle Ativo',
      description: 'Registre 10+ transações no mês',
      unlocked: (income.length + expenses.length) >= 10,
      progress: Math.min(((income.length + expenses.length) / 10) * 100, 100),
    },
  ];

  return (
    <div className="stat-card">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
          <Trophy className="w-4 h-4 text-primary" />
        </div>
        <h3 className="text-sm font-semibold">Conquistas do Mês</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {achievements.map((a, i) => (
          <div
            key={a.id}
            className={cn(
              "relative rounded-xl p-4 overflow-hidden transition-all duration-500",
              a.unlocked 
                ? "bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 hover:border-primary/40 group" 
                : "bg-muted/30 border border-border/50 opacity-60 grayscale"
            )}
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            {/* Glow effect for unlocked */}
            {a.unlocked && (
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            )}
            
            <div className="flex items-center gap-3 mb-3">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shadow-sm shrink-0",
                a.unlocked ? "bg-primary text-primary-foreground shadow-primary/30" : "bg-muted text-muted-foreground"
              )}>
                {a.icon}
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-sm font-bold truncate block">{a.title}</span>
                {a.unlocked && <span className="text-[9px] font-bold uppercase tracking-wider text-primary">Desbloqueado</span>}
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed min-h-[36px]">{a.description}</p>
            
            {!a.unlocked && (
              <div className="mt-auto">
                <div className="flex items-center justify-between text-[10px] font-medium text-muted-foreground mb-1.5">
                  <span>Progresso</span>
                  <span>{Math.round(a.progress || 0)}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-muted-foreground/30 transition-all duration-1000"
                    style={{ width: `${a.progress || 0}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
