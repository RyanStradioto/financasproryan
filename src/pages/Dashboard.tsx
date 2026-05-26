import { useState, useMemo, type ReactNode } from 'react';
import { TrendingUp, TrendingDown, Wallet, PiggyBank, BarChart3, ArrowUpRight, ArrowDownRight, Target, Clock, ChevronRight, BellRing, CreditCard, Activity, CalendarRange, Flame, Trophy, AlertTriangle, ShieldCheck, Gauge, Landmark, BrainCircuit } from 'lucide-react';
import { useIncome, useExpenses, useAccounts, useCategoryAccountBudgets, type Income, type Expense } from '@/hooks/useFinanceData';
import { useNetWorth } from '@/hooks/useInvestments';
import { useCCTransactionsForMonth, useCreditCards, useCreditCardTransactions } from '@/hooks/useCreditCards';
import { getMonthYear, formatCurrency, formatDate, getStatusColor, getStatusLabel } from '@/lib/format';
import MonthSelector from '@/components/finance/MonthSelector';
import TransactionDialog from '@/components/finance/TransactionDialog';
import EditTransactionDialog from '@/components/finance/EditTransactionDialog';
import EconomyGauge from '@/components/finance/EconomyGauge';
import BudgetRings from '@/components/finance/BudgetRings';
import WeeklyHeatmap from '@/components/finance/WeeklyHeatmap';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ComposedChart, Area, Line } from 'recharts';
import { useCategories } from '@/hooks/useFinanceData';
import { useAccumulatedBalance } from '@/hooks/useAccumulatedBalance';
import { useWorkTimeCalc, useProfile } from '@/hooks/useProfile';
import { formatWorkTime } from '@/lib/workTime';
import { cn } from '@/lib/utils';
import { useSensitiveData } from '@/components/finance/SensitiveData';
import PendingExpensesDialog from '@/components/finance/PendingExpensesDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { buildDescriptionAmountKey, buildExpenseMatchKey, detectCreditCardExpense, parseStructuredCardMarker } from '@/lib/paymentMethod';
import { accountBrandFromRow, resolveAccountBrand } from '@/lib/accountBrand';
import {
  computeAllowance, computeBurnRate, detectAnomalies, detectRecurring,
  computeCategoryDeltas, aggregatePixCounterparties, buildExecutiveSummary,
} from '@/lib/dashboardAnalytics';
import AllowanceCard from '@/components/dashboard/AllowanceCard';
import ExecutiveSummary from '@/components/dashboard/ExecutiveSummary';
import BurnRateChart from '@/components/dashboard/BurnRateChart';
import TopCategoriesDelta from '@/components/dashboard/TopCategoriesDelta';
import RecurringExpenses from '@/components/dashboard/RecurringExpenses';
import AnomalyAlerts from '@/components/dashboard/AnomalyAlerts';
import PixCounters from '@/components/dashboard/PixCounters';
import StickySummaryBar from '@/components/dashboard/StickySummaryBar';
import SixMonthStack from '@/components/dashboard/SixMonthStack';
import SectionHeader from '@/components/dashboard/SectionHeader';
import DailyFlowChart from '@/components/dashboard/DailyFlowChart';
import KpiCard from '@/components/dashboard/KpiCard';
import BrandLogoBadge from '@/components/dashboard/BrandLogoBadge';
import ErrorBoundary from '@/components/ErrorBoundary';
import { colorWithOpacity } from '@/lib/colors';

/** Safe wrapper: runs an analytics fn and returns a fallback if it throws. */
function safeRun<T>(fn: () => T, fallback: T, label?: string): T {
  try {
    return fn();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[dashboard analytics]', label || 'unknown', e);
    return fallback;
  }
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



export default function Dashboard() {
  const { maskCurrency, maskText, isVisible } = useSensitiveData();
  const [month, setMonth] = useState(getMonthYear());
  const [accountFocusId, setAccountFocusId] = useState<string>('__all__');
  const { data: profile } = useProfile();
  
  // Previous month string (for MoM comparisons)
  const prevMonth = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, [month]);

  const { data: income = [] } = useIncome(month);
  const { data: expenses = [] } = useExpenses(month);
  const { data: allIncome = [] } = useIncome();
  const { data: allExpenses = [] } = useExpenses();
  const { data: prevIncome = [] } = useIncome(prevMonth);
  const { data: prevExpenses = [] } = useExpenses(prevMonth);
  const { data: prevCCTransactions = [] } = useCCTransactionsForMonth(prevMonth);
  const { data: categories = [] } = useCategories();
  const { data: accounts = [] } = useAccounts();
  const { data: categoryAccountBudgets = [] } = useCategoryAccountBudgets();
  const { data: creditCards = [] } = useCreditCards();
  const { data: creditTransactions = [] } = useCreditCardTransactions();
  const { investmentTotal } = useNetWorth();
  const { data: accumulatedData } = useAccumulatedBalance(month);
  const accumulatedBalance = accumulatedData?.total || 0;
  const accumulatedByAccount = accumulatedData?.byAccount || {};
  const orphanExpensesTotal = accumulatedData?.orphanExpensesTotal || 0;
  const orphanIncomeTotal   = accumulatedData?.orphanIncomeTotal || 0;
  const orphanExpensesCount = accumulatedData?.orphanExpensesCount || 0;
  const orphanIncomeCount   = accumulatedData?.orphanIncomeCount || 0;
  const { data: ccTransactions = [] } = useCCTransactionsForMonth(month);
  const { calcWorkTime, hourlyRate } = useWorkTimeCalc();

  const [editing, setEditing] = useState<((Income & { type: 'income' }) | (Expense & { type: 'expense' })) | null>(null);
  const [orphanFixOpen, setOrphanFixOpen] = useState(false);
  const [orphanFixAccountId, setOrphanFixAccountId] = useState('');
  const [orphanFixBusy, setOrphanFixBusy] = useState(false);
  const orphanQc = useQueryClient();
  const { user: orphanUser } = useAuth();

  const handleFixOrphans = async () => {
    if (!orphanFixAccountId || !orphanUser) return;
    setOrphanFixBusy(true);
    try {
      // Update all expenses with null account_id, NOT being CC mirrors, status concluido
      const { data: orphans, error: selErr } = await supabase
        .from('expenses')
        .select('id, notes')
        .is('account_id', null)
        .eq('status', 'concluido')
        .eq('user_id', orphanUser.id);
      if (selErr) throw selErr;
      // Filter out CC mirror rows (those have notes starting with [Cartao de credito|card:)
      const idsToFix = (orphans || [])
        .filter(o => !o.notes?.includes('[Cartao de credito|card:'))
        .map(o => o.id);
      if (idsToFix.length === 0) {
        toast.info('Nada para corrigir');
        setOrphanFixOpen(false);
        return;
      }
      const { error: updErr } = await supabase
        .from('expenses')
        .update({ account_id: orphanFixAccountId })
        .in('id', idsToFix);
      if (updErr) throw updErr;
      toast.success(`${idsToFix.length} despesa(s) atualizada(s) com sucesso!`);
      setOrphanFixOpen(false);
      orphanQc.invalidateQueries({ queryKey: ['expenses'] });
      orphanQc.invalidateQueries({ queryKey: ['accumulated-balance'] });
    } catch (e) {
      toast.error('Erro: ' + (e as Error).message);
    } finally {
      setOrphanFixBusy(false);
    }
  };
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
  const scopedCCTransactions = useMemo(() => {
    if (accountFocusId === '__all__') return ccTransactions;
    const account = accounts.find(a => a.id === accountFocusId);
    if (!account) return [];
    const accBrand = resolveAccountBrand(account.name).name;
    const matchingCardIds = creditCards
      .filter(c => resolveAccountBrand(c.name).name === accBrand)
      .map(c => c.id);
    return ccTransactions.filter(t => matchingCardIds.includes(t.credit_card_id));
  }, [ccTransactions, accountFocusId, accounts, creditCards]);
  const scopedPrevIncome = useMemo(
    () => (accountFocusId === '__all__' ? prevIncome : prevIncome.filter(i => i.account_id === accountFocusId)),
    [prevIncome, accountFocusId],
  );
  const scopedPrevNonCCExpenses = useMemo(() => {
    const base = prevExpenses.filter(e => !isCreditCardExpense(e));
    return accountFocusId === '__all__' ? base : base.filter(e => e.account_id === accountFocusId);
  }, [prevExpenses, accountFocusId, creditCards, accounts]);
  const scopedPrevCCTransactions = useMemo(() => {
    if (accountFocusId === '__all__') return prevCCTransactions;
    const account = accounts.find(a => a.id === accountFocusId);
    if (!account) return [];
    const accBrand = resolveAccountBrand(account.name).name;
    const matchingCardIds = creditCards
      .filter(c => resolveAccountBrand(c.name).name === accBrand)
      .map(c => c.id);
    return prevCCTransactions.filter(t => matchingCardIds.includes(t.credit_card_id));
  }, [prevCCTransactions, accountFocusId, accounts, creditCards]);

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

  // -"€-"€ Core numbers -"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€
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

  // Unpaid CC bills (past + current month) — these are obligations not yet reflected in account balance
  const unpaidCCTotal = useMemo(() => {
    return creditTransactions
      .filter(t => !t.paid && t.bill_month <= month)
      .reduce((s, t) => s + Number(t.amount), 0);
  }, [creditTransactions, month]);

  const savings = totalIncome > 0 ? ((totalIncome - totalExpensesPaid) / totalIncome) * 100 : 0;

  // -"€-"€ Category breakdown: nonCC expenses + CC transactions (sem dupla contagem) -"€-"€-"€
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

  // -"€-"€ Status breakdown: apenas despesas normais (sem espelhos CC) + Fatura CC -"€-"€-"€
  const statusData = useMemo(() => [
    { name: 'Concluído', value: scopedNonCCExpenses.filter(e => e.status === 'concluido').reduce((s, e) => s + Number(e.amount), 0), fill: 'hsl(160, 84%, 39%)' },
    { name: 'Pendente',  value: scopedNonCCExpenses.filter(e => e.status === 'pendente').reduce((s, e) => s + Number(e.amount), 0),  fill: 'hsl(38, 92%, 50%)' },
    { name: 'Agendado',  value: scopedNonCCExpenses.filter(e => e.status === 'agendado').reduce((s, e) => s + Number(e.amount), 0),  fill: 'hsl(217, 91%, 60%)' },
    ...(totalCCThisMonth > 0 ? [{ name: 'Fatura CC', value: totalCCThisMonth, fill: '#6366f1' }] : []),
  ].filter(s => s.value > 0), [scopedNonCCExpenses, totalCCThisMonth]);

  // -"€-"€ Sparkline data (Last 30 days of the selected month) -"€-"€-"€-"€-"€
  const getDailyTrend = (data: Array<Record<string, string | number | null>>, dateField = 'date') => {
    // Basic grouping for the visual sparkline
    const sorted = [...data].sort((a, b) => new Date(String(a[dateField] ?? "")).getTime() - new Date(String(b[dateField] ?? "")).getTime());
    const daily: Record<string, number> = {};
    sorted.forEach(item => { const key = String(item[dateField] ?? ""); daily[key] = (daily[key] || 0) + Number(item.amount); });
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

  // -"€-"€ Budget progress for Rings: nonCC expenses + CC transactions por categoria -"€-"€
  const budgetsWithData = useMemo(() =>
    categories.filter(c => Number(c.monthly_budget) > 0).map(cat => {
      const spentRegular = scopedNonCCExpenses.filter(e => resolveCategoryId(e) === cat.id).reduce((s, e) => s + Number(e.amount), 0);
      const spentCC = scopedCCTransactions.filter(t => t.category_id === cat.id).reduce((s, t) => s + Number(t.amount), 0);
      const spent = spentRegular + spentCC;
      const budget = Number(cat.monthly_budget);
      return { ...cat, spent, budget };
    }).sort((a, b) => b.budget - a.budget)
  , [categories, scopedNonCCExpenses, scopedCCTransactions, categoryByTxId, categoryByMatchKey, categoryByLooseKey]);

  const scopedExpenseHeatmapData = useMemo(() => [
    ...scopedNonCCExpenses
      .filter(e => e.status === 'concluido')
      .map(e => ({ date: e.date, amount: Number(e.amount) })),
    ...scopedCCTransactions.map(t => ({ date: t.date, amount: Number(t.amount) })),
  ], [scopedNonCCExpenses, scopedCCTransactions]);

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
        const balance = accumulatedByAccount[acc.id] || 0;
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
  const focusLabel = isGlobalView ? 'Todas as contas' : focusedAccountInsight?.acc.name || 'Conta foco';

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

  // -"€-"€ Previous month totals (for MoM deltas) -"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€
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
  // "Sobra do mês" — receitas escopadas menos despesas escopadas. Definido
  // cedo para que o cálculo do Allowance use o valor já escopado por conta.
  const monthResult = totalIncome - currentTotalAll;

  // Percent delta helper (current vs previous, returns null when prev = 0)
  const pctDelta = (cur: number, prev: number): number | null => {
    if (prev === 0) return cur > 0 ? 100 : null;
    return ((cur - prev) / prev) * 100;
  };

  const incomeDelta = pctDelta(totalIncome, prevTotalIncome);
  const expenseDelta = pctDelta(currentTotalAll, prevTotalAll);
  const ccDelta = pctDelta(totalCCThisMonth, prevTotalCC);

  // ── Visão do Mês: Pace tracker ─────────────────────────────────
  const focusedBudget = useMemo(() => {
    if (accountFocusId === '__all__') {
      return categories.reduce((s, c) => s + (Number(c.monthly_budget) || 0), 0);
    }

    const splitBudget = categoryAccountBudgets
      .filter((budget) => budget.account_id === accountFocusId)
      .reduce((s, budget) => s + Number(budget.monthly_budget || 0), 0);

    return splitBudget > 0
      ? splitBudget
      : categories.reduce((s, c) => s + (Number(c.monthly_budget) || 0), 0);
  }, [accountFocusId, categories, categoryAccountBudgets]);

  const monthPace = useMemo(() => {
    const today = new Date();
    const [y, m] = month.split('-').map(Number);
    const isCurrentMonth = today.getFullYear() === y && (today.getMonth() + 1) === m;
    const lastDayOfMonth = new Date(y, m, 0).getDate();
    const dayOfMonth = isCurrentMonth ? today.getDate() : lastDayOfMonth;
    const monthProgress = (dayOfMonth / lastDayOfMonth) * 100;

    const totalBudget = focusedBudget;
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
  }, [month, focusedBudget, currentTotalAll, scopedPrevNonCCExpenses, scopedPrevCCTransactions]);

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

  // -"€-"€ Comparativo Mensal: bars -"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€
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

  // ── Allocation: Contas vs Investimentos ─────────────────────────────────
  const allocationData = useMemo(() => {
    const items = [];
    if (balance > 0) items.push({ name: 'Contas', value: balance, fill: 'hsl(160, 84%, 39%)' });
    if (focusedInvestmentTotal > 0) items.push({ name: 'Investimentos', value: focusedInvestmentTotal, fill: 'hsl(217, 91%, 60%)' });
    return items;
  }, [balance, focusedInvestmentTotal]);

  // ── New Analytics: Allowance, Burn Rate, Anomalies, Recurring, Deltas, Pix ──
  const todaySpent = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const exp = scopedNonCCExpenses
      .filter(e => e.status === 'concluido' && e.date === todayStr)
      .reduce((s, e) => s + Number(e.amount), 0);
    const cc = scopedCCTransactions
      .filter(t => t.date === todayStr)
      .reduce((s, t) => s + Number(t.amount), 0);
    return exp + cc;
  }, [scopedNonCCExpenses, scopedCCTransactions]);

  // Allowance "permitido por dia até o fim do mês".
  //
  // Como o orçamento por categoria (monthPace.totalBudget) é GLOBAL e não tem
  // como ser fatiado por conta, usar ele direto causava valores absurdos ao
  // trocar de conta foco (ex.: ALELO com saldo R$ 1,99 mostrando R$ 584/dia).
  //
  // Usamos a "sobra do mês" (receitas escopadas − despesas escopadas) como
  // o teto a distribuir nos dias restantes. Isso funciona tanto no modo
  // consolidado quanto por conta sem precisar de orçamento configurado.
  // Quando o usuário tem orçamento global definido E está na visão geral,
  // mantemos o teto pelo menor entre "sobra restante" e "orçamento restante"
  // — assim o limite continua respeitando metas configuradas.
  const allowance = useMemo(() => safeRun(() => {
    const remainingFromIncome = Math.max(0, monthResult);
    const remainingFromBudget = monthPace.totalBudget > 0
      ? Math.max(0, monthPace.totalBudget - currentTotalAll)
      : Number.POSITIVE_INFINITY;
    // Use o teto que for menor — não permite gastar acima do orçamento.
    const useBudgetCap = isGlobalView && monthPace.totalBudget > 0;
    const budgetForAllowance = useBudgetCap
      ? Math.min(remainingFromIncome, remainingFromBudget) + currentTotalAll
      : monthResult + currentTotalAll; // = totalIncome (escopado)
    return computeAllowance({
      monthBudget: budgetForAllowance,
      monthSpent: currentTotalAll,
      dayOfMonth: monthPace.dayOfMonth,
      lastDayOfMonth: monthPace.lastDayOfMonth,
      todaySpent,
    });
  }, {
    remainingDays: 30, remainingBudget: 0, perDayAllowance: 0,
    todayAllowanceRemaining: 0, todaySpent: 0, monthBudget: 0, monthSpent: 0,
  }, 'allowance'), [monthPace, currentTotalAll, todaySpent, monthResult, isGlobalView]);

  const burnRate = useMemo(() => safeRun(() => {
    const allMonthExpenses = [
      ...scopedNonCCExpenses
        .filter(e => e.status === 'concluido')
        .map(e => ({ amount: Number(e.amount), date: e.date })),
      ...scopedCCTransactions.map(t => ({ amount: Number(t.amount), date: t.date })),
    ];
    return computeBurnRate({
      expenses: allMonthExpenses,
      monthBudget: monthPace.totalBudget,
      dayOfMonth: monthPace.dayOfMonth,
      lastDayOfMonth: monthPace.lastDayOfMonth,
      monthYYYYMM: month,
    });
  }, { points: [], projectedTotal: 0, willOverrun: false }, 'burnRate'),
  [scopedNonCCExpenses, scopedCCTransactions, monthPace, month]);

  const anomalies = useMemo(() => safeRun(() => {
    const currentExp = [
      ...scopedNonCCExpenses.filter(e => e.status === 'concluido').map(e => ({
        amount: Number(e.amount), date: e.date, description: e.description, category_id: resolveCategoryId(e), notes: e.notes,
      })),
      ...scopedCCTransactions.map(t => ({
        amount: Number(t.amount), date: t.date, description: t.description, category_id: t.category_id, notes: t.notes,
      })),
    ];
    const histExp = [
      ...scopedPrevNonCCExpenses.filter(e => e.status === 'concluido').map(e => ({
        amount: Number(e.amount), date: e.date, description: e.description, category_id: resolveCategoryId(e), notes: e.notes,
      })),
      ...scopedPrevCCTransactions.map(t => ({
        amount: Number(t.amount), date: t.date, description: t.description, category_id: t.category_id, notes: t.notes,
      })),
    ];
    return detectAnomalies({ currentExpenses: currentExp, historicalExpenses: histExp });
  }, [], 'anomalies'),
  [scopedNonCCExpenses, scopedCCTransactions, scopedPrevNonCCExpenses, scopedPrevCCTransactions, categoryByTxId, categoryByMatchKey, categoryByLooseKey]);

  const recurring = useMemo(() => safeRun(() => {
    const pool = [
      ...scopedNonCCExpenses.map(e => ({
        amount: Number(e.amount), date: e.date, description: e.description, category_id: resolveCategoryId(e),
      })),
      ...scopedCCTransactions.map(t => ({
        amount: Number(t.amount), date: t.date, description: t.description, category_id: t.category_id,
      })),
      ...scopedPrevNonCCExpenses.map(e => ({
        amount: Number(e.amount), date: e.date, description: e.description, category_id: resolveCategoryId(e),
      })),
      ...scopedPrevCCTransactions.map(t => ({
        amount: Number(t.amount), date: t.date, description: t.description, category_id: t.category_id,
      })),
    ];
    return detectRecurring({ expenses: pool, minOccurrences: 3 });
  }, [], 'recurring'),
  [scopedNonCCExpenses, scopedCCTransactions, scopedPrevNonCCExpenses, scopedPrevCCTransactions, categoryByTxId, categoryByMatchKey, categoryByLooseKey]);

  const categoryDeltas = useMemo(() => safeRun(() => {
    const cur = [
      ...scopedNonCCExpenses.filter(e => e.status === 'concluido').map(e => ({
        amount: Number(e.amount), date: e.date, category_id: resolveCategoryId(e),
      })),
      ...scopedCCTransactions.map(t => ({
        amount: Number(t.amount), date: t.date, category_id: t.category_id,
      })),
    ];
    const prev = [
      ...scopedPrevNonCCExpenses.filter(e => e.status === 'concluido').map(e => ({
        amount: Number(e.amount), date: e.date, category_id: resolveCategoryId(e),
      })),
      ...scopedPrevCCTransactions.map(t => ({
        amount: Number(t.amount), date: t.date, category_id: t.category_id,
      })),
    ];
    return computeCategoryDeltas({ currentExpenses: cur, previousExpenses: prev });
  }, [], 'categoryDeltas'),
  [scopedNonCCExpenses, scopedCCTransactions, scopedPrevNonCCExpenses, scopedPrevCCTransactions, categoryByTxId, categoryByMatchKey, categoryByLooseKey]);

  const pixCounterparties = useMemo(() => safeRun(() => aggregatePixCounterparties({
    income: scopedIncome.map(i => ({ amount: Number(i.amount), date: i.date, description: i.description, category_id: i.category_id })),
    expenses: scopedNonCCExpenses.map(e => ({ amount: Number(e.amount), date: e.date, description: e.description, category_id: e.category_id })),
  }), [], 'pix'), [scopedIncome, scopedNonCCExpenses]);

  // Six-month overview (current month + 5 previous)
  const sixMonthData = useMemo(() => {
    const result: Array<{ month: string; label: string; income: number; expenses: number; sobra: number }> = [];
    const [y, m] = month.split('-').map(Number);
    const monthLabels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const monthKeys = new Set<string>();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(y, m - 1 - i, 1);
      monthKeys.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    const focusedCardIds = (() => {
      if (accountFocusId === '__all__') return null;
      const account = accounts.find(a => a.id === accountFocusId);
      if (!account) return [];
      const accBrand = resolveAccountBrand(account.name).name;
      return creditCards
        .filter(c => resolveAccountBrand(c.name).name === accBrand)
        .map(c => c.id);
    })();

    const byMonth = new Map<string, { income: number; expenses: number; hasData: boolean }>();
    const ensureMonth = (monthKey: string) => {
      const current = byMonth.get(monthKey) || { income: 0, expenses: 0, hasData: false };
      byMonth.set(monthKey, current);
      return current;
    };

    allIncome
      .filter(i => i.status === 'concluido')
      .filter(i => accountFocusId === '__all__' || i.account_id === accountFocusId)
      .forEach(i => {
        const monthKey = i.date?.slice(0, 7);
        if (!monthKeys.has(monthKey)) return;
        const row = ensureMonth(monthKey);
        row.income += Number(i.amount);
        row.hasData = true;
      });

    allExpenses
      .filter(e => !isCreditCardExpense(e))
      .filter(e => e.status === 'concluido')
      .filter(e => accountFocusId === '__all__' || e.account_id === accountFocusId)
      .forEach(e => {
        const monthKey = e.date?.slice(0, 7);
        if (!monthKeys.has(monthKey)) return;
        const row = ensureMonth(monthKey);
        row.expenses += Number(e.amount);
        row.hasData = true;
      });

    creditTransactions
      .filter(t => monthKeys.has(t.bill_month))
      .filter(t => !focusedCardIds || focusedCardIds.includes(t.credit_card_id))
      .forEach(t => {
        const row = ensureMonth(t.bill_month);
        row.expenses += Number(t.amount);
        row.hasData = true;
      });

    [...monthKeys].forEach(monthKey => {
      const values = byMonth.get(monthKey);
      if (!values?.hasData) return;
      const [yy, mm] = monthKey.split('-').map(Number);
      result.push({
        month: monthKey,
        label: `${monthLabels[mm - 1]}/${String(yy).slice(2)}`,
        income: values.income,
        expenses: values.expenses,
        sobra: values.income - values.expenses,
      });
    });

    return result;
  }, [month, allIncome, allExpenses, creditTransactions, accountFocusId, accounts, creditCards]);

  const evolutionSummary = useMemo(() => {
    const current = sixMonthData[sixMonthData.length - 1] || { income: 0, expenses: 0, sobra: 0 };
    const previous = sixMonthData[sixMonthData.length - 2];
    return {
      currentIncome: current.income,
      currentExpenses: current.expenses,
      currentBalance: current.sobra,
      incomeDelta: previous ? pctDelta(current.income, previous.income) : null,
      expensesDelta: previous ? pctDelta(current.expenses, previous.expenses) : null,
      balanceDelta: previous ? current.sobra - previous.sobra : null,
    };
  }, [sixMonthData]);

  const weeklyFlowData = useMemo(() => {
    const [year, monthNumber] = month.split('-').map(Number);
    const lastDay = new Date(year, monthNumber, 0).getDate();
    const weeks = Array.from({ length: Math.ceil(lastDay / 7) }, (_, index) => {
      const start = index * 7 + 1;
      const end = Math.min(start + 6, lastDay);
      return {
        week: `S${index + 1}`,
        range: `${String(start).padStart(2, '0')}-${String(end).padStart(2, '0')}`,
        income: 0,
        expenses: 0,
        balance: 0,
      };
    });

    const getWeekIndex = (date?: string | null) => {
      if (!date?.startsWith(month)) return -1;
      const day = Number(date.slice(8, 10));
      if (!Number.isFinite(day) || day < 1) return -1;
      return Math.min(weeks.length - 1, Math.floor((day - 1) / 7));
    };

    scopedIncome
      .filter(i => i.status === 'concluido')
      .forEach(i => {
        const index = getWeekIndex(i.date);
        if (index >= 0) weeks[index].income += Number(i.amount);
      });

    scopedNonCCExpenses
      .filter(e => e.status === 'concluido')
      .forEach(e => {
        const index = getWeekIndex(e.date);
        if (index >= 0) weeks[index].expenses += Number(e.amount);
      });

    scopedCCTransactions.forEach(t => {
      const index = getWeekIndex(t.date);
      if (index >= 0) weeks[index].expenses += Number(t.amount);
    });

    return weeks.map(week => ({ ...week, balance: week.income - week.expenses }));
  }, [month, scopedIncome, scopedNonCCExpenses, scopedCCTransactions]);

  const weeklyFlowSummary = useMemo(() => {
    const activeWeeks = weeklyFlowData.filter(week => week.income > 0 || week.expenses > 0);
    const source = activeWeeks.length > 0 ? activeWeeks : weeklyFlowData;
    const bestWeek = source.reduce((best, week) => week.balance > best.balance ? week : best, source[0]);
    const heaviestWeek = source.reduce((max, week) => week.expenses > max.expenses ? week : max, source[0]);
    const averageExpense = source.length > 0
      ? source.reduce((sum, week) => sum + week.expenses, 0) / source.length
      : 0;
    return { bestWeek, heaviestWeek, averageExpense };
  }, [weeklyFlowData]);

  // Executive summary (3-line auto narrative)
  const topCategoryDelta = categoryDeltas.find(d => d.trend === 'up' && d.deltaPct !== null && Math.abs(d.deltaPct) >= 15);
  const topCategoryName = topCategoryDelta ? (categories.find(c => c.id === topCategoryDelta.category_id)?.name) : undefined;

  const summaryLines = useMemo(() => safeRun(() => buildExecutiveSummary({
    balance,
    netWorth,
    totalIncome,
    totalExpenses: currentTotalAll,
    prevTotalExpenses: prevTotalAll,
    topGrowingCategoryName: topCategoryName,
    topGrowingCategoryDeltaPct: topCategoryDelta?.deltaPct ?? undefined,
    unpaidCCTotal,
    daysLeft: monthPace.lastDayOfMonth - monthPace.dayOfMonth,
    perDayAllowance: allowance.perDayAllowance,
    savingsRate: savings,
  }, maskCurrency), [], 'summary'),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [balance, netWorth, totalIncome, currentTotalAll, prevTotalAll, topCategoryName, topCategoryDelta, unpaidCCTotal, monthPace, allowance, savings, maskCurrency]);

  const summaryTone: 'positive' | 'negative' | 'neutral' =
    totalIncome === 0 && currentTotalAll === 0 ? 'neutral'
    : totalIncome - currentTotalAll >= 0 ? 'positive' : 'negative';

  const monthTitle = currentMonthDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const monthTitleCapitalized = monthTitle.charAt(0).toUpperCase() + monthTitle.slice(1);
  // monthResult já foi definido no topo (linha ~422) — sobra do mês escopada
  const daysLeft = Math.max(0, monthPace.lastDayOfMonth - monthPace.dayOfMonth);
  const healthCopy = healthScore >= 80 ? 'Muito boa' : healthScore >= 65 ? 'Boa' : healthScore >= 45 ? 'Atenção' : 'Crítica';
  const totalBudget = monthPace.totalBudget || currentTotalAll || 1;
  const allocationTotal = allocationData.reduce((sum, item) => sum + item.value, 0);

  const deltaCopy = (delta: number | null, inverted = false) => {
    if (delta === null) return 'sem mês anterior';
    const good = inverted ? delta <= 0 : delta >= 0;
    const prefix = delta > 0 ? '+' : '';
    return `${prefix}${delta.toFixed(0)}% vs mês anterior${good ? '' : ''}`;
  };

  const attentionCards = [
    ...(unpaidCCTotal > 0 ? [{
      title: 'Fatura pendente',
      value: maskCurrency(formatCurrency(unpaidCCTotal)),
      tone: 'info' as const,
      icon: CreditCard,
      href: '/cartoes',
    }] : []),
    ...(catBreakdown[0] ? [{
      title: `${catBreakdown[0].name} em destaque`,
      value: maskCurrency(formatCurrency(catBreakdown[0].value)),
      tone: catBreakdown[0].budget > 0 && catBreakdown[0].value > catBreakdown[0].budget ? 'danger' as const : 'warning' as const,
      icon: Flame,
      href: '/categorias',
    }] : []),
    ...(monthPace.totalBudget > 0 && !monthPace.onTrack ? [{
      title: 'Ritmo de gastos',
      value: `${monthPace.spendProgress.toFixed(0)}% do orçamento`,
      tone: 'danger' as const,
      icon: AlertTriangle,
      href: '/categorias',
    }] : []),
    {
      title: monthResult >= 0 ? 'Ótima economia' : 'Mês negativo',
      value: monthResult >= 0 ? `poupando ${Math.max(0, savings).toFixed(0)}%` : maskCurrency(formatCurrency(Math.abs(monthResult))),
      tone: monthResult >= 0 ? 'success' as const : 'danger' as const,
      icon: monthResult >= 0 ? ShieldCheck : AlertTriangle,
      href: '/relatorio',
    },
  ].slice(0, 4);

  const recentActivity = useMemo(() => [
    ...scopedIncome.map(i => ({
      id: `income-${i.id}`,
      description: i.description || 'Receita',
      date: i.date,
      label: 'Receita',
      amount: Number(i.amount),
      type: 'income' as const,
      icon: '↗',
    })),
    ...scopedNonCCExpenses.map(e => {
      const cat = categories.find(c => c.id === resolveCategoryId(e));
      return {
        id: `expense-${e.id}`,
        description: e.description || 'Despesa',
        date: e.date,
        label: cat?.name || 'Despesa',
        amount: Number(e.amount),
        type: 'expense' as const,
        icon: cat?.icon || '↘',
      };
    }),
    ...scopedCCTransactions.map(t => {
      const cat = categories.find(c => c.id === t.category_id);
      return {
        id: `cc-${t.id}`,
        description: t.description || 'Compra no cartão',
        date: t.date,
        label: cat?.name || 'Cartão',
        amount: Number(t.amount),
        type: 'expense' as const,
        icon: cat?.icon || '💳',
      };
    }),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5),
  [scopedIncome, scopedNonCCExpenses, scopedCCTransactions, categories, categoryByTxId, categoryByMatchKey, categoryByLooseKey]);

  const PremiumCard = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
    <div className={cn('rounded-[1.75rem] border border-border/60 dark:border-white/10 bg-card/95 dark:bg-[#0b101a]/90 shadow-md dark:shadow-2xl shadow-black/5 dark:shadow-black/20 backdrop-blur-xl', className)}>
      {children}
    </div>
  );

  return (
    <div className="space-y-3 sm:space-y-4 pb-16 sm:pb-10 animate-fade-in w-full max-w-full overflow-x-hidden">
      <ErrorBoundary fallback={null} label="StickyBar">
        <StickySummaryBar
          balance={balance}
          perDayAllowance={allowance.todayAllowanceRemaining ?? allowance.perDayAllowance}
          monthBudgetSet={monthPace.totalBudget > 0 || allowance.perDayAllowance > 0}
          maskCurrency={maskCurrency}
        />
      </ErrorBoundary>

      <section className="relative overflow-hidden rounded-2xl border border-border/60 dark:border-white/10 bg-card dark:bg-[#070b12] p-4 shadow-lg shadow-black/5 dark:shadow-xl dark:shadow-black/30 sm:rounded-3xl sm:p-5">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-emerald-500/14 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(16,185,129,0.12),transparent_26%),radial-gradient(circle_at_92%_12%,rgba(59,130,246,0.16),transparent_28%)]" />

        <div className="relative z-10 space-y-4">
          {/* Greeting + actions row */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-200/80">
                {greeting.text}{profile?.first_name ? `, ${profile.first_name}` : ''} 👋
              </p>
              <h1 className="mt-1 text-xl font-black tracking-tight text-foreground sm:text-2xl lg:text-3xl">
                Visão financeira do mês
              </h1>
              <p className="mt-1 text-xs font-semibold text-muted-foreground sm:text-sm">
                {monthTitleCapitalized} · {isGlobalView ? 'visão consolidada' : `conta: ${focusLabel}`}
              </p>
            </div>

            <div className="flex flex-col gap-2 min-[430px]:flex-row min-[430px]:items-center min-[430px]:flex-wrap">
              <MonthSelector month={month} onChange={setMonth} />
              <div className="flex items-center gap-2 w-full min-[430px]:w-auto min-w-0">
                <TransactionDialog type="income" defaultAccountId={accountFocusId === '__all__' ? undefined : accountFocusId}>
                  <button className="flex h-10 flex-1 min-[430px]:flex-none items-center justify-center rounded-xl bg-emerald-500 px-3 sm:px-4 text-xs font-black text-slate-950 shadow-md shadow-emerald-500/20 transition-all hover:bg-emerald-400 active:scale-95 whitespace-nowrap">
                    <ArrowUpRight className="mr-1 h-4 w-4 shrink-0" /> Receita
                  </button>
                </TransactionDialog>
                <TransactionDialog type="expense" defaultAccountId={accountFocusId === '__all__' ? undefined : accountFocusId}>
                  <button className="flex h-10 flex-1 min-[430px]:flex-none items-center justify-center rounded-xl bg-red-500 px-3 sm:px-4 text-xs font-black text-white shadow-md shadow-red-500/20 transition-all hover:bg-red-400 active:scale-95 whitespace-nowrap">
                    <ArrowDownRight className="mr-1 h-4 w-4 shrink-0" /> Despesa
                  </button>
                </TransactionDialog>
              </div>
            </div>
          </div>

          {/* Account picker — scrollable row on mobile */}
          <div className="overflow-x-auto pb-1 -mx-3 px-3 sm:-mx-5 sm:px-5">
            <div className="flex gap-2 w-max">
              <button
                onClick={() => setAccountFocusId('__all__')}
                className={cn(
                  'group flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all',
                  isGlobalView
                    ? 'border-emerald-300/45 bg-emerald-400/10 shadow-md shadow-emerald-950/20'
                    : 'border-border/50 dark:border-white/10 bg-muted/30 dark:bg-muted/50 dark:bg-white/[0.035] hover:border-emerald-300/30',
                )}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-400/12 text-emerald-500 dark:text-emerald-700 dark:text-emerald-200">
                  <Landmark className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-black text-foreground whitespace-nowrap">Todas as contas</span>
                  <span className="currency mt-0.5 block text-xs font-black text-emerald-600 dark:text-emerald-300 tabular-nums whitespace-nowrap">{maskCurrency(formatCurrency(accumulatedBalance))}</span>
                </span>
              </button>

              {activeAccounts.map((account) => {
                const brand = accountBrandFromRow(account);
                const active = accountFocusId === account.id;
                const insight = accountInsights.find(a => a.acc.id === account.id);
                const accountBalance = insight?.balance ?? 0;
                return (
                  <button
                    key={account.id}
                    onClick={() => setAccountFocusId(account.id)}
                    className={cn(
                      'group flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all',
                      active ? 'bg-muted/60 dark:bg-white/[0.075] shadow-md shadow-black/10 dark:shadow-black/20' : 'border-border/50 dark:border-white/10 bg-muted/30 dark:bg-muted/50 dark:bg-white/[0.035] hover:bg-muted/50 dark:hover:bg-white/[0.055]',
                    )}
                    style={active ? { borderColor: colorWithOpacity(brand.color, 0.55), boxShadow: `0 12px 28px -20px ${brand.color}` } : undefined}
                  >
                    <BrandLogoBadge logoUrl={brand.logoUrl} label={account.name} color={brand.color} icon={brand.icon || account.icon} active={active} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-black text-foreground max-w-[120px]">{account.name}</span>
                      <span className={cn('currency mt-0.5 block truncate text-xs font-black tabular-nums', accountBalance >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-600 dark:text-red-300')}>
                        {maskCurrency(formatCurrency(accountBalance))}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-2 sm:gap-3 grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Saldo total" value={maskCurrency(formatCurrency(balance))} icon={Wallet} color="from-emerald-400/14" trend="neutral" sparklineData={balanceSparkline} delta={null} sub={isGlobalView ? `${activeAccounts.length} contas ativas` : focusLabel} />
        <KpiCard label="Sobra no mês" value={maskCurrency(formatCurrency(monthResult))} icon={PiggyBank} color={monthResult >= 0 ? 'from-emerald-400/14' : 'from-red-400/14'} trend={monthResult >= 0 ? 'up' : 'down'} sparklineData={balanceSparkline} delta={null} sub={`${Math.max(0, savings).toFixed(0)}% de poupança`} />
        <KpiCard label="Receitas" value={maskCurrency(formatCurrency(totalIncome))} icon={TrendingUp} color="from-emerald-400/14" trend="up" sparklineData={incomeSparkline} delta={incomeDelta} deltaInverted={false} sub={deltaCopy(incomeDelta)} />
        <KpiCard label="Despesas" value={maskCurrency(formatCurrency(currentTotalAll))} icon={TrendingDown} color="from-red-400/14" trend="down" sparklineData={expenseSparkline} delta={expenseDelta} deltaInverted={true} sub={deltaCopy(expenseDelta, true)} />
        <div className="col-span-2 lg:col-span-1">
          <KpiCard label="Saúde financeira" value={`${healthScore}/100`} icon={Gauge} color={healthScore >= 70 ? 'from-emerald-400/14' : healthScore >= 45 ? 'from-amber-400/14' : 'from-red-400/14'} trend={healthScore >= 70 ? 'up' : healthScore >= 45 ? 'neutral' : 'down'} sub={healthCopy} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <PremiumCard className="relative overflow-hidden p-4 sm:p-5">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="relative space-y-4">
            <SectionHeader title="Resumo inteligente" subtitle="Diagnóstico rápido do mês." icon={BrainCircuit} iconColor="text-emerald-600 dark:text-emerald-300" />

            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="space-y-2">
                <div className="rounded-xl border border-border/60 dark:border-white/10 bg-muted/50 dark:bg-white/[0.035] px-3 py-2.5 text-xs sm:text-sm font-semibold text-foreground/80">
                  <span className={monthResult >= 0 ? 'text-emerald-500 dark:text-emerald-600 dark:text-emerald-300' : 'text-red-500 dark:text-red-600 dark:text-red-300'}>{monthResult >= 0 ? 'Mês positivo' : 'Mês negativo'}:</span> {monthResult >= 0 ? 'sobra de' : 'déficit de'} {maskCurrency(formatCurrency(Math.abs(monthResult)))}.
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-border/60 dark:border-white/10 bg-muted/40 dark:bg-white/[0.025] px-3 py-2.5">
                    <p className="text-[10px] font-bold text-muted-foreground">Poupança</p>
                    <p className="mt-0.5 text-sm font-black text-foreground">{Math.max(0, savings).toFixed(0)}% da renda</p>
                  </div>
                  <div className="rounded-xl border border-border/60 dark:border-white/10 bg-muted/40 dark:bg-white/[0.025] px-3 py-2.5">
                    <p className="text-[10px] font-bold text-muted-foreground">Receitas</p>
                    <p className="mt-0.5 text-sm font-black text-emerald-600 dark:text-emerald-600 dark:text-emerald-300">{deltaCopy(incomeDelta)}</p>
                  </div>
                  <div className="rounded-xl border border-border/60 dark:border-white/10 bg-muted/40 dark:bg-white/[0.025] px-3 py-2.5">
                    <p className="text-[10px] font-bold text-muted-foreground">Despesas</p>
                    <p className="mt-0.5 text-sm font-black text-red-600 dark:text-red-600 dark:text-red-300">{deltaCopy(expenseDelta, true)}</p>
                  </div>
                  <button onClick={() => window.location.href = '/cartoes'} className="rounded-xl border border-sky-300/20 bg-sky-400/10 px-3 py-2.5 text-left transition-colors hover:bg-sky-400/15">
                    <p className="text-[10px] font-bold text-sky-600/80 dark:text-sky-700 dark:text-sky-200/70">Cartões</p>
                    <p className="mt-0.5 text-sm font-black text-sky-600 dark:text-sky-700 dark:text-sky-200">{maskCurrency(formatCurrency(unpaidCCTotal))}</p>
                  </button>
                </div>
              </div>

              {/* Health gauge — visible only on sm+ */}
              <div className="hidden sm:flex mx-auto h-36 w-36 items-center justify-center rounded-full border border-border/60 dark:border-white/10 bg-muted/40 dark:bg-white/[0.025] p-3 shadow-inner">
                <div className="relative flex h-28 w-28 items-center justify-center rounded-full" style={{ background: `conic-gradient(${healthColor} ${healthScore * 3.6}deg, rgba(255,255,255,0.08) 0deg)` }}>
                  <div className="flex h-22 w-22 flex-col items-center justify-center rounded-full bg-[#0b101a] text-center shadow-xl shadow-black/40" style={{ width: '4.8rem', height: '4.8rem' }}>
                    <p className="text-2xl font-black text-white leading-none">{healthScore}</p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">/100</p>
                    <p className="text-[10px] font-black leading-tight" style={{ color: healthColor }}>{healthCopy}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Health score row on mobile */}
            <div className="flex sm:hidden items-center gap-3 rounded-xl border border-border/60 dark:border-white/10 bg-muted/40 dark:bg-white/[0.025] px-3 py-2.5">
              <div className="h-2 flex-1 rounded-full bg-border/60">
                <div className="h-full rounded-full transition-all" style={{ width: `${healthScore}%`, backgroundColor: healthColor }} />
              </div>
              <span className="text-sm font-black shrink-0" style={{ color: healthColor }}>{healthScore}/100 · {healthCopy}</span>
            </div>
          </div>
        </PremiumCard>

        <PremiumCard className="relative overflow-hidden p-4 sm:p-5">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber-400/12 blur-3xl" />
          <div className="absolute -bottom-20 -left-12 h-40 w-40 rounded-full bg-orange-400/[0.08] blur-3xl" />
          <div className="relative space-y-4">
            <SectionHeader title="Allowance diária" subtitle="Quanto ainda dá gastar por dia." icon={Target} iconColor="text-amber-600 dark:text-amber-300" />

            {/* Hero value — "disponivel hoje" (perDayAllowance - já gasto hoje) */}
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="currency text-3xl sm:text-4xl lg:text-5xl font-black text-amber-700 dark:text-amber-200 tabular-nums leading-none break-words">
                  {maskCurrency(formatCurrency(allowance.todayAllowanceRemaining ?? allowance.perDayAllowance))}
                </p>
                <p className="mt-1.5 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground dark:text-slate-400">
                  disponível hoje · faltam {daysLeft} dia{daysLeft !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="shrink-0 rounded-2xl border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-200/90">Restante mês</p>
                <p className="currency text-sm sm:text-base font-black text-amber-700 dark:text-amber-200 tabular-nums whitespace-nowrap">
                  {maskCurrency(formatCurrency(allowance.remainingBudget))}
                </p>
              </div>
            </div>

            {/* Progress: spent vs available cap (income or budget) */}
            <div className="rounded-xl border border-border/60 dark:border-white/10 bg-muted/50 dark:bg-white/[0.035] p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-1 text-[10px] sm:text-xs font-bold">
                <span className="text-muted-foreground">Usado este mês</span>
                <span className="text-foreground/80 tabular-nums">
                  {Math.min(100, allowance.monthBudget > 0 ? (currentTotalAll / allowance.monthBudget) * 100 : 0).toFixed(0)}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-border/50 dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-300 via-orange-400 to-rose-400 transition-all duration-500"
                  style={{ width: `${Math.min(100, allowance.monthBudget > 0 ? (currentTotalAll / allowance.monthBudget) * 100 : 0)}%` }}
                />
              </div>
              <div className="mt-1.5 flex flex-wrap justify-between gap-1 text-[10px] text-muted-foreground tabular-nums">
                <span>{maskCurrency(formatCurrency(currentTotalAll))}</span>
                <span>{maskCurrency(formatCurrency(allowance.monthBudget))}</span>
              </div>
            </div>

            <div className={cn(
              'flex items-start gap-2.5 rounded-xl border px-3 py-2.5',
              todaySpent > allowance.perDayAllowance && allowance.perDayAllowance > 0
                ? 'border-red-300/30 bg-red-400/[0.08]'
                : 'border-emerald-300/25 bg-emerald-400/[0.06]',
            )}>
              {todaySpent > allowance.perDayAllowance && allowance.perDayAllowance > 0 ? (
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600 dark:text-red-300" />
              ) : (
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-300" />
              )}
              <p className="text-xs font-semibold text-foreground/80 dark:text-slate-300 min-w-0 break-words">
                Hoje: <span className="tabular-nums font-black">{maskCurrency(formatCurrency(todaySpent))}</span>
                {' · '}
                {todaySpent > allowance.perDayAllowance && allowance.perDayAllowance > 0 ? 'acima do ideal' : 'dentro do ideal'}
              </p>
            </div>
          </div>
        </PremiumCard>
      </section>

      <ErrorBoundary fallback={null} label="BurnRate">
        <BurnRateChart
          points={burnRate.points}
          projectedTotal={burnRate.projectedTotal}
          willOverrun={burnRate.willOverrun}
          monthBudget={monthPace.totalBudget}
          todaySpent={todaySpent}
          dayOfMonth={monthPace.dayOfMonth}
          maskCurrency={maskCurrency}
        />
      </ErrorBoundary>

      <section className="space-y-2.5">
        <SectionHeader title="O que merece atenção" subtitle="Prioridades do mês" icon={BellRing} iconColor="text-amber-600 dark:text-amber-300" />
        <div className="grid gap-2 grid-cols-2 xl:grid-cols-4">
          {attentionCards.map((item) => {
            const Icon = item.icon;
            const toneClass = item.tone === 'success' ? 'text-emerald-600 dark:text-emerald-300 bg-emerald-400/10 border-emerald-300/20' : item.tone === 'danger' ? 'text-red-600 dark:text-red-300 bg-red-400/10 border-red-300/20' : item.tone === 'info' ? 'text-sky-600 dark:text-sky-300 bg-sky-400/10 border-sky-300/20' : 'text-amber-600 dark:text-amber-300 bg-amber-400/10 border-amber-300/20';
            return (
              <button key={item.title} onClick={() => { window.location.href = item.href; }} className="group flex items-center gap-3 rounded-xl border border-border/60 dark:border-white/10 bg-card dark:bg-[#0b101a]/85 p-3 text-left shadow-sm transition-all hover:border-border dark:hover:border-white/20">
                <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border', toneClass)}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-black text-foreground">{item.title}</span>
                  <span className="mt-0.5 block truncate text-xs font-bold text-muted-foreground">{item.value}</span>
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/70 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground/80 dark:text-slate-300 shrink-0" />
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid items-start gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <PremiumCard className="relative self-start overflow-hidden p-4 sm:p-5">
          <div className="pointer-events-none absolute -left-24 -top-28 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="pointer-events-none absolute -right-20 top-10 h-64 w-64 rounded-full bg-sky-400/10 blur-3xl" />
          <div className="relative mb-3 space-y-2">
            <SectionHeader title="Evolução financeira" subtitle="Receitas, despesas e saldo nos últimos meses." icon={BarChart3} iconColor="text-sky-600 dark:text-sky-300" />
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-lg border border-emerald-300/15 bg-emerald-400/[0.07] px-2 py-1 flex items-center gap-1.5">
                <span className="text-[9px] font-black uppercase text-emerald-700 dark:text-emerald-200/60">Rec</span>
                <span className="currency text-[10px] font-black text-emerald-700 dark:text-emerald-200">{maskCurrency(formatCurrency(evolutionSummary.currentIncome))}</span>
              </span>
              <span className="rounded-lg border border-rose-300/15 bg-rose-400/[0.07] px-2 py-1 flex items-center gap-1.5">
                <span className="text-[9px] font-black uppercase text-rose-700 dark:text-rose-200/60">Desp</span>
                <span className="currency text-[10px] font-black text-rose-700 dark:text-rose-200">{maskCurrency(formatCurrency(evolutionSummary.currentExpenses))}</span>
              </span>
              <span className="rounded-lg border border-sky-300/15 bg-sky-400/[0.07] px-2 py-1 flex items-center gap-1.5">
                <span className="text-[9px] font-black uppercase text-sky-700 dark:text-sky-200/60">Saldo</span>
                <span className={cn('currency text-[10px] font-black', evolutionSummary.currentBalance >= 0 ? 'text-sky-700 dark:text-sky-200' : 'text-rose-700 dark:text-rose-200')}>{maskCurrency(formatCurrency(evolutionSummary.currentBalance))}</span>
              </span>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-border/40 dark:border-white/[0.08] bg-muted/40 dark:bg-[#050810]/90 p-3 shadow-inner shadow-black/10 dark:shadow-black/40">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(16,185,129,0.09),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(56,189,248,0.07),transparent_50%)]" />
            <div className="relative h-[260px] sm:h-[290px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={sixMonthData} margin={{ top: 20, right: 20, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id="dashboardIncomeArea" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.28} />
                    <stop offset="60%" stopColor="#34d399" stopOpacity={0.05} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="dashboardExpenseArea" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#fb7185" stopOpacity={0.20} />
                    <stop offset="65%" stopColor="#fb7185" stopOpacity={0.03} />
                    <stop offset="100%" stopColor="#fb7185" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="dashboardBalanceArea" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#818cf8" stopOpacity={0.20} />
                    <stop offset="70%" stopColor="#818cf8" stopOpacity={0.02} />
                    <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="dashboardIncomeStroke" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stopColor="#6ee7b7" />
                    <stop offset="50%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                  <linearGradient id="dashboardExpenseStroke" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stopColor="#fda4af" />
                    <stop offset="50%" stopColor="#fb7185" />
                    <stop offset="100%" stopColor="#f43f5e" />
                  </linearGradient>
                  <linearGradient id="dashboardBalanceStroke" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stopColor="#a5b4fc" />
                    <stop offset="50%" stopColor="#818cf8" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                  <filter id="dashboardGlowIncome" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                  <filter id="dashboardGlowExpense" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>
                <CartesianGrid stroke="rgba(148,163,184,0.07)" strokeDasharray="3 10" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} padding={{ left: 20, right: 20 }} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 800, letterSpacing: '0.03em' }} />
                <YAxis width={30} axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 9, fontWeight: 700 }} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                <RechartsTooltip
                  cursor={{ stroke: 'rgba(165,180,252,0.18)', strokeWidth: 1, strokeDasharray: '4 6' }}
                  content={({ active, payload, label }) => {
                    const rows = (payload || [])
                      .filter((p) => p.value !== null && p.value !== undefined)
                      .map((p) => ({
                        label: String(p.name),
                        value: maskCurrency(formatCurrency(Number(p.value))),
                        color: String(p.color || '#94a3b8'),
                      }));
                    return active && rows.length ? <ChartTooltipCard title={String(label)} rows={rows} /> : null;
                  }}
                />
                <Area name="Saldo" type="monotone" dataKey="sobra" stroke="url(#dashboardBalanceStroke)" strokeWidth={3} strokeLinecap="round" fill="url(#dashboardBalanceArea)" dot={{ r: 5, fill: '#818cf8', stroke: '#050810', strokeWidth: 2.5 }} activeDot={{ r: 8, fill: '#818cf8', stroke: '#e0e7ff', strokeWidth: 2 }} />
                <Line name="Receitas" type="monotone" dataKey="income" stroke="url(#dashboardIncomeStroke)" strokeWidth={3.5} strokeLinecap="round" dot={{ r: 5.5, fill: '#34d399', stroke: '#050810', strokeWidth: 2.5 }} activeDot={{ r: 9, fill: '#34d399', stroke: '#d1fae5', strokeWidth: 2 }} filter="url(#dashboardGlowIncome)" />
                <Line name="Despesas" type="monotone" dataKey="expenses" stroke="url(#dashboardExpenseStroke)" strokeWidth={3.5} strokeLinecap="round" dot={{ r: 5.5, fill: '#fb7185', stroke: '#050810', strokeWidth: 2.5 }} activeDot={{ r: 9, fill: '#fb7185', stroke: '#ffe4e6', strokeWidth: 2 }} filter="url(#dashboardGlowExpense)" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          </div>
          <div className="relative mt-3 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-muted-foreground">
            <div className="flex flex-wrap gap-3">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Receitas</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-400" /> Despesas</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-400" /> Saldo</span>
            </div>
            {evolutionSummary.balanceDelta !== null && (
              <span className={cn('rounded-full border px-2.5 py-0.5 text-[11px]', evolutionSummary.balanceDelta >= 0 ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-700 dark:text-emerald-200' : 'border-rose-300/20 bg-rose-400/10 text-rose-700 dark:text-rose-200')}>
                {evolutionSummary.balanceDelta >= 0 ? '+' : ''}{maskCurrency(formatCurrency(evolutionSummary.balanceDelta))} vs anterior
              </span>
            )}
          </div>
        </PremiumCard>

          <PremiumCard className="relative overflow-hidden p-4 sm:p-5">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />
            <div className="relative grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px]">
              <div className="min-w-0">
                <div className="mb-3">
                  <SectionHeader title="Ritmo semanal" subtitle={`${weeklyFlowData.length} semanas · distribuição de entradas e saídas`} icon={BarChart3} iconColor="text-cyan-600 dark:text-cyan-300" />
                </div>

                <div className="h-[170px] sm:h-[210px] rounded-2xl border border-border/40 dark:border-white/[0.06] bg-muted/40 dark:bg-[#050810]/80 p-3 shadow-inner shadow-black/10 dark:shadow-black/30">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={weeklyFlowData} margin={{ top: 12, right: 8, left: -14, bottom: 0 }} barGap={4} barCategoryGap="25%">
                      <defs>
                        <linearGradient id="weeklyIncomeBar" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="#34d399" stopOpacity={1} />
                          <stop offset="50%" stopColor="#10b981" stopOpacity={0.85} />
                          <stop offset="100%" stopColor="#059669" stopOpacity={0.5} />
                        </linearGradient>
                        <linearGradient id="weeklyExpenseBar" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="#fb7185" stopOpacity={1} />
                          <stop offset="50%" stopColor="#f43f5e" stopOpacity={0.85} />
                          <stop offset="100%" stopColor="#be123c" stopOpacity={0.5} />
                        </linearGradient>
                        <filter id="weeklyBarGlow" x="-30%" y="-30%" width="160%" height="160%">
                          <feGaussianBlur stdDeviation="4" result="blur" />
                          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                        </filter>
                      </defs>
                      <CartesianGrid stroke="rgba(148,163,184,0.06)" strokeDasharray="3 8" vertical={false} />
                      <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 900 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 9, fontWeight: 700 }} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} width={24} />
                      <RechartsTooltip
                        cursor={{ fill: 'rgba(129,140,248,0.06)', radius: 8 }}
                        content={({ active, payload, label }) => {
                          const week = weeklyFlowData.find(item => item.week === label);
                          const rows = (payload || [])
                            .filter((p) => p.value !== null && p.value !== undefined)
                            .map((p) => ({
                              label: String(p.name),
                              value: maskCurrency(formatCurrency(Number(p.value))),
                              color: String(p.color || '#94a3b8'),
                            }));
                          return active && rows.length ? <ChartTooltipCard title={`${label}${week ? ` • dias ${week.range}` : ''}`} rows={rows} /> : null;
                        }}
                      />
                      <Bar name="Receitas" dataKey="income" fill="url(#weeklyIncomeBar)" radius={[10, 10, 3, 3]} maxBarSize={32} />
                      <Bar name="Despesas" dataKey="expenses" fill="url(#weeklyExpenseBar)" radius={[10, 10, 3, 3]} maxBarSize={32} />
                      <Line name="Saldo" type="monotone" dataKey="balance" stroke="#818cf8" strokeWidth={2.5} strokeLinecap="round" dot={{ r: 4, fill: '#818cf8', stroke: '#050810', strokeWidth: 2.5 }} activeDot={{ r: 7, fill: '#818cf8', stroke: '#e0e7ff', strokeWidth: 2 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid gap-2 grid-cols-3 lg:grid-cols-1">
                <div className="rounded-xl border border-border/60 dark:border-white/10 bg-muted/50 dark:bg-white/[0.035] p-2.5 sm:p-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-500">Melhor</p>
                  <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm font-black text-foreground">{weeklyFlowSummary.bestWeek?.week ?? '-'}</p>
                  <p className={cn('currency text-[10px] sm:text-xs font-black truncate', (weeklyFlowSummary.bestWeek?.balance ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300')}>
                    {maskCurrency(formatCurrency(weeklyFlowSummary.bestWeek?.balance ?? 0))}
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 dark:border-white/10 bg-muted/50 dark:bg-white/[0.035] p-2.5 sm:p-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-500">+ pesada</p>
                  <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm font-black text-foreground">{weeklyFlowSummary.heaviestWeek?.week ?? '-'}</p>
                  <p className="currency text-[10px] sm:text-xs font-black text-rose-600 dark:text-rose-300 truncate">{maskCurrency(formatCurrency(weeklyFlowSummary.heaviestWeek?.expenses ?? 0))}</p>
                </div>
                <div className="rounded-xl border border-border/60 dark:border-white/10 bg-muted/50 dark:bg-white/[0.035] p-2.5 sm:p-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-500">Média/sem</p>
                  <p className="currency mt-0.5 sm:mt-1 text-[10px] sm:text-xs font-black text-cyan-700 dark:text-cyan-200 truncate">{maskCurrency(formatCurrency(weeklyFlowSummary.averageExpense))}</p>
                  <p className="text-[10px] font-semibold text-muted-foreground/70 hidden sm:block">por semana</p>
                </div>
              </div>
            </div>
          </PremiumCard>
        </div>

        <div className="space-y-4">
          <PremiumCard className="p-4 sm:p-5">
            <div className="mb-3">
              <SectionHeader title="Transações recentes" icon={Clock} iconColor="text-sky-600 dark:text-sky-300" action={{ label: 'Ver todas', href: '/relatorio' }} />
            </div>
            <div className="space-y-2">
              {recentActivity.map((tx) => (
                <div key={tx.id} className="flex items-center gap-3 rounded-xl border border-border/60 dark:border-white/10 bg-muted/40 dark:bg-white/[0.025] px-3 py-2.5">
                  <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm', tx.type === 'income' ? 'bg-emerald-400/10 text-emerald-600 dark:text-emerald-300' : 'bg-red-400/10 text-red-600 dark:text-red-300')}>{tx.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-black text-foreground">{tx.description}</p>
                    <p className="mt-0.5 text-[10px] font-semibold text-slate-500">{formatDate(tx.date)} · {tx.label}</p>
                  </div>
                  <p className={cn('currency shrink-0 text-xs font-black tabular-nums', tx.type === 'income' ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-600 dark:text-red-300')}>
                    {tx.type === 'income' ? '+' : '-'}{maskCurrency(formatCurrency(tx.amount))}
                  </p>
                </div>
              ))}
            </div>
          </PremiumCard>

          <PremiumCard className="p-4 sm:p-5">
            <div className="mb-3">
              <SectionHeader title="Categorias principais" icon={Target} iconColor="text-emerald-600 dark:text-emerald-300" action={{ label: 'Ver todas', href: '/categorias' }} />
            </div>
            <div className="space-y-3">
              {catBreakdown.slice(0, 5).map((cat) => {
                const pct = currentTotalAll > 0 ? (cat.value / currentTotalAll) * 100 : 0;
                return (
                  <div key={cat.name}>
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-xs font-bold">
                      <span className="truncate text-foreground/80 dark:text-slate-300">{cat.icon} {cat.name}</span>
                      <span className="shrink-0 text-slate-500">{pct.toFixed(0)}% · {maskCurrency(formatCurrency(cat.value))}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-border/50 dark:bg-white/10">
                      <div className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-sky-400" style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </PremiumCard>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <PremiumCard className="relative overflow-hidden p-4 sm:p-5">
          <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-rose-400/10 blur-3xl" />
          <div className="relative">
            <div className="mb-3">
              <SectionHeader title="Top 5 despesas" subtitle="Maiores do mês" icon={TrendingDown} iconColor="text-rose-600 dark:text-rose-300" action={{ label: 'Ver todas', href: '/despesas' }} />
            </div>
            <div className="space-y-2">
              {topExpenses.length === 0 ? (
                <div className="rounded-xl border border-border/60 dark:border-white/10 bg-muted/40 dark:bg-white/[0.025] p-3 text-xs font-semibold text-muted-foreground">Nenhuma despesa neste mês.</div>
              ) : topExpenses.map((item, index) => {
                const cat = categories.find(c => c.id === item.category_id);
                const pct = currentTotalAll > 0 ? (item.amount / currentTotalAll) * 100 : 0;
                return (
                  <div key={`${item.kind}-${item.id}`} className="group rounded-xl border border-border/60 dark:border-white/10 bg-muted/40 dark:bg-white/[0.025] p-2.5 transition-all hover:border-rose-300/25 hover:bg-rose-400/[0.04]">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-rose-300/15 bg-rose-400/10 text-[10px] font-black text-rose-700 dark:text-rose-200">#{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-black text-foreground">{item.description}</p>
                        <p className="mt-0.5 text-[10px] font-semibold text-slate-500">{formatDate(item.date)} · {cat?.icon} {cat?.name || 'Sem cat.'}</p>
                      </div>
                      <p className="currency shrink-0 text-xs font-black text-rose-700 dark:text-rose-200">{maskCurrency(formatCurrency(item.amount))}</p>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-border/50 dark:bg-white/10">
                      <div className="h-full rounded-full bg-gradient-to-r from-rose-300 to-red-500" style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </PremiumCard>

        <PremiumCard className="relative overflow-hidden p-4 sm:p-5">
          <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="relative">
            <div className="mb-3">
              <SectionHeader title="Top 5 receitas" subtitle="Maiores do mês" icon={TrendingUp} iconColor="text-emerald-600 dark:text-emerald-300" action={{ label: 'Ver todas', href: '/receitas' }} />
            </div>
            <div className="space-y-2">
              {topIncomes.length === 0 ? (
                <div className="rounded-xl border border-border/60 dark:border-white/10 bg-muted/40 dark:bg-white/[0.025] p-3 text-xs font-semibold text-muted-foreground">Nenhuma receita neste mês.</div>
              ) : topIncomes.map((item, index) => {
                const pct = totalIncome > 0 ? (Number(item.amount) / totalIncome) * 100 : 0;
                return (
                  <div key={item.id} className="group rounded-xl border border-border/60 dark:border-white/10 bg-muted/40 dark:bg-white/[0.025] p-2.5 transition-all hover:border-emerald-300/25 hover:bg-emerald-400/[0.04]">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-emerald-300/15 bg-emerald-400/10 text-[10px] font-black text-emerald-700 dark:text-emerald-200">#{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-black text-foreground">{item.description || 'Receita'}</p>
                        <p className="mt-0.5 text-[10px] font-semibold text-slate-500">{formatDate(item.date)} · {item.status || 'concluido'}</p>
                      </div>
                      <p className="currency shrink-0 text-xs font-black text-emerald-700 dark:text-emerald-200">{maskCurrency(formatCurrency(Number(item.amount)))}</p>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-border/50 dark:bg-white/10">
                      <div className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-teal-400" style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </PremiumCard>

        <PremiumCard className="relative overflow-hidden p-4 sm:p-5 md:col-span-2 xl:col-span-1">
          <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-blue-400/10 blur-3xl" />
          <div className="relative">
            <div className="mb-3">
              <SectionHeader title="Mês atual vs anterior" subtitle="3 métricas comparadas" icon={BarChart3} iconColor="text-sky-600 dark:text-sky-300" />
            </div>
            <div className="rounded-2xl border border-border/40 dark:border-white/[0.06] bg-muted/40 dark:bg-[#050810]/80 p-3 shadow-inner shadow-black/10 dark:shadow-black/30 h-[185px] sm:h-[235px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthCompareData} margin={{ top: 10, right: 4, left: -20, bottom: 0 }} barGap={5} barCategoryGap="30%">
                  <CartesianGrid stroke="rgba(148,163,184,0.06)" strokeDasharray="3 8" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 900 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 9, fontWeight: 700 }} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} width={24} />
                  <RechartsTooltip
                    cursor={{ fill: 'rgba(129,140,248,0.06)', radius: 8 }}
                    content={({ active, payload, label }) => {
                      const rows = (payload || [])
                        .filter((p) => p.value !== null && p.value !== undefined)
                        .map((p) => ({
                          label: String(p.name),
                          value: maskCurrency(formatCurrency(Number(p.value))),
                          color: String(p.color || '#94a3b8'),
                        }));
                      return active && rows.length ? <ChartTooltipCard title={String(label)} rows={rows} /> : null;
                    }}
                  />
                  <Bar name="Anterior" dataKey="anterior" fill="rgba(148,163,184,0.20)" radius={[8, 8, 2, 2]} maxBarSize={30} />
                  <Bar name="Atual" dataKey="atual" radius={[8, 8, 2, 2]} maxBarSize={30}>
                    {monthCompareData.map((entry) => <Cell key={entry.name} fill={entry.colorAtual} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-[10px] font-bold text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-slate-600/60" /> Mês anterior</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-400/80" /> Mês atual</span>
            </div>
          </div>
        </PremiumCard>
      </section>

      <ErrorBoundary fallback={null} label="DailyFlow">
        <DailyFlowChart
          income={scopedIncome
            .filter(i => i.status === 'concluido')
            .map(i => ({ date: i.date, amount: Number(i.amount) }))}
          expenses={[
            ...scopedNonCCExpenses
              .filter(e => e.status === 'concluido')
              .map(e => ({ date: e.date, amount: Number(e.amount) })),
            ...scopedCCTransactions
              .map(t => ({ date: t.date, amount: Number(t.amount) })),
          ]}
          month={month}
          maskCurrency={maskCurrency}
        />
      </ErrorBoundary>

      <section className="grid gap-4 lg:grid-cols-2">
        <PremiumCard className="p-4 sm:p-5">
          <div className="mb-4">
            <SectionHeader title="Metas por categoria" subtitle="Orçamento vs. real" icon={Trophy} iconColor="text-emerald-600 dark:text-emerald-300" action={{ label: 'Ajustar', href: '/categorias' }} />
          </div>
          {budgetsWithData.length > 0 ? (
            <BudgetRings budgets={budgetsWithData.slice(0, 5)} size={160} />
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
              <Trophy className="h-10 w-10 text-slate-700" />
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Sem orçamentos definidos</p>
                <p className="text-[11px] text-muted-foreground/70 mt-1">Defina metas nas <a href="/categorias" className="text-emerald-400 hover:underline">categorias</a> para acompanhar aqui</p>
              </div>
            </div>
          )}
        </PremiumCard>

        <PremiumCard className="p-4 sm:p-5">
          <div className="mb-4">
            <SectionHeader title="Mapa de calor" subtitle={monthTitleCapitalized} icon={CalendarRange} iconColor="text-orange-600 dark:text-orange-300" />
          </div>
          <div className="rounded-2xl border border-border/40 dark:border-white/[0.06] bg-muted/40 dark:bg-[#050810]/80 p-3.5">
            <WeeklyHeatmap month={currentMonthDate} data={scopedExpenseHeatmapData} />
          </div>
        </PremiumCard>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <PremiumCard className="p-4 sm:p-5">
          <div className="mb-3">
            <SectionHeader title="Visão do mês" subtitle={`Dia ${monthPace.dayOfMonth} de ${monthPace.lastDayOfMonth}`} icon={Activity} iconColor="text-emerald-600 dark:text-emerald-300" />
          </div>
          <div className="space-y-3">
            <div>
              <div className="mb-1 flex justify-between text-xs font-bold text-muted-foreground"><span>Avanço do mês</span><span>{monthPace.monthProgress.toFixed(0)}%</span></div>
              <div className="h-1.5 rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${monthPace.monthProgress}%` }} /></div>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs font-bold text-muted-foreground"><span>Gastos do mês</span><span>{monthPace.spendProgress.toFixed(0)}%</span></div>
              <div className="h-1.5 rounded-full bg-white/10"><div className={cn('h-full rounded-full', monthPace.onTrack ? 'bg-emerald-400' : 'bg-red-400')} style={{ width: `${Math.min(100, monthPace.spendProgress)}%` }} /></div>
            </div>
            <p className="text-xs font-semibold text-muted-foreground">{maskCurrency(formatCurrency(currentTotalAll))} de {maskCurrency(formatCurrency(monthPace.totalBudget || currentTotalAll))}</p>
            <div className="flex flex-wrap gap-1.5">
              <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-black', monthPace.onTrack ? 'bg-emerald-400/10 text-emerald-600 dark:text-emerald-300' : 'bg-red-400/10 text-red-600 dark:text-red-300')}>{monthPace.onTrack ? 'No ritmo certo' : 'Acima do ritmo'}</span>
              {monthPace.paceVsPrev !== null && <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[11px] font-black text-foreground/80 dark:text-slate-300">{Math.abs(monthPace.paceVsPrev).toFixed(0)}% {monthPace.paceVsPrev > 0 ? 'mais rápido' : 'mais lento'}</span>}
            </div>
          </div>
        </PremiumCard>

        <PremiumCard className="p-4 sm:p-5">
          <ErrorBoundary fallback={null} label="AnomalyAlerts">
            <AnomalyAlerts
              anomalies={anomalies}
              categories={categories.map(c => ({ id: c.id, name: c.name, icon: c.icon || '📊' }))}
              maskCurrency={maskCurrency}
            />
            {anomalies.length === 0 && (
              <div className="space-y-3">
                <SectionHeader title="Gastos atípicos" subtitle="Fora do padrão" icon={AlertTriangle} iconColor="text-amber-600 dark:text-amber-300" action={{ label: 'Ver despesas', href: '/despesas' }} />
                <div className="rounded-xl border border-border/60 dark:border-white/10 bg-muted/40 dark:bg-white/[0.025] p-4 text-center">
                  <ShieldCheck className="h-8 w-8 text-emerald-600 dark:text-emerald-300/40 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-muted-foreground">Nenhum gasto atípico detectado</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">Seus gastos estão dentro do padrão</p>
                </div>
              </div>
            )}
          </ErrorBoundary>
        </PremiumCard>

        <PremiumCard className="p-4 sm:p-5 sm:col-span-2 xl:col-span-1">
          <div className="mb-3">
            <SectionHeader title="Alocação" subtitle="Contas vs investimentos" icon={Landmark} iconColor="text-violet-600 dark:text-violet-300" action={{ label: 'Detalhes', href: '/investimentos' }} />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center xl:flex-col">
            <div className="h-[110px] sm:h-[120px] w-full sm:w-[120px] sm:shrink-0 xl:w-full xl:h-[130px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={allocationData.length ? allocationData : [{ name: 'Sem dados', value: 1, fill: '#334155' }]} dataKey="value" innerRadius={36} outerRadius={56} paddingAngle={4}>
                    {(allocationData.length ? allocationData : [{ fill: '#334155' }]).map((entry, index) => <Cell key={`alloc-${index}`} fill={entry.fill} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 flex-1">
              {allocationData.map((item) => {
                const pct = allocationTotal > 0 ? (item.value / allocationTotal) * 100 : 0;
                return (
                  <div key={item.name} className="flex items-center justify-between gap-2 rounded-xl border border-border/60 dark:border-white/10 bg-muted/40 dark:bg-white/[0.025] px-3 py-2">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-foreground/80 dark:text-slate-300"><span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.fill }} /> {item.name}</span>
                    <span className="text-right text-xs font-black text-foreground">{maskCurrency(formatCurrency(item.value))}<span className="ml-1.5 text-[10px] text-slate-500">{pct.toFixed(0)}%</span></span>
                  </div>
                );
              })}
              <div className="rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs font-black text-emerald-700 dark:text-emerald-200">
                Total · {maskCurrency(formatCurrency(netWorth))}
              </div>
            </div>
          </div>
        </PremiumCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ErrorBoundary fallback={null} label="TopCategoriesDelta">
          <PremiumCard className="p-4 sm:p-5">
            <TopCategoriesDelta
              deltas={categoryDeltas}
              categories={categories}
              maskCurrency={maskCurrency}
              limit={5}
            />
          </PremiumCard>
        </ErrorBoundary>

        <ErrorBoundary fallback={null} label="RecurringExpenses">
          <PremiumCard className="p-4 sm:p-5">
            <RecurringExpenses
              recurring={recurring}
              categories={categories.map(c => ({ id: c.id, name: c.name, icon: c.icon || '🔁' }))}
              maskCurrency={maskCurrency}
              limit={6}
            />
          </PremiumCard>
        </ErrorBoundary>
      </section>

      {pixCounterparties.length > 0 && (
        <ErrorBoundary fallback={null} label="PixCounters">
          <PremiumCard className="p-4 sm:p-5">
            <PixCounters
              counterparties={pixCounterparties}
              maskCurrency={maskCurrency}
              maskText={maskText}
              isVisible={isVisible}
              limit={5}
            />
          </PremiumCard>
        </ErrorBoundary>
      )}

      {orphanExpensesTotal > 0 && (
        <button onClick={() => setOrphanFixOpen(true)} className="flex w-full items-center gap-3 rounded-xl border border-amber-300/20 bg-amber-400/[0.06] px-3 py-3 text-left transition-colors hover:bg-amber-400/10">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
          <span className="min-w-0 flex-1 text-xs font-semibold text-foreground/80 dark:text-slate-300">
            {orphanExpensesCount} despesa{orphanExpensesCount !== 1 ? 's' : ''} sem conta · {maskCurrency(formatCurrency(orphanExpensesTotal))}. Clique para corrigir.
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-500 shrink-0" />
        </button>
      )}
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

      {/* Orphan Expenses Fix Dialog */}
      <Dialog open={orphanFixOpen} onOpenChange={setOrphanFixOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atribuir conta às despesas órfãs</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-warning/30 bg-warning/5 px-4 py-3">
              <p className="text-sm font-semibold text-warning">
                {orphanExpensesCount} despesa{orphanExpensesCount !== 1 ? 's' : ''} • {maskCurrency(formatCurrency(orphanExpensesTotal))}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Todas serão atribuídas à conta selecionada. O saldo desta conta vai diminuir em {maskCurrency(formatCurrency(orphanExpensesTotal))}.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Conta de destino</label>
              <Select value={orphanFixAccountId} onValueChange={setOrphanFixAccountId}>
                <SelectTrigger><SelectValue placeholder="Selecionar conta..." /></SelectTrigger>
                <SelectContent>
                  {accounts.filter(a => !a.archived).map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.icon} {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Apenas despesas concluídas sem conta atribuída (excluindo espelhos de cartão) serão afetadas.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOrphanFixOpen(false)} disabled={orphanFixBusy}>Cancelar</Button>
            <Button
              onClick={handleFixOrphans}
              disabled={!orphanFixAccountId || orphanFixBusy}
              className="bg-warning text-warning-foreground hover:bg-warning/90"
            >
              {orphanFixBusy ? 'Aplicando...' : `Atribuir a ${orphanExpensesCount} despesa(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
