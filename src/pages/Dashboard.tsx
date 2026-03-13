import { useState } from 'react';
import { TrendingUp, TrendingDown, Wallet, PiggyBank } from 'lucide-react';
import { useIncome, useExpenses } from '@/hooks/useFinanceData';
import { getMonthYear, formatCurrency, formatDate, getStatusColor, getStatusLabel } from '@/lib/format';
import MonthSelector from '@/components/finance/MonthSelector';
import StatCard from '@/components/finance/StatCard';
import TransactionDialog from '@/components/finance/TransactionDialog';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useCategories } from '@/hooks/useFinanceData';

const CHART_COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'];

export default function Dashboard() {
  const [month, setMonth] = useState(getMonthYear());
  const { data: income = [] } = useIncome(month);
  const { data: expenses = [] } = useExpenses(month);
  const { data: categories = [] } = useCategories();

  const totalIncome = income.reduce((s, i) => s + Number(i.amount), 0);
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const balance = totalIncome - totalExpenses;
  const savings = totalIncome > 0 ? ((balance / totalIncome) * 100) : 0;

  // Category breakdown for pie chart
  const catBreakdown = categories
    .map(cat => ({
      name: cat.name,
      icon: cat.icon,
      value: expenses.filter(e => e.category_id === cat.id).reduce((s, e) => s + Number(e.amount), 0),
    }))
    .filter(c => c.value > 0)
    .sort((a, b) => b.value - a.value);

  // Recent transactions
  const recentTransactions = [
    ...income.map(i => ({ ...i, type: 'income' as const })),
    ...expenses.map(e => ({ ...e, type: 'expense' as const })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral das suas finanças</p>
        </div>
        <MonthSelector month={month} onChange={setMonth} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Receitas" value={totalIncome} icon={TrendingUp} trend="up" />
        <StatCard label="Despesas" value={totalExpenses} icon={TrendingDown} trend="down" />
        <StatCard label="Saldo" value={balance} icon={Wallet} trend={balance >= 0 ? 'up' : 'down'} />
        <StatCard label="Economia" value={savings} icon={PiggyBank} trend="neutral" />
      </div>

      {/* Quick actions */}
      <div className="flex gap-2">
        <TransactionDialog type="income" />
        <TransactionDialog type="expense" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Category chart */}
        <div className="stat-card">
          <h3 className="text-sm font-semibold mb-4">Despesas por Categoria</h3>
          {catBreakdown.length > 0 ? (
            <div className="flex items-center gap-4">
              <div className="w-40 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={catBreakdown} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={65} paddingAngle={3}>
                      {catBreakdown.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {catBreakdown.slice(0, 5).map((cat, i) => (
                  <div key={cat.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="text-muted-foreground">{cat.icon} {cat.name}</span>
                    </div>
                    <span className="currency font-medium">{formatCurrency(cat.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma despesa neste mês</p>
          )}
        </div>

        {/* Recent transactions */}
        <div className="stat-card">
          <h3 className="text-sm font-semibold mb-4">Últimas Transações</h3>
          {recentTransactions.length > 0 ? (
            <div className="space-y-2">
              {recentTransactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${t.type === 'income' ? 'bg-income' : 'bg-expense'}`} />
                    <div>
                      <p className="text-sm font-medium">{t.description || (t.type === 'income' ? 'Receita' : 'Despesa')}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(t.date)}</p>
                    </div>
                  </div>
                  <span className={`currency text-sm font-semibold ${t.type === 'income' ? 'text-income' : 'text-expense'}`}>
                    {t.type === 'income' ? '+' : '-'}{formatCurrency(Number(t.amount))}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma transação neste mês</p>
          )}
        </div>
      </div>
    </div>
  );
}
