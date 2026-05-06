import { useState, useMemo, type ElementType } from 'react';
import { TrendingUp, TrendingDown, Wallet, PiggyBank, Pencil, BarChart3, ArrowUpRight, ArrowDownRight, Target, Clock, ChevronRight, BellRing, Sparkles, CreditCard, Activity, CalendarRange, Flame, Trophy, AlertTriangle } from 'lucide-react';
import { useIncome, useExpenses, useAccounts, type Income, type Expense } from '@/hooks/useFinanceData';
import { useNetWorth } from '@/hooks/useInvestments';
import { useCCTransactionsForMonth, useCreditCards, useCreditCardTransactions } from '@/hooks/useCreditCards';
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
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip } from 'recharts';
import { useCategories } from '@/hooks/useFinanceData';
import { useAccumulatedBalance } from '@/hooks/useAccumulatedBalance';
import { useWorkTimeCalc, useProfile } from '@/hooks/useProfile';
import { formatWorkTime } from '@/lib/workTime';
import { cn } from '@/lib/utils';
import { useSensitiveData } from '@/components/finance/SensitiveData';
import PendingExpensesDialog from '@/components/finance/PendingExpensesDialog';
import { buildDescriptionAmountKey, buildExpenseMatchKey, detectCreditCardExpense, parseStructuredCardMarker } from '@/lib/paymentMethod';
import { accountBrandFromRow } from '@/lib/accountBrand';

const CHART_COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'];

function colorWithOpacity(hex: string, opacity: number) {
  const cleanHex = hex.replace('#', '');
  const normalized = cleanHex.length === 3
    ? cleanHex.split('').map((char) => char + char).join('')
    : cleanHex;
  const int = Number.parseInt(normalized, 16);
  if (Number.isNaN(int)) return `rgba(37, 99, 235, ${opacity})`;
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function ChartTooltipCard({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value: string; color?: string }>;
}) {
  return (
    <div className="min-w-[140px] rounded-xl border border-border bg-popover px-3 py-2.5 shadow-lg">
      <p className="mb-2 text-xs font-semibold">{title}</p>
      <div className="space-y-1.5">
        {rows.map((row) => (
          <div key={`${title}-${row.label}`} className="flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              {row.color ? <div className="h-2 w-2 rounded-full" style={{ backgroundColor: row.color }} /> : null}
              <span className="text-muted-foreground">{row.label}</span>
            </div>
            <span className="currency font-semibold">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Premium KPI card: colored gradient accent, MoM delta chip, sparkline
function KpiCard({
  label, value, sub, color, icon: Icon, trend, sparklineData, delta, deltaInverted,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
  icon: ElementType;
  trend?: 'up' | 'down' | 'neutral';
  sparklineData?: number[];
  delta?: number | null;
  deltaInverted?: boolean; // true for expenses (less = good)
}) {
  const { maskCurrency, maskText } = useSensitiveData();
  const displayValue = value.startsWith('R$') ? maskCurrency(value) : maskText(value);
  const deltaIsGood = delta == null ? null : (deltaInverted ? delta < 0 : delta > 0);
  const sparkColor = trend === 'up' ? 'hsl(160, 84%, 39%)' : trend === 'down' ? 'hsl(0, 72%, 51%)' : 'hsl(217, 91%, 60%)';

  return (
    <div className={cn('relative rounded-2xl border border-border/60 bg-card/70 backdrop-blur-sm p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-300 group overflow-hidden animate-slide-up', color)}>
      {/* Decorative gradient blob */}
      <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-[0.06] group-hover:opacity-[0.10] group-hover:scale-110 transition-all duration-500 pointer-events-none" style={{ background: `radial-gradient(circle, ${sparkColor} 0%, transparent 70%)` }} />

      <div className="relative z-10 flex flex-col gap-2.5 h-full">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn('w-8 h-8 rounded-xl items-center justify-center flex shrink-0',
              trend === 'up' ? 'bg-income/10 text-income' : trend === 'down' ? 'bg-expense/10 text-expense' : 'bg-primary/10 text-primary'
            )}>
              <Icon className="w-4 h-4" />
            </div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.1em]">{label}</p>
          </div>
          {delta !== null && delta !== undefined && (
            <span className={cn(
              'inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md',
              deltaIsGood ? 'bg-income/10 text-income' : 'bg-expense/10 text-expense',
            )}>
              {delta > 0 ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
              {Math.abs(delta).toFixed(0)}%
            </span>
          )}
        </div>

        {/* Value + sparkline */}
        <div className="flex items-end justify-between mt-1 gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-base sm:text-lg lg:text-xl font-extrabold currency tracking-tight leading-none whitespace-nowrap tabular-nums truncate">{displayValue}</p>
            {sub && <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-1.5 leading-tight line-clamp-2">{sub}</p>}
          </div>
          {sparklineData && sparklineData.length > 1 && (
            <div className="shrink-0 -mr-1 opacity-60 group-hover:opacity-100 transition-opacity hidden sm:block">
              <SparklineChart data={sparklineData} color={sparkColor} width={48} height={22} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { maskCurrency } = useSensitiveData();
  const [month, setMonth] = useState(getMonthYear());
  const [accountFocusId, setAccountFocusId] = useState<string>('__all__');
  const [accountAnalysisOpen, setAccountAnalysisOpen] = useState(false);
  const { data: profile } = useProfile();
  
  // Previous month string (for MoM comparisons)
  const prevMonth = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, [month]);

  const { data: income = [] } = useIncome(month);
  const { data: expenses = [] } = useExpenses(month);
  const { data: prevIncome = [] } = useIncome(prevMonth);
  const { data: prevExpenses = [] } = useExpenses(prevMonth);
  const { data: prevCCTransactions = [] } = useCCTransactionsForMonth(prevMonth);
  const { data: categories = [] } = useCategories();
  const { data: accounts = [] } = useAccounts();
  const { data: creditCards = [] } = useCreditCards();
  const { data: creditTransactions = [] } = useCreditCardTransactions();
  const { investmentTotal } = useNetWorth();
  const { data: accumulatedData } = useAccumulatedBalance(month);
  const accumulatedBalance = accumulatedData?.total || 0;
  const accumulatedByAccount = accumulatedData?.byAccount || {};
  const { data: ccTransactions = [] } = useCCTransactionsForMonth(month);
  const { calcWorkTime, hourlyRate } = useWorkTimeCalc();

  const [editing, setEditing] = useState<((Income & { type: 'income' }) | (Expense & { type: 'expense' })) | null>(null);
  const [pendingModalOpen, setPendingModalOpen] = useState(false);
  const isCreditCardExpense = (expense: Pick<Expense, 'notes' | 'account_id'>) =>
    detectCreditCardExpense(expense, creditCards, accounts).isCreditCard;

  // Despesas que NÃO são espelho de cartão de crédito (evitar dupla contagem)
  const nonCCExpenses = useMemo(() =>
    expenses.filter(e => !isCreditCardExpense(e))
  , [expenses, creditCards, accounts]);

  const scopedIncome = useMemo(
    () => (accountFocusId === '__all__' ? income : income.filter(i => i.account_id === accountFocusId)),
    [income, accountFocusId],
  );
  const scopedNonCCExpenses = useMemo(
    () => (accountFocusId === '__all__' ? nonCCExpenses : nonCCExpenses.filter(e => e.account_id === accountFocusId)),
    [nonCCExpenses, accountFocusId],
  );
  const scopedCCTransactions = useMemo(
    () => (accountFocusId === '__all__' ? ccTransactions : []),
    [ccTransactions, accountFocusId],
  );
  const scopedPrevIncome = useMemo(
    () => (accountFocusId === '__all__' ? prevIncome : prevIncome.filter(i => i.account_id === accountFocusId)),
    [prevIncome, accountFocusId],
  );
  const scopedPrevNonCCExpenses = useMemo(() => {
    const base = prevExpenses.filter(e => !isCreditCardExpense(e));
    return accountFocusId === '__all__' ? base : base.filter(e => e.account_id === accountFocusId);
  }, [prevExpenses, accountFocusId, creditCards, accounts]);
  const scopedPrevCCTransactions = useMemo(
    () => (accountFocusId === '__all__' ? prevCCTransactions : []),
    [prevCCTransactions, accountFocusId],
  );

  const { categoryByTxId, categoryByMatchKey, categoryByLooseKey } = useMemo(() => {
    const byTxId = new Map<string, string>();
    const byKey = new Map<string, string>();
    const byLooseKey = new Map<string, string>();

    creditTransactions.forEach((tx) => {
      if (!tx.category_id) return;
      byTxId.set(tx.id, tx.category_id);
      byKey.set(buildExpenseMatchKey(tx.description || '', tx.date, Number(tx.amount) || 0), tx.category_id);
      byLooseKey.set(`${tx.bill_month}|${buildDescriptionAmountKey(tx.description || '', Number(tx.amount) || 0)}`, tx.category_id);
    });

    return { categoryByTxId: byTxId, categoryByMatchKey: byKey, categoryByLooseKey: byLooseKey };
  }, [creditTransactions]);

  const resolveCategoryId = (expense: Expense) => {
    if (expense.category_id) return expense.category_id;

    const marker = parseStructuredCardMarker(expense.notes);
    if (marker?.transactionId && categoryByTxId.has(marker.transactionId)) {
      return categoryByTxId.get(marker.transactionId) ?? null;
    }

    const matchKey = buildExpenseMatchKey(expense.description || '', expense.date, Number(expense.amount) || 0);
    const billMonth = marker?.billMonth ?? expense.date?.slice(0, 7);
    const looseKey = `${billMonth}|${buildDescriptionAmountKey(expense.description || '', Number(expense.amount) || 0)}`;
    return categoryByMatchKey.get(matchKey) ?? categoryByLooseKey.get(looseKey) ?? null;
  };

  // ── Core numbers ─────────────────────────────────────────────
  const totalIncome = useMemo(() =>
    scopedIncome.filter(i => i.status === 'concluido').reduce((s, i) => s + Number(i.amount), 0)
  , [scopedIncome]);

  const totalExpensesPaid = useMemo(() =>
    scopedNonCCExpenses.filter(e => e.status === 'concluido').reduce((s, e) => s + Number(e.amount), 0)
  , [scopedNonCCExpenses]);

  const totalExpensesAll = useMemo(() =>
    scopedNonCCExpenses.reduce((s, e) => s + Number(e.amount), 0)
  , [scopedNonCCExpenses]);

  const pendingAmount = useMemo(() =>
    scopedNonCCExpenses.filter(e => e.status !== 'concluido').reduce((s, e) => s + Number(e.amount), 0)
  , [scopedNonCCExpenses]);

  // CC totals for the current bill month
  const totalCCThisMonth = useMemo(() =>
    scopedCCTransactions.reduce((s, t) => s + Number(t.amount), 0)
  , [scopedCCTransactions]);

  const savings = totalIncome > 0 ? ((totalIncome - totalExpensesPaid) / totalIncome) * 100 : 0;

  // ── Category breakdown: nonCC expenses + CC transactions (sem dupla contagem) ───
  const catBreakdown = useMemo(() => {
    const allItems = [
      ...scopedNonCCExpenses.map(e => ({ category_id: resolveCategoryId(e), amount: Number(e.amount) })),
      ...scopedCCTransactions.map(t => ({ category_id: t.category_id, amount: Number(t.amount) })),
    ];
    return categories
      .map(cat => ({
        name: cat.name,
        icon: cat.icon,
        value: allItems.filter(i => i.category_id === cat.id).reduce((s, i) => s + i.amount, 0),
        budget: Number(cat.monthly_budget) || 0,
      }))
      .filter(c => c.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [scopedNonCCExpenses, scopedCCTransactions, categories, categoryByTxId, categoryByMatchKey, categoryByLooseKey]);

  // ── Status breakdown: apenas despesas normais (sem espelhos CC) + Fatura CC ───
  const statusData = useMemo(() => [
    { name: 'Concluído', value: scopedNonCCExpenses.filter(e => e.status === 'concluido').reduce((s, e) => s + Number(e.amount), 0), fill: 'hsl(160, 84%, 39%)' },
    { name: 'Pendente',  value: scopedNonCCExpenses.filter(e => e.status === 'pendente').reduce((s, e) => s + Number(e.amount), 0),  fill: 'hsl(38, 92%, 50%)' },
    { name: 'Agendado',  value: scopedNonCCExpenses.filter(e => e.status === 'agendado').reduce((s, e) => s + Number(e.amount), 0),  fill: 'hsl(217, 91%, 60%)' },
    ...(totalCCThisMonth > 0 ? [{ name: 'Fatura CC', value: totalCCThisMonth, fill: '#6366f1' }] : []),
  ].filter(s => s.value > 0), [scopedNonCCExpenses, totalCCThisMonth]);

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

  const incomeSparkline = useMemo(() => getDailyTrend(scopedIncome.filter(i => i.status === 'concluido')), [scopedIncome]);
  const expenseSparkline = useMemo(() => {
    const items = [
      ...scopedNonCCExpenses.filter(e => e.status === 'concluido').map(e => ({ date: e.date, amount: Number(e.amount) })),
      ...scopedCCTransactions.map(t => ({ date: t.date, amount: Number(t.amount) })),
    ];
    return getDailyTrend(items);
  }, [scopedNonCCExpenses, scopedCCTransactions]);
  
  // Balance sparkline (running total)
  const balanceSparkline = useMemo(() => {
    const all = [
      ...scopedIncome
        .filter(i => i.status === 'concluido')
        .map(i => ({ date: i.date, amount: Number(i.amount) })),
      ...scopedNonCCExpenses
        .filter(e => e.status === 'concluido')
        .map(e => ({ date: e.date, amount: -Number(e.amount) })),
      ...scopedCCTransactions.map(t => ({ date: t.date, amount: -Number(t.amount) })),
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    let run = 0;
    const vals = all.map(t => { run += t.amount; return run; });
    if (vals.length === 0) return [0, 0];
    if (vals.length === 1) return [0, vals[0]];
    return vals;
  }, [scopedIncome, scopedNonCCExpenses, scopedCCTransactions]);

  // ── Budget progress for Rings: nonCC expenses + CC transactions por categoria ──
  const budgetsWithData = useMemo(() =>
    categories.filter(c => Number(c.monthly_budget) > 0).map(cat => {
      const spentRegular = scopedNonCCExpenses.filter(e => resolveCategoryId(e) === cat.id).reduce((s, e) => s + Number(e.amount), 0);
      const spentCC = scopedCCTransactions.filter(t => t.category_id === cat.id).reduce((s, t) => s + Number(t.amount), 0);
      const spent = spentRegular + spentCC;
      const budget = Number(cat.monthly_budget);
      return { ...cat, spent, budget };
    }).sort((a, b) => b.budget - a.budget)
  , [categories, scopedNonCCExpenses, scopedCCTransactions, categoryByTxId, categoryByMatchKey, categoryByLooseKey]);

  // ── Recent transactions (sem espelhos CC) ───────────────────
  const recentTransactions = useMemo(() => [
    ...scopedIncome.map(i => ({ ...i, type: 'income' as const })),
    ...scopedNonCCExpenses.map(e => ({ ...e, type: 'expense' as const })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5)
  , [scopedIncome, scopedNonCCExpenses]);

  const scopedExpenseHeatmapData = useMemo(() => [
    ...scopedNonCCExpenses
      .filter(e => e.status === 'concluido')
      .map(e => ({ date: e.date, amount: Number(e.amount) })),
    ...scopedCCTransactions.map(t => ({ date: t.date, amount: Number(t.amount) })),
  ], [scopedNonCCExpenses, scopedCCTransactions]);

  const workTimeTotal = hourlyRate > 0 ? calcWorkTime(totalExpensesPaid) : null;
  const accountInsights = useMemo(() => {
    return accounts
      .filter(a => !a.archived)
      .map((acc) => {
        const accIncome = income
          .filter((i) => i.account_id === acc.id && i.status === 'concluido')
          .reduce((s, i) => s + Number(i.amount), 0);
        const accExpenses = nonCCExpenses
          .filter((e) => e.account_id === acc.id && e.status === 'concluido')
          .reduce((s, e) => s + Number(e.amount), 0);
        const accPending = nonCCExpenses
          .filter((e) => e.account_id === acc.id && e.status !== 'concluido')
          .reduce((s, e) => s + Number(e.amount), 0);
        const accumulated = accumulatedByAccount[acc.id] || 0;
        const balance = Number(acc.initial_balance) + accumulated;
        return { acc, accIncome, accExpenses, accPending, balance };
      })
      .sort((a, b) => b.balance - a.balance);
  }, [accounts, income, nonCCExpenses, accumulatedByAccount]);

  const activeAccounts = useMemo(() => accounts.filter((acc) => !acc.archived), [accounts]);
  const focusedAccountInsight = useMemo(
    () => (accountFocusId === '__all__' ? null : accountInsights.find(({ acc }) => acc.id === accountFocusId) ?? null),
    [accountInsights, accountFocusId],
  );

  const focusedBrand = useMemo(
    () => (focusedAccountInsight ? accountBrandFromRow(focusedAccountInsight.acc) : null),
    [focusedAccountInsight],
  );
  const isGlobalView = accountFocusId === '__all__';
  const currentAccent = focusedBrand?.color || '#2563eb';
  const accentSoft = colorWithOpacity(currentAccent, 0.12);
  const accentBorder = colorWithOpacity(currentAccent, 0.45);
  const accentGlow = colorWithOpacity(currentAccent, 0.2);
  const focusLabel = isGlobalView ? 'Todas as contas' : focusedAccountInsight?.acc.name || 'Conta foco';
  const focusSubLabel = isGlobalView
    ? `${activeAccounts.length} contas ativas`
    : `Saldo atual: ${maskCurrency(formatCurrency(focusedAccountInsight?.balance || 0))}`;

  const balance = accountFocusId === '__all__' ? accumulatedBalance : (focusedAccountInsight?.balance ?? 0);
  const focusedInvestmentTotal = accountFocusId === '__all__' ? investmentTotal : 0;
  const netWorth = balance + focusedInvestmentTotal;

  // All sections visible in single-page layout
  
  // Greeting based on time
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: 'Bom dia', icon: '☀️' };
    if (hour < 18) return { text: 'Boa tarde', icon: '🌤️' };
    return { text: 'Boa noite', icon: '🌙' };
  }, []);

  const currentMonthDate = useMemo(() => {
    const [year, m] = month.split('-');
    return new Date(parseInt(year), parseInt(m) - 1, 1);
  }, [month]);

  // ── Previous month totals (for MoM deltas) ─────────────────────
  const prevTotalIncome = useMemo(() =>
    scopedPrevIncome.filter(i => i.status === 'concluido').reduce((s, i) => s + Number(i.amount), 0)
  , [scopedPrevIncome]);

  const prevTotalExpensesPaid = useMemo(() =>
    scopedPrevNonCCExpenses.filter(e => e.status === 'concluido').reduce((s, e) => s + Number(e.amount), 0)
  , [scopedPrevNonCCExpenses]);

  const prevTotalCC = useMemo(() =>
    scopedPrevCCTransactions.reduce((s, t) => s + Number(t.amount), 0)
  , [scopedPrevCCTransactions]);

  const prevTotalAll = prevTotalExpensesPaid + prevTotalCC;
  const currentTotalAll = totalExpensesPaid + totalCCThisMonth;

  // Percent delta helper (current vs previous, returns null when prev = 0)
  const pctDelta = (cur: number, prev: number): number | null => {
    if (prev === 0) return cur > 0 ? 100 : null;
    return ((cur - prev) / prev) * 100;
  };

  const incomeDelta = pctDelta(totalIncome, prevTotalIncome);
  const expenseDelta = pctDelta(currentTotalAll, prevTotalAll);
  const ccDelta = pctDelta(totalCCThisMonth, prevTotalCC);

  // ── Visão do Mês: Pace tracker ─────────────────────────────────
  const monthPace = useMemo(() => {
    const today = new Date();
    const [y, m] = month.split('-').map(Number);
    const isCurrentMonth = today.getFullYear() === y && (today.getMonth() + 1) === m;
    const lastDayOfMonth = new Date(y, m, 0).getDate();
    const dayOfMonth = isCurrentMonth ? today.getDate() : lastDayOfMonth;
    const monthProgress = (dayOfMonth / lastDayOfMonth) * 100;

    const totalBudget = categories.reduce((s, c) => s + (Number(c.monthly_budget) || 0), 0);
    const spendProgress = totalBudget > 0 ? (currentTotalAll / totalBudget) * 100 : 0;

    // Compare pace: how does today's spending vs same day last month?
    const prevSameDayTotal = (() => {
      const filterByDay = <T extends { date: string }>(arr: T[]) => arr.filter(e => {
        const d = new Date(e.date + 'T00:00:00');
        return d.getDate() <= dayOfMonth;
      });
      const exp = filterByDay(scopedPrevNonCCExpenses).filter(e => e.status === 'concluido').reduce((s, e) => s + Number(e.amount), 0);
      const cc = filterByDay(scopedPrevCCTransactions).reduce((s, t) => s + Number(t.amount), 0);
      return exp + cc;
    })();
    const paceVsPrev = pctDelta(currentTotalAll, prevSameDayTotal);

    return {
      dayOfMonth,
      lastDayOfMonth,
      isCurrentMonth,
      monthProgress,
      totalBudget,
      spendProgress,
      paceVsPrev,
      onTrack: totalBudget > 0 ? spendProgress <= monthProgress + 5 : null,
    };
  }, [month, categories, currentTotalAll, scopedPrevNonCCExpenses, scopedPrevCCTransactions]);

  // ── Saúde Financeira: 0–100 score combinando vários sinais ─────
  const healthScore = useMemo(() => {
    let score = 50; // baseline

    // Economy: > 20% = +25, > 10% = +15, > 0 = +5, negative = -20
    if (savings >= 20) score += 25;
    else if (savings >= 10) score += 15;
    else if (savings > 0) score += 5;
    else score -= 20;

    // Budget compliance: spending vs total budget
    if (monthPace.totalBudget > 0) {
      if (monthPace.spendProgress <= monthPace.monthProgress) score += 15;
      else if (monthPace.spendProgress <= monthPace.monthProgress + 10) score += 5;
      else if (monthPace.spendProgress > monthPace.monthProgress + 25) score -= 15;
    }

    // Pendências: poucas = +10, muitas = -10
    const pendingRatio = totalIncome > 0 ? pendingAmount / totalIncome : 0;
    if (pendingRatio < 0.1) score += 10;
    else if (pendingRatio > 0.3) score -= 10;

    // CC usage vs income
    if (totalIncome > 0) {
      const ccRatio = totalCCThisMonth / totalIncome;
      if (ccRatio > 0.6) score -= 10;
      else if (ccRatio < 0.3) score += 5;
    }

    // Net worth positive = +10
    if (netWorth > 0) score += 10;
    else score -= 10;

    return Math.max(0, Math.min(100, Math.round(score)));
  }, [savings, monthPace, pendingAmount, totalIncome, totalCCThisMonth, netWorth]);

  const healthLabel = healthScore >= 80 ? 'Excelente' : healthScore >= 60 ? 'Saudável' : healthScore >= 40 ? 'Atenção' : 'Crítica';
  const healthColor = healthScore >= 80 ? 'hsl(160, 84%, 39%)' : healthScore >= 60 ? 'hsl(195, 70%, 50%)' : healthScore >= 40 ? 'hsl(38, 92%, 50%)' : 'hsl(0, 72%, 51%)';

  // ── Top Movimentos do Mês ──────────────────────────────────────
  const topExpenses = useMemo(() => {
    const allExpenses = [
      ...scopedNonCCExpenses.map(e => ({ id: e.id, description: e.description || 'Despesa', amount: Number(e.amount), date: e.date, category_id: resolveCategoryId(e), kind: 'expense' as const })),
      ...scopedCCTransactions.map(t => ({ id: t.id, description: t.description || 'Compra', amount: Number(t.amount), date: t.date, category_id: t.category_id, kind: 'cc' as const })),
    ];
    return allExpenses.sort((a, b) => b.amount - a.amount).slice(0, 5);
  }, [scopedNonCCExpenses, scopedCCTransactions, categoryByTxId, categoryByMatchKey, categoryByLooseKey]);

  const topIncomes = useMemo(() =>
    [...scopedIncome].sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 5)
  , [scopedIncome]);

  // ── Comparativo Mensal: bars ───────────────────────────────────
  const monthCompareData = useMemo(() => [
    {
      name: 'Receitas',
      anterior: prevTotalIncome,
      atual: totalIncome,
      colorAtual: 'hsl(160, 84%, 39%)',
      colorPrev: 'hsl(160, 84%, 39%, 0.35)',
    },
    {
      name: 'Despesas',
      anterior: prevTotalAll,
      atual: currentTotalAll,
      colorAtual: 'hsl(0, 72%, 51%)',
      colorPrev: 'hsl(0, 72%, 51%, 0.35)',
    },
    {
      name: 'Sobra',
      anterior: prevTotalIncome - prevTotalAll,
      atual: totalIncome - currentTotalAll,
      colorAtual: 'hsl(217, 91%, 60%)',
      colorPrev: 'hsl(217, 91%, 60%, 0.35)',
    },
  ], [prevTotalIncome, totalIncome, prevTotalAll, currentTotalAll]);

  // ── Allocation: Contas vs Investimentos ────────────────────────
  const allocationData = useMemo(() => {
    const items = [];
    if (balance > 0) items.push({ name: 'Contas', value: balance, fill: 'hsl(160, 84%, 39%)' });
    if (focusedInvestmentTotal > 0) items.push({ name: 'Investimentos', value: focusedInvestmentTotal, fill: 'hsl(217, 91%, 60%)' });
    return items;
  }, [balance, focusedInvestmentTotal]);

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in pb-10 w-full max-w-full overflow-x-hidden sm:overflow-visible">
      {/* Hero + account switcher + visual mode */}
      <div
        className="relative overflow-hidden rounded-[2.5rem] border shadow-xl sm:rounded-[3rem] p-5 sm:p-8"
        style={{
          borderColor: isGlobalView ? 'hsl(var(--border) / 0.8)' : accentBorder,
          background: isGlobalView
            ? 'linear-gradient(145deg, hsl(var(--background)) 0%, hsl(var(--card)) 100%)'
            : `linear-gradient(145deg, ${accentSoft} 0%, hsl(var(--card)) 100%)`,
        }}
      >
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full blur-[100px]" style={{ background: accentGlow }} />
        <div className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-primary/10 blur-[100px]" />

        <div className="relative z-10 flex flex-col gap-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1 flex flex-col sm:flex-row gap-5 items-start sm:items-center">
              <div
                className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl border bg-background/80 p-3 shadow-lg backdrop-blur-md transition-transform hover:scale-105"
                style={{ borderColor: isGlobalView ? 'hsl(var(--border))' : accentBorder }}
              >
                {focusedBrand?.logoUrl ? (
                  <img src={focusedBrand.logoUrl} alt={focusLabel} className="h-full w-full object-contain drop-shadow-sm" />
                ) : isGlobalView ? (
                  <Sparkles className="h-10 w-10 text-primary drop-shadow-sm" />
                ) : (
                  <span className="text-4xl drop-shadow-sm">{focusedBrand?.icon || '🏦'}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-muted-foreground tracking-wide uppercase">
                  {greeting.icon} {greeting.text}{profile?.first_name ? `, ${profile.first_name}` : ''}
                </p>
                <h1 className="truncate text-3xl font-black leading-tight tracking-tight sm:text-5xl mt-1 drop-shadow-sm">
                  {focusLabel}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <span className="text-lg font-bold text-muted-foreground">{focusSubLabel}</span>
                  <span
                    className="rounded-xl border px-3 py-1 text-xs font-bold uppercase tracking-wider backdrop-blur-md"
                    style={{ borderColor: colorWithOpacity(healthColor, 0.4), backgroundColor: colorWithOpacity(healthColor, 0.15), color: healthColor }}
                  >
                    Saúde {healthScore}/100
                  </span>
                </div>
              </div>
            </div>

            <div className="grid w-full grid-cols-2 gap-3 sm:w-auto sm:flex">
              <div className="col-span-2 sm:col-span-1">
                <MonthSelector month={month} onChange={setMonth} />
              </div>
              <TransactionDialog type="income" defaultAccountId={accountFocusId === '__all__' ? undefined : accountFocusId}>
                <button className="flex h-11 items-center justify-center rounded-2xl bg-income px-5 text-sm font-bold text-income-foreground transition-all hover:bg-income/90 hover:shadow-lg hover:-translate-y-0.5">
                  <ArrowUpRight className="mr-2 h-5 w-5" /> Receita
                </button>
              </TransactionDialog>
              <TransactionDialog type="expense" defaultAccountId={accountFocusId === '__all__' ? undefined : accountFocusId}>
                <button className="flex h-11 items-center justify-center rounded-2xl bg-expense px-5 text-sm font-bold text-expense-foreground transition-all hover:bg-expense/90 hover:shadow-lg hover:-translate-y-0.5">
                  <ArrowDownRight className="mr-2 h-5 w-5" /> Despesa
                </button>
              </TransactionDialog>
            </div>
          </div>

          {/* Account Switcher - BIGGER and PREMIUM */}
          <div className="rounded-3xl border border-white/10 bg-background/40 p-4 backdrop-blur-2xl shadow-inner">
            <p className="px-2 pb-3 text-xs font-black uppercase tracking-widest text-muted-foreground">
              Escolha a conta
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              <button
                onClick={() => setAccountFocusId('__all__')}
                className={cn(
                  'group flex flex-col items-center gap-3 rounded-[1.5rem] border p-4 sm:p-5 text-center transition-all duration-300',
                  isGlobalView 
                    ? 'border-primary/50 bg-primary/10 shadow-[0_8px_30px_rgb(0,0,0,0.12)] ring-4 ring-primary/20 scale-[1.02]' 
                    : 'border-border/40 bg-background/50 hover:bg-background/80 hover:scale-[1.02] hover:shadow-md',
                )}
              >
                <span className={cn("flex h-14 w-14 items-center justify-center rounded-2xl transition-transform group-hover:scale-110", isGlobalView ? "bg-primary text-primary-foreground shadow-lg" : "bg-primary/10 text-primary")}>
                  <Wallet className="h-7 w-7" />
                </span>
                <div className="min-w-0 w-full mt-1">
                  <p className="text-sm font-bold truncate">Visão Geral</p>
                  <p className="text-xs text-muted-foreground font-medium mt-0.5">{activeAccounts.length} contas ativas</p>
                  <p className="text-base font-black currency mt-2 tabular-nums truncate tracking-tight">{maskCurrency(formatCurrency(accumulatedBalance))}</p>
                </div>
              </button>
              {activeAccounts.map((account) => {
                const brand = accountBrandFromRow(account);
                const active = accountFocusId === account.id;
                const insight = accountInsights.find(a => a.acc.id === account.id);
                const bal = insight?.balance ?? 0;
                return (
                  <button
                    key={account.id}
                    onClick={() => setAccountFocusId(account.id)}
                    className={cn(
                      'group flex flex-col items-center gap-3 rounded-[1.5rem] border p-4 sm:p-5 text-center transition-all duration-300',
                      active 
                        ? 'shadow-[0_8px_30px_rgb(0,0,0,0.12)] ring-4 scale-[1.02]' 
                        : 'border-border/40 bg-background/50 hover:bg-background/80 hover:scale-[1.02] hover:shadow-md',
                    )}
                    style={active ? { borderColor: colorWithOpacity(brand.color, 0.6), backgroundColor: colorWithOpacity(brand.color, 0.15), '--tw-ring-color': colorWithOpacity(brand.color, 0.25) } as React.CSSProperties : undefined}
                  >
                    <span className={cn("flex h-14 w-14 items-center justify-center rounded-2xl border transition-transform group-hover:scale-110", active ? "bg-background shadow-lg" : "border-border/50 bg-background/80")}>
                      {brand.logoUrl ? (
                        <img src={brand.logoUrl} alt={account.name} className="h-8 w-8 object-contain" />
                      ) : (
                        <span className="text-2xl">{brand.icon || account.icon || '🏦'}</span>
                      )}
                    </span>
                    <div className="min-w-0 w-full mt-1">
                      <p className="text-sm font-bold truncate">{account.name}</p>
                      <p className={cn('text-base font-black currency mt-2 tabular-nums truncate tracking-tight', bal >= 0 ? 'text-income' : 'text-expense')}>
                        {maskCurrency(formatCurrency(bal))}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      {/* Account-level lens — Collapsible */}
      {accountInsights.length > 0 && (
        <div className="rounded-3xl border border-border/60 bg-card/70 backdrop-blur-sm shadow-sm overflow-hidden">
          <button
            onClick={() => setAccountAnalysisOpen(v => !v)}
            className="w-full flex items-center justify-between p-5 sm:p-6 hover:bg-muted/20 transition-colors text-left"
          >
            <div>
              <h3 className="text-sm font-bold leading-tight">Análise por Conta</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Visão separada de entradas, saídas e saldo por banco/carteira</p>
            </div>
            <ChevronRight className={cn('w-5 h-5 text-muted-foreground transition-transform duration-300 shrink-0', accountAnalysisOpen && 'rotate-90')} />
          </button>
          {accountAnalysisOpen && (
            <div className="px-5 pb-5 sm:px-6 sm:pb-6 pt-0 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {accountInsights
                  .filter(({ acc }) => accountFocusId === '__all__' || acc.id === accountFocusId)
                  .map(({ acc, accIncome, accExpenses, accPending, balance }) => {
                    const brand = accountBrandFromRow(acc);
                    return (
                      <div
                        key={acc.id}
                        className="rounded-2xl border p-4"
                        style={{ borderColor: colorWithOpacity(brand.color, 0.35), background: `linear-gradient(135deg, ${colorWithOpacity(brand.color, 0.12)} 0%, hsl(var(--muted) / 0.24) 100%)` }}
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-background/70 p-1">
                            {brand.logoUrl ? (
                              <img src={brand.logoUrl} alt={acc.name} className="h-full w-full object-contain" />
                            ) : (
                              <span className="text-base">{brand.icon || acc.icon}</span>
                            )}
                          </span>
                          <p className="font-bold truncate">{acc.name}</p>
                        </div>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Receitas</span>
                            <span className="font-semibold text-income currency">{maskCurrency(formatCurrency(accIncome))}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Despesas</span>
                            <span className="font-semibold text-expense currency">{maskCurrency(formatCurrency(accExpenses))}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Pendentes</span>
                            <span className="font-semibold text-warning currency">{maskCurrency(formatCurrency(accPending))}</span>
                          </div>
                          <div className="pt-2 mt-2 border-t border-border/60 flex items-center justify-between">
                            <span className="font-semibold">Saldo da conta</span>
                            <span className={cn('font-extrabold currency', balance >= 0 ? 'text-income' : 'text-expense')}>
                              {maskCurrency(formatCurrency(balance))}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Alertas ────────────────────────────────────────── */}
      <SmartAlerts expenses={scopedNonCCExpenses} income={scopedIncome} categories={categories} />

      {/* ─── KPI Cards Premium ─── */}
      <div className={`grid grid-cols-1 gap-3 min-[390px]:grid-cols-2 sm:gap-4 stagger-1 ${totalCCThisMonth > 0 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
        <KpiCard
          label="Receitas"
          value={formatCurrency(totalIncome)}
          sub="concluídas neste mês"
          color="border-l-[3px] border-l-income"
          icon={TrendingUp}
          trend="up"
          sparklineData={incomeSparkline}
          delta={incomeDelta}
        />
        <KpiCard
          label="Despesas"
          value={formatCurrency(totalExpensesPaid + totalCCThisMonth)}
          sub={`${formatCurrency(totalExpensesPaid)} contas + ${formatCurrency(totalCCThisMonth)} cartão`}
          color="border-l-[3px] border-l-expense"
          icon={TrendingDown}
          trend="down"
          sparklineData={expenseSparkline}
          delta={expenseDelta}
          deltaInverted
        />
        <KpiCard
          label="Saldo Acumulado"
          value={formatCurrency(balance)}
          sub="disponível em contas"
          color={balance >= 0 ? 'border-l-[3px] border-l-primary' : 'border-l-[3px] border-l-expense'}
          icon={Wallet}
          trend={balance >= 0 ? 'up' : 'down'}
          sparklineData={balanceSparkline}
        />

        {/* Patrimônio Líquido = Saldo + Investimentos */}
        <a href="/investimentos" className="block">
          <div className="relative rounded-2xl border border-info/20 bg-card/70 backdrop-blur-sm p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-300 group overflow-hidden animate-slide-up border-l-[3px] border-l-info h-full">
            <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-[0.06] group-hover:opacity-[0.12] group-hover:scale-110 transition-all duration-500 pointer-events-none" style={{ background: 'radial-gradient(circle, hsl(217, 91%, 60%) 0%, transparent 70%)' }} />
            <div className="relative z-10 flex flex-col gap-2.5 h-full">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl items-center justify-center flex shrink-0 bg-info/10 text-info">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.1em]">Patrimônio</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-info group-hover:translate-x-0.5 transition-all" />
              </div>
              <div className="mt-1 min-w-0">
                <p className="text-base sm:text-lg lg:text-xl font-extrabold currency tracking-tight leading-none text-info whitespace-nowrap tabular-nums truncate">
                  {maskCurrency(formatCurrency(netWorth))}
                </p>
                <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-1.5 leading-tight line-clamp-2">
                  {accountFocusId === '__all__'
                    ? `Contas ${maskCurrency(formatCurrency(balance))} · Invest. ${maskCurrency(formatCurrency(focusedInvestmentTotal))}`
                    : `Conta foco: ${focusedAccountInsight?.acc.name || 'Conta selecionada'}`}
                </p>
              </div>
            </div>
          </div>
        </a>

        {/* Fatura CC — só aparece quando há transações de cartão no mês */}
        {totalCCThisMonth > 0 && (
          <a href="/cartoes" className="block">
            <div className="relative rounded-2xl border border-[#6366f1]/25 bg-card/70 backdrop-blur-sm p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-300 group overflow-hidden animate-slide-up border-l-[3px] border-l-[#6366f1] h-full">
              <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-[0.08] group-hover:opacity-[0.14] group-hover:scale-110 transition-all duration-500 pointer-events-none" style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)' }} />
              <div className="relative z-10 flex flex-col gap-2.5 h-full">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl items-center justify-center flex shrink-0 bg-[#6366f1]/10 text-[#6366f1]">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.1em]">Fatura CC</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-[#6366f1] group-hover:translate-x-0.5 transition-all" />
                </div>
                <div className="mt-1 min-w-0">
                  <p className="text-base sm:text-lg lg:text-xl font-extrabold currency tracking-tight leading-none text-[#6366f1] whitespace-nowrap tabular-nums truncate">
                    {maskCurrency(formatCurrency(totalCCThisMonth))}
                  </p>
                  <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-1.5 leading-tight">
                    {scopedCCTransactions.filter(t => t.paid).length}/{scopedCCTransactions.length} itens pagos
                  </p>
                </div>
              </div>
            </div>
          </a>
        )}
      </div>

      {/* ─── NEW: Visão do Mês + Comparativo Mensal ─── */}
      <div className="grid lg:grid-cols-3 gap-4 sm:gap-6 stagger-1">
        {/* Pace Tracker */}
        <div className="lg:col-span-2 relative overflow-hidden rounded-3xl border border-border/60 bg-card/70 backdrop-blur-sm p-5 sm:p-6 shadow-sm">
          <div className="absolute -top-20 -right-16 w-56 h-56 bg-primary/[0.08] blur-3xl rounded-full pointer-events-none" />
          <div className="relative z-10 space-y-5">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/15">
                  <Activity className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-bold leading-tight">Visão do Mês</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Ritmo do mês × ritmo dos gastos</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="font-semibold text-muted-foreground">Dia</span>
                <span className="font-extrabold text-foreground tabular-nums">{monthPace.dayOfMonth}/{monthPace.lastDayOfMonth}</span>
              </div>
            </div>

            {/* Dual progress bars: month progress vs spend progress */}
            <div className="space-y-3.5">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                    <CalendarRange className="w-3 h-3" /> Avanço do mês
                  </span>
                  <span className="font-bold tabular-nums">{monthPace.monthProgress.toFixed(0)}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary/60 to-primary rounded-full transition-all duration-1000" style={{ width: `${monthPace.monthProgress}%` }} />
                </div>
              </div>
              {monthPace.totalBudget > 0 ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                      <Flame className={cn('w-3 h-3', monthPace.onTrack ? 'text-income' : 'text-expense')} /> Gastos do mês
                    </span>
                    <span className={cn('font-bold tabular-nums', monthPace.onTrack ? 'text-income' : 'text-expense')}>{monthPace.spendProgress.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all duration-1000', monthPace.onTrack ? 'bg-gradient-to-r from-income/70 to-income' : 'bg-gradient-to-r from-expense/70 to-expense')} style={{ width: `${Math.min(100, monthPace.spendProgress)}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground">{maskCurrency(formatCurrency(currentTotalAll))} de {maskCurrency(formatCurrency(monthPace.totalBudget))} de orçamento</p>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-muted/30 px-3 py-2.5 text-center">
                  <p className="text-[11px] text-muted-foreground">Defina <a href="/categorias" className="text-primary font-semibold hover:underline">orçamentos por categoria</a> para acompanhar o ritmo de gastos</p>
                </div>
              )}
            </div>

            {/* Insight chips */}
            <div className="flex flex-wrap gap-2 pt-1 border-t border-border/40">
              {monthPace.totalBudget > 0 && (
                <div className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border',
                  monthPace.onTrack ? 'bg-income/10 text-income border-income/20' : 'bg-expense/10 text-expense border-expense/20',
                )}>
                  {monthPace.onTrack ? <Trophy className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                  {monthPace.onTrack ? 'No ritmo certo' : 'Acima do ritmo'}
                </div>
              )}
              {monthPace.paceVsPrev !== null && (
                <div className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border',
                  monthPace.paceVsPrev > 0 ? 'bg-warning/10 text-warning border-warning/20' : 'bg-income/10 text-income border-income/20',
                )}>
                  {monthPace.paceVsPrev > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {Math.abs(monthPace.paceVsPrev).toFixed(0)}% {monthPace.paceVsPrev > 0 ? 'mais rápido' : 'mais lento'} que mês anterior
                </div>
              )}
              {workTimeTotal && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border bg-muted/50 text-foreground/80 border-border/60">
                  <Clock className="w-3 h-3" /> {formatWorkTime(workTimeTotal)} de trabalho
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Comparativo Mês Anterior */}
        <div className="rounded-3xl border border-border/60 bg-card/70 backdrop-blur-sm p-5 sm:p-6 shadow-sm flex flex-col">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-info/20 to-info/5 flex items-center justify-center border border-info/15">
              <BarChart3 className="w-4 h-4 text-info" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold leading-tight">Mês a Mês</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">vs mês anterior</p>
            </div>
          </div>
          <div className="flex-1 min-h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthCompareData} margin={{ top: 6, right: 4, left: 4, bottom: 0 }} barCategoryGap="22%">
                <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.3} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <RechartsTooltip
                  cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <ChartTooltipCard
                        title={label as string}
                        rows={payload.map(p => ({
                          label: p.dataKey === 'atual' ? 'Atual' : 'Anterior',
                          value: maskCurrency(formatCurrency(Number(p.value))),
                          color: p.color,
                        }))}
                      />
                    );
                  }}
                />
                <Bar dataKey="anterior" radius={[6, 6, 0, 0]} fill="hsl(var(--muted-foreground) / 0.35)" />
                <Bar dataKey="atual" radius={[6, 6, 0, 0]}>
                  {monthCompareData.map((entry, i) => <Cell key={i} fill={entry.colorAtual} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-3 text-[10px] mt-2 pt-2 border-t border-border/40">
            <span className="flex items-center gap-1.5 text-muted-foreground"><span className="inline-block w-2 h-2 rounded-sm bg-muted-foreground/40" /> Anterior</span>
            <span className="flex items-center gap-1.5 text-foreground"><span className="inline-block w-2 h-2 rounded-sm bg-primary" /> Atual</span>
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
              <button onClick={() => setPendingModalOpen(true)} className="p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                <ChevronRight className="w-4 h-4" />
              </button>
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
            <a href="/planejamento" className="ml-auto text-xs text-primary hover:underline flex items-center gap-0.5 font-normal">
              Ver todos <ChevronRight className="w-3 h-3" />
            </a>
          </h3>
          <div className="flex-1 flex flex-col items-center justify-center">
            {budgetsWithData.length > 0 ? (
              <BudgetRings budgets={budgetsWithData} size={150} />
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-8 text-muted-foreground">
                <Target className="w-10 h-10 mb-3 opacity-20" />
                <p className="text-sm">Nenhum orçamento definido</p>
                <p className="text-xs mt-1">Configure limites nas suas categorias para acompanhar aqui.</p>
              </div>
            )}
          </div>
        </div>

        {/* Weekly Heatmap */}
        <div className="stat-card lg:col-span-1 flex flex-col">
          <h3 className="text-sm font-semibold mb-6 flex items-center gap-2">
            <BellRing className="w-4 h-4 text-primary" /> Intensidade de Gastos
          </h3>
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="w-full max-w-[280px]">
              {scopedExpenseHeatmapData.length > 0 ? (
                <WeeklyHeatmap 
                  month={currentMonthDate} 
                  data={scopedExpenseHeatmapData} 
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">Sem gastos neste mês</p>
                </div>
              )}
            </div>
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
                const cardExpense = t.type === 'expense' && isCreditCardExpense(t as Expense);
                return (
                  <div key={t.id} className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-muted/50 transition-all group -mx-2">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0 border',
                        t.type === 'income' ? 'bg-income/5 text-income border-income/10' : 'bg-expense/5 text-expense border-expense/10'
                      )}>
                        {t.type === 'income'
                          ? <ArrowUpRight className="w-3.5 h-3.5" />
                          : <ArrowDownRight className="w-3.5 h-3.5" />}
                      </div>
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="text-xs font-medium truncate">{t.description || (t.type === 'income' ? 'Receita' : 'Despesa')}</p>
                        <div className="flex items-center gap-1.5">
                          <p className="text-[10px] text-muted-foreground truncate">{formatDate(t.date)}</p>
                          <div className={cn('w-1.5 h-1.5 shrink-0 rounded-full', t.status === 'concluido' ? 'bg-success' : t.status === 'pendente' ? 'bg-warning' : 'bg-info')} />
                          {cardExpense && (
                            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
                              Cartao
                            </span>
                          )}
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

      {/* ── Category & Status Breakdown (Added Back) ────────── */}
      <div className="grid lg:grid-cols-2 gap-6 stagger-4">
        {/* Category Donut */}
        <div className="stat-card">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <div className="w-1.5 h-4 rounded-full bg-expense" />
            Por Categoria
          </h3>
          {catBreakdown.length > 0 ? (
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="relative w-40 h-40 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart accessibilityLayer={false}>
                    <Pie data={catBreakdown} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2} strokeWidth={0} isAnimationActive={false}>
                      {catBreakdown.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      cursor={false}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const item = payload[0]?.payload;
                        return (
                          <ChartTooltipCard
                            title={item?.name || 'Categoria'}
                            rows={[{ label: 'Valor', value: maskCurrency(formatCurrency(Number(item?.value || 0))), color: payload[0]?.color }]}
                          />
                        );
                      }}
                      wrapperStyle={{ outline: 'none', pointerEvents: 'none', zIndex: 20 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-[10px] text-muted-foreground">Total</p>
                  <p className="text-xs font-bold currency">{maskCurrency(formatCurrency(totalExpensesAll + totalCCThisMonth))}</p>
                </div>
              </div>
              <div className="w-full space-y-2">
                {catBreakdown.slice(0, 5).map((cat, i) => {
                  const combinedTotal = totalExpensesAll + totalCCThisMonth;
                  const pct = combinedTotal > 0 ? ((cat.value / combinedTotal) * 100) : 0;
                  return (
                    <div key={cat.name}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                          <span className="text-muted-foreground truncate max-w-[100px]">{cat.icon} {cat.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground font-medium w-6 text-right">{pct.toFixed(0)}%</span>
                          <span className="font-semibold currency w-16 text-right">{maskCurrency(formatCurrency(cat.value))}</span>
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

        {/* Status breakdown */}
        <div className="stat-card">
          <h3 className="text-sm font-semibold mb-6 flex items-center gap-2">
            <div className="w-1.5 h-4 rounded-full bg-primary" />
            Despesas por Status
          </h3>
          {statusData.length > 0 ? (
            <div className="flex flex-col gap-4">
              {/* Stacked Progress Bar */}
              <div className="w-full h-3 rounded-full flex overflow-hidden bg-muted mb-2 shadow-inner">
                {statusData.map(s => {
                  const statusTotal = statusData.reduce((acc, d) => acc + d.value, 0);
                  const pct = statusTotal > 0 ? (s.value / statusTotal) * 100 : 0;
                  return (
                    <div
                      key={`stack-${s.name}`}
                      className="h-full transition-all duration-1000 ease-out"
                      style={{ width: `${pct}%`, backgroundColor: s.fill }}
                    />
                  );
                })}
              </div>

              {/* Status List */}
              <div className="space-y-3">
                {statusData.map(s => {
                  const statusGrandTotal = statusData.reduce((acc, d) => acc + d.value, 0);
                  const pct = statusGrandTotal > 0 ? (s.value / statusGrandTotal) * 100 : 0;
                  return (
                    <div key={s.name} className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/50 hover:bg-muted/40 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: s.fill, boxShadow: `0 0 8px ${s.fill}` }} />
                        <span className="text-sm font-semibold text-foreground/90">{s.name}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="font-bold currency text-sm">{maskCurrency(formatCurrency(s.value))}</span>
                        <span className="text-[10px] text-muted-foreground font-medium">{pct.toFixed(0)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-10">
              <div className="w-8 h-8 rounded-full bg-muted/50 mx-auto flex items-center justify-center mb-2">
                <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
              </div>
              <p className="text-sm text-muted-foreground">Sem despesas registradas</p>
            </div>
          )}
        </div>
      </div>


      {/* ─── Top Movimentos do Mês ─── */}
      {(topExpenses.length > 0 || topIncomes.length > 0) && (() => {
        const showAllocationFiller = topExpenses.length > 0 && topIncomes.length === 0 && allocationData.length > 0 && focusedInvestmentTotal > 0;
        const showIncomeFiller = topIncomes.length > 0 && topExpenses.length === 0;
        return (
        <div className="grid lg:grid-cols-2 gap-6 stagger-4">
          {/* Top Despesas */}
          {topExpenses.length > 0 && (
            <div className="rounded-3xl border border-border/60 bg-card/70 backdrop-blur-sm p-5 sm:p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4 gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-expense/20 to-expense/5 flex items-center justify-center border border-expense/15">
                    <Flame className="w-4 h-4 text-expense" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold leading-tight">Maiores Despesas</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Top 5 do mês</p>
                  </div>
                </div>
                <a href="/despesas" className="text-[11px] text-primary hover:underline font-medium flex items-center gap-0.5">
                  Ver todas <ChevronRight className="w-3 h-3" />
                </a>
              </div>
              <div className="space-y-2.5">
                {topExpenses.map((tx, idx) => {
                  const cat = categories.find(c => c.id === tx.category_id);
                  const maxValue = topExpenses[0].amount;
                  const pct = maxValue > 0 ? (tx.amount / maxValue) * 100 : 0;
                  return (
                    <div key={`${tx.kind}-${tx.id}`} className="group relative">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className={cn(
                            'w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-extrabold shrink-0',
                            idx === 0 ? 'bg-gradient-to-br from-expense to-expense/70 text-white shadow-sm shadow-expense/30' :
                            idx === 1 ? 'bg-expense/15 text-expense border border-expense/25' :
                            'bg-muted text-muted-foreground border border-border/60',
                          )}>
                            #{idx + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <p className="text-[13px] font-semibold truncate min-w-0 flex-1">{tx.description}</p>
                              {tx.kind === 'cc' && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-[#6366f1]/10 text-[#6366f1] border border-[#6366f1]/20 font-bold shrink-0">CARTÃO</span>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                              {cat ? `${cat.icon} ${cat.name}` : 'Sem categoria'} · {formatDate(tx.date)}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm font-extrabold currency text-expense tabular-nums shrink-0 whitespace-nowrap">{maskCurrency(formatCurrency(tx.amount))}</p>
                      </div>
                      <div className="h-1 bg-muted/60 rounded-full overflow-hidden ml-9">
                        <div className="h-full bg-gradient-to-r from-expense/40 to-expense/80 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Allocation as filler when no incomes */}
          {showAllocationFiller && (
            <div className="rounded-3xl border border-border/60 bg-card/70 backdrop-blur-sm p-5 sm:p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4 gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-info/20 to-info/5 flex items-center justify-center border border-info/15">
                    <PiggyBank className="w-4 h-4 text-info" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold leading-tight">Alocação do Patrimônio</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Contas vs Investimentos</p>
                  </div>
                </div>
                <a href="/investimentos" className="text-[11px] text-primary hover:underline font-medium flex items-center gap-0.5">
                  Detalhes <ChevronRight className="w-3 h-3" />
                </a>
              </div>
              <div className="flex flex-col items-center gap-4">
                <div className="relative w-40 h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={allocationData} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={3} strokeWidth={0}>
                        {allocationData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                      </Pie>
                      <RechartsTooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const item = payload[0]?.payload;
                          return <ChartTooltipCard title={item?.name} rows={[{ label: 'Valor', value: maskCurrency(formatCurrency(Number(item?.value || 0))), color: payload[0]?.color }]} />;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Total</p>
                    <p className="text-sm font-extrabold currency tabular-nums whitespace-nowrap">{maskCurrency(formatCurrency(netWorth))}</p>
                  </div>
                </div>
                <div className="w-full space-y-2.5">
                  {allocationData.map(d => {
                    const pct = netWorth > 0 ? (d.value / netWorth) * 100 : 0;
                    return (
                      <div key={d.name}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
                            <span className="text-xs font-semibold">{d.name}</span>
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-xs font-extrabold currency tabular-nums whitespace-nowrap">{maskCurrency(formatCurrency(d.value))}</span>
                            <span className="text-[10px] text-muted-foreground font-semibold">{pct.toFixed(1)}%</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: d.fill }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Empty filler when no expenses but have incomes */}
          {showIncomeFiller && (
            <div className="rounded-3xl border border-dashed border-border/40 bg-muted/10 p-10 flex flex-col items-center justify-center text-center">
              <Trophy className="w-10 h-10 text-income/40 mb-3" />
              <p className="text-sm font-bold text-foreground">Nenhuma despesa neste mês</p>
              <p className="text-xs text-muted-foreground mt-1">Continue assim — sua economia agradece!</p>
            </div>
          )}

          {/* Top Receitas */}
          {topIncomes.length > 0 && (
            <div className="rounded-3xl border border-border/60 bg-card/70 backdrop-blur-sm p-5 sm:p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4 gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-income/20 to-income/5 flex items-center justify-center border border-income/15">
                    <TrendingUp className="w-4 h-4 text-income" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold leading-tight">Maiores Receitas</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Top 5 do mês</p>
                  </div>
                </div>
                <a href="/receitas" className="text-[11px] text-primary hover:underline font-medium flex items-center gap-0.5">
                  Ver todas <ChevronRight className="w-3 h-3" />
                </a>
              </div>
              <div className="space-y-2.5">
                {topIncomes.map((tx, idx) => {
                  const cat = categories.find(c => c.id === tx.category_id);
                  const maxValue = Number(topIncomes[0].amount);
                  const pct = maxValue > 0 ? (Number(tx.amount) / maxValue) * 100 : 0;
                  return (
                    <div key={tx.id} className="group relative">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className={cn(
                            'w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-extrabold shrink-0',
                            idx === 0 ? 'bg-gradient-to-br from-income to-income/70 text-white shadow-sm shadow-income/30' :
                            idx === 1 ? 'bg-income/15 text-income border border-income/25' :
                            'bg-muted text-muted-foreground border border-border/60',
                          )}>
                            #{idx + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-semibold truncate">{tx.description || 'Receita'}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                              {cat ? `${cat.icon} ${cat.name}` : 'Sem categoria'} · {formatDate(tx.date)}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm font-extrabold currency text-income tabular-nums shrink-0 whitespace-nowrap">{maskCurrency(formatCurrency(Number(tx.amount)))}</p>
                      </div>
                      <div className="h-1 bg-muted/60 rounded-full overflow-hidden ml-9">
                        <div className="h-full bg-gradient-to-r from-income/40 to-income/80 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        );
      })()}

      {/* ─── Allocation Patrimônio (skip when already shown as filler) ─── */}
      {allocationData.length > 0 && focusedInvestmentTotal > 0 && !(topExpenses.length > 0 && topIncomes.length === 0) && (
        <div className="rounded-3xl border border-border/60 bg-card/70 backdrop-blur-sm p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4 gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-info/20 to-info/5 flex items-center justify-center border border-info/15">
                <PiggyBank className="w-4 h-4 text-info" />
              </div>
              <div>
                <h3 className="text-sm font-bold leading-tight">Alocação do Patrimônio</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Como seu dinheiro está distribuído</p>
              </div>
            </div>
            <a href="/investimentos" className="text-[11px] text-primary hover:underline font-medium flex items-center gap-0.5">
              Investimentos <ChevronRight className="w-3 h-3" />
            </a>
          </div>
          <div className="grid sm:grid-cols-[180px_1fr] gap-6 items-center">
            <div className="relative w-44 h-44 mx-auto">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={allocationData} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} strokeWidth={0}>
                    {allocationData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const item = payload[0]?.payload;
                      return <ChartTooltipCard title={item?.name} rows={[{ label: 'Valor', value: maskCurrency(formatCurrency(Number(item?.value || 0))), color: payload[0]?.color }]} />;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total</p>
                <p className="text-base font-extrabold currency tabular-nums">{maskCurrency(formatCurrency(netWorth))}</p>
              </div>
            </div>
            <div className="space-y-3">
              {allocationData.map(d => {
                const pct = netWorth > 0 ? (d.value / netWorth) * 100 : 0;
                return (
                  <div key={d.name}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.fill }} />
                        <span className="text-sm font-semibold">{d.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-extrabold currency tabular-nums">{maskCurrency(formatCurrency(d.value))}</p>
                        <p className="text-[10px] text-muted-foreground font-semibold">{pct.toFixed(1)}%</p>
                      </div>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: d.fill }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Cash Flow Projection ────────────────────────────── */}
      <div className="stagger-5">
        <CashFlowForecast />
      </div>

      {/* ── Achievements ───────────────────────────────────── */}
      <div className="stagger-6">
        <Achievements expenses={scopedNonCCExpenses} income={scopedIncome} categories={categories} />
      </div>

      {editing && (
        <EditTransactionDialog
          open={!!editing}
          onOpenChange={(open) => !open && setEditing(null)}
          transaction={editing}
        />
      )}

      <PendingExpensesDialog 
        open={pendingModalOpen} 
        onOpenChange={setPendingModalOpen} 
        expenses={scopedNonCCExpenses} 
      />
    </div>
  );
}


