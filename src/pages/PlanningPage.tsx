import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, WalletCards, Plus, Trash2, TrendingUp, Pencil, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAccounts, useAddExpenseBatch, useAddIncome, useCategories } from '@/hooks/useFinanceData';
import { useProfile } from '@/hooks/useProfile';
import { formatCurrency, getMonthYear } from '@/lib/format';
import MonthSelector from '@/components/finance/MonthSelector';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

type FixedCost = {
  id: string;
  description: string;
  amount: number;
  day: number;
  category_id: string;
  account_id: string;
};

type SalaryConfig = {
  grossOverride: number;   // 0 = use profile salary
  account_id: string;
  firstSplitPct: number;
  description: string;
};

// ─── localStorage helpers ─────────────────────────────────────────────────────

const FIXED_COSTS_KEY = 'fixed_costs_v1';
const SALARY_KEY = 'salary_forecast_v2';

const readArray = <T,>(key: string): T[] => {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
};
const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch { return fallback; }
};
const saveJson = (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value));

// ─── Brazilian CLT tax calculations 2024 ─────────────────────────────────────

/** INSS progressivo 2024 — tabela CLT */
export const calcINSS = (gross: number): number => {
  if (gross <= 0) return 0;
  const brackets = [
    { limit: 1412.00,  rate: 0.075 },
    { limit: 2666.68,  rate: 0.09  },
    { limit: 4000.03,  rate: 0.12  },
    { limit: 7786.02,  rate: 0.14  },
  ];
  let inss = 0;
  let prev = 0;
  for (const b of brackets) {
    if (gross <= prev) break;
    inss += (Math.min(gross, b.limit) - prev) * b.rate;
    prev = b.limit;
    if (gross <= b.limit) break;
  }
  return Math.round(inss * 100) / 100;
};

/** IRRF 2024 — base = bruto − INSS */
export const calcIRRF = (base: number): number => {
  if (base <= 2259.20) return 0;
  if (base <= 2826.65) return Math.max(0, base * 0.075  - 169.44);
  if (base <= 3751.05) return Math.max(0, base * 0.15   - 381.44);
  if (base <= 4664.68) return Math.max(0, base * 0.225  - 662.77);
  return Math.max(0, base * 0.275 - 896.00);
};

// ─── Calendar helpers ─────────────────────────────────────────────────────────

const toDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const formatDateBR = (dateStr: string) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
};

const getBrazilHolidays = (year: number) => {
  const easter = getEasterDate(year);
  const add = (date: Date, days: number) => { const r = new Date(date); r.setDate(r.getDate() + days); return r; };
  return new Set([
    `${year}-01-01`, `${year}-04-21`, `${year}-05-01`,
    `${year}-09-07`, `${year}-10-12`, `${year}-11-02`,
    `${year}-11-15`, `${year}-12-25`,
    toDateStr(add(easter, -48)), toDateStr(add(easter, -47)),
    toDateStr(add(easter, -2)),  toDateStr(add(easter, 60)),
  ]);
};

const getEasterDate = (year: number) => {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
};

const isBusinessDay = (date: Date, holidays: Set<string>) =>
  date.getDay() !== 0 && date.getDay() !== 6 && !holidays.has(toDateStr(date));

const getNthBusinessDay = (year: number, month: number, nth: number) => {
  const holidays = getBrazilHolidays(year);
  let count = 0;
  for (let day = 1; day <= 31; day++) {
    const date = new Date(year, month - 1, day);
    if (date.getMonth() !== month - 1) break;
    if (isBusinessDay(date, holidays)) count++;
    if (count === nth) return toDateStr(date);
  }
  return toDateStr(new Date(year, month - 1, 1));
};

const getAdjustedBusinessDate = (year: number, month: number, day: number) => {
  const holidays = getBrazilHolidays(year);
  const date = new Date(year, month - 1, day);
  while (!isBusinessDay(date, holidays)) date.setDate(date.getDate() - 1);
  return toDateStr(date);
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function PlanningPage() {
  const [month, setMonth] = useState(getMonthYear());
  const { data: categories = [] } = useCategories();
  const { data: accounts = [] } = useAccounts();
  const { data: profile } = useProfile();
  const addExpenseBatch = useAddExpenseBatch();
  const addIncome = useAddIncome();

  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>(() => readArray<FixedCost>(FIXED_COSTS_KEY));
  const [costForm, setCostForm] = useState({ description: '', amount: '', day: '1', category_id: '', account_id: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<FixedCost>>({});

  const [salary, setSalary] = useState<SalaryConfig>(() => readJson<SalaryConfig>(SALARY_KEY, {
    grossOverride: 0,
    account_id: '',
    firstSplitPct: 60,
    description: 'Salário',
  }));

  // Sync salary override with profile when profile loads for the first time
  useEffect(() => {
    if (profile?.monthly_salary && !salary.grossOverride) {
      // Don't override if user already set a custom value
    }
  }, [profile]);

  const [year, mon] = month.split('-').map(Number);
  const fifthBusinessDay = useMemo(() => getNthBusinessDay(year, mon, 5), [year, mon]);
  const day20 = useMemo(() => getAdjustedBusinessDate(year, mon, 20), [year, mon]);

  // Use override if set, otherwise use profile salary
  const grossSalary = salary.grossOverride || (profile?.monthly_salary ?? 0);
  const inss = calcINSS(grossSalary);
  const irrf = calcIRRF(grossSalary - inss);
  const netSalary = Math.max(0, grossSalary - inss - irrf);
  const firstNet = Math.max(0, netSalary * (salary.firstSplitPct / 100));
  const secondNet = Math.max(0, netSalary * ((100 - salary.firstSplitPct) / 100));
  const fixedTotal = fixedCosts.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const updateFixedCosts = (items: FixedCost[]) => {
    setFixedCosts(items);
    saveJson(FIXED_COSTS_KEY, items);
  };

  const updateSalary = (patch: Partial<SalaryConfig>) => {
    const next = { ...salary, ...patch };
    setSalary(next);
    saveJson(SALARY_KEY, next);
  };

  const addFixedCost = () => {
    if (!costForm.description || !costForm.amount) {
      toast.error('Informe descrição e valor');
      return;
    }
    updateFixedCosts([
      ...fixedCosts,
      {
        id: crypto.randomUUID(),
        description: costForm.description,
        amount: Number(costForm.amount) || 0,
        day: Number(costForm.day) || 1,
        category_id: costForm.category_id,
        account_id: costForm.account_id,
      },
    ]);
    setCostForm({ description: '', amount: '', day: '1', category_id: '', account_id: '' });
  };

  const generateFixedCosts = async () => {
    if (fixedCosts.length === 0) return toast.error('Cadastre pelo menos um custo fixo');
    const rows = fixedCosts.map((item) => ({
      date: getAdjustedBusinessDate(year, mon, item.day),
      description: item.description,
      amount: item.amount,
      category_id: item.category_id || null,
      account_id: item.account_id || null,
      status: 'agendado',
      notes: '[CUSTO FIXO] Lançamento gerado pelo planejamento mensal.',
    }));
    await addExpenseBatch.mutateAsync(rows);
    toast.success(`${rows.length} custos fixos agendados para ${mon.toString().padStart(2,'0')}/${year}`);
  };

  const generateSalary = async () => {
    if (!netSalary) return toast.error('Configure o salário nas Configurações ou informe um valor acima');
    await addIncome.mutateAsync({
      date: fifthBusinessDay,
      description: `${salary.description || 'Salário'} — ${salary.firstSplitPct}%`,
      amount: firstNet,
      account_id: salary.account_id || null,
      status: 'agendado',
      notes: `INSS: ${formatCurrency(inss)} | IRRF: ${formatCurrency(irrf)}`,
    });
    await addIncome.mutateAsync({
      date: day20,
      description: `${salary.description || 'Salário'} — ${100 - salary.firstSplitPct}%`,
      amount: secondNet,
      account_id: salary.account_id || null,
      status: 'agendado',
      notes: null,
    });
    toast.success(`Salário lançado: ${formatDateBR(fifthBusinessDay)} e ${formatDateBR(day20)}`);
  };

  const saveEdit = () => {
    if (!editingId) return;
    updateFixedCosts(fixedCosts.map(c =>
      c.id === editingId ? { ...c, ...editForm, amount: Number(editForm.amount) || c.amount, day: Number(editForm.day) || c.day } : c
    ));
    setEditingId(null);
    setEditForm({});
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Planejamento</h1>
          <p className="text-sm text-muted-foreground">Organize seus custos fixos e preveja o salário do mês</p>
        </div>
        <MonthSelector month={month} onChange={setMonth} />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="stat-card">
          <p className="text-xs text-muted-foreground mb-1">Custos fixos</p>
          <p className="text-xl font-bold text-expense">{formatCurrency(fixedTotal)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{fixedCosts.length} item{fixedCosts.length !== 1 ? 's' : ''} cadastrado{fixedCosts.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground mb-1">Salário líquido previsto</p>
          <p className="text-xl font-bold text-income">{formatCurrency(netSalary)}</p>
          {grossSalary > 0 && <p className="text-xs text-muted-foreground mt-0.5">Bruto: {formatCurrency(grossSalary)}</p>}
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground mb-1">Saldo previsto</p>
          <p className={`text-xl font-bold ${netSalary - fixedTotal >= 0 ? 'text-income' : 'text-expense'}`}>
            {formatCurrency(netSalary - fixedTotal)}
          </p>
          {netSalary > 0 && fixedTotal > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {((fixedTotal / netSalary) * 100).toFixed(0)}% do líquido comprometido
            </p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="custos">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="custos" className="flex items-center gap-2">
            <CalendarClock className="w-3.5 h-3.5" /> Custos Fixos
          </TabsTrigger>
          <TabsTrigger value="salario" className="flex items-center gap-2">
            <WalletCards className="w-3.5 h-3.5" /> Salário
          </TabsTrigger>
        </TabsList>

        {/* ── TAB: Custos Fixos ─────────────────────────────────────── */}
        <TabsContent value="custos" className="space-y-4 mt-4">

          {/* Add form */}
          <div className="stat-card space-y-3">
            <p className="text-sm font-semibold">Adicionar custo fixo</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Descrição</Label>
                <Input
                  placeholder="Ex: Academia, Streaming..."
                  value={costForm.description}
                  onChange={(e) => setCostForm(p => ({ ...p, description: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && addFixedCost()}
                  className="h-10"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Valor (R$)</Label>
                <Input
                  type="number"
                  placeholder="0,00"
                  value={costForm.amount}
                  onChange={(e) => setCostForm(p => ({ ...p, amount: e.target.value }))}
                  className="h-10"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Dia do mês</Label>
                <Input
                  type="number" min={1} max={31}
                  value={costForm.day}
                  onChange={(e) => setCostForm(p => ({ ...p, day: e.target.value }))}
                  className="h-10"
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-xs text-muted-foreground">Categoria</Label>
                <Select value={costForm.category_id || '__none__'} onValueChange={(v) => setCostForm(p => ({ ...p, category_id: v === '__none__' ? '' : v }))}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sem categoria</SelectItem>
                    {categories.filter(c => !c.archived).map(c => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-xs text-muted-foreground">Conta</Label>
                <Select value={costForm.account_id || '__none__'} onValueChange={(v) => setCostForm(p => ({ ...p, account_id: v === '__none__' ? '' : v }))}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sem conta</SelectItem>
                    {accounts.filter(a => !a.archived).map(a => <SelectItem key={a.id} value={a.id}>{a.icon} {a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 sm:col-span-2 flex items-end">
                <Button onClick={addFixedCost} className="w-full h-10">
                  <Plus className="w-4 h-4 mr-1.5" /> Adicionar
                </Button>
              </div>
            </div>
          </div>

          {/* List */}
          {fixedCosts.length === 0 ? (
            <div className="stat-card py-10 text-center">
              <CalendarClock className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum custo fixo cadastrado ainda</p>
            </div>
          ) : (
            <div className="space-y-2">
              {fixedCosts.map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
                  {editingId === item.id ? (
                    // Inline edit
                    <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <Input className="h-8 text-sm col-span-2 sm:col-span-1" value={String(editForm.description ?? item.description)} onChange={e => setEditForm(p => ({...p, description: e.target.value}))} />
                      <Input type="number" className="h-8 text-sm" value={String(editForm.amount ?? item.amount)} onChange={e => setEditForm(p => ({...p, amount: e.target.value as unknown as number}))} />
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">Dia</span>
                        <Input type="number" min={1} max={31} className="h-8 text-sm w-16" value={String(editForm.day ?? item.day)} onChange={e => setEditForm(p => ({...p, day: e.target.value as unknown as number}))} />
                      </div>
                      <Button size="sm" className="h-8" onClick={saveEdit}><Check className="w-3.5 h-3.5" /></Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.description}</p>
                        <p className="text-xs text-muted-foreground">
                          Todo dia {item.day} · <span className="font-semibold text-foreground">{formatCurrency(item.amount)}</span>
                          {categories.find(c => c.id === item.category_id) && ` · ${categories.find(c => c.id === item.category_id)?.icon} ${categories.find(c => c.id === item.category_id)?.name}`}
                        </p>
                      </div>
                      <button className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" onClick={() => { setEditingId(item.id); setEditForm(item); }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" onClick={() => updateFixedCosts(fixedCosts.filter(c => c.id !== item.id))}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Generate button */}
          {fixedCosts.length > 0 && (
            <div className="flex items-center gap-3">
              <Button onClick={generateFixedCosts} disabled={addExpenseBatch.isPending} className="gap-2">
                <CalendarClock className="w-4 h-4" />
                Agendar {fixedCosts.length} custo{fixedCosts.length !== 1 ? 's' : ''} em {String(mon).padStart(2,'0')}/{year}
              </Button>
              <p className="text-xs text-muted-foreground">Lançamentos criados como "Agendado" nas Despesas</p>
            </div>
          )}
        </TabsContent>

        {/* ── TAB: Salário ──────────────────────────────────────────── */}
        <TabsContent value="salario" className="space-y-4 mt-4">

          {/* Salary config */}
          <div className="stat-card space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Configuração do salário</p>
              {profile?.monthly_salary ? (
                <span className="text-xs bg-income/10 text-income px-2 py-0.5 rounded-full font-medium">
                  Salário nas Configurações: {formatCurrency(profile.monthly_salary)}
                </span>
              ) : (
                <span className="text-xs bg-warning/10 text-warning px-2 py-0.5 rounded-full font-medium">
                  Configure o salário em Configurações
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">
                  Salário bruto {profile?.monthly_salary ? '(deixe em branco para usar o das Configurações)' : ''}
                </Label>
                <Input
                  type="number"
                  placeholder={profile?.monthly_salary ? `${profile.monthly_salary} (das Configurações)` : 'Ex: 5000'}
                  value={salary.grossOverride || ''}
                  onChange={(e) => updateSalary({ grossOverride: Number(e.target.value) || 0 })}
                  className="h-10"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Descrição do lançamento</Label>
                <Input
                  placeholder="Salário"
                  value={salary.description}
                  onChange={(e) => updateSalary({ description: e.target.value })}
                  className="h-10"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Conta para receber</Label>
                <Select value={salary.account_id || '__none__'} onValueChange={(v) => updateSalary({ account_id: v === '__none__' ? '' : v })}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sem conta</SelectItem>
                    {accounts.filter(a => !a.archived).map(a => <SelectItem key={a.id} value={a.id}>{a.icon} {a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">1ª parcela (% no 5º dia útil)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number" min={0} max={100}
                    value={salary.firstSplitPct}
                    onChange={(e) => updateSalary({ firstSplitPct: Number(e.target.value) || 60 })}
                    className="h-10"
                  />
                  <span className="text-sm text-muted-foreground shrink-0">% / {100 - salary.firstSplitPct}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* CLT breakdown */}
          {grossSalary > 0 && (
            <div className="stat-card space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Cálculo CLT automático
                <span className="text-xs font-normal text-muted-foreground">(tabela 2024)</span>
              </p>

              <div className="space-y-2">
                {/* Gross */}
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">Salário bruto</span>
                  <span className="font-semibold">{formatCurrency(grossSalary)}</span>
                </div>
                {/* INSS */}
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <div>
                    <span className="text-sm text-muted-foreground">INSS (progressivo)</span>
                    {grossSalary > 0 && <span className="text-xs text-muted-foreground ml-2">({((inss/grossSalary)*100).toFixed(1)}% efetivo)</span>}
                  </div>
                  <span className="text-expense font-semibold">− {formatCurrency(inss)}</span>
                </div>
                {/* Base IRRF */}
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">Base IRRF (bruto − INSS)</span>
                  <span className="text-sm">{formatCurrency(grossSalary - inss)}</span>
                </div>
                {/* IRRF */}
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <div>
                    <span className="text-sm text-muted-foreground">IRRF</span>
                    {irrf === 0 && <span className="text-xs text-income ml-2 font-medium">isento</span>}
                  </div>
                  <span className={`font-semibold ${irrf > 0 ? 'text-expense' : 'text-muted-foreground'}`}>
                    {irrf > 0 ? `− ${formatCurrency(irrf)}` : formatCurrency(0)}
                  </span>
                </div>
                {/* Net */}
                <div className="flex justify-between items-center pt-2">
                  <span className="text-sm font-semibold">Salário líquido</span>
                  <span className="text-income font-bold text-lg">{formatCurrency(netSalary)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Payment preview */}
          {netSalary > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-income/25 bg-income/5 p-4 space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">5º dia útil</p>
                <p className="text-2xl font-bold text-income">{formatCurrency(firstNet)}</p>
                <p className="text-sm text-muted-foreground">{formatDateBR(fifthBusinessDay)}</p>
                <p className="text-xs text-muted-foreground">{salary.firstSplitPct}% do líquido</p>
              </div>
              <div className="rounded-xl border border-income/25 bg-income/5 p-4 space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Dia 20</p>
                <p className="text-2xl font-bold text-income">{formatCurrency(secondNet)}</p>
                <p className="text-sm text-muted-foreground">{formatDateBR(day20)}</p>
                <p className="text-xs text-muted-foreground">{100 - salary.firstSplitPct}% do líquido</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={generateSalary} disabled={addIncome.isPending || !netSalary} className="gap-2">
              <WalletCards className="w-4 h-4" />
              Lançar previsão de salário em {String(mon).padStart(2,'0')}/{year}
            </Button>
            <p className="text-xs text-muted-foreground">Criados como "Agendado" nas Receitas</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
