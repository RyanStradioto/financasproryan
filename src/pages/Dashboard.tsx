import { useState } from 'react';
import { TrendingUp, TrendingDown, Wallet, PiggyBank, Pencil, BarChart3 } from 'lucide-react';
import { useIncome, useExpenses, type Income, type Expense } from '@/hooks/useFinanceData';
import { useNetWorth } from '@/hooks/useInvestments';
import { getMonthYear, formatCurrency, formatDate, getStatusColor, getStatusLabel } from '@/lib/format';
import MonthSelector from '@/components/finance/MonthSelector';
import StatCard from '@/components/finance/StatCard';
import TransactionDialog from '@/components/finance/TransactionDialog';
import EditTransactionDialog from '@/components/finance/EditTransactionDialog';
import TrendChart from '@/components/finance/TrendChart';
import CashFlowForecast from '@/components/finance/CashFlowForecast';
import SmartAlerts from '@/components/finance/SmartAlerts';
import Achievements from '@/components/finance/Achievements';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useCategories } from '@/hooks/useFinanceData';

const CHART_COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'];

export default function Dashboard() {
  const [month, setMonth] = useState(getMonthYear());
  const { data: income = [] } = useIncome(month);
  const { data: expenses = [] } = useExpenses(month);
  const { data: categories = [] } = useCategories();
  const { investmentTotal } = useNetWorth();

  const [editing, setEditing] = useState<((Income & { type: 'income' }) | (Expense & { type: 'expense' })) | null>(null);

  const totalIncome = income
    .filter(i => i.status === 'concluido')
    .reduce((s, i) => s + Number(i.amount), 0);
  const totalExpensesPaid = expenses
    .filter(e => e.status === 'concluido')
    .reduce((s, e) => s + Number(e.amount), 0);
  const balance = totalIncome - totalExpensesPaid;
  const savings = totalIncome > 0 ? ((balance / totalIncome) * 100) : 0;

  const pendingExpenses = expenses
    .filter(e => e.status !== 'concluido')
    .reduce((s, e) => s + Number(e.amount), 0);

  const catBreakdown = categories
    .map(cat => ({
      name: cat.name,
      icon: cat.icon,
      value: expenses.filter(e => e.category_id === cat.id).reduce((s, e) => s + Number(e.amount), 0),
    }))
    .filter(c => c.value > 0)
    .sort((a, b) => b.value - a.value);

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

      {/* Stat Cards — Cashflow */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Receitas" value={totalIncome} icon={TrendingUp} trend="up" />
        <StatCard label="Despesas (pagas)" value={totalExpensesPaid} icon={TrendingDown} trend="down" />
        <StatCard label="Saldo" value={balance} icon={Wallet} trend={balance >= 0 ? 'up' : 'down'} />
        <StatCard label="Economia" value={savings} icon={PiggyBank} trend={savings >= 0 ? 'up' : 'down'} suffix="%" />
      </div>

      {/* Patrimony Card */}
      <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Patrimônio em Investimentos</p>
            <p className="text-xl font-bold text-primary">{formatCurrency(investmentTotal)}</p>
          </div>
        </div>
        <a href="/investimentos" className="text-xs text-primary hover:underline">Ver detalhes →</a>
      </div>

      {pendingExpenses > 0 && (
        <div className="rounded-lg bg-warning/10 border border-warning/20 px-4 py-3 text-sm">
          <span className="font-medium text-warning">⏳ Pendente/Agendado:</span>{' '}
          <span className="currency font-semibold">{formatCurrency(pendingExpenses)}</span>{' '}
          <span className="text-muted-foreground">em despesas ainda não pagas</span>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex gap-2">
        <TransactionDialog type="income" />
        <TransactionDialog type="expense" />
      </div>

      {/* Smart Alerts */}
      <SmartAlerts expenses={expenses} income={income} categories={categories} />

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        <TrendChart />
        <CashFlowForecast />
      </div>

      {/* Category Breakdown + Achievements */}
      <div className="grid lg:grid-cols-2 gap-6">
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

        <Achievements expenses={expenses} income={income} categories={categories} />
      </div>

      {/* Recent Transactions */}
      <div className="stat-card">
        <h3 className="text-sm font-semibold mb-4">Últimas Transações</h3>
        {recentTransactions.length > 0 ? (
          <div className="space-y-2">
            {recentTransactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0 group">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${t.type === 'income' ? 'bg-income' : 'bg-expense'}`} />
                  <div>
                    <p className="text-sm font-medium">{t.description || (t.type === 'income' ? 'Receita' : 'Despesa')}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground">{formatDate(t.date)}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${getStatusColor(t.status)}`}>
                        {getStatusLabel(t.status)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`currency text-sm font-semibold ${t.type === 'income' ? 'text-income' : 'text-expense'}`}>
                    {t.type === 'income' ? '+' : '-'}{formatCurrency(Number(t.amount))}
                  </span>
                  <button
                    onClick={() => setEditing(t as Transaction)}
                    className="p-1 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma transação neste mês</p>
        )}
      </div>

      {editing && (
        <EditTransactionDialog
          open={!!editing}
          onOpenChange={(open) => !open && setEditing(null)}
          transaction={editing}
        />
      )}
    </div>
  );
}
