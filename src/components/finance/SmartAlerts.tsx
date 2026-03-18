import { AlertTriangle, Clock, TrendingDown, CheckCircle, Bell } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import type { Category, Expense, Income } from '@/hooks/useFinanceData';

type Alert = {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  type: 'warning' | 'danger' | 'info' | 'success';
};

type Props = {
  expenses: Expense[];
  income: Income[];
  categories: Category[];
};

export default function SmartAlerts({ expenses, income, categories }: Props) {
  const alerts: Alert[] = [];

  // 1. Budget exceeded alerts
  categories.filter(c => !c.archived && Number(c.monthly_budget) > 0).forEach(cat => {
    const spent = expenses
      .filter(e => e.category_id === cat.id)
      .reduce((s, e) => s + Number(e.amount), 0);
    const budget = Number(cat.monthly_budget);
    const pct = (spent / budget) * 100;

    if (pct > 100) {
      alerts.push({
        id: `over-${cat.id}`,
        icon: <AlertTriangle className="w-4 h-4" />,
        title: `${cat.icon} ${cat.name} estourou o orçamento`,
        description: `Gasto ${formatCurrency(spent)} de ${formatCurrency(budget)} (${Math.round(pct)}%)`,
        type: 'danger',
      });
    } else if (pct >= 80) {
      alerts.push({
        id: `near-${cat.id}`,
        icon: <TrendingDown className="w-4 h-4" />,
        title: `${cat.icon} ${cat.name} quase no limite`,
        description: `${Math.round(pct)}% do orçamento utilizado. Restam ${formatCurrency(budget - spent)}`,
        type: 'warning',
      });
    }
  });

  // 2. Upcoming bills (scheduled or pending)
  const upcoming = expenses.filter(e => e.status !== 'concluido');
  if (upcoming.length > 0) {
    const totalPending = upcoming.reduce((s, e) => s + Number(e.amount), 0);
    alerts.push({
      id: 'pending-bills',
      icon: <Clock className="w-4 h-4" />,
      title: `${upcoming.length} despesa${upcoming.length > 1 ? 's' : ''} pendente${upcoming.length > 1 ? 's' : ''}`,
      description: `Total de ${formatCurrency(totalPending)} em contas a pagar/agendadas`,
      type: 'info',
    });
  }

  // 3. High spending day detection
  const daySpending: Record<string, number> = {};
  expenses.forEach(e => {
    daySpending[e.date] = (daySpending[e.date] || 0) + Number(e.amount);
  });
  const avgDaily = Object.values(daySpending).length > 0
    ? Object.values(daySpending).reduce((a, b) => a + b, 0) / Object.values(daySpending).length
    : 0;
  Object.entries(daySpending).forEach(([date, amount]) => {
    if (avgDaily > 0 && amount > avgDaily * 3) {
      alerts.push({
        id: `spike-${date}`,
        icon: <AlertTriangle className="w-4 h-4" />,
        title: 'Gasto atípico detectado',
        description: `${formatCurrency(amount)} em um único dia (${new Date(date + 'T00:00:00').toLocaleDateString('pt-BR')}) — ${Math.round(amount / avgDaily)}x a média diária`,
        type: 'warning',
      });
    }
  });

  // 4. Positive: savings achievement
  const totalIncome = income.filter(i => i.status === 'concluido').reduce((s, i) => s + Number(i.amount), 0);
  const totalExpenses = expenses.filter(e => e.status === 'concluido').reduce((s, e) => s + Number(e.amount), 0);
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;
  if (savingsRate >= 30) {
    alerts.push({
      id: 'savings-great',
      icon: <CheckCircle className="w-4 h-4" />,
      title: 'Ótima economia!',
      description: `Você está economizando ${savingsRate.toFixed(0)}% da sua renda este mês. Continue assim!`,
      type: 'success',
    });
  }

  if (alerts.length === 0) return null;

  const typeStyles = {
    danger: 'bg-expense/5 border-expense/20 text-expense',
    warning: 'bg-warning/5 border-warning/20 text-warning',
    info: 'bg-info/5 border-info/20 text-info',
    success: 'bg-income/5 border-income/20 text-income',
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <Bell className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Alertas Inteligentes</h3>
      </div>
      {alerts.slice(0, 5).map(alert => (
        <div
          key={alert.id}
          className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm transition-all ${typeStyles[alert.type]}`}
        >
          <div className="mt-0.5 shrink-0">{alert.icon}</div>
          <div>
            <p className="font-medium">{alert.title}</p>
            <p className="text-xs opacity-80 mt-0.5">{alert.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
