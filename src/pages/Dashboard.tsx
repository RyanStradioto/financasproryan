import { useState } from 'react';
import { TrendingUp, TrendingDown, Wallet, PiggyBank, Pencil, BarChart3, ArrowUpRight, ArrowDownRight } from 'lucide-react';
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
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useCategories } from '@/hooks/useFinanceData';
import { useAccumulatedBalance } from '@/hooks/useAccumulatedBalance';

const CHART_COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'];

export default function Dashboard() {
  const [month, setMonth] = useState(getMonthYear());
  const { data: income = [] } = useIncome(month);
  const { data: expenses = [] } = useExpenses(month);
  const { data: categories = [] } = useCategories();
  const { investmentTotal } = useNetWorth();
  const { data: accumulatedBalance = 0 } = useAccumulatedBalance(month);

  const [editing, setEditing] = useState<((Income & { type: 'income' }) | (Expense & { type: 'expense' })) | null>(null);

  const totalIncome = income
    .filter(i => i.status === 'concluido')
    .reduce((s, i) => s + Number(i.amount), 0);
  const totalExpensesPaid = expenses
    .filter(e => e.status === 'concluido')
    .reduce((s, e) => s + Number(e.amount), 0);
  const balance = accumulatedBalance;
  const savings = totalIncome > 0 ? (((totalIncome - totalExpensesPaid) / totalIncome) * 100) : 0;

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
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral das suas finanças</p>
        </div>
        <div className="flex items-center gap-2">
          <MonthSelector month={month} onChange={setMonth} />
        </div>
      </div>

      {/* Stat Cards — Cashflow */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Receitas" value={totalIncome} icon={TrendingUp} trend="up" className="stagger-1" />
        <StatCard label="Despesas" value={totalExpensesPaid} icon={TrendingDown} trend="down" className="stagger-2" />
        <StatCard label="Saldo" value={balance} icon={Wallet} trend={balance >= 0 ? 'up' : 'down'} className="stagger-3" />
        <StatCard label="Economia" value={savings} icon={PiggyBank} trend={savings >= 0 ? 'up' : 'down'} suffix="%" className="stagger-4" />
      </div>

      {/* Patrimony Card */}
      <div className="rounded-2xl bg-gradient-to-r from-primary/8 via-primary/5 to-transparent border border-primary/15 p-5 flex items-center justify-between animate-slide-up shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shadow-sm shadow-primary/10">
            <BarChart3 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Patrimônio em Investimentos</p>
            <p className="text-2xl font-extrabold text-primary currency">{formatCurrency(investmentTotal)}</p>
          </div>
        </div>
        <a href="/investimentos" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 transition-colors">
          Ver detalhes <ArrowUpRight className="w-3 h-3" />
        </a>
      </div>

      {pendingExpenses > 0 && (
        <div className="rounded-2xl bg-gradient-to-r from-warning/8 to-warning/3 border border-warning/15 px-5 py-4 text-sm flex items-center gap-3 animate-slide-up shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-warning/15 flex items-center justify-center shrink-0">
            <ArrowDownRight className="w-4 h-4 text-warning" />
          </div>
          <div>
            <span className="font-semibold text-warning">Pendente/Agendado</span>
            <span className="mx-2 text-muted-foreground">—</span>
            <span className="currency font-bold">{formatCurrency(pendingExpenses)}</span>
            <span className="text-muted-foreground ml-1">em despesas ainda não pagas</span>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
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
        <div className="stat-card animate-slide-up">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <div className="w-1.5 h-4 rounded-full bg-primary" />
            Despesas por Categoria
          </h3>
          {catBreakdown.length > 0 ? (
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="w-44 h-44 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={catBreakdown} dataKey="value" cx="50%" cy="50%" innerRadius={38} outerRadius={68} paddingAngle={3} strokeWidth={0}>
                      {catBreakdown.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '0.75rem',
                        fontSize: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 w-full space-y-2.5">
                {catBreakdown.slice(0, 6).map((cat, i) => {
                  const pct = totalExpensesPaid > 0 ? ((cat.value / totalExpensesPaid) * 100).toFixed(0) : '0';
                  return (
                    <div key={cat.name} className="flex items-center justify-between text-sm group">
                      <div className="flex items-center gap-2.5">
                        <div className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="text-muted-foreground group-hover:text-foreground transition-colors truncate">{cat.icon} {cat.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">{pct}%</span>
                        <span className="currency font-semibold">{formatCurrency(cat.value)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-10">
              <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                <TrendingDown className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Nenhuma despesa neste mês</p>
            </div>
          )}
        </div>

        <Achievements expenses={expenses} income={income} categories={categories} />
      </div>

      {/* Recent Transactions */}
      <div className="stat-card animate-slide-up">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <div className="w-1.5 h-4 rounded-full bg-primary" />
          Últimas Transações
        </h3>
        {recentTransactions.length > 0 ? (
          <div className="space-y-1">
            {recentTransactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-muted/50 transition-all group -mx-1">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    t.type === 'income' ? 'bg-income/10' : 'bg-expense/10'
                  }`}>
                    {t.type === 'income' ? (
                      <ArrowUpRight className="w-4 h-4 text-income" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4 text-expense" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t.description || (t.type === 'income' ? 'Receita' : 'Despesa')}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground">{formatDate(t.date)}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${getStatusColor(t.status)}`}>
                        {getStatusLabel(t.status)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`currency text-sm font-bold ${t.type === 'income' ? 'text-income' : 'text-expense'}`}>
                    {t.type === 'income' ? '+' : '-'}{formatCurrency(Number(t.amount))}
                  </span>
                  <button
                    onClick={() => setEditing(t as any)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10">
            <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
              <Wallet className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Nenhuma transação neste mês</p>
            <p className="text-xs text-muted-foreground mt-1">Adicione receitas ou despesas para começar</p>
          </div>
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
