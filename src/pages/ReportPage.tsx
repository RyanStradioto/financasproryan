import { useState, useRef } from 'react';
import { useIncome, useExpenses, useCategories, useAccounts } from '@/hooks/useFinanceData';
import { useCreditCardTransactions } from '@/hooks/useCreditCards';
import { formatCurrency, getMonthLabel } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { TrendingUp, TrendingDown, Wallet, PiggyBank, CreditCard, FileText, Download } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

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

export default function ReportPage() {
  const monthOptions = getMonthOptions();
  const currentMonth = monthOptions[monthOptions.length - 1].value;
  const [startMonth, setStartMonth] = useState(currentMonth);
  const [endMonth, setEndMonth] = useState(currentMonth);
  const [generated, setGenerated] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  // Build all months in range
  const monthsInRange: string[] = [];
  if (generated) {
    const [sy, sm] = startMonth.split('-').map(Number);
    const [ey, em] = endMonth.split('-').map(Number);
    let cur = new Date(sy, sm - 1);
    const end = new Date(ey, em - 1);
    while (cur <= end) {
      monthsInRange.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`);
      cur.setMonth(cur.getMonth() + 1);
    }
  }

  // Data queries for each month
  const { data: allIncome = [] } = useIncome(generated ? undefined : '__skip__');
  const { data: allExpenses = [] } = useExpenses(generated ? undefined : '__skip__');
  const { data: categories = [] } = useCategories();
  const { data: accounts = [] } = useAccounts();

  // Filter to range
  const incomeInRange = allIncome.filter(i => {
    const m = i.date?.substring(0, 7);
    return m && m >= startMonth && m <= endMonth;
  });
  const expensesInRange = allExpenses.filter(e => {
    const m = e.date?.substring(0, 7);
    return m && m >= startMonth && m <= endMonth;
  });

  const totalIncome = incomeInRange.filter(i => i.status === 'concluido').reduce((s, i) => s + Number(i.amount), 0);
  const totalExpenses = expensesInRange.filter(e => e.status === 'concluido').reduce((s, e) => s + Number(e.amount), 0);
  const balance = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? (balance / totalIncome) * 100 : 0;

  const pendingIncome = incomeInRange.filter(i => i.status !== 'concluido').reduce((s, i) => s + Number(i.amount), 0);
  const pendingExpenses = expensesInRange.filter(e => e.status !== 'concluido').reduce((s, e) => s + Number(e.amount), 0);

  // Category breakdown
  const catBreakdown = categories
    .map(cat => ({
      name: `${cat.icon} ${cat.name}`,
      value: expensesInRange.filter(e => e.category_id === cat.id).reduce((s, e) => s + Number(e.amount), 0),
    }))
    .filter(c => c.value > 0)
    .sort((a, b) => b.value - a.value);

  // Monthly trend
  const monthlyTrend = monthsInRange.map(m => {
    const inc = incomeInRange.filter(i => i.date?.startsWith(m) && i.status === 'concluido').reduce((s, i) => s + Number(i.amount), 0);
    const exp = expensesInRange.filter(e => e.date?.startsWith(m) && e.status === 'concluido').reduce((s, e) => s + Number(e.amount), 0);
    const [y, mo] = m.split('-').map(Number);
    const shortNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return { month: `${shortNames[mo - 1]}/${String(y).slice(2)}`, receitas: inc, despesas: exp };
  });

  // Top expenses
  const topExpenses = [...expensesInRange]
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, 10);

  // Account breakdown
  const accountBreakdown = accounts
    .map(acc => {
      const accIncome = incomeInRange.filter(i => i.account_id === acc.id && i.status === 'concluido').reduce((s, i) => s + Number(i.amount), 0);
      const accExpense = expensesInRange.filter(e => e.account_id === acc.id && e.status === 'concluido').reduce((s, e) => s + Number(e.amount), 0);
      return { name: `${acc.icon} ${acc.name}`, income: accIncome, expense: accExpense, balance: accIncome - accExpense };
    })
    .filter(a => a.income > 0 || a.expense > 0);

  const periodLabel = startMonth === endMonth
    ? getMonthLabel(startMonth)
    : `${getMonthLabel(startMonth)} — ${getMonthLabel(endMonth)}`;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Relatório Financeiro</h1>
        <p className="text-sm text-muted-foreground">Gere um resumo detalhado do período selecionado</p>
      </div>

      {/* Period Selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5 flex-1 min-w-[180px]">
              <Label>Mês Inicial</Label>
              <Select value={startMonth} onValueChange={setStartMonth}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {monthOptions.map(o => (
                    <SelectItem key={o.value} value={o.value} className="capitalize">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 flex-1 min-w-[180px]">
              <Label>Mês Final</Label>
              <Select value={endMonth} onValueChange={setEndMonth}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {monthOptions.filter(o => o.value >= startMonth).map(o => (
                    <SelectItem key={o.value} value={o.value} className="capitalize">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => setGenerated(true)} className="gap-2">
              <FileText className="w-4 h-4" />
              Gerar Relatório
            </Button>
          </div>
        </CardContent>
      </Card>

      {generated && (
        <div ref={reportRef} className="space-y-6">
          {/* Report Header */}
          <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Relatório Financeiro</h2>
                <p className="text-sm text-muted-foreground capitalize">{periodLabel}</p>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="border-income/20 bg-income/5">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-income" />
                  <span className="text-xs text-muted-foreground">Receitas</span>
                </div>
                <p className="text-lg font-bold text-income currency">{formatCurrency(totalIncome)}</p>
                {pendingIncome > 0 && <p className="text-[10px] text-muted-foreground mt-1">+ {formatCurrency(pendingIncome)} pendente</p>}
              </CardContent>
            </Card>
            <Card className="border-expense/20 bg-expense/5">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown className="w-4 h-4 text-expense" />
                  <span className="text-xs text-muted-foreground">Despesas</span>
                </div>
                <p className="text-lg font-bold text-expense currency">{formatCurrency(totalExpenses)}</p>
                {pendingExpenses > 0 && <p className="text-[10px] text-muted-foreground mt-1">+ {formatCurrency(pendingExpenses)} pendente</p>}
              </CardContent>
            </Card>
            <Card className={`border-${balance >= 0 ? 'income' : 'expense'}/20 bg-${balance >= 0 ? 'income' : 'expense'}/5`}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Wallet className="w-4 h-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Saldo</span>
                </div>
                <p className={`text-lg font-bold currency ${balance >= 0 ? 'text-income' : 'text-expense'}`}>{formatCurrency(balance)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <PiggyBank className="w-4 h-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Taxa de Economia</span>
                </div>
                <p className={`text-lg font-bold ${savingsRate >= 0 ? 'text-income' : 'text-expense'}`}>{savingsRate.toFixed(1)}%</p>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Category Pie */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Despesas por Categoria</CardTitle>
              </CardHeader>
              <CardContent>
                {catBreakdown.length > 0 ? (
                  <div className="flex items-center gap-4">
                    <div className="w-44 h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={catBreakdown} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={70} paddingAngle={2}>
                            {catBreakdown.map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-1 space-y-2">
                      {catBreakdown.map((cat, i) => (
                        <div key={cat.name} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                            <span className="text-muted-foreground text-xs">{cat.name}</span>
                          </div>
                          <span className="currency font-medium text-xs">{formatCurrency(cat.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
                )}
              </CardContent>
            </Card>

            {/* Monthly Trend Bar Chart */}
            {monthsInRange.length > 1 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Evolução Mensal</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                          formatter={(value: number) => formatCurrency(value)}
                        />
                        <Bar dataKey="receitas" fill="#10b981" radius={[4, 4, 0, 0]} name="Receitas" />
                        <Bar dataKey="despesas" fill="#ef4444" radius={[4, 4, 0, 0]} name="Despesas" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Top 10 Expenses */}
          {topExpenses.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Top 10 Maiores Despesas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {topExpenses.map((e, i) => {
                    const cat = categories.find(c => c.id === e.category_id);
                    const pct = totalExpenses > 0 ? (Number(e.amount) / totalExpenses) * 100 : 0;
                    return (
                      <div key={e.id} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium truncate">{e.description || 'Despesa'}</p>
                            <span className="currency text-sm font-semibold text-expense ml-2">{formatCurrency(Number(e.amount))}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {cat && <span className="text-[10px] text-muted-foreground">{cat.icon} {cat.name}</span>}
                            <span className="text-[10px] text-muted-foreground">{e.date}</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1 mt-1">
                            <div className="bg-expense/60 h-1 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Account Breakdown */}
          {accountBreakdown.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Resumo por Conta</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-3">
                  {accountBreakdown.map(acc => (
                    <div key={acc.name} className="rounded-lg bg-muted/50 border border-border p-3">
                      <p className="text-sm font-semibold mb-2">{acc.name}</p>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Receitas</span>
                          <span className="text-income font-medium currency">{formatCurrency(acc.income)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Despesas</span>
                          <span className="text-expense font-medium currency">{formatCurrency(acc.expense)}</span>
                        </div>
                        <div className="flex justify-between border-t border-border pt-1">
                          <span className="font-medium">Saldo</span>
                          <span className={`font-bold currency ${acc.balance >= 0 ? 'text-income' : 'text-expense'}`}>{formatCurrency(acc.balance)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Insights */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">💡 Insights do Período</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                {balance >= 0 ? (
                  <p className="text-income">✅ Você economizou <span className="font-bold currency">{formatCurrency(balance)}</span> no período ({savingsRate.toFixed(1)}% do que ganhou).</p>
                ) : (
                  <p className="text-expense">⚠️ Você gastou <span className="font-bold currency">{formatCurrency(Math.abs(balance))}</span> a mais do que ganhou.</p>
                )}
                {catBreakdown[0] && (
                  <p className="text-muted-foreground">📊 Sua maior categoria de gasto foi <span className="font-semibold text-foreground">{catBreakdown[0].name}</span> com <span className="currency font-semibold">{formatCurrency(catBreakdown[0].value)}</span> ({totalExpenses > 0 ? ((catBreakdown[0].value / totalExpenses) * 100).toFixed(0) : 0}% do total).</p>
                )}
                {topExpenses[0] && (
                  <p className="text-muted-foreground">💸 Seu maior gasto individual foi <span className="font-semibold text-foreground">"{topExpenses[0].description || 'Despesa'}"</span> de <span className="currency font-semibold">{formatCurrency(Number(topExpenses[0].amount))}</span>.</p>
                )}
                <p className="text-muted-foreground">📋 Total de <span className="font-semibold text-foreground">{incomeInRange.length} receitas</span> e <span className="font-semibold text-foreground">{expensesInRange.length} despesas</span> no período.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
