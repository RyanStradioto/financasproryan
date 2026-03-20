import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCategories, useAddExpenseBatch, useAddIncome, useExpenses, useIncome as useIncomeData } from '@/hooks/useFinanceData';
import { useInvestments, useAddInvestmentTransaction } from '@/hooks/useInvestments';
import { useCreditCards, useAddCreditCardTransaction } from '@/hooks/useCreditCards';
import { useClassificationRules, classifyDescription } from '@/hooks/useClassification';
import { formatCurrency } from '@/lib/format';
import { toast } from 'sonner';
import { Upload, Trash2, Check, TrendingUp, TrendingDown, BarChart3, Info, CreditCard, Building2, Link2, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';

type RowType = 'income' | 'expense' | 'investment' | 'cc_payment';

type ParsedRow = {
  date: string;
  description: string;
  amount: number;
  type: RowType;
  categoryId: string;
  investmentId: string;
  creditCardId: string;
  selected: boolean;
  confidence: 'high' | 'medium' | 'low';
  classificationReason: string;
  isDuplicate: boolean;
  source: 'bank' | 'cc';
};

// ── Parsing helpers ──────────────────────────────────────────────

function splitCsvLine(line: string): string[] {
  const cols: string[] = [];
  let cur = '', inQuote = false;
  for (const ch of line) {
    if (ch === '"') { inQuote = !inQuote; continue; }
    if (ch === ',' && !inQuote) { cols.push(cur.trim()); cur = ''; continue; }
    if (ch === ';' && !inQuote) { cols.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  cols.push(cur.trim());
  return cols;
}

function parseMoney(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  if (/,\d{1,2}$/.test(s)) {
    const n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
    return isNaN(n) ? null : n;
  }
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function parseDateStr(raw: string): string {
  const br = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (br) {
    const [, d, m, y] = br;
    return `${y.length === 2 ? '20' + y : y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(raw.trim())) return raw.trim().substring(0, 10);
  return new Date().toISOString().split('T')[0];
}

/** Generate a dedup key from date+description+amount */
function dedupeKey(date: string, description: string, amount: number): string {
  return `${date}|${description.toLowerCase().trim()}|${Math.abs(amount).toFixed(2)}`;
}

/** Get unique months (YYYY-MM) from a list of rows */
function getImportedMonths(rows: ParsedRow[]): string[] {
  const months = new Set(rows.map(r => r.date.substring(0, 7)));
  return [...months].sort();
}

// ── CSV parser ───────────────────────────────────────────────────

function parseCSV(text: string, rules: any[], source: 'bank' | 'cc'): ParsedRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const header = lines[0].toLowerCase();
  const isNubank = header.includes('valor') && (header.includes('identificador') || header.includes('título'));

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (cols.length < 2) continue;

    let date: string;
    let rawAmount: string;
    let description: string;

    if (isNubank && cols.length >= 4) {
      date = parseDateStr(cols[0]);
      rawAmount = cols[1];
      description = cols[3] || cols[2] || 'Transação';
    } else if (isNubank && cols.length >= 3) {
      date = parseDateStr(cols[0]);
      rawAmount = cols[1];
      description = cols[2] || 'Transação';
    } else {
      date = new Date().toISOString().split('T')[0];
      rawAmount = '0';
      description = 'Transação importada';
      let gotAmount = false;
      for (const col of cols) {
        if (!col) continue;
        if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(col) || /^\d{4}-\d{2}-\d{2}/.test(col)) {
          date = parseDateStr(col); continue;
        }
        const n = parseMoney(col);
        if (n !== null && !gotAmount && col.length <= 15) { rawAmount = col; gotAmount = true; continue; }
        if (col.length > 3) description = col;
      }
    }

    const amount = parseMoney(rawAmount);
    if (amount === null || amount === 0) continue;

    const result = classifyDescription(description, amount, rules);
    rows.push({
      date, description,
      amount: Math.abs(amount),
      type: source === 'cc' ? 'expense' : result.type as RowType,
      categoryId: result.categoryId ?? '',
      investmentId: result.investmentId ?? '',
      creditCardId: '',
      selected: true,
      confidence: result.confidence,
      classificationReason: source === 'cc' ? 'Fatura do cartão' : result.reason,
      isDuplicate: false,
      source,
    });
  }
  return rows;
}

// ── OFX parser ───────────────────────────────────────────────────

function parseOFX(text: string, rules: any[], source: 'bank' | 'cc'): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const stmtRx = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;
  while ((match = stmtRx.exec(text)) !== null) {
    const block = match[1];
    const get = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}>([^<\n]+)`, 'i'));
      return m ? m[1].trim() : '';
    };
    const dtStr = get('DTPOSTED');
    const date = dtStr.length >= 8
      ? `${dtStr.slice(0, 4)}-${dtStr.slice(4, 6)}-${dtStr.slice(6, 8)}`
      : new Date().toISOString().split('T')[0];
    const amount = parseFloat(get('TRNAMT')) || 0;
    if (amount === 0) continue;
    const description = get('MEMO') || get('NAME') || 'Transação OFX';
    const result = classifyDescription(description, amount, rules);
    rows.push({
      date, description, amount: Math.abs(amount),
      type: source === 'cc' ? 'expense' : result.type as RowType,
      categoryId: result.categoryId ?? '',
      investmentId: result.investmentId ?? '',
      creditCardId: '',
      selected: true,
      confidence: result.confidence,
      classificationReason: source === 'cc' ? 'Fatura do cartão' : result.reason,
      isDuplicate: false,
      source,
    });
  }
  return rows;
}

function parseFile(text: string, fileName: string, rules: any[], source: 'bank' | 'cc'): ParsedRow[] {
  const ext = fileName.toLowerCase();
  if (ext.endsWith('.ofx') || ext.endsWith('.qfx')) {
    return parseOFX(text, rules, source);
  }
  return parseCSV(text, rules, source);
}

// ── CC payment detection ─────────────────────────────────────────

const CC_PAYMENT_KEYWORDS = [
  'pagamento de fatura', 'pag fatura', 'fatura cartao', 'fatura cartão',
  'pagto fatura', 'pgto cartao', 'pgto cartão', 'pag cartao', 'pag cartão',
  'nubank', 'pagamento nubank', 'debito automatico cartao',
];

function detectCCPayment(description: string): boolean {
  const lower = description.toLowerCase();
  return CC_PAYMENT_KEYWORDS.some(kw => lower.includes(kw));
}

// ── Type labels & colors ─────────────────────────────────────────

const TYPE_LABELS: Record<RowType, string> = {
  income: 'Receita',
  expense: 'Despesa',
  investment: 'Investimento',
  cc_payment: 'Fatura Cartão',
};

const TYPE_COLORS: Record<RowType, string> = {
  income: 'bg-income/10 text-income',
  expense: 'bg-expense/10 text-expense',
  investment: 'bg-primary/10 text-primary',
  cc_payment: 'bg-warning/10 text-warning',
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: 'text-income',
  medium: 'text-warning',
  low: 'text-muted-foreground',
};

// ══════════════════════════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════════════════════════

export default function ImportPage() {
  const [bankRows, setBankRows] = useState<ParsedRow[]>([]);
  const [ccRows, setCcRows] = useState<ParsedRow[]>([]);
  const [bankFileName, setBankFileName] = useState('');
  const [ccFileName, setCcFileName] = useState('');
  const [activeTab, setActiveTab] = useState('bank');

  const { data: categories = [] } = useCategories();
  const { data: investments = [] } = useInvestments();
  const { data: creditCards = [] } = useCreditCards();
  const { data: classificationRules = [] } = useClassificationRules();
  const { data: existingExpenses = [] } = useExpenses();
  const { data: existingIncome = [] } = useIncomeData();
  const addExpenseBatch = useAddExpenseBatch();
  const addIncome = useAddIncome();
  const addInvestmentTx = useAddInvestmentTransaction();
  const addCCTransaction = useAddCreditCardTransaction();
  const { user } = useAuth();

  // Build set of existing transaction keys for dedup
  const existingKeys = useMemo(() => {
    const keys = new Set<string>();
    existingExpenses.forEach(e => keys.add(dedupeKey(e.date, e.description, e.amount)));
    existingIncome.forEach(i => keys.add(dedupeKey(i.date, i.description, i.amount)));
    return keys;
  }, [existingExpenses, existingIncome]);

  // Mark duplicates and detect CC payments
  const markRows = useCallback((parsed: ParsedRow[]): ParsedRow[] => {
    return parsed.map(row => {
      const key = dedupeKey(row.date, row.description, row.amount);
      const isDuplicate = existingKeys.has(key);
      const isCCPayment = row.source === 'bank' && detectCCPayment(row.description);
      return {
        ...row,
        isDuplicate,
        selected: !isDuplicate,
        type: isCCPayment ? 'cc_payment' as RowType : row.type,
        classificationReason: isDuplicate ? '⚠️ Já importado anteriormente' : isCCPayment ? 'Pagamento de fatura detectado' : row.classificationReason,
        confidence: isDuplicate ? 'low' : isCCPayment ? 'high' : row.confidence,
      };
    });
  }, [existingKeys]);

  const handleBankFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBankFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseFile(text, file.name, classificationRules, 'bank');
      if (parsed.length === 0) { toast.error('Nenhuma transação encontrada no arquivo'); return; }
      const marked = markRows(parsed);
      setBankRows(marked);
      const dupes = marked.filter(r => r.isDuplicate).length;
      const ccPay = marked.filter(r => r.type === 'cc_payment').length;
      toast.success(`${parsed.length} transações lidas${dupes > 0 ? ` (${dupes} duplicadas detectadas)` : ''}${ccPay > 0 ? ` — ${ccPay} pagamento(s) de fatura identificado(s)` : ''}`);
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  }, [classificationRules, markRows]);

  const handleCCFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCcFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseFile(text, file.name, classificationRules, 'cc');
      if (parsed.length === 0) { toast.error('Nenhuma transação encontrada no arquivo da fatura'); return; }
      setCcRows(parsed);
      toast.success(`${parsed.length} transações da fatura lidas`);
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  }, [classificationRules]);

  // Cross-reference: total CC rows vs CC payment in bank
  const ccTotal = useMemo(() => ccRows.filter(r => r.selected).reduce((s, r) => s + r.amount, 0), [ccRows]);
  const bankCCPayment = useMemo(() => bankRows.filter(r => r.type === 'cc_payment').reduce((s, r) => s + r.amount, 0), [bankRows]);
  const crossRefMatch = ccTotal > 0 && bankCCPayment > 0 && Math.abs(ccTotal - bankCCPayment) < 1;

  const toggleRow = (setter: React.Dispatch<React.SetStateAction<ParsedRow[]>>, i: number) =>
    setter(prev => prev.map((r, idx) => idx === i ? { ...r, selected: !r.selected } : r));

  const updateRow = (setter: React.Dispatch<React.SetStateAction<ParsedRow[]>>, i: number, field: keyof ParsedRow, value: any) =>
    setter(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));

  const handleImport = async () => {
    // Combine bank (non-cc-payment) + cc rows
    const bankSelected = bankRows.filter(r => r.selected && r.type !== 'cc_payment');
    const ccSelected = ccRows.filter(r => r.selected);
    const allSelected = [...bankSelected, ...ccSelected];

    if (allSelected.length === 0) { toast.error('Selecione ao menos uma transação'); return; }

    try {
      // Bank expenses
      const expenseRows = bankSelected.filter(r => r.type === 'expense');
      const incomeRows = bankSelected.filter(r => r.type === 'income');
      const investmentRows = bankSelected.filter(r => r.type === 'investment');

      if (expenseRows.length > 0) {
        await addExpenseBatch.mutateAsync(expenseRows.map(r => ({
          date: r.date, description: r.description, amount: r.amount,
          category_id: r.categoryId || null, status: 'concluido',
        })));
      }

      for (const r of incomeRows) {
        await addIncome.mutateAsync({
          date: r.date,
          description: r.description,
          amount: r.amount,
          category_id: r.categoryId || null,
          status: 'concluido',
        });
      }

      for (const r of investmentRows) {
        if (!r.investmentId) continue;
        await addInvestmentTx.mutateAsync({
          investment_id: r.investmentId, type: 'aporte',
          amount: r.amount, date: r.date, description: r.description,
        });
      }

      // CC transactions — save to credit_card_transactions table
      if (ccSelected.length > 0) {
        const defaultCardId = ccSelected[0]?.creditCardId || creditCards[0]?.id;
        if (defaultCardId) {
          for (const r of ccSelected) {
            const cardId = r.creditCardId || defaultCardId;
            const billMonth = r.date.substring(0, 7); // YYYY-MM from the transaction date
            await addCCTransaction.mutateAsync({
              credit_card_id: cardId,
              category_id: r.categoryId || null,
              description: r.description,
              amount: r.amount,
              date: r.date,
              bill_month: billMonth,
              installments: 1,
            });
          }
        } else {
          // Fallback: save as regular expenses if no CC configured
          await addExpenseBatch.mutateAsync(ccSelected.map(r => ({
            date: r.date, description: r.description, amount: r.amount,
            category_id: r.categoryId || null, status: 'concluido',
          })));
        }
      }

      // Build months summary for the toast
      const importedMonths = getImportedMonths(allSelected);
      const monthsLabel = importedMonths.map(m => {
        const [y, mo] = m.split('-');
        const names = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        return `${names[parseInt(mo) - 1]}/${y}`;
      }).join(', ');

      toast.success(
        `✅ ${allSelected.length} transações importadas! Acesse o Dashboard e selecione o mês ${monthsLabel} para ver as transações.`,
        { duration: 8000 }
      );

      setBankRows([]); setCcRows([]); setBankFileName(''); setCcFileName('');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const activeCategories = categories.filter(c => !c.archived);
  const activeInvestments = investments.filter(i => !i.archived);
  const hasAnyData = bankRows.length > 0 || ccRows.length > 0;
  const totalSelected = bankRows.filter(r => r.selected && r.type !== 'cc_payment').length + ccRows.filter(r => r.selected).length;

  // ── Upload area ──────────────────────────────────────────────────
  const renderUploadArea = (
    label: string,
    icon: React.ReactNode,
    fileName: string,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
    hint: string,
    loaded: boolean
  ) => (
    <label className={`flex flex-col items-center justify-center py-8 cursor-pointer rounded-xl border-2 border-dashed transition-all
      ${loaded
        ? 'border-primary/40 bg-primary/5 hover:bg-primary/10'
        : 'border-border bg-muted/30 hover:border-primary/30 hover:bg-muted/50'
      }`}>
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${loaded ? 'bg-primary/15' : 'bg-muted'}`}>
        {icon}
      </div>
      <p className="font-medium mb-1 text-sm">{label}</p>
      {loaded ? (
        <Badge variant="secondary" className="mt-1 text-xs">{fileName}</Badge>
      ) : (
        <p className="text-xs text-muted-foreground text-center px-4">{hint}</p>
      )}
      <input type="file" className="hidden" onChange={onChange} accept=".csv,.ofx,.qfx" />
    </label>
  );

  const renderTable = (rows: ParsedRow[], setter: React.Dispatch<React.SetStateAction<ParsedRow[]>>, showCCColumn: boolean) => (
    <div className="stat-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="py-3 px-2 w-10">
              <input type="checkbox" checked={rows.every(r => r.selected)}
                onChange={() => { const all = rows.every(r => r.selected); setter(prev => prev.map(r => ({ ...r, selected: !all }))); }}
                className="accent-primary" />
            </th>
            <th className="text-left py-3 px-2 font-medium text-muted-foreground">Data</th>
            <th className="text-left py-3 px-2 font-medium text-muted-foreground">Descrição</th>
            <th className="text-left py-3 px-2 font-medium text-muted-foreground">Tipo</th>
            <th className="text-right py-3 px-2 font-medium text-muted-foreground">Valor</th>
            <th className="text-left py-3 px-2 font-medium text-muted-foreground">
              {showCCColumn ? 'Cartão / Categoria' : 'Categoria / Ativo'}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={`border-b border-border/50 transition-colors ${
              row.isDuplicate ? 'opacity-30 bg-warning/5' : row.selected ? 'hover:bg-muted/50' : 'opacity-40'
            }`}>
              <td className="py-2 px-2">
                <input type="checkbox" checked={row.selected} onChange={() => toggleRow(setter, i)} className="accent-primary" />
              </td>
              <td className="py-2 px-2 text-muted-foreground whitespace-nowrap">{row.date}</td>
              <td className="py-2 px-2 max-w-[180px]">
                <p className="font-medium truncate">{row.description}</p>
                <p className={`text-[10px] ${CONFIDENCE_COLORS[row.confidence]}`}>
                  {row.isDuplicate ? '🔁' : row.confidence === 'high' ? '✅' : row.confidence === 'medium' ? '⚠️' : '❓'} {row.classificationReason}
                </p>
              </td>
              <td className="py-2 px-2">
                <Select value={row.type} onValueChange={(v: any) => updateRow(setter, i, 'type', v)}>
                  <SelectTrigger className={`h-7 text-xs border-0 px-2 ${TYPE_COLORS[row.type]}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Despesa</SelectItem>
                    <SelectItem value="income">Receita</SelectItem>
                    <SelectItem value="investment">Investimento</SelectItem>
                    {!showCCColumn && <SelectItem value="cc_payment">Fatura Cartão</SelectItem>}
                  </SelectContent>
                </Select>
              </td>
              <td className={`py-2 px-2 text-right currency font-semibold ${
                row.type === 'income' ? 'text-income' : row.type === 'investment' ? 'text-primary' : row.type === 'cc_payment' ? 'text-warning' : 'text-expense'
              }`}>
                {formatCurrency(row.amount)}
              </td>
              <td className="py-2 px-2">
                {showCCColumn ? (
                  <div className="space-y-1">
                    <Select value={row.creditCardId} onValueChange={v => updateRow(setter, i, 'creditCardId', v)}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Cartão..." /></SelectTrigger>
                      <SelectContent>
                        {creditCards.map(cc => <SelectItem key={cc.id} value={cc.id}>{cc.icon} {cc.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={row.categoryId} onValueChange={v => updateRow(setter, i, 'categoryId', v)}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Categoria..." /></SelectTrigger>
                      <SelectContent>
                        {activeCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <>
                    {(row.type === 'expense' || row.type === 'cc_payment') && (
                      <Select value={row.categoryId} onValueChange={v => updateRow(setter, i, 'categoryId', v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          {activeCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                    {row.type === 'investment' && (
                      <Select value={row.investmentId} onValueChange={v => updateRow(setter, i, 'investmentId', v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar ativo..." /></SelectTrigger>
                        <SelectContent>
                          {activeInvestments.map(inv => <SelectItem key={inv.id} value={inv.id}>{inv.icon} {inv.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Importar Extrato</h1>
        <p className="text-sm text-muted-foreground">Importe o extrato do banco e a fatura do cartão juntos — o app cruza os dados automaticamente</p>
      </div>

      {/* Instructions */}
      <div className="rounded-lg bg-muted/60 border border-border p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Info className="w-4 h-4 text-primary" /> Como funciona
        </div>
        <ol className="text-xs text-muted-foreground space-y-1 ml-6 list-decimal">
          <li><strong>Extrato do banco:</strong> Exporte o CSV/OFX do seu banco (ex: Nubank → Exportar dados)</li>
          <li><strong>Fatura do cartão (opcional):</strong> Exporte a fatura do cartão de crédito separadamente</li>
          <li>Anexe os dois arquivos abaixo e clique <strong>Importar</strong> — tudo é processado de uma vez</li>
          <li><strong>Transações duplicadas</strong> são identificadas e desmarcadas automaticamente</li>
        </ol>
      </div>

      {/* Upload areas — always visible */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderUploadArea(
          bankFileName ? 'Extrato carregado ✓' : 'Extrato do Banco',
          <Building2 className={`w-6 h-6 ${bankFileName ? 'text-primary' : 'text-muted-foreground'}`} />,
          bankFileName,
          handleBankFile,
          'CSV ou OFX do extrato bancário do mês',
          !!bankFileName
        )}
        {renderUploadArea(
          ccFileName ? 'Fatura carregada ✓' : 'Fatura do Cartão',
          <CreditCard className={`w-6 h-6 ${ccFileName ? 'text-primary' : 'text-muted-foreground'}`} />,
          ccFileName,
          handleCCFile,
          'CSV ou OFX da fatura do cartão (opcional)',
          !!ccFileName
        )}
      </div>

      {hasAnyData && (
        <>
          {/* Cross-reference banner */}
          {ccRows.length > 0 && bankCCPayment > 0 && (
            <div className={`rounded-lg border px-4 py-3 text-sm flex items-center gap-3 ${
              crossRefMatch ? 'bg-income/5 border-income/20 text-income' : 'bg-warning/5 border-warning/20 text-warning'
            }`}>
              <Link2 className="w-5 h-5 shrink-0" />
              <div>
                {crossRefMatch ? (
                  <p>✅ <strong>Cruzamento ok!</strong> A fatura ({formatCurrency(ccTotal)}) bate com o pagamento no extrato ({formatCurrency(bankCCPayment)}). Os itens da fatura serão importados individualmente e o pagamento genérico será ignorado.</p>
                ) : (
                  <p>⚠️ A fatura ({formatCurrency(ccTotal)}) <strong>não bate exatamente</strong> com o pagamento no extrato ({formatCurrency(bankCCPayment)}). Diferença: {formatCurrency(Math.abs(ccTotal - bankCCPayment))}. Verifique os valores.</p>
                )}
              </div>
            </div>
          )}

          {/* Duplicate warning */}
          {bankRows.filter(r => r.isDuplicate).length > 0 && (
            <div className="rounded-lg bg-warning/5 border border-warning/20 px-4 py-3 text-sm flex items-center gap-3 text-warning">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <p><strong>{bankRows.filter(r => r.isDuplicate).length} transação(ões) duplicada(s)</strong> foram detectadas e desmarcadas. Elas já existem no seu banco de dados.</p>
            </div>
          )}

          {/* Summary + actions */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm text-muted-foreground flex gap-4">
              {bankFileName && <span>🏦 <span className="font-medium text-foreground">{bankFileName}</span> ({bankRows.length})</span>}
              {ccFileName && <span>💳 <span className="font-medium text-foreground">{ccFileName}</span> ({ccRows.length})</span>}
              <span className="font-medium text-foreground">{totalSelected} selecionadas</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setBankRows([]); setCcRows([]); setBankFileName(''); setCcFileName(''); }}>
                <Trash2 className="w-4 h-4 mr-1" /> Limpar
              </Button>
              <Button size="sm" onClick={handleImport} disabled={totalSelected === 0 || addExpenseBatch.isPending}>
                <Check className="w-4 h-4 mr-1" /> Importar {totalSelected}
              </Button>
            </div>
          </div>

          {/* Tabs for bank / cc */}
          {ccRows.length > 0 ? (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="bank" className="gap-1">
                  <Building2 className="w-4 h-4" /> Extrato ({bankRows.length})
                </TabsTrigger>
                <TabsTrigger value="cc" className="gap-1">
                  <CreditCard className="w-4 h-4" /> Fatura ({ccRows.length})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="bank">
                {bankRows.length > 0 ? renderTable(bankRows, setBankRows, false) : (
                  <div className="stat-card flex flex-col items-center py-8 text-muted-foreground">
                    <Building2 className="w-8 h-8 mb-2 opacity-40" />
                    <p className="text-sm">Nenhum extrato carregado — use a área acima</p>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="cc">
                {renderTable(ccRows, setCcRows, true)}
              </TabsContent>
            </Tabs>
          ) : (
            renderTable(bankRows, setBankRows, false)
          )}
        </>
      )}
    </div>
  );
}
