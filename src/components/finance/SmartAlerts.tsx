import { useState } from 'react';
import { AlertTriangle, Clock, TrendingDown, CheckCircle, Bell, ChevronDown, Flame } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import type { Category, Expense, Income } from '@/hooks/useFinanceData';
import { cn } from '@/lib/utils';

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
  const [open, setOpen] = useState(true);
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
        icon: <AlertTriangle className="w-4 h-4 animate-pulse" />,
        title: `${cat.name} estourou`,
        description: `Gasto ${formatCurrency(spent)} de ${formatCurrency(budget)} (${Math.round(pct)}%)`,
        type: 'danger',
      });
    } else if (pct >= 85) {
      alerts.push({
        id: `near-${cat.id}`,
        icon: <TrendingDown className="w-4 h-4" />,
        title: `${cat.name} no limite`,
        description: `${Math.round(pct)}% do orçamento. Restam ${formatCurrency(budget - spent)}`,
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
      title: `${upcoming.length} contas pendentes`,
      description: `Total de ${formatCurrency(totalPending)} a pagar ou agendadas`,
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
        icon: <Flame className="w-4 h-4 text-orange-500" />,
        title: 'Gasto atípico',
        description: `${formatCurrency(amount)} em ${new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', {day:'numeric', month:'short'})} (${Math.round(amount / avgDaily)}x a média)`,
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
      description: `Poupando ${savingsRate.toFixed(0)}% da renda este mês. Continue assim!`,
      type: 'success',
    });
  }

  if (alerts.length === 0) return null;

  const typeStyles = {
    danger: 'bg-gradient-to-r from-expense/10 to-transparent border-l-expense text-expense-foreground',
    warning: 'bg-gradient-to-r from-warning/10 to-transparent border-l-warning text-warning-foreground',
    info: 'bg-gradient-to-r from-info/10 to-transparent border-l-info text-info-foreground',
    success: 'bg-gradient-to-r from-income/10 to-transparent border-l-income text-income-foreground',
  };

  const iconColors = {
    danger: 'text-expense',
    warning: 'text-warning',
    info: 'text-info',
    success: 'text-income',
  };

  return (
    <div className="space-y-3 mb-6 animate-slide-up">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full group py-1"
      >
        <div className="relative flex h-3 w-3 mr-1">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-40"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
        </div>
        <h3 className="text-sm font-semibold tracking-tight">Alertas Inteligentes</h3>
        <span className="text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full ml-1">{alerts.length}</span>
        <ChevronDown className={cn('w-4 h-4 text-muted-foreground ml-auto transition-transform duration-200', open ? 'rotate-180' : '')} />
      </button>
      
      {open && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {alerts.slice(0, 6).map((alert, i) => (
            <div
              key={alert.id}
              className={cn(
                'flex items-start gap-3 rounded-xl border-y border-r border-l-[3px] p-3.5 text-sm transition-all shadow-sm',
                typeStyles[alert.type],
                'animate-fade-in'
              )}
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <div className={cn('mt-0.5 shrink-0', iconColors[alert.type])}>{alert.icon}</div>
              <div className="min-w-0">
                <p className="font-bold tracking-tight text-foreground truncate">{alert.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{alert.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
