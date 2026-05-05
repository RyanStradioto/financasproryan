import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, CircleDollarSign, Plus, ReceiptText, Trash2, WalletCards, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MonthSelector from '@/components/finance/MonthSelector';
import { useAccounts, useAddExpense, useAddIncome, useCategories, useExpenses, useIncome } from '@/hooks/useFinanceData';
import { useCreditCards } from '@/hooks/useCreditCards';
import { useProfile } from '@/hooks/useProfile';
import { adjustToPreviousBusinessDay, getNthBusinessDay, toISODate } from '@/lib/businessDays';
import { formatCurrency, formatDate, getMonthYear } from '@/lib/format';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type FixedCost = {
  id: string;
  description: string;
  amount: number;
  day: number;
  categoryId: string;
  accountId: string;
  paymentMethod: 'account' | 'credit_card';
  creditCardId: string;
};

type PayrollSettings = {
  baseSalary: number;
  firstPercent: number;
  secondPercent: number;
  deductionAmount: number;
  firstRule: 'fifth_business_day';
  secondDay: number;
  accountId: string;
};

const FIXED_COSTS_KEY = 'financaspro.planning.fixed-costs.v1';
const PAYROLL_KEY = 'financaspro.planning.payroll.v1';

function parseMoney(value: string) {
  return parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0;
}

function toMoneyInput(value: number) {
  return value > 0 ? String(value).replace('.', ',') : '';
}

function clampDay(day: number) {
  return Math.min(31, Math.max(1, day || 1));
}

function getDateForDay(month: string, day: number) {
  const [year, rawMonth] = month.split('-').map(Number);
  const lastDay = new Date(year, rawMonth, 0).getDate();
  return `${month}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

function getPayrollDates(month: string, settings: PayrollSettings) {
  const [year, rawMonth] = month.split('-').map(Number);
  const monthIndex = rawMonth - 1;
  const first = getNthBusinessDay(year, monthIndex, 5);
  const secondRaw = new Date(year, monthIndex, Math.min(settings.secondDay, new Date(year, rawMonth, 0).getDate()));
  const second = adjustToPreviousBusinessDay(secondRaw);
  return { first: toISODate(first), second: toISODate(second) };
}

function makeDefaultPayroll(profileSalary: number): PayrollSettings {
  return {
    baseSalary: profileSalary || 0,
    firstPercent: 60,
    secondPercent: 40,
    deductionAmount: 0,
    firstRule: 'fifth_business_day',
    secondDay: 20,
    accountId: '',
  };
}

export default function PlanningPage() {
  const [month, setMonth] = useState(getMonthYear());
  const { data: categories = [] } = useCategories();
  const { data: accounts = [] } = useAccounts();
  const { data: cards = [] } = useCreditCards();
  const { data: expenses = [] } = useExpenses(month);
  const { data: income = [] } = useIncome(month);
  const { data: profile } = useProfile();
  const addExpense = useAddExpense();
  const addIncome = useAddIncome();

  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);
  const [payroll, setPayroll] = useState<PayrollSettings>(() => makeDefaultPayroll(0));
  const [costOpen, setCostOpen] = useState(false);
  const [payrollOpen, setPayrollOpen] = useState(false);
  const [newCost, setNewCost] = useState({
    description: '',
    amount: '',
    day: '5',
    categoryId: '',
    accountId: '',
    paymentMethod: 'account' as 'account' | 'credit_card',
    creditCardId: '',
  });

  useEffect(() => {
    try {
      const rawCosts = window.localStorage.getItem(FIXED_COSTS_KEY);
      const rawPayroll = window.localStorage.getItem(PAYROLL_KEY);
      if (rawCosts) setFixedCosts(JSON.parse(rawCosts) as FixedCost[]);
      if (rawPayroll) setPayroll(JSON.parse(rawPayroll) as PayrollSettings);
    } catch {
      // local planning settings stay optional; a malformed entry should not block the page.
    }
  }, []);

  useEffect(() => {
    if (payroll.baseSalary === 0 && profile?.monthly_salary) {
      setPayroll((current) => ({ ...current, baseSalary: profile.monthly_salary }));
    }
  }, [payroll.baseSalary, profile?.monthly_salary]);

  useEffect(() => {
    window.localStorage.setItem(FIXED_COSTS_KEY, JSON.stringify(fixedCosts));
  }, [fixedCosts]);

  useEffect(() => {
    window.localStorage.setItem(PAYROLL_KEY, JSON.stringify(payroll));
  }, [payroll]);

  const activeCategories = categories.filter((c) => !c.archived);
  const activeAccounts = accounts.filter((a) => !a.archived);
  const activeCards = cards.filter((c) => !c.archived);

  const payrollDates = useMemo(() => getPayrollDates(month, payroll), [month, payroll]);
  const firstGross = (payroll.baseSalary * payroll.firstPercent) / 100;
  const secondGross = (payroll.baseSalary * payroll.secondPercent) / 100;
  const firstNet = Math.max(0, firstGross - payroll.deductionAmount);
  const secondNet = secondGross;
  const fixedTotal = fixedCosts.reduce((sum, item) => sum + item.amount, 0);
  const expectedIncome = firstNet + secondNet;

  const plannedCosts = fixedCosts.map((cost) => {
    const date = getDateForDay(month, cost.day);
    const exists = expenses.some(
      (expense) =>
        expense.date === date &&
        Math.abs(Number(expense.amount) - cost.amount) < 0.01 &&
        (expense.description || '').toLowerCase() === cost.description.toLowerCase(),
    );
    return { ...cost, date, exists };
  });

  const payrollItems = [
    { id: 'first', label: 'Salario principal', date: payrollDates.first, amount: firstNet, gross: firstGross, deduction: payroll.deductionAmount },
    { id: 'second', label: 'Adiantamento', date: payrollDates.second, amount: secondNet, gross: secondGross, deduction: 0 },
  ];

  const payrollWithState = payrollItems.map((item) => ({
    ...item,
    exists: income.some(
      (entry) =>
        entry.date === item.date &&
        Math.abs(Number(entry.amount) - item.amount) < 0.01 &&
        (entry.description || '').toLowerCase().includes(item.label.toLowerCase()),
    ),
  }));

  const resetNewCost = () => {
    setNewCost({
      description: '',
      amount: '',
      day: '5',
      categoryId: '',
      accountId: '',
      paymentMethod: 'account',
      creditCardId: '',
    });
  };

  const handleAddCost = () => {
    const amount = parseMoney(newCost.amount);
    if (!newCost.description.trim() || amount <= 0) {
      toast.error('Informe descricao e valor do custo fixo');
      return;
    }

    setFixedCosts((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        description: newCost.description.trim(),
        amount,
        day: clampDay(parseInt(newCost.day)),
        categoryId: newCost.categoryId,
        accountId: newCost.accountId,
        paymentMethod: newCost.paymentMethod,
        creditCardId: newCost.creditCardId,
      },
    ]);
    resetNewCost();
    setCostOpen(false);
    toast.success('Custo fixo salvo no planejamento');
  };

  const handleLaunchCost = async (cost: FixedCost) => {
    try {
      const date = getDateForDay(month, cost.day);
      await addExpense.mutateAsync({
        date,
        description: cost.description,
        amount: cost.amount,
        category_id: cost.categoryId || null,
        account_id: cost.paymentMethod === 'account' ? cost.accountId || null : null,
        status: 'agendado',
        notes:
          cost.paymentMethod === 'credit_card'
            ? `[Planejamento|fixo:${cost.id}] [Cartao de credito${cost.creditCardId ? `|card:${cost.creditCardId}` : ''}]`
            : `[Planejamento|fixo:${cost.id}]`,
        is_recurring: true,
        recurring_day: cost.day,
      });
      toast.success('Custo fixo lancado no mes');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleLaunchPayroll = async (item: typeof payrollWithState[number]) => {
    if (item.amount <= 0) {
      toast.error('Configure o salario antes de lancar');
      return;
    }

    try {
      await addIncome.mutateAsync({
        date: item.date,
        description: item.label,
        amount: item.amount,
        account_id: payroll.accountId || null,
        status: 'agendado',
        notes: `[Planejamento salario] Bruto ${formatCurrency(item.gross)} | Descontos ${formatCurrency(item.deduction)}`,
      });
      toast.success('Previsao de salario lancada');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Planejamento</h1>
          <p className="text-sm text-muted-foreground">Custos fixos, vencimentos e entradas previstas</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <MonthSelector month={month} onChange={setMonth} />
          <Button variant="outline" onClick={() => setPayrollOpen(true)}>
            <WalletCards className="h-4 w-4" /> Salario
          </Button>
          <Dialog open={costOpen} onOpenChange={setCostOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" /> Custo fixo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo custo fixo</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Descricao</Label>
                  <Input value={newCost.description} onChange={(e) => setNewCost((p) => ({ ...p, description: e.target.value }))} placeholder="Ex: Totalpass, ajuda em casa..." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Valor</Label>
                    <Input value={newCost.amount} onChange={(e) => setNewCost((p) => ({ ...p, amount: e.target.value }))} placeholder="0,00" inputMode="decimal" />
                  </div>
                  <div>
                    <Label>Dia do mes</Label>
                    <Input type="number" min={1} max={31} value={newCost.day} onChange={(e) => setNewCost((p) => ({ ...p, day: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Select value={newCost.categoryId || '__none__'} onValueChange={(value) => setNewCost((p) => ({ ...p, categoryId: value === '__none__' ? '' : value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sem categoria</SelectItem>
                      {activeCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>{category.icon} {category.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Forma de pagamento</Label>
                  <Select value={newCost.paymentMethod} onValueChange={(value) => setNewCost((p) => ({ ...p, paymentMethod: value as FixedCost['paymentMethod'] }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="account">Conta / Debito / PIX</SelectItem>
                      <SelectItem value="credit_card">Cartao de credito</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newCost.paymentMethod === 'account' ? (
                  <div>
                    <Label>Conta</Label>
                    <Select value={newCost.accountId || '__none__'} onValueChange={(value) => setNewCost((p) => ({ ...p, accountId: value === '__none__' ? '' : value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Sem conta</SelectItem>
                        {activeAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>{account.icon} {account.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div>
                    <Label>Cartao</Label>
                    <Select value={newCost.creditCardId || '__none__'} onValueChange={(value) => setNewCost((p) => ({ ...p, creditCardId: value === '__none__' ? '' : value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Sem cartao</SelectItem>
                        {activeCards.map((card) => (
                          <SelectItem key={card.id} value={card.id}>{card.icon} {card.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCostOpen(false)}>Cancelar</Button>
                <Button onClick={handleAddCost}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="stat-card">
          <p className="text-xs text-muted-foreground">Custos fixos</p>
          <p className="mt-1 text-2xl font-bold text-expense">{formatCurrency(fixedTotal)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground">Salario previsto</p>
          <p className="mt-1 text-2xl font-bold text-income">{formatCurrency(expectedIncome)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground">Sobra planejada</p>
          <p className={cn('mt-1 text-2xl font-bold', expectedIncome - fixedTotal >= 0 ? 'text-primary' : 'text-expense')}>
            {formatCurrency(expectedIncome - fixedTotal)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Custos fixos do mes</h2>
            <span className="text-xs text-muted-foreground">{plannedCosts.length} itens</span>
          </div>
          {plannedCosts.length === 0 ? (
            <div className="stat-card py-12 text-center">
              <ReceiptText className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">Nenhum custo fixo cadastrado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {plannedCosts.map((cost) => {
                const category = activeCategories.find((item) => item.id === cost.categoryId);
                const paymentLabel =
                  cost.paymentMethod === 'credit_card'
                    ? activeCards.find((card) => card.id === cost.creditCardId)?.name ?? 'Cartao'
                    : activeAccounts.find((account) => account.id === cost.accountId)?.name ?? 'Conta';

                return (
                  <div key={cost.id} className="rounded-lg border border-border bg-card px-4 py-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-semibold">{cost.description}</p>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>{formatDate(cost.date)}</span>
                          <span>{category ? `${category.icon} ${category.name}` : 'Sem categoria'}</span>
                          <span>{paymentLabel}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-expense">{formatCurrency(cost.amount)}</span>
                        <Button size="sm" variant={cost.exists ? 'outline' : 'default'} onClick={() => handleLaunchCost(cost)} disabled={cost.exists || addExpense.isPending}>
                          {cost.exists ? 'Lancado' : 'Lancar'}
                        </Button>
                        <button
                          onClick={() => setFixedCosts((current) => current.filter((item) => item.id !== cost.id))}
                          className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`Remover ${cost.description}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Salario previsto</h2>
            <Button size="sm" variant="outline" onClick={() => setPayrollOpen(true)}>
              <Wand2 className="h-4 w-4" /> Ajustar
            </Button>
          </div>
          <div className="space-y-2">
            {payrollWithState.map((item) => (
              <div key={item.id} className="rounded-lg border border-border bg-card px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{item.label}</p>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><CalendarClock className="h-3 w-3" /> {formatDate(item.date)}</span>
                      <span>Bruto {formatCurrency(item.gross)}</span>
                      {item.deduction > 0 && <span>Descontos {formatCurrency(item.deduction)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-income">{formatCurrency(item.amount)}</span>
                    <Button size="sm" variant={item.exists ? 'outline' : 'default'} onClick={() => handleLaunchPayroll(item)} disabled={item.exists || addIncome.isPending}>
                      {item.exists ? 'Lancado' : 'Lancar'}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <Dialog open={payrollOpen} onOpenChange={setPayrollOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Previsao de salario</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Salario base mensal</Label>
              <Input value={toMoneyInput(payroll.baseSalary)} onChange={(e) => setPayroll((p) => ({ ...p, baseSalary: parseMoney(e.target.value) }))} placeholder="0,00" inputMode="decimal" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Primeira entrada (%)</Label>
                <Input type="number" value={payroll.firstPercent} onChange={(e) => setPayroll((p) => ({ ...p, firstPercent: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label>Segunda entrada (%)</Label>
                <Input type="number" value={payroll.secondPercent} onChange={(e) => setPayroll((p) => ({ ...p, secondPercent: parseFloat(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Descontos na primeira entrada</Label>
                <Input value={toMoneyInput(payroll.deductionAmount)} onChange={(e) => setPayroll((p) => ({ ...p, deductionAmount: parseMoney(e.target.value) }))} placeholder="0,00" inputMode="decimal" />
              </div>
              <div>
                <Label>Dia da segunda entrada</Label>
                <Input type="number" min={1} max={31} value={payroll.secondDay} onChange={(e) => setPayroll((p) => ({ ...p, secondDay: clampDay(parseInt(e.target.value)) }))} />
              </div>
            </div>
            <div>
              <Label>Conta de recebimento</Label>
              <Select value={payroll.accountId || '__none__'} onValueChange={(value) => setPayroll((p) => ({ ...p, accountId: value === '__none__' ? '' : value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem conta</SelectItem>
                  {activeAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>{account.icon} {account.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setPayrollOpen(false)}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
