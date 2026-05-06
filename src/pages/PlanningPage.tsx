import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, WalletCards, Plus, Trash2, TrendingUp, Pencil, Check, Database, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAccounts, useAddExpenseBatch, useAddIncome, useCategories, useExpenses, useIncome } from '@/hooks/useFinanceData';
import { useProfile } from '@/hooks/useProfile';
import { useAddPlanningFixedCost, useArchivePlanningFixedCost, usePlanningFixedCosts, usePlanningSalaryConfig, useUpdatePlanningFixedCost, useUpsertPlanningSalaryConfig, type PlanningFixedCost } from '@/hooks/usePlanning';
import { formatCurrency, getMonthYear } from '@/lib/format';
import MonthSelector from '@/components/finance/MonthSelector';
import { toast } from 'sonner';

type LocalFixedCost = { description: string; amount: number; day: number; category_id?: string | null; account_id?: string | null };
type LocalSalaryConfig = { grossOverride?: number; account_id?: string; firstSplitPct?: number; description?: string };
type CostForm = { description: string; amount: string; day: string; category_id: string; account_id: string };
type EditForm = Partial<Pick<PlanningFixedCost, 'description' | 'category_id' | 'account_id'>> & { amount?: string; day?: string };

const FIXED_COSTS_KEY = 'fixed_costs_v1';
const SALARY_KEY = 'salary_forecast_v2';
const FIXED_MIGRATION_KEY = 'fixed_costs_v1_migrated_to_supabase';
const SALARY_MIGRATION_KEY = 'salary_forecast_v2_migrated_to_supabase';

const readArray = <T,>(key: string): T[] => {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
};

const readJson = <T,>(key: string): Partial<T> => {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
};

const calcINSS = (gross: number): number => {
  if (gross <= 0) return 0;
  const brackets = [{ limit: 1412, rate: 0.075 }, { limit: 2666.68, rate: 0.09 }, { limit: 4000.03, rate: 0.12 }, { limit: 7786.02, rate: 0.14 }];
  let inss = 0;
  let prev = 0;
  for (const bracket of brackets) {
    if (gross <= prev) break;
    inss += (Math.min(gross, bracket.limit) - prev) * bracket.rate;
    prev = bracket.limit;
    if (gross <= bracket.limit) break;
  }
  return Math.round(inss * 100) / 100;
};

const calcIRRF = (base: number): number => {
  if (base <= 2259.2) return 0;
  if (base <= 2826.65) return Math.max(0, base * 0.075 - 169.44);
  if (base <= 3751.05) return Math.max(0, base * 0.15 - 381.44);
  if (base <= 4664.68) return Math.max(0, base * 0.225 - 662.77);
  return Math.max(0, base * 0.275 - 896);
};

const toDateStr = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const formatDateBR = (dateStr: string) => { const [y, m, d] = dateStr.split('-'); return `${d}/${m}/${y}`; };

const getEasterDate = (year: number) => {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const n = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * n + 114) / 31);
  const day = ((h + l - 7 * n + 114) % 31) + 1;
  return new Date(year, month - 1, day);
};

const getBrazilHolidays = (year: number) => {
  const easter = getEasterDate(year);
  const add = (date: Date, days: number) => { const copy = new Date(date); copy.setDate(copy.getDate() + days); return copy; };
  return new Set([`${year}-01-01`, `${year}-04-21`, `${year}-05-01`, `${year}-09-07`, `${year}-10-12`, `${year}-11-02`, `${year}-11-15`, `${year}-12-25`, toDateStr(add(easter, -48)), toDateStr(add(easter, -47)), toDateStr(add(easter, -2)), toDateStr(add(easter, 60))]);
};

const isBusinessDay = (date: Date, holidays: Set<string>) => date.getDay() !== 0 && date.getDay() !== 6 && !holidays.has(toDateStr(date));
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

const fixedMarker = (id: string, month: string) => `[CUSTO_FIXO|fixed:${id}|month:${month}]`;
const salaryMarker = (part: 1 | 2, month: string) => `[SALARIO|part:${part}|month:${month}]`;

export default function PlanningPage() {
  const [month, setMonth] = useState(getMonthYear());
  const { data: categories = [] } = useCategories();
  const { data: accounts = [] } = useAccounts();
  const { data: profile } = useProfile();
  const { data: fixedCosts = [], isFetched: fixedFetched } = usePlanningFixedCosts();
  const { data: salaryConfig, isFetched: salaryFetched } = usePlanningSalaryConfig();
  const { data: monthExpenses = [] } = useExpenses(month);
  const { data: monthIncome = [] } = useIncome(month);
  const addFixedCostMutation = useAddPlanningFixedCost();
  const updateFixedCostMutation = useUpdatePlanningFixedCost();
  const archiveFixedCostMutation = useArchivePlanningFixedCost();
  const upsertSalaryConfig = useUpsertPlanningSalaryConfig();
  const addExpenseBatch = useAddExpenseBatch();
  const addIncome = useAddIncome();
  const [costForm, setCostForm] = useState<CostForm>({ description: '', amount: '', day: '1', category_id: '', account_id: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({});
  const salary = { grossOverride: salaryConfig?.gross_override ?? 0, account_id: salaryConfig?.account_id ?? '', firstSplitPct: salaryConfig?.first_split_pct ?? 60, description: salaryConfig?.description ?? 'Salário' };

  useEffect(() => {
    if (!fixedFetched || fixedCosts.length > 0 || localStorage.getItem(FIXED_MIGRATION_KEY)) return;
    const localCosts = readArray<LocalFixedCost>(FIXED_COSTS_KEY).filter(item => item.description && Number(item.amount) > 0);
    if (localCosts.length === 0) { localStorage.setItem(FIXED_MIGRATION_KEY, 'empty'); return; }
    Promise.all(localCosts.map(item => addFixedCostMutation.mutateAsync({ description: item.description, amount: Number(item.amount), day: Math.min(31, Math.max(1, Number(item.day) || 1)), category_id: item.category_id || null, account_id: item.account_id || null, active: true })))
      .then(() => { localStorage.setItem(FIXED_MIGRATION_KEY, 'done'); toast.success('Custos fixos antigos preservados no Supabase.'); })
      .catch(() => toast.error('Não consegui migrar os custos locais agora. Eles continuam salvos no navegador.'));
  }, [fixedFetched, fixedCosts.length, addFixedCostMutation]);

  useEffect(() => {
    if (!salaryFetched || salaryConfig || localStorage.getItem(SALARY_MIGRATION_KEY)) return;
    const localSalary = readJson<LocalSalaryConfig>(SALARY_KEY);
    if (!localSalary.description && !localSalary.grossOverride && !localSalary.account_id && !localSalary.firstSplitPct) { localStorage.setItem(SALARY_MIGRATION_KEY, 'empty'); return; }
    upsertSalaryConfig.mutateAsync({ gross_override: Number(localSalary.grossOverride) || 0, account_id: localSalary.account_id || null, first_split_pct: Number(localSalary.firstSplitPct) || 60, description: localSalary.description || 'Salário' })
      .then(() => { localStorage.setItem(SALARY_MIGRATION_KEY, 'done'); toast.success('Configuração de salário preservada no Supabase.'); })
      .catch(() => toast.error('Não consegui migrar o salário local agora. Ele continua salvo no navegador.'));
  }, [salaryFetched, salaryConfig, upsertSalaryConfig]);

  const [year, mon] = month.split('-').map(Number);
  const fifthBusinessDay = useMemo(() => getNthBusinessDay(year, mon, 5), [year, mon]);
  const day20 = useMemo(() => getAdjustedBusinessDate(year, mon, 20), [year, mon]);
  const grossSalary = salary.grossOverride || (profile?.monthly_salary ?? 0);
  const inss = calcINSS(grossSalary);
  const irrf = calcIRRF(grossSalary - inss);
  const netSalary = Math.max(0, grossSalary - inss - irrf);
  const firstNet = Math.max(0, netSalary * (salary.firstSplitPct / 100));
  const secondNet = Math.max(0, netSalary * ((100 - salary.firstSplitPct) / 100));
  const fixedTotal = fixedCosts.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const saveSalary = (patch: Partial<typeof salary>) => upsertSalaryConfig.mutate({ gross_override: patch.grossOverride ?? salary.grossOverride, account_id: (patch.account_id ?? salary.account_id) || null, first_split_pct: Math.min(100, Math.max(0, patch.firstSplitPct ?? salary.firstSplitPct)), description: (patch.description ?? salary.description) || 'Salário' });

  const addFixedCost = async () => {
    if (!costForm.description.trim() || !costForm.amount) return toast.error('Informe descrição e valor');
    await addFixedCostMutation.mutateAsync({ description: costForm.description.trim(), amount: Number(costForm.amount) || 0, day: Math.min(31, Math.max(1, Number(costForm.day) || 1)), category_id: costForm.category_id || null, account_id: costForm.account_id || null, active: true });
    setCostForm({ description: '', amount: '', day: '1', category_id: '', account_id: '' });
    toast.success('Custo fixo salvo no Supabase.');
  };

  const generateFixedCosts = async () => {
    if (fixedCosts.length === 0) return toast.error('Cadastre pelo menos um custo fixo');
    const rows = fixedCosts.filter(item => !monthExpenses.some(expense => expense.notes?.includes(fixedMarker(item.id, month)))).map(item => ({ date: getAdjustedBusinessDate(year, mon, item.day), description: item.description, amount: item.amount, category_id: item.category_id || null, account_id: item.account_id || null, status: 'agendado', notes: `${fixedMarker(item.id, month)} Lançamento gerado pelo planejamento mensal.` }));
    if (rows.length === 0) return toast.info(`Os custos fixos de ${String(mon).padStart(2, '0')}/${year} já estavam agendados.`);
    await addExpenseBatch.mutateAsync(rows);
    toast.success(`${rows.length} custo${rows.length !== 1 ? 's' : ''} fixo${rows.length !== 1 ? 's' : ''} agendado${rows.length !== 1 ? 's' : ''}.`);
  };

  const generateSalary = async () => {
    if (!netSalary) return toast.error('Configure o salário nas Configurações ou informe um valor acima.');
    let created = 0;
    if (!monthIncome.some(income => income.notes?.includes(salaryMarker(1, month))) && firstNet > 0) {
      await addIncome.mutateAsync({ date: fifthBusinessDay, description: `${salary.description || 'Salário'} - ${salary.firstSplitPct}%`, amount: firstNet, account_id: salary.account_id || null, status: 'agendado', notes: `${salaryMarker(1, month)} INSS: ${formatCurrency(inss)} | IRRF: ${formatCurrency(irrf)}` });
      created++;
    }
    if (!monthIncome.some(income => income.notes?.includes(salaryMarker(2, month))) && secondNet > 0) {
      await addIncome.mutateAsync({ date: day20, description: `${salary.description || 'Salário'} - ${100 - salary.firstSplitPct}%`, amount: secondNet, account_id: salary.account_id || null, status: 'agendado', notes: salaryMarker(2, month) });
      created++;
    }
    if (created === 0) return toast.info(`A previsão de salário de ${String(mon).padStart(2, '0')}/${year} já estava criada.`);
    toast.success(`Salário lançado para ${formatDateBR(fifthBusinessDay)} e ${formatDateBR(day20)}.`);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await updateFixedCostMutation.mutateAsync({ id: editingId, description: editForm.description, amount: editForm.amount ? Number(editForm.amount) : undefined, day: editForm.day ? Math.min(31, Math.max(1, Number(editForm.day))) : undefined, category_id: editForm.category_id, account_id: editForm.account_id });
    setEditingId(null);
    setEditForm({});
    toast.success('Custo fixo atualizado.');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-[2rem] border border-primary/15 bg-gradient-to-br from-card via-card to-primary/10 p-5 sm:p-7 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4"><div className="h-14 w-14 rounded-2xl bg-primary/15 border border-primary/20 flex items-center justify-center"><CalendarClock className="h-7 w-7 text-primary" /></div><div><p className="text-xs uppercase tracking-[0.25em] text-primary font-bold">Planejamento financeiro</p><h1 className="text-3xl font-black tracking-tight mt-1">Custos fixos e salário</h1><p className="text-sm text-muted-foreground mt-1 max-w-2xl">Programe o que cai todo mês, calcule o 5º dia útil e gere lançamentos sem duplicar nada.</p></div></div>
          <MonthSelector month={month} onChange={setMonth} />
        </div>
        <div className="mt-5 flex flex-wrap gap-2 text-xs"><span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-primary"><Database className="h-3.5 w-3.5" /> Persistido no Supabase</span><span className="inline-flex items-center gap-1.5 rounded-full border border-income/20 bg-income/10 px-3 py-1 text-income"><ShieldCheck className="h-3.5 w-3.5" /> Geração idempotente</span></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="stat-card"><p className="text-xs text-muted-foreground mb-1">Custos fixos</p><p className="text-xl font-bold text-expense">{formatCurrency(fixedTotal)}</p><p className="text-xs text-muted-foreground mt-0.5">{fixedCosts.length} item{fixedCosts.length !== 1 ? 's' : ''} cadastrado{fixedCosts.length !== 1 ? 's' : ''}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground mb-1">Salário líquido previsto</p><p className="text-xl font-bold text-income">{formatCurrency(netSalary)}</p>{grossSalary > 0 && <p className="text-xs text-muted-foreground mt-0.5">Bruto: {formatCurrency(grossSalary)}</p>}</div>
        <div className="stat-card"><p className="text-xs text-muted-foreground mb-1">Saldo previsto</p><p className={`text-xl font-bold ${netSalary - fixedTotal >= 0 ? 'text-income' : 'text-expense'}`}>{formatCurrency(netSalary - fixedTotal)}</p>{netSalary > 0 && fixedTotal > 0 && <p className="text-xs text-muted-foreground mt-0.5">{((fixedTotal / netSalary) * 100).toFixed(0)}% do líquido comprometido</p>}</div>
      </div>

      <Tabs defaultValue="custos">
        <TabsList className="w-full sm:w-auto"><TabsTrigger value="custos" className="flex items-center gap-2"><CalendarClock className="w-3.5 h-3.5" /> Custos Fixos</TabsTrigger><TabsTrigger value="salario" className="flex items-center gap-2"><WalletCards className="w-3.5 h-3.5" /> Salário</TabsTrigger></TabsList>
        <TabsContent value="custos" className="space-y-4 mt-4">
          <div className="stat-card space-y-3"><p className="text-sm font-semibold">Adicionar custo fixo</p><div className="grid grid-cols-1 gap-2 min-[430px]:grid-cols-2 sm:grid-cols-4"><div className="min-[430px]:col-span-2"><Label className="text-xs text-muted-foreground">Descrição</Label><Input placeholder="Ex: TotalPass, ajuda em casa, faculdade..." value={costForm.description} onChange={(e) => setCostForm(p => ({ ...p, description: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && addFixedCost()} className="h-10" /></div><div><Label className="text-xs text-muted-foreground">Valor (R$)</Label><Input type="number" placeholder="0,00" value={costForm.amount} onChange={(e) => setCostForm(p => ({ ...p, amount: e.target.value }))} className="h-10" /></div><div><Label className="text-xs text-muted-foreground">Dia do mês</Label><Input type="number" min={1} max={31} value={costForm.day} onChange={(e) => setCostForm(p => ({ ...p, day: e.target.value }))} className="h-10" /></div><div><Label className="text-xs text-muted-foreground">Categoria</Label><Select value={costForm.category_id || '__none__'} onValueChange={(v) => setCostForm(p => ({ ...p, category_id: v === '__none__' ? '' : v }))}><SelectTrigger className="h-10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__none__">Sem categoria</SelectItem>{categories.filter(c => !c.archived).map(c => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}</SelectContent></Select></div><div><Label className="text-xs text-muted-foreground">Conta</Label><Select value={costForm.account_id || '__none__'} onValueChange={(v) => setCostForm(p => ({ ...p, account_id: v === '__none__' ? '' : v }))}><SelectTrigger className="h-10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__none__">Sem conta</SelectItem>{accounts.filter(a => !a.archived).map(a => <SelectItem key={a.id} value={a.id}>{a.icon} {a.name}</SelectItem>)}</SelectContent></Select></div><div className="min-[430px]:col-span-2 sm:col-span-2 flex items-end"><Button onClick={addFixedCost} disabled={addFixedCostMutation.isPending} className="w-full h-10"><Plus className="w-4 h-4 mr-1.5" /> Adicionar</Button></div></div></div>
          {fixedCosts.length === 0 ? <div className="stat-card py-10 text-center"><CalendarClock className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" /><p className="text-sm text-muted-foreground">Nenhum custo fixo cadastrado ainda</p></div> : <div className="space-y-2">{fixedCosts.map(item => { const category = categories.find(c => c.id === item.category_id); return <div key={item.id} className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3">{editingId === item.id ? <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2"><Input className="h-8 text-sm col-span-2 sm:col-span-1" value={editForm.description ?? item.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} /><Input type="number" className="h-8 text-sm" value={editForm.amount ?? String(item.amount)} onChange={e => setEditForm(p => ({ ...p, amount: e.target.value }))} /><Input type="number" min={1} max={31} className="h-8 text-sm" value={editForm.day ?? String(item.day)} onChange={e => setEditForm(p => ({ ...p, day: e.target.value }))} /><Button size="sm" className="h-8" onClick={saveEdit}><Check className="w-3.5 h-3.5" /></Button></div> : <><div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{item.description}</p><p className="text-xs text-muted-foreground">Todo dia {item.day} - <span className="font-semibold text-foreground">{formatCurrency(item.amount)}</span>{category && ` - ${category.icon} ${category.name}`}</p></div><button className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" onClick={() => { setEditingId(item.id); setEditForm({ description: item.description, amount: String(item.amount), day: String(item.day), category_id: item.category_id, account_id: item.account_id }); }}><Pencil className="w-3.5 h-3.5" /></button><button className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" onClick={() => archiveFixedCostMutation.mutate(item.id)}><Trash2 className="w-3.5 h-3.5" /></button></>}</div>; })}</div>}
          {fixedCosts.length > 0 && <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3"><Button onClick={generateFixedCosts} disabled={addExpenseBatch.isPending} className="w-full gap-2 sm:w-auto"><CalendarClock className="w-4 h-4" /> Agendar em {String(mon).padStart(2, '0')}/{year}</Button><p className="text-xs text-muted-foreground">Cria apenas o que ainda não existe no mês selecionado.</p></div>}
        </TabsContent>
        <TabsContent value="salario" className="space-y-4 mt-4">
          <div className="stat-card space-y-4"><p className="text-sm font-semibold">Configuração do salário</p><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div><Label className="text-xs text-muted-foreground">Salário bruto</Label><Input type="number" placeholder={profile?.monthly_salary ? `${profile.monthly_salary} (das Configurações)` : 'Ex: 5000'} value={salary.grossOverride || ''} onChange={(e) => saveSalary({ grossOverride: Number(e.target.value) || 0 })} className="h-10" /></div><div><Label className="text-xs text-muted-foreground">Descrição do lançamento</Label><Input placeholder="Salário" value={salary.description} onChange={(e) => saveSalary({ description: e.target.value })} className="h-10" /></div><div><Label className="text-xs text-muted-foreground">Conta para receber</Label><Select value={salary.account_id || '__none__'} onValueChange={(v) => saveSalary({ account_id: v === '__none__' ? '' : v })}><SelectTrigger className="h-10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__none__">Sem conta</SelectItem>{accounts.filter(a => !a.archived).map(a => <SelectItem key={a.id} value={a.id}>{a.icon} {a.name}</SelectItem>)}</SelectContent></Select></div><div><Label className="text-xs text-muted-foreground">1ª parcela (% no 5º dia útil)</Label><Input type="number" min={0} max={100} value={salary.firstSplitPct} onChange={(e) => saveSalary({ firstSplitPct: Number(e.target.value) || 60 })} className="h-10" /></div></div></div>
          {grossSalary > 0 && <div className="stat-card space-y-3"><p className="text-sm font-semibold flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Cálculo CLT automático</p><div className="space-y-2"><div className="flex justify-between py-2 border-b border-border/50"><span className="text-sm text-muted-foreground">Salário bruto</span><span className="font-semibold">{formatCurrency(grossSalary)}</span></div><div className="flex justify-between py-2 border-b border-border/50"><span className="text-sm text-muted-foreground">INSS progressivo</span><span className="text-expense font-semibold">- {formatCurrency(inss)}</span></div><div className="flex justify-between py-2 border-b border-border/50"><span className="text-sm text-muted-foreground">IRRF</span><span className="font-semibold">{irrf > 0 ? `- ${formatCurrency(irrf)}` : formatCurrency(0)}</span></div><div className="flex justify-between pt-2"><span className="text-sm font-semibold">Salário líquido</span><span className="text-income font-bold text-lg">{formatCurrency(netSalary)}</span></div></div></div>}
          {netSalary > 0 && <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div className="rounded-xl border border-income/25 bg-income/5 p-4 space-y-1"><p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">5º dia útil</p><p className="text-2xl font-bold text-income">{formatCurrency(firstNet)}</p><p className="text-sm text-muted-foreground">{formatDateBR(fifthBusinessDay)}</p></div><div className="rounded-xl border border-income/25 bg-income/5 p-4 space-y-1"><p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Dia 20 ajustado</p><p className="text-2xl font-bold text-income">{formatCurrency(secondNet)}</p><p className="text-sm text-muted-foreground">{formatDateBR(day20)}</p></div></div>}
          <div className="flex items-center gap-3 flex-wrap"><Button onClick={generateSalary} disabled={addIncome.isPending || !netSalary} className="gap-2"><WalletCards className="w-4 h-4" /> Lançar previsão em {String(mon).padStart(2, '0')}/{year}</Button><p className="text-xs text-muted-foreground">Criado como “Agendado” nas Receitas, sem duplicar se já existir.</p></div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
