import { useState, useRef, useMemo } from 'react';
import { useIncome, useExpenses, useCategories, useAccounts } from '@/hooks/useFinanceData';
import { useCreditCardTransactions } from '@/hooks/useCreditCards';
import { formatCurrency, getMonthLabel } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  TrendingUp, TrendingDown, Wallet, PiggyBank, FileText, Download, Sparkles, BarChart3,
  Flame, Calendar, Target, ArrowUpRight, ArrowDownRight, Award,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  AreaChart, Area, Legend,
} from 'recharts';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const CHART_COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'];

function getMonthOptions() {
  const opts: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    opts.push({ value: val, label: getMonthLabel(val) });
  }
  return opts;
}

type TooltipPayload = { color?: string; fill?: string; name?: string; dataKey?: string; value?: number };

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2.5 shadow-lg backdrop-blur-sm">
      {label && <p className="mb-1.5 text-xs font-bold capitalize">{label}</p>}
      <div className="space-y-1">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color || p.fill }} />
              <span className="text-muted-foreground capitalize">{p.name || p.dataKey}</span>
            </div>
            <span className="font-bold currency tabular-nums">{formatCurrency(Number(p.value))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ReportPage() {
  const monthOptions = getMonthOptions();
  const currentMonth = monthOptions[monthOptions.length - 1].value;
  const [startMonth, setStartMonth] = useState(currentMonth);
  const [endMonth, setEndMonth] = useState(currentMonth);
  const [generated, setGenerated] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  // Build all months in range
  const monthsInRange: string[] = useMemo(() => {
    if (!generated) return [];
    const out: string[] = [];
    const [sy, sm] = startMonth.split('-').map(Number);
    const [ey, em] = endMonth.split('-').map(Number);
    const cur = new Date(sy, sm - 1);
    const end = new Date(ey, em - 1);
    while (cur <= end) {
      out.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`);
      cur.setMonth(cur.getMonth() + 1);
    }
    return out;
  }, [generated, startMonth, endMonth]);

  const { data: allIncome = [] } = useIncome(generated ? undefined : '__skip__');
  const { data: allExpenses = [] } = useExpenses(generated ? undefined : '__skip__');
  const { data: allCCTransactions = [] } = useCreditCardTransactions();
  const { data: categories = [] } = useCategories();
  const { data: accounts = [] } = useAccounts();

  const incomeInRange = allIncome.filter(i => {
    const m = i.date?.substring(0, 7);
    return m && m >= startMonth && m <= endMonth;
  });

  // Filter out CC mirror rows and bill payment markers — the actual CC charges come in via
  // allCCTransactions grouped by bill_month. Without this, CC purchases get double-counted
  // (mirror in expenses + tx in cc_transactions).
  const isCCMirror = (notes: string | null | undefined) =>
    !!notes && /\[Cartao de credito\b/i.test(notes);
  const isBillPayment = (notes: string | null | undefined) =>
    !!notes && /\[FATURA_CARTAO\]/i.test(notes);

  const expensesInRange = allExpenses.filter(e => {
    const m = e.date?.substring(0, 7);
    if (!m || m < startMonth || m > endMonth) return false;
    return !isCCMirror(e.notes) && !isBillPayment(e.notes);
  });

  const ccTransactionsInRange = allCCTransactions.filter(t => {
    return t.bill_month && t.bill_month >= startMonth && t.bill_month <= endMonth;
  });

  const totalIncome = incomeInRange.filter(i => i.status === 'concluido').reduce((s, i) => s + Number(i.amount), 0);
  const totalExpensesNonCC = expensesInRange.filter(e => e.status === 'concluido').reduce((s, e) => s + Number(e.amount), 0);
  const totalCC = ccTransactionsInRange.reduce((s, t) => s + Number(t.amount), 0);
  const totalExpenses = totalExpensesNonCC + totalCC;
  const balance = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? (balance / totalIncome) * 100 : 0;

  const pendingIncome = incomeInRange.filter(i => i.status !== 'concluido').reduce((s, i) => s + Number(i.amount), 0);
  const pendingExpenses = expensesInRange.filter(e => e.status !== 'concluido').reduce((s, e) => s + Number(e.amount), 0);

  // Category breakdown: combine non-CC expenses + CC transactions by category
  const catBreakdown = categories
    .map(cat => {
      const fromExp = expensesInRange.filter(e => e.category_id === cat.id && e.status === 'concluido').reduce((s, e) => s + Number(e.amount), 0);
      const fromCC = ccTransactionsInRange.filter(t => t.category_id === cat.id).reduce((s, t) => s + Number(t.amount), 0);
      return {
        name: cat.name,
        icon: cat.icon,
        value: fromExp + fromCC,
      };
    })
    .filter(c => c.value > 0)
    .sort((a, b) => b.value - a.value);

  const monthlyTrend = monthsInRange.map(m => {
    const inc = incomeInRange.filter(i => i.date?.startsWith(m) && i.status === 'concluido').reduce((s, i) => s + Number(i.amount), 0);
    const expReal = expensesInRange.filter(e => e.date?.startsWith(m) && e.status === 'concluido').reduce((s, e) => s + Number(e.amount), 0);
    const expCC = ccTransactionsInRange.filter(t => t.bill_month === m).reduce((s, t) => s + Number(t.amount), 0);
    const exp = expReal + expCC;
    const [y, mo] = m.split('-').map(Number);
    const shortNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return {
      month: `${shortNames[mo - 1]}/${String(y).slice(2)}`,
      receitas: inc,
      despesas: exp,
      saldo: inc - exp,
    };
  });

  // Top 10 — combine biggest individual movements from both sources
  const topExpenses = [
    ...expensesInRange.filter(e => e.status === 'concluido').map(e => ({
      id: e.id,
      description: e.description,
      amount: Number(e.amount),
      date: e.date,
      category_id: e.category_id,
      isCC: false,
    })),
    ...ccTransactionsInRange.map(t => ({
      id: t.id,
      description: t.description,
      amount: Number(t.amount),
      date: t.date,
      category_id: t.category_id,
      isCC: true,
    })),
  ].sort((a, b) => b.amount - a.amount).slice(0, 10);

  const accountBreakdown = accounts
    .map(acc => {
      const accIncome = incomeInRange.filter(i => i.account_id === acc.id && i.status === 'concluido').reduce((s, i) => s + Number(i.amount), 0);
      const accExpense = expensesInRange.filter(e => e.account_id === acc.id && e.status === 'concluido').reduce((s, e) => s + Number(e.amount), 0);
      return {
        id: acc.id,
        icon: acc.icon,
        name: acc.name,
        income: accIncome,
        expense: accExpense,
        balance: accIncome - accExpense,
      };
    })
    .filter(a => a.income > 0 || a.expense > 0)
    .sort((a, b) => (b.income + b.expense) - (a.income + a.expense));

  // Best & worst month
  const bestMonth = monthlyTrend.reduce((best, m) => m.saldo > (best?.saldo ?? -Infinity) ? m : best, null as typeof monthlyTrend[0] | null);
  const worstMonth = monthlyTrend.reduce((worst, m) => m.saldo < (worst?.saldo ?? Infinity) ? m : worst, null as typeof monthlyTrend[0] | null);
  const avgIncome = monthlyTrend.length > 0 ? monthlyTrend.reduce((s, m) => s + m.receitas, 0) / monthlyTrend.length : 0;
  const avgExpense = monthlyTrend.length > 0 ? monthlyTrend.reduce((s, m) => s + m.despesas, 0) / monthlyTrend.length : 0;

  const periodLabel = startMonth === endMonth
    ? getMonthLabel(startMonth)
    : `${getMonthLabel(startMonth)} — ${getMonthLabel(endMonth)}`;

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Relatorio Financeiro', pageWidth / 2, y, { align: 'center' });
    y += 8;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(periodLabel.normalize('NFD').replace(/[\\u0300-\\u036f]/g, ''), pageWidth / 2, y, { align: 'center' });
    y += 14;

    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumo', 14, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    const fmtBRL = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

    const summaryData = [
      ['Receitas', fmtBRL(totalIncome)],
      ['Despesas', fmtBRL(totalExpenses)],
      ['Saldo', fmtBRL(balance)],
      ['Taxa de Economia', `${savingsRate.toFixed(1)}%`],
    ];

    (doc as unknown as { autoTable: (opts: Record<string, unknown>) => void }).autoTable({
      startY: y,
      head: [['Item', 'Valor']],
      body: summaryData,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
      margin: { left: 14, right: 14 },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;

    if (catBreakdown.length > 0) {
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('Despesas por Categoria', 14, y);
      y += 8;

      const catData = catBreakdown.map(c => [
        `${c.icon} ${c.name}`.normalize('NFD').replace(/[\\u0300-\\u036f]/g, ''),
        fmtBRL(c.value),
        totalExpenses > 0 ? `${((c.value / totalExpenses) * 100).toFixed(1)}%` : '0%',
      ]);

      (doc as unknown as { autoTable: (opts: Record<string, unknown>) => void }).autoTable({
        startY: y,
        head: [['Categoria', 'Valor', '% Total']],
        body: catData,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] },
        margin: { left: 14, right: 14 },
      });

      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
    }

    if (topExpenses.length > 0) {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('Top 10 Maiores Despesas', 14, y);
      y += 8;

      const topData = topExpenses.map((e, i) => {
        const cat = categories.find(c => c.id === e.category_id);
        return [
          String(i + 1),
          (e.description || 'Despesa').normalize('NFD').replace(/[\\u0300-\\u036f]/g, ''),
          cat ? cat.name.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '') : '-',
          e.date,
          fmtBRL(Number(e.amount)),
        ];
      });

      (doc as unknown as { autoTable: (opts: Record<string, unknown>) => void }).autoTable({
        startY: y,
        head: [['#', 'Descricao', 'Categoria', 'Data', 'Valor']],
        body: topData,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] },
        margin: { left: 14, right: 14 },
        columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 60 } },
      });

      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
    }

    if (accountBreakdown.length > 0) {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('Resumo por Conta', 14, y);
      y += 8;

      const accData = accountBreakdown.map(a => [
        `${a.icon} ${a.name}`.normalize('NFD').replace(/[\\u0300-\\u036f]/g, ''),
        fmtBRL(a.income),
        fmtBRL(a.expense),
        fmtBRL(a.balance),
      ]);

      (doc as unknown as { autoTable: (opts: Record<string, unknown>) => void }).autoTable({
        startY: y,
        head: [['Conta', 'Receitas', 'Despesas', 'Saldo']],
        body: accData,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] },
        margin: { left: 14, right: 14 },
      });
    }

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`FinancasPro - Pagina ${i}/${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
    }

    const fileName = `relatorio_${startMonth}${startMonth !== endMonth ? `_a_${endMonth}` : ''}.pdf`;
    doc.save(fileName);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* â”€â”€â”€ Hero Header â”€â”€â”€ */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-info/[0.05] p-4 shadow-sm sm:rounded-3xl sm:p-7">
        <div className="absolute -top-24 -right-32 w-80 h-80 bg-info/15 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute -bottom-32 -left-24 w-72 h-72 bg-primary/[0.08] blur-3xl rounded-full pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-end justify-between gap-5">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-info/25 to-info/5 flex items-center justify-center shadow-inner border border-info/15 shrink-0">
              <FileText className="w-6 h-6 sm:w-7 sm:h-7 text-info" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-none">Relatório Financeiro</h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 flex items-center gap-2 flex-wrap">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-info animate-pulse" />
                Resumo detalhado e exportável em PDF
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* â”€â”€â”€ Period Selector Card â”€â”€â”€ */}
      <div className="rounded-2xl border border-border/60 bg-card/70 backdrop-blur-sm p-4 shadow-sm sm:rounded-3xl sm:p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/15">
            <Calendar className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold leading-tight">Selecionar Período</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Escolha o intervalo de meses para análise</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-[1fr_1fr_auto_auto] items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Mês Inicial</Label>
            <Select value={startMonth} onValueChange={setStartMonth}>
              <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {monthOptions.map(o => (
                  <SelectItem key={o.value} value={o.value} className="capitalize">{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Mês Final</Label>
            <Select value={endMonth} onValueChange={setEndMonth}>
              <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {monthOptions.filter(o => o.value >= startMonth).map(o => (
                  <SelectItem key={o.value} value={o.value} className="capitalize">{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => setGenerated(true)} className="h-10 rounded-xl gap-2 bg-primary hover:bg-primary/90">
            <Sparkles className="w-4 h-4" />
            Gerar Relatório
          </Button>
          {generated && (
            <Button onClick={handleExportPDF} variant="outline" className="h-10 rounded-xl gap-2 border-info/30 text-info hover:bg-info/10">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Exportar PDF</span>
              <span className="sm:hidden">PDF</span>
            </Button>
          )}
        </div>
      </div>

      {/* â”€â”€â”€ Empty State â”€â”€â”€ */}
      {!generated && (
        <div className="rounded-3xl border border-dashed border-border/50 bg-muted/10 py-20 px-6 text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-info/15 to-info/5 flex items-center justify-center mx-auto mb-4 border border-info/15 shadow-inner">
            <BarChart3 className="w-10 h-10 text-info/50" />
          </div>
          <p className="font-extrabold text-lg mb-1">Pronto para gerar seu relatório</p>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">Escolha o período acima e clique em <span className="font-semibold text-foreground">Gerar Relatório</span> para visualizar análises completas</p>
        </div>
      )}

      {/* â”€â”€â”€ Report Body â”€â”€â”€ */}
      {generated && (
        <div ref={reportRef} className="space-y-6 animate-fade-in">
          {/* Period Banner */}
          <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/[0.08] via-primary/[0.04] to-transparent p-5 sm:p-6">
            <div className="absolute -top-16 -right-16 w-48 h-48 bg-primary/15 blur-3xl rounded-full pointer-events-none" />
            <div className="relative z-10 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center border border-primary/25">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Período analisado</p>
                  <p className="text-base sm:text-lg font-extrabold capitalize">{periodLabel}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-card/70 border border-border/60 text-[11px] font-semibold">
                  <Calendar className="w-3 h-3" /> {monthsInRange.length} {monthsInRange.length === 1 ? 'mês' : 'meses'}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-income/10 border border-income/20 text-income text-[11px] font-semibold">
                  <TrendingUp className="w-3 h-3" /> {incomeInRange.length} receitas
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-expense/10 border border-expense/20 text-expense text-[11px] font-semibold">
                  <TrendingDown className="w-3 h-3" /> {expensesInRange.length + ccTransactionsInRange.length} despesas
                </span>
              </div>
            </div>
          </div>

          {/* Summary KPIs */}
          <div className="grid grid-cols-1 gap-3 min-[390px]:grid-cols-2 lg:grid-cols-4 sm:gap-4">
            <div className="relative overflow-hidden rounded-2xl border border-income/25 bg-card/70 backdrop-blur-sm p-4 sm:p-5 shadow-sm">
              <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full opacity-[0.08] pointer-events-none" style={{ background: 'radial-gradient(circle, hsl(160, 84%, 39%) 0%, transparent 70%)' }} />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-income/10 flex items-center justify-center text-income">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Receitas</span>
                </div>
                <p className="text-lg sm:text-xl font-extrabold currency text-income tabular-nums whitespace-nowrap truncate">{formatCurrency(totalIncome)}</p>
                {pendingIncome > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-1.5 line-clamp-1">+ {formatCurrency(pendingIncome)} pendente</p>
                )}
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-expense/25 bg-card/70 backdrop-blur-sm p-4 sm:p-5 shadow-sm">
              <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full opacity-[0.08] pointer-events-none" style={{ background: 'radial-gradient(circle, hsl(0, 72%, 51%) 0%, transparent 70%)' }} />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-expense/10 flex items-center justify-center text-expense">
                    <TrendingDown className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Despesas</span>
                </div>
                <p className="text-lg sm:text-xl font-extrabold currency text-expense tabular-nums whitespace-nowrap truncate">{formatCurrency(totalExpenses)}</p>
                {pendingExpenses > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-1.5 line-clamp-1">+ {formatCurrency(pendingExpenses)} pendente</p>
                )}
              </div>
            </div>

            <div className={cn(
              'relative overflow-hidden rounded-2xl border bg-card/70 backdrop-blur-sm p-4 sm:p-5 shadow-sm',
              balance >= 0 ? 'border-info/25' : 'border-expense/25',
            )}>
              <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full opacity-[0.08] pointer-events-none" style={{ background: `radial-gradient(circle, ${balance >= 0 ? 'hsl(217, 91%, 60%)' : 'hsl(0, 72%, 51%)'} 0%, transparent 70%)` }} />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', balance >= 0 ? 'bg-info/10 text-info' : 'bg-expense/10 text-expense')}>
                    <Wallet className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Saldo</span>
                </div>
                <p className={cn('text-lg sm:text-xl font-extrabold currency tabular-nums whitespace-nowrap truncate', balance >= 0 ? 'text-info' : 'text-expense')}>{formatCurrency(balance)}</p>
                <p className="text-[10px] text-muted-foreground mt-1.5">{balance >= 0 ? '✅ Período positivo' : '⚠️ Período negativo'}</p>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-card/70 backdrop-blur-sm p-4 sm:p-5 shadow-sm">
              <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full opacity-[0.08] pointer-events-none" style={{ background: 'radial-gradient(circle, hsl(217, 91%, 60%) 0%, transparent 70%)' }} />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <PiggyBank className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Economia</span>
                </div>
                <p className={cn('text-lg sm:text-xl font-extrabold tabular-nums', savingsRate >= 0 ? 'text-income' : 'text-expense')}>{savingsRate.toFixed(1)}%</p>
                <p className="text-[10px] text-muted-foreground mt-1.5">{savingsRate >= 20 ? '🎯 Acima da meta' : savingsRate >= 10 ? '👍 No caminho' : '⚠️ Aumente'}</p>
              </div>
            </div>
          </div>

          {/* Period Stats (only when range > 1 month) */}
          {monthsInRange.length > 1 && (
            <div className="grid grid-cols-1 gap-3 min-[390px]:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-border/60 bg-card/50 p-3.5">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <ArrowUpRight className="w-3 h-3 text-income" />
                  <p className="text-[10px] font-bold uppercase tracking-wider">Receita média/mês</p>
                </div>
                <p className="text-base font-extrabold currency text-income tabular-nums whitespace-nowrap truncate">{formatCurrency(avgIncome)}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-card/50 p-3.5">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <ArrowDownRight className="w-3 h-3 text-expense" />
                  <p className="text-[10px] font-bold uppercase tracking-wider">Despesa média/mês</p>
                </div>
                <p className="text-base font-extrabold currency text-expense tabular-nums whitespace-nowrap truncate">{formatCurrency(avgExpense)}</p>
              </div>
              {bestMonth && (
                <div className="rounded-2xl border border-income/25 bg-income/[0.04] p-3.5">
                  <div className="flex items-center gap-1.5 text-income mb-1">
                    <Award className="w-3 h-3" />
                    <p className="text-[10px] font-bold uppercase tracking-wider">Melhor mês</p>
                  </div>
                  <p className="text-sm font-extrabold capitalize">{bestMonth.month}</p>
                  <p className="text-[10px] currency font-semibold text-income tabular-nums">{formatCurrency(bestMonth.saldo)}</p>
                </div>
              )}
              {worstMonth && bestMonth && worstMonth.month !== bestMonth.month && (
                <div className="rounded-2xl border border-expense/25 bg-expense/[0.04] p-3.5">
                  <div className="flex items-center gap-1.5 text-expense mb-1">
                    <Flame className="w-3 h-3" />
                    <p className="text-[10px] font-bold uppercase tracking-wider">Pior mês</p>
                  </div>
                  <p className="text-sm font-extrabold capitalize">{worstMonth.month}</p>
                  <p className="text-[10px] currency font-semibold text-expense tabular-nums">{formatCurrency(worstMonth.saldo)}</p>
                </div>
              )}
            </div>
          )}

          {/* Charts: Categoria Pie + Evolução */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Categoria */}
            <div className="rounded-3xl border border-border/60 bg-card/70 backdrop-blur-sm p-5 sm:p-6 shadow-sm">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-expense/20 to-expense/5 flex items-center justify-center border border-expense/15">
                  <Target className="w-4 h-4 text-expense" />
                </div>
                <div>
                  <h3 className="text-sm font-bold leading-tight">Por Categoria</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Onde seu dinheiro foi</p>
                </div>
              </div>
              {catBreakdown.length > 0 ? (
                <div className="flex flex-col sm:flex-row items-center gap-5">
                  <div className="relative w-44 h-44 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={catBreakdown} dataKey="value" cx="50%" cy="50%" innerRadius={48} outerRadius={75} paddingAngle={2} strokeWidth={0}>
                          {catBreakdown.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Total</p>
                      <p className="text-sm font-extrabold currency tabular-nums whitespace-nowrap">{formatCurrency(totalExpenses)}</p>
                    </div>
                  </div>
                  <div className="flex-1 w-full space-y-2">
                    {catBreakdown.slice(0, 6).map((cat, i) => {
                      const pct = totalExpenses > 0 ? (cat.value / totalExpenses) * 100 : 0;
                      return (
                        <div key={cat.name}>
                          <div className="flex items-center justify-between mb-1 text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                              <span className="truncate text-muted-foreground">{cat.icon} {cat.name}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] text-muted-foreground font-semibold w-7 text-right tabular-nums">{pct.toFixed(0)}%</span>
                              <span className="font-bold currency tabular-nums whitespace-nowrap">{formatCurrency(cat.value)}</span>
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
                <div className="flex flex-col items-center py-8 text-muted-foreground">
                  <Target className="w-10 h-10 opacity-30 mb-2" />
                  <p className="text-sm">Nenhuma despesa categorizada no período</p>
                </div>
              )}
            </div>

            {/* Evolução / Single Month Visualization */}
            <div className="rounded-3xl border border-border/60 bg-card/70 backdrop-blur-sm p-5 sm:p-6 shadow-sm">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/15">
                  <BarChart3 className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-bold leading-tight">{monthsInRange.length > 1 ? 'Evolução Mensal' : 'Receitas vs Despesas'}</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {monthsInRange.length > 1 ? `${monthsInRange.length} meses` : 'Comparativo do mês'}
                  </p>
                </div>
              </div>
              <div className="h-[220px] -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                  {monthsInRange.length > 1 ? (
                    <AreaChart data={monthlyTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="rep-rec" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="rep-desp" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.3} vertical={false} />
                      <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.3)' }} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 600 }} />
                      <Area type="monotone" dataKey="receitas" name="Receitas" stroke="hsl(160, 84%, 39%)" strokeWidth={2.5} fill="url(#rep-rec)" />
                      <Area type="monotone" dataKey="despesas" name="Despesas" stroke="hsl(0, 72%, 51%)" strokeWidth={2.5} fill="url(#rep-desp)" />
                    </AreaChart>
                  ) : (
                    <BarChart data={monthlyTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
                      <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.3} vertical={false} />
                      <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.3)' }} />
                      <Bar dataKey="receitas" name="Receitas" fill="hsl(160, 84%, 39%)" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="despesas" name="Despesas" fill="hsl(0, 72%, 51%)" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Top 10 Expenses */}
          {topExpenses.length > 0 && (
            <div className="rounded-3xl border border-border/60 bg-card/70 backdrop-blur-sm p-5 sm:p-6 shadow-sm">
              <div className="flex items-center justify-between mb-5 gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-expense/20 to-expense/5 flex items-center justify-center border border-expense/15">
                    <Flame className="w-4 h-4 text-expense" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold leading-tight">Top 10 Maiores Despesas</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Os maiores gastos do período</p>
                  </div>
                </div>
                <span className="text-[11px] text-muted-foreground font-semibold">
                  {((topExpenses.reduce((s, e) => s + Number(e.amount), 0) / Math.max(totalExpenses, 1)) * 100).toFixed(0)}% do total
                </span>
              </div>
              <div className="space-y-2.5">
                {topExpenses.map((e, i) => {
                  const cat = categories.find(c => c.id === e.category_id);
                  const pct = totalExpenses > 0 ? (Number(e.amount) / totalExpenses) * 100 : 0;
                  const maxValue = Number(topExpenses[0].amount);
                  const widthPct = maxValue > 0 ? (Number(e.amount) / maxValue) * 100 : 0;
                  return (
                    <div key={e.id} className="group relative">
                      <div className="flex items-center gap-3 mb-1">
                        <div className={cn(
                          'w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-extrabold shrink-0',
                          i === 0 ? 'bg-gradient-to-br from-expense to-expense/70 text-white shadow-sm shadow-expense/30' :
                          i === 1 ? 'bg-expense/15 text-expense border border-expense/25' :
                          i === 2 ? 'bg-expense/10 text-expense/80 border border-expense/20' :
                          'bg-muted text-muted-foreground border border-border/60',
                        )}>
                          #{i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <p className="text-sm font-semibold truncate">{e.description || 'Despesa'}</p>
                              {e.isCC && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-[#6366f1]/10 text-[#6366f1] border border-[#6366f1]/20 font-bold shrink-0">CARTÃO</span>
                              )}
                            </div>
                            <span className="text-sm font-extrabold currency text-expense tabular-nums whitespace-nowrap shrink-0">{formatCurrency(Number(e.amount))}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {cat && <span className="text-[10px] text-muted-foreground font-medium">{cat.icon} {cat.name}</span>}
                            <span className="text-[10px] text-muted-foreground">·  {e.date}</span>
                            <span className="text-[10px] text-expense font-bold ml-auto sm:ml-0">{pct.toFixed(1)}% do total</span>
                          </div>
                        </div>
                      </div>
                      <div className="h-1 bg-muted/60 rounded-full overflow-hidden ml-10">
                        <div className="h-full bg-gradient-to-r from-expense/40 to-expense/80 rounded-full transition-all duration-700" style={{ width: `${widthPct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Account Breakdown */}
          {accountBreakdown.length > 0 && (
            <div className="rounded-3xl border border-border/60 bg-card/70 backdrop-blur-sm p-5 sm:p-6 shadow-sm">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-info/20 to-info/5 flex items-center justify-center border border-info/15">
                  <Wallet className="w-4 h-4 text-info" />
                </div>
                <div>
                  <h3 className="text-sm font-bold leading-tight">Resumo por Conta</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Movimentação em cada conta</p>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {accountBreakdown.map(acc => (
                  <div key={acc.id} className="rounded-2xl border border-border/60 bg-card/50 p-4 hover:bg-card/70 transition-colors">
                    <div className="flex items-center gap-2.5 mb-3 pb-3 border-b border-border/40">
                      <span className="text-2xl">{acc.icon}</span>
                      <p className="text-sm font-bold truncate">{acc.name}</p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <ArrowUpRight className="w-3 h-3 text-income" /> Entradas
                        </span>
                        <span className="text-xs font-bold text-income currency tabular-nums whitespace-nowrap">{formatCurrency(acc.income)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <ArrowDownRight className="w-3 h-3 text-expense" /> Saídas
                        </span>
                        <span className="text-xs font-bold text-expense currency tabular-nums whitespace-nowrap">{formatCurrency(acc.expense)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Saldo</span>
                        <span className={cn('text-sm font-extrabold currency tabular-nums whitespace-nowrap', acc.balance >= 0 ? 'text-income' : 'text-expense')}>{formatCurrency(acc.balance)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Insights Final */}
          <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/[0.06] via-card to-card p-5 sm:p-6 shadow-sm">
            <div className="absolute -top-16 -right-12 w-44 h-44 bg-primary/15 blur-3xl rounded-full pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/25 to-primary/10 flex items-center justify-center border border-primary/20">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-bold leading-tight">Insights do Período</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Conclusões automáticas dos seus dados</p>
                </div>
              </div>
              <div className="space-y-2.5">
                {balance >= 0 ? (
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-income/[0.06] border border-income/20">
                    <div className="w-7 h-7 rounded-lg bg-income/15 flex items-center justify-center shrink-0 text-income">
                      <Award className="w-4 h-4" />
                    </div>
                    <p className="text-sm leading-relaxed">
                      Você economizou <span className="font-extrabold currency text-income">{formatCurrency(balance)}</span> no período <span className="text-muted-foreground">({savingsRate.toFixed(1)}% da renda)</span>.
                    </p>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-expense/[0.06] border border-expense/20">
                    <div className="w-7 h-7 rounded-lg bg-expense/15 flex items-center justify-center shrink-0 text-expense">
                      <Flame className="w-4 h-4" />
                    </div>
                    <p className="text-sm leading-relaxed">
                      Gastou <span className="font-extrabold currency text-expense">{formatCurrency(Math.abs(balance))}</span> a mais do que ganhou no período.
                    </p>
                  </div>
                )}
                {catBreakdown[0] && (
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border/50">
                    <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Target className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <p className="text-sm leading-relaxed">
                      Maior categoria: <span className="font-bold">{catBreakdown[0].icon} {catBreakdown[0].name}</span> com <span className="currency font-bold">{formatCurrency(catBreakdown[0].value)}</span> <span className="text-muted-foreground">({totalExpenses > 0 ? ((catBreakdown[0].value / totalExpenses) * 100).toFixed(0) : 0}% das despesas)</span>.
                    </p>
                  </div>
                )}
                {topExpenses[0] && (
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border/50">
                    <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Flame className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <p className="text-sm leading-relaxed">
                      Maior gasto individual: <span className="font-bold">"{topExpenses[0].description || 'Despesa'}"</span> de <span className="currency font-bold text-expense">{formatCurrency(Number(topExpenses[0].amount))}</span>.
                    </p>
                  </div>
                )}
                {monthsInRange.length > 1 && bestMonth && (
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-info/[0.06] border border-info/20">
                    <div className="w-7 h-7 rounded-lg bg-info/15 flex items-center justify-center shrink-0 text-info">
                      <BarChart3 className="w-4 h-4" />
                    </div>
                    <p className="text-sm leading-relaxed">
                      Melhor performance em <span className="font-bold capitalize">{bestMonth.month}</span>, com saldo de <span className="currency font-bold text-income">{formatCurrency(bestMonth.saldo)}</span>.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


