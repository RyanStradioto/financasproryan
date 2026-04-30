import { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Wallet, PiggyBank, Pencil, BarChart3, ArrowUpRight, ArrowDownRight, Target, Clock, Zap, ChevronRight, BellRing, Sparkles } from 'lucide-react';
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
import SparklineChart from '@/components/finance/SparklineChart';
import EconomyGauge from '@/components/finance/EconomyGauge';
import BudgetRings from '@/components/finance/BudgetRings';
import WeeklyHeatmap from '@/components/finance/WeeklyHeatmap';
import { useCategories } from '@/hooks/useFinanceData';
import { useAccumulatedBalance } from '@/hooks/useAccumulatedBalance';
import { useWorkTimeCalc, useProfile } from '@/hooks/useProfile';
import { formatWorkTime } from '@/lib/workTime';
import { cn } from '@/lib/utils';
import { useSensitiveData } from '@/components/finance/SensitiveData';

// Mini stat card with colored left border accent
function KpiCard({ label, value, sub, color, icon: Icon, trend, sparklineData }: { label: string; value: string; sub?: string; color: string; icon: React.ElementType; trend?: 'up' | 'down' | 'neutral', sparklineData?: number[] }) {
  const { maskCurrency, maskText } = useSensitiveData();
  const displayValue = value.startsWith('R$') ? maskCurrency(value) : maskText(value);
  
  return (
    <div className={cn('stat-card flex flex-col justify-between gap-3 p-4 sm:p-5 border-l-[3px] animate-slide-up group overflow-hidden relative', color)}>
      <div className="absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 rounded-full bg-gradient-to-br from-current to-transparent opacity-[0.03] group-hover:scale-150 transition-transform duration-700 pointer-events-none" style={{ color: 'inherit' }} />
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn('w-8 h-8 rounded-lg items-center justify-center flex shrink-0',
            trend === 'up' ? 'bg-income/10 text-income' : trend === 'down' ? 'bg-expense/10 text-expense' : 'bg-primary/10 text-primary'
          )}>
            <Icon className="w-4 h-4" />
          </div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
        </div>
      </div>

      <div className="flex items-end justify-between mt-1">
        <div className="min-w-0">
          <p className="text-xl sm:text-2xl font-extrabold currency tracking-tight leading-none whitespace-nowrap overflow-hidden overflow-ellipsis group-hover:-translate-y-0.5 transition-transform duration-300">{displayValue}</p>
          {sub && <p className="text-[10px] sm:text-xs text-muted-foreground mt-1.5 leading-tight">{sub}</p>}
        </div>
        {sparklineData && sparklineData.length > 1 && (
          <div className="hidden sm:block shrink-0 -mr-2">
            <SparklineChart 
              data={sparklineData} 
              color={trend === 'up' ? 'hsl(160, 84%, 39%)' : trend === 'down' ? 'hsl(0, 72%, 51%)' : 'hsl(217, 91%, 60%)'} 
              width={60} 
              height={28} 
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { maskCurrency } = useSensitiveData();
  const [month, setMonth] = useState(getMonthYear());
  const { profile } = useProfile();
  
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

  // ── Sparkline data (Last 30 days of the selected month) ─────
  const getDailyTrend = (data: any[], dateField = 'date') => {
    // Basic grouping for the visual sparkline
    const sorted = [...data].sort((a, b) => new Date(a[dateField]).getTime() - new Date(b[dateField]).getTime());
    const daily: Record<string, number> = {};
    sorted.forEach(item => { daily[item[dateField]] = (daily[item[dateField]] || 0) + Number(item.amount); });
    const vals = Object.values(daily);
    // Pad to look like a chart if very few days
    if (vals.length === 1) return [0, vals[0]];
    if (vals.length === 0) return [0, 0, 0];
    return vals;
  };

  const incomeSparkline = useMemo(() => getDailyTrend(income.filter(i => i.status === 'concluido')), [income]);
  const expenseSparkline = useMemo(() => getDailyTrend(expenses.filter(e => e.status === 'concluido')), [expenses]);
  
  // Balance sparkline (running total)
  const balanceSparkline = useMemo(() => {
    const all = [...income.map(i => ({...i, amount: Number(i.amount)})), ...expenses.map(e => ({...e, amount: -Number(e.amount)}))]
      .filter(t => t.status === 'concluido')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    let run = 0;
    const vals = all.map(t => { run += t.amount; return run; });
    if (vals.length === 0) return [0, 0];
    if (vals.length === 1) return [0, vals[0]];
    return vals;
  }, [income, expenses]);

  // ── Budget progress for Rings ────────────────────────────────
  const budgetsWithData = useMemo(() =>
    categories.filter(c => Number(c.monthly_budget) > 0).map(cat => {
      const spent = expenses.filter(e => e.category_id === cat.id).reduce((s, e) => s + Number(e.amount), 0);
      const budget = Number(cat.monthly_budget);
      return { ...cat, spent, budget };
    }).sort((a, b) => b.budget - a.budget)
  , [categories, expenses]);

  // ── Recent transactions ──────────────────────────────────────
  const recentTransactions = useMemo(() => [
    ...income.map(i => ({ ...i, type: 'income' as const })),
    ...expenses.map(e => ({ ...e, type: 'expense' as const })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5)
  , [income, expenses]);

  const workTimeTotal = hourlyRate > 0 ? calcWorkTime(totalExpensesPaid) : null;
  
  // Greeting based on time
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  }, []);

  const currentMonthDate = useMemo(() => {
    const [year, m] = month.split('-');
    return new Date(parseInt(year), parseInt(m) - 1, 1);
  }, [month]);

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in pb-10">
      {/* ── Premium Header ───────────────────────────────────── */}
      <div className="hero-card flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 opacity-80">
            <Sparkles className="w-4 h-4 text-primary animate-pulse" />
            <p className="text-sm font-medium">{greeting}, {profile?.first_name || 'Ryan'}!</p>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-foreground to-foreground/70">
            Seu Panorama
          </h1>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-0">
          <MonthSelector month={month} onChange={setMonth} />
          <div className="flex gap-2">
            <TransactionDialog type="income">
              <button className="h-10 px-4 rounded-xl bg-income text-income-foreground font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-income/90 hover:shadow-lg hover:shadow-income/20 active:scale-[0.97] transition-all">
                <ArrowUpRight className="w-4 h-4 shrink-0" /> <span className="hidden sm:inline">Receita</span>
              </button>
            </TransactionDialog>
            <TransactionDialog type="expense">
              <button className="h-10 px-4 rounded-xl bg-expense text-expense-foreground font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-expense/90 hover:shadow-lg hover:shadow-expense/20 active:scale-[0.97] transition-all">
                <ArrowDownRight className="w-4 h-4 shrink-0" /> <span className="hidden sm:inline">Despesa</span>
              </button>
            </TransactionDialog>
          </div>
        </div>
      </div>

      {/* ── Alertas ────────────────────────────────────────── */}
      <SmartAlerts expenses={expenses} income={income} categories={categories} />

      {/* ── KPI Cards Premium ──────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 stagger-1">
        <KpiCard 
          label="Receitas" 
          value={formatCurrency(totalIncome)} 
          sub="concluídas neste mês" 
          color="border-l-income" 
          icon={TrendingUp} 
          trend="up" 
          sparklineData={incomeSparkline}
        />
        <KpiCard 
          label="Despesas" 
          value={formatCurrency(totalExpensesPaid)} 
          sub="pagas neste mês" 
          color="border-l-expense" 
          icon={TrendingDown} 
          trend="down" 
          sparklineData={expenseSparkline}
        />
        <KpiCard 
          label="Saldo Acumulado" 
          value={formatCurrency(balance)} 
          sub="disponível em contas" 
          color={balance >= 0 ? 'border-l-primary' : 'border-l-expense'} 
          icon={Wallet} 
          trend={balance >= 0 ? 'up' : 'down'} 
          sparklineData={balanceSparkline}
        />
        
        {/* Patrimônio / Net Worth */}
        <div className="stat-card flex flex-col justify-between gap-3 p-4 sm:p-5 border-l-[3px] border-l-info animate-slide-up group overflow-hidden relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg items-center justify-center flex shrink-0 bg-info/10 text-info">
                <BarChart3 className="w-4 h-4" />
              </div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Investimentos</p>
            </div>
            <a href="/investimentos" className="text-muted-foreground hover:text-info transition-colors">
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>
          <div className="mt-1">
            <p className="text-xl sm:text-2xl font-extrabold currency tracking-tight leading-none text-info group-hover:-translate-y-0.5 transition-transform duration-300">
              {maskCurrency(formatCurrency(investmentTotal))}
            </p>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1.5 leading-tight">Total acumulado</p>
          </div>
        </div>
      </div>

      {/* ── Main Charts Grid ───────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-6 stagger-2">
        {/* Trend Area Chart (span 2) */}
        <div className="lg:col-span-2 relative z-10">
          <TrendChart />
        </div>

        {/* Economy Gauge & Mini Stats */}
        <div className="flex flex-col gap-4">
          <div className="stat-card flex flex-col items-center justify-center flex-1 py-8 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-muted/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            <h3 className="text-sm font-semibold mb-6 flex items-center gap-2 w-full px-2">
              <PiggyBank className="w-4 h-4 text-primary" /> Taxa de Economia
            </h3>
            <EconomyGauge percentage={savings} size={160} label="Da receita poupada" />
            <div className="mt-6 flex gap-4 text-xs font-medium text-muted-foreground">
              <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-income" /> Meta: &gt;20%</span>
            </div>
          </div>
          
          {/* Pendentes Quick Look */}
          {pendingAmount > 0 && (
            <div className="stat-card p-4 border-l-[3px] border-l-warning flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center text-warning">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase">Despesas Pendentes</p>
                  <p className="text-lg font-extrabold currency text-warning">{maskCurrency(formatCurrency(pendingAmount))}</p>
                </div>
              </div>
              <a href="/despesas" className="p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                <ChevronRight className="w-4 h-4" />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* ── Row 3: Visual Analytics ────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-6 stagger-3">
        {/* Budget Rings */}
        <div className="stat-card flex flex-col">
          <h3 className="text-sm font-semibold mb-6 flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" /> Orçamentos Principais
            <a href="/categorias" className="ml-auto text-xs text-primary hover:underline flex items-center gap-0.5 font-normal">
              Ver todos <ChevronRight className="w-3 h-3" />
            </a>
          </h3>
          {budgetsWithData.length > 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              <BudgetRings budgets={budgetsWithData} size={160} />
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
              <Target className="w-10 h-10 mb-3 opacity-20" />
              <p className="text-sm">Nenhum orçamento definido</p>
              <p className="text-xs mt-1">Configure limites nas suas categorias para acompanhar aqui.</p>
            </div>
          )}
        </div>

        {/* Weekly Heatmap */}
        <div className="stat-card lg:col-span-1 flex flex-col">
          <h3 className="text-sm font-semibold mb-6 flex items-center gap-2">
            <BellRing className="w-4 h-4 text-primary" /> Intensidade de Gastos
          </h3>
          <div className="flex-1 flex flex-col justify-center">
            {expenses.length > 0 ? (
              <WeeklyHeatmap 
                month={currentMonthDate} 
                data={expenses.filter(e => e.status === 'concluido').map(e => ({ date: e.date, amount: Number(e.amount) }))} 
              />
            ) : (
              <div className="text-center p-6 text-muted-foreground">
                <p className="text-sm">Sem gastos neste mês</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Recent Transactions List */}
        <div className="stat-card flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Wallet className="w-4 h-4 text-primary" /> Transações Recentes
            </h3>
          </div>
          {recentTransactions.length > 0 ? (
            <div className="space-y-1 flex-1">
              {recentTransactions.map((t) => {
                const wt = hourlyRate > 0 && t.type === 'expense' ? calcWorkTime(Number(t.amount)) : null;
                return (
                  <div key={t.id} className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-muted/50 transition-all group -mx-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0 border',
                        t.type === 'income' ? 'bg-income/5 text-income border-income/10' : 'bg-expense/5 text-expense border-expense/10'
                      )}>
                        {t.type === 'income'
                          ? <ArrowUpRight className="w-3.5 h-3.5" />
                          : <ArrowDownRight className="w-3.5 h-3.5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{t.description || (t.type === 'income' ? 'Receita' : 'Despesa')}</p>
                        <div className="flex items-center gap-1.5">
                          <p className="text-[10px] text-muted-foreground">{formatDate(t.date)}</p>
                          <div className={cn('w-1.5 h-1.5 rounded-full', t.status === 'concluido' ? 'bg-success' : t.status === 'pendente' ? 'bg-warning' : 'bg-info')} />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className={cn('currency text-sm font-bold tabular-nums', t.type === 'income' ? 'text-income' : 'text-expense')}>
                        {t.type === 'income' ? '+' : '-'}{maskCurrency(formatCurrency(Number(t.amount)))}
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
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
              <Wallet className="w-8 h-8 opacity-20 mb-2" />
              <p className="text-sm">Nenhuma transação</p>
            </div>
          )}
          <div className="mt-4 pt-4 border-t flex justify-center">
             <a href="/despesas" className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">
               Ver extrato completo →
             </a>
          </div>
        </div>
      </div>

      {/* ── Cash Flow Projection ────────────────────────────── */}
      <div className="stagger-4">
        <CashFlowForecast />
      </div>

      {/* ── Achievements ───────────────────────────────────── */}
      <div className="stagger-5">
        <Achievements expenses={expenses} income={income} categories={categories} />
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
