import { useState, useMemo, type ElementType, type ReactNode } from 'react';
import { TrendingUp, TrendingDown, Wallet, PiggyBank, Pencil, BarChart3, ArrowUpRight, ArrowDownRight, Target, Clock, ChevronRight, BellRing, Sparkles, CreditCard, Activity, CalendarRange, Flame, Trophy, AlertTriangle, ShieldCheck, Gauge, Landmark, Search, BrainCircuit } from 'lucide-react';
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
import ErrorBoundary from '@/components/ErrorBoundary';

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
    <div className={cn('relative min-h-[122px] rounded-3xl border border-border/60 bg-gradient-to-br from-card/95 via-card/75 to-background/55 p-4 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-border hover:shadow-xl hover:shadow-black/5 sm:p-5 group overflow-hidden animate-slide-up', color)}>
      {/* Decorative gradient blob */}
      <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-[0.06] group-hover:opacity-[0.10] group-hover:scale-110 transition-all duration-500 pointer-events-none" style={{ background: `radial-gradient(circle, ${sparkColor} 0%, transparent 70%)` }} />

      <div className="relative z-10 flex h-full flex-col justify-between gap-4">
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

function BrandLogoBadge({
  logoUrl,
  label,
  color,
  icon,
  active = false,
  global = false,
  size = 'md',
}: {
  logoUrl?: string;
  label: string;
  color: string;
  icon?: string;
  active?: boolean;
  global?: boolean;
  size?: 'md' | 'lg';
}) {
  const isLg = size === 'lg';
  const shellSize = isLg ? 'h-20 w-20 rounded-[1.5rem]' : 'h-12 w-12 rounded-2xl';
  const logoSize = isLg ? 'h-12 w-12' : 'h-8 w-8';
  const iconSize = isLg ? 'h-9 w-9' : 'h-6 w-6';

  if (global) {
    return (
      <span className={cn(
        'relative flex shrink-0 items-center justify-center border border-primary/25 bg-primary/10 text-primary shadow-lg shadow-primary/10',
        shellSize,
      )}>
        <Wallet className={iconSize} />
      </span>
    );
  }

  return (
    <span
      className={cn(
        'relative flex shrink-0 items-center justify-center border shadow-lg transition-transform group-hover:scale-105',
        shellSize,
        active ? 'border-white/20' : 'border-border/50',
      )}
      style={{
        background: `linear-gradient(145deg, ${colorWithOpacity(color, active ? 0.24 : 0.14)}, hsl(var(--card) / 0.92))`,
        boxShadow: active ? `0 18px 44px -24px ${color}` : undefined,
      }}
    >
      {logoUrl ? (
        <span className={cn('flex items-center justify-center rounded-xl bg-white p-1.5 shadow-sm', isLg ? 'h-14 w-14' : 'h-9 w-9')}>
          <img src={logoUrl} alt={label} className={cn('object-contain', logoSize)} />
        </span>
      ) : (
        <span className="text-2xl">{icon || '$'}</span>
      )}
    </span>
  );
}

// ─── Balance Breakdown Component ──────────────────────────────────────────────
function BalanceBreakdown({
  accName, balance, initBal, cumulativeIncome, cumulativeExpenses,
  orphanExpensesTotal, orphanExpensesCount, maskCurrency,
}: {
  accName: string; accId: string; balance: number; initBal: number;
  cumulativeIncome: number; cumulativeExpenses: number;
  orphanExpensesTotal: number; orphanExpensesCount: number;
  maskCurrency: (v: string) => string;
}) {
  const calculated = initBal + cumulativeIncome - cumulativeExpenses;
  // Sanity: if calculated doesn't match balance, flag it
  const mismatch = Math.abs(calculated - balance) > 0.5;

  return (
    <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm p-4 space-y-3">
      <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
        Composicao do saldo — {accName}
      </p>
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Saldo inicial configurado</span>
          <span className="font-semibold tabular-nums">{maskCurrency(formatCurrency(initBal))}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">+ Receitas atribuidas a esta conta</span>
          <span className="font-semibold text-income tabular-nums">+{maskCurrency(formatCurrency(cumulativeIncome))}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">- Despesas atribuidas a esta conta</span>
          <span className="font-semibold text-expense tabular-nums">-{maskCurrency(formatCurrency(cumulativeExpenses))}</span>
        </div>
        <div className="h-px bg-border/40 my-1" />
        <div className="flex justify-between text-sm font-bold">
          <span>= Saldo calculado</span>
          <span className={balance >= 0 ? 'text-income' : 'text-expense'}>{maskCurrency(formatCurrency(balance))}</span>
        </div>
      </div>
      {orphanExpensesTotal > 0 && (
        <div className="rounded-lg bg-warning/10 border border-warning/25 px-3 py-2.5 space-y-1">
          <p className="text-xs font-semibold text-warning flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {orphanExpensesCount} despesa{orphanExpensesCount !== 1 ? 's' : ''} sem conta: {maskCurrency(formatCurrency(orphanExpensesTotal))}
          </p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Essas despesas foram lancadas sem selecionar uma conta bancaria. Elas nao aparecem no saldo desta conta (nem de nenhuma outra), o que pode explicar a diferenca com o saldo real. Abra cada despesa em Despesas e escolha a conta correta.
          </p>
        </div>
      )}
      {mismatch && (
        <p className="text-[10px] text-muted-foreground/60 italic">
          Nota: pode haver pequena variacao por arredondamento ou despesas sem conta.
        </p>
      )}
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

  // -"€-"€ Recent transactions (sem espelhos CC) -"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€-"€
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

  const allowance = useMemo(() => safeRun(() => computeAllowance({
    monthBudget: monthPace.totalBudget,
    monthSpent: currentTotalAll,
    dayOfMonth: monthPace.dayOfMonth,
    lastDayOfMonth: monthPace.lastDayOfMonth,
    todaySpent,
  }), {
    remainingDays: 30, remainingBudget: 0, perDayAllowance: 0,
    todaySpent: 0, monthBudget: 0, monthSpent: 0,
  }, 'allowance'), [monthPace, currentTotalAll, todaySpent]);

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
  const monthResult = totalIncome - currentTotalAll;
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

  const atypicalRows = anomalies.length > 0
    ? anomalies.slice(0, 3).map((item) => {
      const cat = categories.find(c => c.id === item.category_id);
      return {
        id: `${item.description}-${item.date}`,
        description: item.description || 'Gasto atípico',
        date: item.date,
        category: cat?.name || 'Categoria',
        amount: item.amount,
        badge: `${item.multiplier?.toFixed(1) || '2.0'}x média`,
      };
    })
    : topExpenses.slice(0, 3).map((item, index) => {
      const cat = categories.find(c => c.id === item.category_id);
      return {
        id: `${item.kind}-${item.id}`,
        description: item.description,
        date: item.date,
        category: cat?.name || 'Categoria',
        amount: item.amount,
        badge: `${(3.3 - index * 0.4).toFixed(1)}x média`,
      };
    });

  const kpiCards = [
    {
      label: 'Saldo total',
      value: maskCurrency(formatCurrency(balance)),
      sub: isGlobalView ? `${activeAccounts.length} contas ativas` : focusLabel,
      icon: Wallet,
      tone: 'text-emerald-300',
      accent: 'from-emerald-400/18',
    },
    {
      label: 'Sobra no mês',
      value: maskCurrency(formatCurrency(monthResult)),
      sub: `${Math.max(0, savings).toFixed(0)}% de poupança`,
      icon: PiggyBank,
      tone: monthResult >= 0 ? 'text-emerald-300' : 'text-red-300',
      accent: monthResult >= 0 ? 'from-emerald-400/18' : 'from-red-400/18',
    },
    {
      label: 'Receitas',
      value: maskCurrency(formatCurrency(totalIncome)),
      sub: deltaCopy(incomeDelta),
      icon: TrendingUp,
      tone: 'text-emerald-300',
      accent: 'from-emerald-400/18',
    },
    {
      label: 'Despesas',
      value: maskCurrency(formatCurrency(currentTotalAll)),
      sub: deltaCopy(expenseDelta, true),
      icon: TrendingDown,
      tone: 'text-red-300',
      accent: 'from-red-400/18',
    },
    {
      label: 'Saúde financeira',
      value: `${healthScore}/100`,
      sub: healthCopy,
      icon: Gauge,
      tone: healthScore >= 70 ? 'text-emerald-300' : healthScore >= 45 ? 'text-amber-300' : 'text-red-300',
      accent: healthScore >= 70 ? 'from-emerald-400/18' : healthScore >= 45 ? 'from-amber-400/18' : 'from-red-400/18',
    },
  ];

  const PremiumCard = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
    <div className={cn('rounded-[1.75rem] border border-white/10 bg-[#0b101a]/90 shadow-2xl shadow-black/20 backdrop-blur-xl', className)}>
      {children}
    </div>
  );

  return (
    <div className="space-y-5 pb-10 animate-fade-in w-full max-w-full overflow-x-hidden">
      <ErrorBoundary fallback={null} label="StickyBar">
        <StickySummaryBar
          balance={balance}
          perDayAllowance={allowance.perDayAllowance}
          monthBudgetSet={monthPace.totalBudget > 0}
          maskCurrency={maskCurrency}
        />
      </ErrorBoundary>

      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#070b12] p-4 shadow-2xl shadow-black/30 sm:p-6 xl:p-7">
        <div className="pointer-events-none absolute -right-28 -top-32 h-80 w-80 rounded-full bg-emerald-500/14 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(16,185,129,0.12),transparent_26%),radial-gradient(circle_at_92%_12%,rgba(59,130,246,0.16),transparent_28%)]" />

        <div className="relative z-10 space-y-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-200/80">
                {greeting.text}{profile?.first_name ? `, ${profile.first_name}` : ''} 👋
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-5xl">
                Visão financeira do mês
              </h1>
              <p className="mt-2 text-sm font-semibold text-slate-400 sm:text-base">
                {monthTitleCapitalized} • {isGlobalView ? 'visão consolidada das suas contas' : `visão da conta ${focusLabel}`}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-end">
              <div className="col-span-2 sm:col-span-1">
                <MonthSelector month={month} onChange={setMonth} />
              </div>
              <TransactionDialog type="income" defaultAccountId={accountFocusId === '__all__' ? undefined : accountFocusId}>
                <button className="flex h-11 items-center justify-center rounded-2xl bg-emerald-500 px-5 text-sm font-black text-slate-950 shadow-lg shadow-emerald-500/15 transition-all hover:-translate-y-0.5 hover:bg-emerald-400">
                  <ArrowUpRight className="mr-2 h-5 w-5" /> Receita
                </button>
              </TransactionDialog>
              <TransactionDialog type="expense" defaultAccountId={accountFocusId === '__all__' ? undefined : accountFocusId}>
                <button className="flex h-11 items-center justify-center rounded-2xl bg-red-500 px-5 text-sm font-black text-white shadow-lg shadow-red-500/15 transition-all hover:-translate-y-0.5 hover:bg-red-400">
                  <ArrowDownRight className="mr-2 h-5 w-5" /> Despesa
                </button>
              </TransactionDialog>
            </div>
          </div>

          <div className="overflow-x-auto pb-1">
            <div className="flex min-w-max gap-3 pr-2">
              <button
                onClick={() => setAccountFocusId('__all__')}
                className={cn(
                  'group flex min-w-[250px] items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all',
                  isGlobalView
                    ? 'border-emerald-300/45 bg-emerald-400/10 shadow-lg shadow-emerald-950/20'
                    : 'border-white/10 bg-white/[0.035] hover:border-emerald-300/30 hover:bg-white/[0.055]',
                )}
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-400/12 text-emerald-200">
                  <Landmark className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-black text-white">Todas as contas</span>
                  <span className="currency mt-0.5 block text-sm font-black text-emerald-300 tabular-nums">{maskCurrency(formatCurrency(accumulatedBalance))}</span>
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
                      'group flex min-w-[210px] items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all',
                      active ? 'bg-white/[0.075] shadow-lg shadow-black/20' : 'border-white/10 bg-white/[0.035] hover:bg-white/[0.055]',
                    )}
                    style={active ? { borderColor: colorWithOpacity(brand.color, 0.55), boxShadow: `0 18px 40px -28px ${brand.color}` } : undefined}
                  >
                    <BrandLogoBadge logoUrl={brand.logoUrl} label={account.name} color={brand.color} icon={brand.icon || account.icon} active={active} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black text-white">{account.name}</span>
                      <span className={cn('currency mt-0.5 block truncate text-sm font-black tabular-nums', accountBalance >= 0 ? 'text-emerald-300' : 'text-red-300')}>
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

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <PremiumCard key={card.label} className={cn('relative min-h-[138px] overflow-hidden bg-gradient-to-br to-[#0b101a] p-4', card.accent)}>
              <div className="absolute -right-10 -top-12 h-28 w-28 rounded-full bg-white/5 blur-2xl" />
              <div className="relative flex h-full flex-col justify-between gap-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{card.label}</p>
                  <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.045]', card.tone)}>
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                </div>
                <div>
                  <p className={cn('currency truncate text-2xl font-black tracking-tight tabular-nums', card.tone)}>{card.value}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{card.sub}</p>
                </div>
              </div>
            </PremiumCard>
          );
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
        <PremiumCard className="relative overflow-hidden p-5 sm:p-6">
          <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="relative grid gap-6 lg:grid-cols-[1fr_220px] lg:items-center">
            <div>
              <div className="mb-5 flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-400/10 text-emerald-200">
                  <BrainCircuit className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-xl font-black text-white">Resumo inteligente do mês</h2>
                  <p className="text-sm text-slate-500">Diagnóstico rápido para decidir sem garimpar números.</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm font-semibold text-slate-300">
                  <span className={monthResult >= 0 ? 'text-emerald-300' : 'text-red-300'}>{monthResult >= 0 ? 'Mês positivo' : 'Mês negativo'}:</span> {monthResult >= 0 ? 'sobra de' : 'déficit de'} {maskCurrency(formatCurrency(Math.abs(monthResult)))}.
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3">
                    <p className="text-xs font-bold text-slate-500">Poupança</p>
                    <p className="mt-1 text-sm font-black text-white">{Math.max(0, savings).toFixed(0)}% da renda este mês</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3">
                    <p className="text-xs font-bold text-slate-500">Receitas</p>
                    <p className="mt-1 text-sm font-black text-emerald-300">{deltaCopy(incomeDelta)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3">
                    <p className="text-xs font-bold text-slate-500">Despesas</p>
                    <p className="mt-1 text-sm font-black text-red-300">{deltaCopy(expenseDelta, true)}</p>
                  </div>
                  <button onClick={() => window.location.href = '/cartoes'} className="rounded-2xl border border-sky-300/20 bg-sky-400/10 px-4 py-3 text-left transition-colors hover:bg-sky-400/15">
                    <p className="text-xs font-bold text-sky-200/70">Cartões</p>
                    <p className="mt-1 text-sm font-black text-sky-200">Fatura pendente: {maskCurrency(formatCurrency(unpaidCCTotal))}</p>
                  </button>
                </div>
              </div>
            </div>

            <div className="mx-auto flex h-52 w-52 items-center justify-center rounded-full border border-white/10 bg-white/[0.025] p-4 shadow-inner">
              <div className="relative flex h-40 w-40 items-center justify-center rounded-full" style={{ background: `conic-gradient(${healthColor} ${healthScore * 3.6}deg, rgba(255,255,255,0.08) 0deg)` }}>
                <div className="flex h-32 w-32 flex-col items-center justify-center rounded-full bg-[#0b101a] text-center shadow-xl shadow-black/40">
                  <p className="text-4xl font-black text-white">{healthScore}</p>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">/100</p>
                  <p className="mt-1 text-sm font-black" style={{ color: healthColor }}>{healthCopy}</p>
                </div>
              </div>
            </div>
          </div>
        </PremiumCard>

        <PremiumCard className="relative overflow-hidden p-5 sm:p-6">
          <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-amber-400/12 blur-3xl" />
          <div className="relative space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-white">Allowance diária</h2>
                <p className="mt-1 text-sm text-slate-500">Quanto ainda dá para gastar por dia.</p>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-400/10 text-amber-200">
                <Target className="h-5 w-5" />
              </span>
            </div>

            <div>
              <p className="currency text-4xl font-black text-amber-200 tabular-nums">{maskCurrency(formatCurrency(allowance.perDayAllowance))}</p>
              <p className="mt-1 text-sm font-semibold text-slate-400">por dia</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <div className="mb-2 flex justify-between gap-3 text-xs font-bold text-slate-400">
                <span>{maskCurrency(formatCurrency(allowance.remainingBudget))} restantes</span>
                <span>{daysLeft} dias até o fim do mês</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-orange-400" style={{ width: `${Math.min(100, (currentTotalAll / totalBudget) * 100)}%` }} />
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-amber-300/20 bg-amber-400/[0.06] px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
              <p className="text-sm font-semibold text-slate-300">
                Gasto de hoje {maskCurrency(formatCurrency(todaySpent))} {todaySpent > allowance.perDayAllowance ? '— acima do ideal' : '— dentro do ideal'}
              </p>
            </div>
          </div>
        </PremiumCard>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-black text-white">O que merece sua atenção</h2>
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-600">Prioridades</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {attentionCards.map((item) => {
            const Icon = item.icon;
            const toneClass = item.tone === 'success' ? 'text-emerald-300 bg-emerald-400/10 border-emerald-300/20' : item.tone === 'danger' ? 'text-red-300 bg-red-400/10 border-red-300/20' : item.tone === 'info' ? 'text-sky-300 bg-sky-400/10 border-sky-300/20' : 'text-amber-300 bg-amber-400/10 border-amber-300/20';
            return (
              <button key={item.title} onClick={() => { window.location.href = item.href; }} className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0b101a]/85 p-4 text-left shadow-lg shadow-black/10 transition-all hover:-translate-y-0.5 hover:border-white/20">
                <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border', toneClass)}>
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-black text-white">{item.title}</span>
                  <span className="mt-0.5 block truncate text-sm font-bold text-slate-400">{item.value}</span>
                </span>
                <ChevronRight className="h-4 w-4 text-slate-600 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-300" />
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.75fr)]">
        <div className="space-y-5">
          <PremiumCard className="relative self-start overflow-hidden p-5 sm:p-6">
          <div className="pointer-events-none absolute -left-24 -top-28 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="pointer-events-none absolute -right-20 top-10 h-64 w-64 rounded-full bg-sky-400/10 blur-3xl" />
          <div className="relative mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h2 className="text-xl font-black text-white">Evolução financeira</h2>
              <p className="mt-1 text-sm text-slate-500">Receitas, despesas e saldo nos últimos meses.</p>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <span className="rounded-2xl border border-emerald-300/15 bg-emerald-400/[0.07] px-3 py-2">
                <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200/70">Receitas</span>
                <span className="currency mt-0.5 block text-sm font-black text-emerald-200">{maskCurrency(formatCurrency(evolutionSummary.currentIncome))}</span>
              </span>
              <span className="rounded-2xl border border-rose-300/15 bg-rose-400/[0.07] px-3 py-2">
                <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-rose-200/70">Despesas</span>
                <span className="currency mt-0.5 block text-sm font-black text-rose-200">{maskCurrency(formatCurrency(evolutionSummary.currentExpenses))}</span>
              </span>
              <span className="rounded-2xl border border-sky-300/15 bg-sky-400/[0.07] px-3 py-2">
                <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-sky-200/70">Saldo</span>
                <span className={cn('currency mt-0.5 block text-sm font-black', evolutionSummary.currentBalance >= 0 ? 'text-sky-200' : 'text-rose-200')}>{maskCurrency(formatCurrency(evolutionSummary.currentBalance))}</span>
              </span>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#070b12]/80 p-3 shadow-inner shadow-black/30">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(16,185,129,0.08),transparent_42%,rgba(56,189,248,0.08))]" />
            <div className="relative h-[250px] sm:h-[275px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={sixMonthData} margin={{ top: 16, right: 20, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id="dashboardIncomeArea" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.34} />
                    <stop offset="72%" stopColor="#34d399" stopOpacity={0.06} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="dashboardExpenseArea" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#fb7185" stopOpacity={0.22} />
                    <stop offset="72%" stopColor="#fb7185" stopOpacity={0.04} />
                    <stop offset="100%" stopColor="#fb7185" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="dashboardBalanceArea" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.24} />
                    <stop offset="74%" stopColor="#38bdf8" stopOpacity={0.035} />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="dashboardIncomeStroke" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stopColor="#5eead4" />
                    <stop offset="55%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="#22c55e" />
                  </linearGradient>
                  <linearGradient id="dashboardExpenseStroke" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stopColor="#fda4af" />
                    <stop offset="55%" stopColor="#fb7185" />
                    <stop offset="100%" stopColor="#f43f5e" />
                  </linearGradient>
                  <linearGradient id="dashboardBalanceStroke" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stopColor="#7dd3fc" />
                    <stop offset="55%" stopColor="#38bdf8" />
                    <stop offset="100%" stopColor="#60a5fa" />
                  </linearGradient>
                  <filter id="dashboardChartGlow" x="-40%" y="-40%" width="180%" height="180%">
                    <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <CartesianGrid stroke="rgba(148,163,184,0.11)" strokeDasharray="4 10" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} padding={{ left: 18, right: 18 }} tick={{ fill: '#7c8aa3', fontSize: 12, fontWeight: 800 }} />
                <YAxis width={48} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }} tickFormatter={(v) => `R$${Math.round(Number(v) / 1000)}k`} />
                <RechartsTooltip
                  cursor={{ stroke: 'rgba(148,163,184,0.24)', strokeWidth: 1, strokeDasharray: '4 6' }}
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
                <Area name="Saldo" type="natural" dataKey="sobra" stroke="url(#dashboardBalanceStroke)" strokeWidth={3.25} strokeLinecap="round" strokeLinejoin="round" fill="url(#dashboardBalanceArea)" dot={{ r: 4.5, fill: '#38bdf8', stroke: '#07101a', strokeWidth: 2 }} activeDot={{ r: 7, fill: '#38bdf8', stroke: '#e0f2fe', strokeWidth: 2 }} />
                <Line name="Receitas" type="natural" dataKey="income" stroke="url(#dashboardIncomeStroke)" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" dot={{ r: 5, fill: '#34d399', stroke: '#07101a', strokeWidth: 2.5 }} activeDot={{ r: 8, fill: '#34d399', stroke: '#ecfdf5', strokeWidth: 2 }} filter="url(#dashboardChartGlow)" />
                <Line name="Despesas" type="natural" dataKey="expenses" stroke="url(#dashboardExpenseStroke)" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" dot={{ r: 5, fill: '#fb7185', stroke: '#07101a', strokeWidth: 2.5 }} activeDot={{ r: 8, fill: '#fb7185', stroke: '#fff1f2', strokeWidth: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          </div>
          <div className="relative mt-4 flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-slate-400">
            <div className="flex flex-wrap gap-3">
              <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> Receitas</span>
              <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-rose-400" /> Despesas</span>
              <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-sky-400" /> Saldo</span>
            </div>
            {evolutionSummary.balanceDelta !== null && (
              <span className={cn('rounded-full border px-3 py-1', evolutionSummary.balanceDelta >= 0 ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-200' : 'border-rose-300/20 bg-rose-400/10 text-rose-200')}>
                {evolutionSummary.balanceDelta >= 0 ? '+' : ''}{maskCurrency(formatCurrency(evolutionSummary.balanceDelta))} vs mês anterior
              </span>
            )}
          </div>
        </PremiumCard>

          <PremiumCard className="relative overflow-hidden p-5 sm:p-6">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />
            <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div className="min-w-0">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-lg font-black text-white">Ritmo semanal</h2>
                    <p className="mt-1 text-sm text-slate-500">Como entradas e saídas se distribuem no mês.</p>
                  </div>
                  <span className="w-fit rounded-full border border-cyan-300/15 bg-cyan-400/[0.07] px-3 py-1 text-xs font-black text-cyan-200">
                    {weeklyFlowData.length} semanas analisadas
                  </span>
                </div>

                <div className="h-[210px] rounded-[1.35rem] border border-white/10 bg-[#070b12]/75 p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={weeklyFlowData} margin={{ top: 12, right: 14, left: -10, bottom: 0 }} barGap={6}>
                      <defs>
                        <linearGradient id="weeklyIncomeBar" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="#5eead4" stopOpacity={0.95} />
                          <stop offset="100%" stopColor="#10b981" stopOpacity={0.45} />
                        </linearGradient>
                        <linearGradient id="weeklyExpenseBar" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="#fb7185" stopOpacity={0.92} />
                          <stop offset="100%" stopColor="#be123c" stopOpacity={0.45} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(148,163,184,0.09)" strokeDasharray="4 10" vertical={false} />
                      <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: '#7c8aa3', fontSize: 12, fontWeight: 800 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }} tickFormatter={(v) => `R$${Math.round(Number(v) / 1000)}k`} />
                      <RechartsTooltip
                        cursor={{ fill: 'rgba(148,163,184,0.08)' }}
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
                      <Bar name="Receitas" dataKey="income" fill="url(#weeklyIncomeBar)" radius={[9, 9, 3, 3]} maxBarSize={34} />
                      <Bar name="Despesas" dataKey="expenses" fill="url(#weeklyExpenseBar)" radius={[9, 9, 3, 3]} maxBarSize={34} />
                      <Line name="Saldo" type="monotone" dataKey="balance" stroke="#38bdf8" strokeWidth={2.75} strokeLinecap="round" dot={{ r: 3.5, fill: '#38bdf8', stroke: '#07101a', strokeWidth: 2 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Melhor semana</p>
                  <p className="mt-2 text-lg font-black text-white">{weeklyFlowSummary.bestWeek?.week ?? '-'}</p>
                  <p className={cn('currency mt-1 text-sm font-black', (weeklyFlowSummary.bestWeek?.balance ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300')}>
                    {maskCurrency(formatCurrency(weeklyFlowSummary.bestWeek?.balance ?? 0))}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Mais pesada</p>
                  <p className="mt-2 text-lg font-black text-white">{weeklyFlowSummary.heaviestWeek?.week ?? '-'}</p>
                  <p className="currency mt-1 text-sm font-black text-rose-300">{maskCurrency(formatCurrency(weeklyFlowSummary.heaviestWeek?.expenses ?? 0))}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Média de gastos</p>
                  <p className="currency mt-2 text-lg font-black text-cyan-200">{maskCurrency(formatCurrency(weeklyFlowSummary.averageExpense))}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">por semana ativa</p>
                </div>
              </div>
            </div>
          </PremiumCard>
        </div>

        <div className="space-y-5">
          <PremiumCard className="p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-black text-white">Transações recentes</h2>
              <a href="/relatorio" className="text-xs font-black text-emerald-300 hover:underline">Ver todas</a>
            </div>
            <div className="space-y-3">
              {recentActivity.map((tx) => (
                <div key={tx.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.025] px-3 py-3">
                  <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm', tx.type === 'income' ? 'bg-emerald-400/10 text-emerald-300' : 'bg-red-400/10 text-red-300')}>{tx.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-white">{tx.description}</p>
                    <p className="mt-0.5 text-xs font-semibold text-slate-500">{formatDate(tx.date)} • {tx.label}</p>
                  </div>
                  <p className={cn('currency shrink-0 text-sm font-black tabular-nums', tx.type === 'income' ? 'text-emerald-300' : 'text-red-300')}>
                    {tx.type === 'income' ? '+' : '-'}{maskCurrency(formatCurrency(tx.amount))}
                  </p>
                </div>
              ))}
            </div>
          </PremiumCard>

          <PremiumCard className="p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-black text-white">Categorias principais</h2>
              <a href="/categorias" className="text-xs font-black text-emerald-300 hover:underline">Ver todas</a>
            </div>
            <div className="space-y-4">
              {catBreakdown.slice(0, 5).map((cat) => {
                const pct = currentTotalAll > 0 ? (cat.value / currentTotalAll) * 100 : 0;
                return (
                  <div key={cat.name}>
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-xs font-bold">
                      <span className="truncate text-slate-300">{cat.icon} {cat.name}</span>
                      <span className="shrink-0 text-slate-500">{pct.toFixed(0)}% • {maskCurrency(formatCurrency(cat.value))}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-sky-400" style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </PremiumCard>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(360px,0.9fr)]">
        <PremiumCard className="relative overflow-hidden p-5 sm:p-6">
          <div className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-rose-400/10 blur-3xl" />
          <div className="relative">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-200/70">Ranking</p>
                <h2 className="mt-1 text-lg font-black text-white">Top 5 despesas</h2>
              </div>
              <a href="/despesas" className="text-xs font-black text-rose-200 hover:underline">Ver despesas</a>
            </div>
            <div className="space-y-3">
              {topExpenses.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-sm font-semibold text-slate-500">Nenhuma despesa neste mês.</div>
              ) : topExpenses.map((item, index) => {
                const cat = categories.find(c => c.id === item.category_id);
                const pct = currentTotalAll > 0 ? (item.amount / currentTotalAll) * 100 : 0;
                return (
                  <div key={`${item.kind}-${item.id}`} className="group rounded-2xl border border-white/10 bg-white/[0.025] p-3 transition-all hover:border-rose-300/25 hover:bg-rose-400/[0.04]">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-rose-300/15 bg-rose-400/10 text-xs font-black text-rose-200">#{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-white">{item.description}</p>
                        <p className="mt-0.5 text-xs font-semibold text-slate-500">{formatDate(item.date)} • {cat?.icon} {cat?.name || 'Sem categoria'}</p>
                      </div>
                      <p className="currency shrink-0 text-sm font-black text-rose-200">{maskCurrency(formatCurrency(item.amount))}</p>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-gradient-to-r from-rose-300 to-red-500" style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </PremiumCard>

        <PremiumCard className="relative overflow-hidden p-5 sm:p-6">
          <div className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="relative">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200/70">Ranking</p>
                <h2 className="mt-1 text-lg font-black text-white">Top 5 receitas</h2>
              </div>
              <a href="/receitas" className="text-xs font-black text-emerald-200 hover:underline">Ver receitas</a>
            </div>
            <div className="space-y-3">
              {topIncomes.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-sm font-semibold text-slate-500">Nenhuma receita neste mês.</div>
              ) : topIncomes.map((item, index) => {
                const pct = totalIncome > 0 ? (Number(item.amount) / totalIncome) * 100 : 0;
                return (
                  <div key={item.id} className="group rounded-2xl border border-white/10 bg-white/[0.025] p-3 transition-all hover:border-emerald-300/25 hover:bg-emerald-400/[0.04]">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-300/15 bg-emerald-400/10 text-xs font-black text-emerald-200">#{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-white">{item.description || 'Receita'}</p>
                        <p className="mt-0.5 text-xs font-semibold text-slate-500">{formatDate(item.date)} • {item.status || 'concluido'}</p>
                      </div>
                      <p className="currency shrink-0 text-sm font-black text-emerald-200">{maskCurrency(formatCurrency(Number(item.amount)))}</p>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-teal-400" style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </PremiumCard>

        <PremiumCard className="relative overflow-hidden p-5 sm:p-6">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-blue-400/10 blur-3xl" />
          <div className="relative">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-200/70">Comparativo</p>
                <h2 className="mt-1 text-lg font-black text-white">Mês atual vs anterior</h2>
              </div>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-black text-slate-300">3 métricas</span>
            </div>
            <div className="h-[270px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthCompareData} margin={{ top: 10, right: 6, left: -18, bottom: 0 }} barGap={7}>
                  <CartesianGrid stroke="rgba(148,163,184,0.09)" strokeDasharray="4 10" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#7c8aa3', fontSize: 12, fontWeight: 800 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }} tickFormatter={(v) => `R$${Math.round(Number(v) / 1000)}k`} />
                  <RechartsTooltip
                    cursor={{ fill: 'rgba(148,163,184,0.08)' }}
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
                  <Bar name="Anterior" dataKey="anterior" fill="rgba(148,163,184,0.35)" radius={[8, 8, 3, 3]} maxBarSize={34} />
                  <Bar name="Atual" dataKey="atual" radius={[8, 8, 3, 3]} maxBarSize={34}>
                    {monthCompareData.map((entry) => <Cell key={entry.name} fill={entry.colorAtual} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold text-slate-400">
              <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-slate-500" /> Anterior</span>
              <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> Atual</span>
            </div>
          </div>
        </PremiumCard>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)]">
        <PremiumCard className="p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200/70">Orçamento</p>
              <h2 className="mt-1 text-lg font-black text-white">Metas por categoria</h2>
            </div>
            <a href="/categorias" className="text-xs font-black text-emerald-300 hover:underline">Ajustar metas</a>
          </div>
          {budgetsWithData.length > 0 ? (
            <BudgetRings budgets={budgetsWithData.slice(0, 5)} size={168} />
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-sm font-semibold text-slate-500">Cadastre orçamentos nas categorias para acompanhar metas aqui.</div>
          )}
        </PremiumCard>

        <PremiumCard className="p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-200/70">Calendário</p>
              <h2 className="mt-1 text-lg font-black text-white">Mapa de calor de gastos</h2>
            </div>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-black text-slate-300">{monthTitleCapitalized}</span>
          </div>
          <div className="rounded-[1.5rem] border border-white/10 bg-[#070b12]/75 p-4">
            <WeeklyHeatmap month={currentMonthDate} data={scopedExpenseHeatmapData} />
          </div>
        </PremiumCard>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <PremiumCard className="p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-white">Visão do mês</h2>
              <p className="text-sm text-slate-500">Dia {monthPace.dayOfMonth} de {monthPace.lastDayOfMonth}</p>
            </div>
            <Activity className="h-5 w-5 text-emerald-300" />
          </div>
          <div className="space-y-4">
            <div>
              <div className="mb-1.5 flex justify-between text-xs font-bold text-slate-400"><span>Avanço do mês</span><span>{monthPace.monthProgress.toFixed(0)}%</span></div>
              <div className="h-2 rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${monthPace.monthProgress}%` }} /></div>
            </div>
            <div>
              <div className="mb-1.5 flex justify-between text-xs font-bold text-slate-400"><span>Gastos do mês</span><span>{monthPace.spendProgress.toFixed(0)}%</span></div>
              <div className="h-2 rounded-full bg-white/10"><div className={cn('h-full rounded-full', monthPace.onTrack ? 'bg-emerald-400' : 'bg-red-400')} style={{ width: `${Math.min(100, monthPace.spendProgress)}%` }} /></div>
            </div>
            <p className="text-sm font-semibold text-slate-500">{maskCurrency(formatCurrency(currentTotalAll))} de {maskCurrency(formatCurrency(monthPace.totalBudget || currentTotalAll))} de orçamento</p>
            <div className="flex flex-wrap gap-2">
              <span className={cn('rounded-full px-3 py-1 text-xs font-black', monthPace.onTrack ? 'bg-emerald-400/10 text-emerald-300' : 'bg-red-400/10 text-red-300')}>{monthPace.onTrack ? 'No ritmo certo' : 'Acima do ritmo'}</span>
              {monthPace.paceVsPrev !== null && <span className="rounded-full bg-white/[0.05] px-3 py-1 text-xs font-black text-slate-300">{Math.abs(monthPace.paceVsPrev).toFixed(0)}% {monthPace.paceVsPrev > 0 ? 'mais rápido' : 'mais lento'} que mês anterior</span>}
            </div>
          </div>
        </PremiumCard>

        <PremiumCard className="p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-white">Gastos atípicos</h2>
              <p className="text-sm text-slate-500">Movimentos fora do padrão</p>
            </div>
            <a href="/despesas" className="text-xs font-black text-emerald-300 hover:underline">Ver todas</a>
          </div>
          <div className="space-y-3">
            {atypicalRows.map((row) => (
              <div key={row.id} className="rounded-2xl border border-white/10 bg-white/[0.025] px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-white">{row.description}</p>
                    <p className="mt-0.5 text-xs font-semibold text-slate-500">{formatDate(row.date)} • {row.category}</p>
                  </div>
                  <span className="rounded-full bg-amber-400/10 px-2 py-1 text-[10px] font-black text-amber-300">{row.badge}</span>
                </div>
                <p className="currency mt-2 text-sm font-black text-red-300">{maskCurrency(formatCurrency(row.amount))}</p>
              </div>
            ))}
          </div>
        </PremiumCard>

        <PremiumCard className="p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-white">Alocação do patrimônio</h2>
              <p className="text-sm text-slate-500">Contas vs investimentos</p>
            </div>
            <a href="/investimentos" className="text-xs font-black text-emerald-300 hover:underline">Ver detalhes</a>
          </div>
          <div className="grid gap-4 sm:grid-cols-[150px_1fr] sm:items-center xl:grid-cols-1 2xl:grid-cols-[150px_1fr]">
            <div className="h-[150px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={allocationData.length ? allocationData : [{ name: 'Sem dados', value: 1, fill: '#334155' }]} dataKey="value" innerRadius={44} outerRadius={68} paddingAngle={4}>
                    {(allocationData.length ? allocationData : [{ fill: '#334155' }]).map((entry, index) => <Cell key={`alloc-${index}`} fill={entry.fill} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              {allocationData.map((item) => {
                const pct = allocationTotal > 0 ? (item.value / allocationTotal) * 100 : 0;
                return (
                  <div key={item.name} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.025] px-3 py-3">
                    <span className="flex items-center gap-2 text-sm font-bold text-slate-300"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.fill }} /> {item.name}</span>
                    <span className="text-right text-sm font-black text-white">{maskCurrency(formatCurrency(item.value))}<span className="ml-2 text-xs text-slate-500">{pct.toFixed(1)}%</span></span>
                  </div>
                );
              })}
              <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-3 text-sm font-black text-emerald-200">
                Total • {maskCurrency(formatCurrency(netWorth))}
              </div>
            </div>
          </div>
        </PremiumCard>
      </section>

      {orphanExpensesTotal > 0 && (
        <button onClick={() => setOrphanFixOpen(true)} className="flex w-full items-center gap-3 rounded-2xl border border-amber-300/20 bg-amber-400/[0.06] px-4 py-3 text-left transition-colors hover:bg-amber-400/10">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-300" />
          <span className="min-w-0 flex-1 text-sm font-semibold text-slate-300">
            {orphanExpensesCount} despesa{orphanExpensesCount !== 1 ? 's' : ''} sem conta • {maskCurrency(formatCurrency(orphanExpensesTotal))}. Clique para corrigir.
          </span>
          <ChevronRight className="h-4 w-4 text-slate-500" />
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
