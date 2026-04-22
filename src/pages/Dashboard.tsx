import { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Wallet, PiggyBank, Pencil, BarChart3, ArrowUpRight, ArrowDownRight, Target, Clock, Zap, ChevronRight } from 'lucide-react';
import { useIncome, useExpenses, useAccounts, type Income, type Expense } from '@/hooks/useFinanceData';
import { useNetWorth } from '@/hooks/useInvestments';
import { getMonthYear, formatCurrency, formatDate, getStatusColor, getStatusLabel } from '@/lib/format';
import MonthSelector from '@/components/finance/MonthSelector';
import TransactionDialog from '@/components/finance/TransactionDialog';
import EditTransactionDialog from '@/components/finance/EditTransactionDialog';
import TrendChart from '@/components/finance/TrendChart';
import CashFlowForecast from '@/components/finance/CashFlowForecast';
import SmartAlerts from '@/components/finance/SmartAlerts';
import Achievements from '@/components/finance/Achievements';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useCategories } from '@/hooks/useFinanceData';
import { useAccumulatedBalance } from '@/hooks/useAccumulatedBalance';
import { useWorkTimeCalc } from '@/hooks/useProfile';
import { formatWorkTime } from '@/lib/workTime';
import { cn } from '@/lib/utils';

const CHART_COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'];

// Mini stat card with colored left border accent
function KpiCard({ label, value, sub, color, icon: Icon, trend }: { label: string; value: string; sub?: string; color: string; icon: React.ElementType; trend?: 'up' | 'down' | 'neutral' }) {
  return (
    <div className={cn('stat-card flex items-center gap-2 sm:gap-3 p-3 sm:p-4 border-l-4 animate-slide-up', color)}>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-sm sm:text-xl font-extrabold currency tracking-tight leading-tight whitespace-nowrap overflow-hidden overflow-ellipsis">{value}</p>
        {sub && <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 leading-tight">{sub}</p>}
      </div>
      <div className={cn('hidden sm:flex w-10 h-10 rounded-xl items-center justify-center shrink-0',
        trend === 'up' ? 'bg-income/15' : trend === 'down' ? 'bg-expense/15' : 'bg-primary/15'
      )}>
        <Icon className={cn('w-5 h-5', trend === 'up' ? 'text-income' : trend === 'down' ? 'text-expense' : 'text-primary')} />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [month, setMonth] = useState(getMonthYear());
  const { data: income = [] } = useIncome(month);
  const { data: expenses = [] } = useExpenses(month);
  const { data: categories = [] } = useCategories();
  const { data: accounts = [] } = useAccounts();
  const { investmentTotal } = useNetWorth();
  const { data: accumulatedBalance = 0 } = useAccumulatedBalance(month);
  const { calcWorkTime, hourlyRate } = useWorkTimeCalc();

  const [editing, setEditing] = useState<((Income & { type: 'income' }) | (Expense & { type: 'expense' })) | null>(null);

  // ── Core numbers ─────────────────────────────────────────────
  const totalIncome = useMemo(() =>
    income.filter(i => i.status === 'concluido').reduce((s, i) => s + Number(i.amount), 0)
  , [income]);

  const totalExpensesPaid = useMemo(() =>
    expenses.filter(e => e.status === 'concluido').reduce((s, e) => s + Number(e.amount), 0)
  , [expenses]);

  const totalExpensesAll = useMemo(() =>
    expenses.reduce((s, e) => s + Number(e.amount), 0)
  , [expenses]);

  const pendingAmount = useMemo(() =>
    expenses.filter(e => e.status !== 'concluido').reduce((s, e) => s + Number(e.amount), 0)
  , [expenses]);

  const balance = accumulatedBalance;
  const savings = totalIncome > 0 ? ((totalIncome - totalExpensesPaid) / totalIncome) * 100 : 0;

  // ── Category breakdown ────────────────────────────────────────
  const catBreakdown = useMemo(() =>
    categories
      .map(cat => ({
        name: cat.name,
        icon: cat.icon,
        value: expenses.filter(e => e.category_id === cat.id).reduce((s, e) => s + Number(e.amount), 0),
        budget: Number(cat.monthly_budget) || 0,
      }))
      .filter(c => c.value > 0)
      .sort((a, b) => b.value - a.value)
  , [expenses, categories]);

  // ── Status breakdown bar data ────────────────────────────────
  const statusData = useMemo(() => [
    { name: 'Concluído', value: expenses.filter(e => e.status === 'concluido').reduce((s, e) => s + Number(e.amount), 0), fill: '#10b981' },
    { name: 'Pendente', value: expenses.filter(e => e.status === 'pendente').reduce((s, e) => s + Number(e.amount), 0), fill: '#f59e0b' },
    { name: 'Agendado', value: expenses.filter(e => e.status === 'agendado').reduce((s, e) => s + Number(e.amount), 0), fill: '#3b82f6' },
  ].filter(s => s.value > 0), [expenses]);

  // ── Account breakdown ────────────────────────────────────────
  const accountData = useMemo(() =>
    accounts
      .map(acc => ({
        name: `${acc.icon ?? ''} ${acc.name}`.trim(),
        expenses: expenses.filter(e => e.account_id === acc.id).reduce((s, e) => s + Number(e.amount), 0),
        income: income.filter(i => i.account_id === acc.id).reduce((s, i) => s + Number(i.amount), 0),
      }))
      .filter(a => a.expenses > 0 || a.income > 0)
  , [accounts, expenses, income]);

  // ── Recent transactions ──────────────────────────────────────
  const recentTransactions = useMemo(() => [
    ...income.map(i => ({ ...i, type: 'income' as const })),
    ...expenses.map(e => ({ ...e, type: 'expense' as const })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 6)
  , [income, expenses]);

  // ── Goals/budget progress ────────────────────────────────────
  const budgetsWithData = useMemo(() =>
    categories.filter(c => Number(c.monthly_budget) > 0).map(cat => {
      const spent = expenses.filter(e => e.category_id === cat.id).reduce((s, e) => s + Number(e.amount), 0);
      const budget = Number(cat.monthly_budget);
      return { ...cat, spent, budget, pct: Math.min((spent / budget) * 100, 100) };
    }).sort((a, b) => b.pct - a.pct)
  , [categories, expenses]);

  const workTimeTotal = hourlyRate > 0 ? calcWorkTime(totalExpensesPaid) : null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Visão geral das suas finanças</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <MonthSelector month={month} onChange={setMonth} />
          <div className="flex gap-2 ml-auto shrink-0">
            <TransactionDialog type="income">
              <button className="h-9 w-9 sm:w-auto sm:px-4 rounded-xl bg-income text-white font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-income/90 active:scale-[0.97] transition-all shadow-sm shadow-income/20">
                <ArrowUpRight className="w-4 h-4 shrink-0" /> <span className="hidden sm:inline">Receita</span>
              </button>
            </TransactionDialog>
            <TransactionDialog type="expense">
              <button className="h-9 w-9 sm:w-auto sm:px-4 rounded-xl bg-expense text-white font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-expense/90 active:scale-[0.97] transition-all shadow-sm shadow-expense/20">
                <ArrowDownRight className="w-4 h-4 shrink-0" /> <span className="hidden sm:inline">Despesa</span>
              </button>
            </TransactionDialog>
          </div>
        </div>
      </div>

      {/* ── Alertas ────────────────────────────────────────── */}
      <SmartAlerts expenses={expenses} income={income} categories={categories} />

      {/* ── KPI Cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Receitas" value={formatCurrency(totalIncome)} sub="concluídas" color="border-l-income" icon={TrendingUp} trend="up" />
        <KpiCard label="Despesas" value={formatCurrency(totalExpensesPaid)} sub="pagas" color="border-l-expense" icon={TrendingDown} trend="down" />
        <KpiCard label="Saldo" value={formatCurrency(balance)} sub={balance >= 0 ? 'positivo ✓' : 'negativo'} color={balance >= 0 ? 'border-l-primary' : 'border-l-expense'} icon={Wallet} trend={balance >= 0 ? 'up' : 'down'} />
        <KpiCard label="Economia" value={`${savings.toFixed(1)}%`} sub={savings >= 20 ? 'meta ✓' : 'meta: 20%'} color={savings >= 20 ? 'border-l-income' : 'border-l-warning'} icon={PiggyBank} trend={savings >= 20 ? 'up' : 'neutral'} />
      </div>

      {/* ── Secondary info row ─────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Patrimônio */}
        <div className="stat-card flex items-center gap-3 p-3 sm:p-4">
          <div className="hidden sm:flex w-10 h-10 rounded-xl bg-primary/10 items-center justify-center shrink-0">
            <BarChart3 className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Investimentos</p>
            <p className="text-base sm:text-lg font-extrabold text-primary currency leading-tight">{formatCurrency(investmentTotal)}</p>
          </div>
          <a href="/investimentos" className="shrink-0 text-muted-foreground hover:text-primary transition-colors">
            <ChevronRight className="w-4 h-4" />
          </a>
        </div>

        {/* Pendentes */}
        <div className={cn('stat-card flex items-center gap-3 p-3 sm:p-4', pendingAmount > 0 ? 'border-l-4 border-l-warning' : '')}>
          <div className="hidden sm:flex w-10 h-10 rounded-xl bg-warning/10 items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-warning" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Pendentes</p>
            <p className="text-base sm:text-lg font-extrabold text-warning currency leading-tight">{formatCurrency(pendingAmount)}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">{expenses.filter(e => e.status !== 'concluido').length} transações</p>
          </div>
        </div>

        {/* Horas trabalhadas (só se houver taxa configurada) */}
        {workTimeTotal != null ? (
          <div className="stat-card flex items-center gap-3 p-3 sm:p-4">
            <div className="hidden sm:flex w-10 h-10 rounded-xl bg-accent items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-accent-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Trabalho</p>
              <p className="text-base sm:text-lg font-extrabold leading-tight">{formatWorkTime(workTimeTotal)}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">p/ pagar despesas</p>
            </div>
          </div>
        ) : (
          <div className="stat-card flex items-center gap-3 p-3 sm:p-4">
            <div className="hidden sm:flex w-10 h-10 rounded-xl bg-primary/10 items-center justify-center shrink-0">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Lançado</p>
              <p className="text-base sm:text-lg font-extrabold currency leading-tight">{formatCurrency(totalExpensesAll)}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">{expenses.length} despesas</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Charts Row 1: Trend + Category Pie ─────────────── */}
      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <TrendChart />
        </div>

        {/* Category Donut */}
        <div className="lg:col-span-2 stat-card">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <div className="w-1.5 h-4 rounded-full bg-expense" />
            Por Categoria
          </h3>
          {catBreakdown.length > 0 ? (
            <div className="flex flex-col items-center gap-4">
              <div className="relative w-40 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={catBreakdown} dataKey="value" cx="50%" cy="50%" innerRadius={42} outerRadius={68} paddingAngle={2} strokeWidth={0} isAnimationActive={false}>
                      {catBreakdown.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-[10px] text-muted-foreground">Total</p>
                  <p className="text-xs font-bold currency">{formatCurrency(totalExpensesAll)}</p>
                </div>
              </div>
              <div className="w-full space-y-1.5">
                {catBreakdown.slice(0, 5).map((cat, i) => {
                  const pct = totalExpensesAll > 0 ? ((cat.value / totalExpensesAll) * 100) : 0;
                  return (
                    <div key={cat.name}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                          <span className="text-muted-foreground truncate max-w-[90px]">{cat.icon} {cat.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-muted-foreground">{pct.toFixed(0)}%</span>
                          <span className="font-semibold currency">{formatCurrency(cat.value)}</span>
                        </div>
                      </div>
                      <div className="h-1 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-10">
              <TrendingDown className="w-8 h-8 text-muted-foreground opacity-30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Sem categorias</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Charts Row 2: Status breakdown + Account breakdown ── */}
      <div className="grid sm:grid-cols-2 gap-6">
        {/* Status breakdown */}
        <div className="stat-card">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <div className="w-1.5 h-4 rounded-full bg-primary" />
            Despesas por Status
          </h3>
          {statusData.length > 0 ? (
            <>
              <div className="h-[140px] mb-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                      {statusData.map((s, i) => <Cell key={i} fill={s.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5">
                {statusData.map(s => (
                  <div key={s.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.fill }} />
                      <span className="text-muted-foreground">{s.name}</span>
                    </div>
                    <span className="font-semibold currency">{formatCurrency(s.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-sm text-muted-foreground">Sem despesas</div>
          )}
        </div>

        {/* Account breakdown */}
        {accountData.length > 0 ? (
          <div className="stat-card">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <div className="w-1.5 h-4 rounded-full bg-info" />
              Por Conta
            </h3>
            <div className="h-[140px] mb-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={accountData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Bar dataKey="income" name="income" fill="hsl(160,84%,39%)" radius={[4, 4, 0, 0]} opacity={0.85} isAnimationActive={false} />
                  <Bar dataKey="expenses" name="expenses" fill="hsl(0,72%,51%)" radius={[4, 4, 0, 0]} opacity={0.85} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
              <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded-sm bg-income opacity-85" /><span>Receitas</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded-sm bg-expense opacity-85" /><span>Despesas</span></div>
            </div>
          </div>
        ) : (
          <CashFlowForecast />
        )}
      </div>

      {/* ── Budget progress ─────────────────────────────────── */}
      {budgetsWithData.length > 0 && (
        <div className="stat-card">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <div className="w-1.5 h-4 rounded-full bg-warning" />
            Orçamentos do Mês
            <a href="/categorias" className="ml-auto text-xs text-primary hover:underline flex items-center gap-0.5">
              Gerenciar <ChevronRight className="w-3 h-3" />
            </a>
          </h3>
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
            {budgetsWithData.map(cat => {
              const over = cat.spent > cat.budget;
              const color = over ? '#ef4444' : cat.pct >= 80 ? '#f59e0b' : '#10b981';
              return (
                <div key={cat.id}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-medium">{cat.icon} {cat.name}</span>
                    <span className={cn('font-semibold tabular-nums', over ? 'text-expense' : cat.pct >= 80 ? 'text-warning' : 'text-income')}>
                      {formatCurrency(cat.spent)} / {formatCurrency(cat.budget)}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${cat.pct}%`, backgroundColor: color }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {over
                      ? `Estourou ${formatCurrency(cat.spent - cat.budget)}`
                      : `Restam ${formatCurrency(cat.budget - cat.spent)} (${(100 - cat.pct).toFixed(0)}%)`}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Trend Chart row ─────────────────────────────────── */}
      <CashFlowForecast />

      {/* ── Achievements ───────────────────────────────────── */}
      <Achievements expenses={expenses} income={income} categories={categories} />

      {/* ── Recent Transactions ────────────────────────────── */}
      <div className="stat-card animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <div className="w-1.5 h-4 rounded-full bg-primary" />
            Últimas Transações
          </h3>
          <div className="flex items-center gap-3">
            <a href="/despesas" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-0.5">
              Ver despesas <ChevronRight className="w-3 h-3" />
            </a>
            <a href="/receitas" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-0.5">
              Ver receitas <ChevronRight className="w-3 h-3" />
            </a>
          </div>
        </div>
        {recentTransactions.length > 0 ? (
          <div className="space-y-0.5">
            {recentTransactions.map((t) => {
              const wt = hourlyRate > 0 && t.type === 'expense' ? calcWorkTime(Number(t.amount)) : null;
              return (
                <div key={t.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-muted/50 transition-all group -mx-1">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                      t.type === 'income' ? 'bg-income/10' : 'bg-expense/10'
                    )}>
                      {t.type === 'income'
                        ? <ArrowUpRight className="w-4 h-4 text-income" />
                        : <ArrowDownRight className="w-4 h-4 text-expense" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t.description || (t.type === 'income' ? 'Receita' : 'Despesa')}</p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-xs text-muted-foreground">{formatDate(t.date)}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${getStatusColor(t.status)}`}>
                          {getStatusLabel(t.status)}
                        </span>
                        {wt && <span className="text-[10px] text-muted-foreground">· {formatWorkTime(wt)}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className={cn('currency text-sm font-bold tabular-nums', t.type === 'income' ? 'text-income' : 'text-expense')}>
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
              );
            })}
          </div>
        ) : (
          <div className="text-center py-10">
            <Wallet className="w-8 h-8 text-muted-foreground opacity-30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma transação neste mês</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Adicione receitas ou despesas para começar</p>
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
