import { Trophy, Flame, Target, Shield, Coins } from 'lucide-react';
import type { Expense, Income, Category } from '@/hooks/useFinanceData';

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
      description: 'Economize pelo menos 20% da renda',
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
      description: 'Mantenha todas as categorias dentro do orçamento',
      unlocked: budgetedCats > 0 && withinBudget === budgetedCats,
      progress: budgetedCats > 0 ? (withinBudget / budgetedCats) * 100 : 0,
    },
    {
      id: 'streak',
      icon: <Flame className="w-5 h-5" />,
      title: 'Streak de Controle',
      description: 'Registre pelo menos 10 transações no mês',
      unlocked: (income.length + expenses.length) >= 10,
      progress: Math.min(((income.length + expenses.length) / 10) * 100, 100),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Conquistas do Mês</h3>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {achievements.map(a => (
          <div
            key={a.id}
            className={`rounded-lg border p-3 transition-all ${
              a.unlocked
                ? 'bg-primary/5 border-primary/20'
                : 'bg-muted/30 border-border/50 opacity-60'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`${a.unlocked ? 'text-primary' : 'text-muted-foreground'}`}>
                {a.icon}
              </div>
              <span className="text-xs font-semibold truncate">{a.title}</span>
            </div>
            <p className="text-[10px] text-muted-foreground mb-2">{a.description}</p>
            <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${a.unlocked ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                style={{ width: `${a.progress || 0}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
