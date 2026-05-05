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
import { useQueryClient } from '@tanstack/react-query';

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
  fitId?: string; // OFX unique ID for dedup
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

function dedupeKey(date: string, description: string, amount: number): string {
  const month = date.substring(0, 7);
  return `${month}|${description.toLowerCase().trim()}|${Math.abs(amount).toFixed(2)}`;
}

function getImportedMonths(rows: ParsedRow[]): string[] {
  const months = new Set(rows.map(r => r.date.substring(0, 7)));
  return [...months].sort();
}

// ── CC payment detection (used in both CSV and OFX parsers) ─────

const CC_PAYMENT_KEYWORDS = [
  'pagamento de fatura', 'pag fatura', 'fatura cartao', 'fatura cartão',
  'pagto fatura', 'pgto cartao', 'pgto cartão', 'pag cartao', 'pag cartão',
  'pagamento nubank', 'debito automatico cartao',
];

function detectCCPayment(description: string): boolean {
  const lower = description.toLowerCase();
  return CC_PAYMENT_KEYWORDS.some(kw => lower.includes(kw));
}

// ── OFX type detection ───────────────────────────────────────────

type OFXType = 'bank' | 'creditcard';

function detectOFXType(text: string): OFXType {
  if (/<CREDITCARDMSGSRSV1>/i.test(text) || /<CCSTMTTRNRS>/i.test(text) || /<CCSTMTRS>/i.test(text)) {
    return 'creditcard';
  }
  return 'bank';
}

/**
 * Extracts the bill month from a credit card OFX.
 * Uses DTEND from BANKTRANLIST which represents the closing date.
 * The bill month is the month AFTER the closing date (when you pay).
 */
function extractCCBillMonth(text: string): string {
  const dtEndMatch = text.match(/<DTEND>(\d{8})/i);
  if (dtEndMatch) {
    const dtStr = dtEndMatch[1];
    const year = parseInt(dtStr.slice(0, 4));
    const month = parseInt(dtStr.slice(4, 6));
    // Bill month = month after closing (DTEND)
    const billDate = new Date(year, month, 1); // month is already 0-indexed +1
    return `${billDate.getFullYear()}-${String(billDate.getMonth() + 1).padStart(2, '0')}`;
  }
  // Fallback: current month
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// ── CSV parser ───────────────────────────────────────────────────

function parseCSV(text: string, rules: Array<{ [key: string]: string }>, source: 'bank' | 'cc', categories: Array<{ id: string; name: string }> = []): ParsedRow[] {
  const allLines = text.split(/\r?\n/);
  if (allLines.length < 2) return [];

  // Find the real header line — some banks prepend account info rows before the actual header
  let headerIdx = 0;
  for (let i = 0; i < Math.min(allLines.length, 10); i++) {
    const lower = allLines[i].toLowerCase();
    if (
      (lower.includes('data') || lower.includes('date')) &&
      (lower.includes('valor') || lower.includes('histórico') || lower.includes('historico') ||
       lower.includes('descrição') || lower.includes('descricao') ||
       lower.includes('crédito') || lower.includes('credito') || lower.includes('débito') || lower.includes('debito'))
    ) {
      headerIdx = i;
      break;
    }
  }

  const lines = allLines.slice(headerIdx);
  if (lines.length < 2) return [];

  const headerCols = splitCsvLine(lines[0]).map(c => c.toLowerCase().replace(/\s+/g, ' ').trim());

  // Detect split credit/debit format (Bradesco, Itaú, CEF, Santander, etc.)
  const creditIdx = headerCols.findIndex(c => c.startsWith('crédito') || c.startsWith('credito') || c === 'cr');
  const debitIdx  = headerCols.findIndex(c => c.startsWith('débito')  || c.startsWith('debito')  || c === 'db');
  const dateIdx   = headerCols.findIndex(c => c === 'data' || c === 'date' || c === 'dt' || c.startsWith('data'));
  const descIdx   = headerCols.findIndex(c =>
    c.includes('histórico') || c.includes('historico') ||
    c.includes('descrição') || c.includes('descricao') ||
    c.includes('memo') || c.includes('lançamento') || c.includes('lancamento')
  );

  const isSplitFormat = creditIdx !== -1 && debitIdx !== -1;
  const isNubank = headerCols.some(c => c.includes('valor')) &&
    (headerCols.some(c => c.includes('identificador')) || headerCols.some(c => c.includes('título') || c.includes('titulo')));

  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const cols = splitCsvLine(line);
    if (cols.length < 2) continue;

    // Stop at footer / summary rows (lines that don't start with a date-like value)
    const firstCol = cols[0].trim();
    if (firstCol && !/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(firstCol) && !/^\d{4}-\d{2}-\d{2}/.test(firstCol)) continue;

    let date: string;
    let rawAmount: string;
    let description: string;
    let isIncomeRow = false;

    if (isSplitFormat) {
      // Bradesco / Itaú / CEF style: Date | Desc | [Docto] | Crédito | Débito | Saldo
      const dIdx = dateIdx >= 0 ? dateIdx : 0;
      const hIdx = descIdx >= 0 ? descIdx : (dIdx === 0 ? 1 : 0);

      date = parseDateStr(cols[dIdx] ?? '');
      description = (cols[hIdx] ?? '').trim() || 'Transação';

      const creditVal = parseMoney(cols[creditIdx] ?? '');
      const debitVal  = parseMoney(cols[debitIdx]  ?? '');

      if (creditVal !== null && creditVal > 0) {
        rawAmount = cols[creditIdx];
        isIncomeRow = true;
      } else if (debitVal !== null && debitVal > 0) {
        rawAmount = cols[debitIdx];
        isIncomeRow = false;
      } else {
        continue;
      }
    } else if (isNubank) {
      date = parseDateStr(cols[0]);
      rawAmount = cols[1];
      description = (cols.length >= 4 ? cols[3] : cols[2]) || 'Transação';
    } else {
      // Generic fallback — only accept values that have a decimal separator (avoids picking up doc/transaction IDs)
      date = new Date().toISOString().split('T')[0];
      rawAmount = '0';
      description = 'Transação importada';
      let gotAmount = false;
      for (const col of cols) {
        if (!col) continue;
        if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(col) || /^\d{4}-\d{2}-\d{2}/.test(col)) {
          date = parseDateStr(col); continue;
        }
        // Must contain comma or period acting as decimal — pure integers are likely doc numbers
        if (!gotAmount && /[,.]/.test(col) && col.length <= 15) {
          const n = parseMoney(col);
          if (n !== null) { rawAmount = col; gotAmount = true; continue; }
        }
        if (col.length > 3 && isNaN(Number(col.replace(/\./g, '').replace(',', '.')))) description = col;
      }
    }

    const amount = parseMoney(rawAmount);
    if (amount === null || amount === 0) continue;

    const result = classifyDescription(description, amount, rules, categories);

    let rowType: RowType;
    if (source === 'cc') {
      rowType = 'expense';
    } else if (isSplitFormat) {
      if (!isIncomeRow && detectCCPayment(description)) {
        rowType = 'cc_payment';
      } else {
        rowType = isIncomeRow ? 'income' : result.type as RowType;
      }
    } else {
      rowType = result.type as RowType;
    }

    rows.push({
      date, description,
      amount: Math.abs(amount),
      type: rowType,
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

const CC_CREDIT_SKIP_KEYWORDS = [
  'pagamento recebido', 'ajuste a crédito',
];

function shouldSkipCCCredit(description: string): boolean {
  const lower = description.toLowerCase();
  return CC_CREDIT_SKIP_KEYWORDS.some(kw => lower.includes(kw));
}

function parseOFX(text: string, rules: Array<{ [key: string]: string }>, categories: Array<{ id: string; name: string }> = []): { rows: ParsedRow[]; detectedType: OFXType; billMonth?: string } {
  const detectedType = detectOFXType(text);
  const isCreditCard = detectedType === 'creditcard';
  const source: 'bank' | 'cc' = isCreditCard ? 'cc' : 'bank';
  const billMonth = isCreditCard ? extractCCBillMonth(text) : undefined;

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
    const rawAmount = parseFloat(get('TRNAMT')) || 0;
    if (rawAmount === 0) continue;
    const description = get('MEMO') || get('NAME') || 'Transação OFX';
    const fitId = get('FITID');
    const trnType = get('TRNTYPE').toUpperCase();

    // For credit card OFX: skip "Pagamento recebido" and other credits (they're not purchases)
    if (isCreditCard && trnType === 'CREDIT' && shouldSkipCCCredit(description)) {
      console.log('[OFX] Ignorando crédito no cartão:', description, rawAmount);
      continue;
    }

    const amount = Math.abs(rawAmount);
    const isIncome = !isCreditCard && rawAmount > 0;
    
    let rowType: RowType;
    let classReason: string;
    
    if (isCreditCard) {
      rowType = 'expense';
      classReason = 'Fatura do cartão';
    } else if (detectCCPayment(description)) {
      rowType = 'cc_payment';
      classReason = 'Pagamento de fatura detectado';
    } else {
      const result = classifyDescription(description, rawAmount, rules, categories);
      rowType = isIncome ? 'income' : result.type as RowType;
      classReason = result.reason;
    }

    const result = classifyDescription(description, rawAmount, rules, categories);

    rows.push({
      date, description, amount,
      type: rowType,
      categoryId: result.categoryId ?? '',
      investmentId: result.investmentId ?? '',
      creditCardId: '',
      selected: true,
      confidence: isCreditCard ? 'high' : result.confidence,
      classificationReason: classReason,
      isDuplicate: false,
      source,
      fitId,
    });
  }
  return { rows, detectedType, billMonth };
}

function parseFile(text: string, fileName: string, rules: Array<{ [key: string]: string }>, forcedSource?: 'bank' | 'cc', categories: Array<{ id: string; name: string }> = []): { rows: ParsedRow[]; detectedType?: OFXType; billMonth?: string } {
  const ext = fileName.toLowerCase();
  if (ext.endsWith('.ofx') || ext.endsWith('.qfx')) {
    const result = parseOFX(text, rules, categories);
    // If user forced a source via upload slot, override
    if (forcedSource && forcedSource !== (result.detectedType === 'creditcard' ? 'cc' : 'bank')) {
      return { rows: result.rows.map(r => ({ ...r, source: forcedSource })), detectedType: result.detectedType, billMonth: result.billMonth };
    }
    return result;
  }
  return { rows: parseCSV(text, rules, forcedSource || 'bank', categories) };
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
  const [ccBillMonth, setCcBillMonth] = useState('');
  const [activeTab, setActiveTab] = useState('bank');
  const [forceImport, setForceImport] = useState(false);
  const [autoDetectedInfo, setAutoDetectedInfo] = useState('');

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
  const queryClient = useQueryClient();

  // Build set of existing keys for dedup
  const existingKeys = useMemo(() => {
    const keys = new Set<string>();
    existingExpenses.forEach(e => keys.add(dedupeKey(e.date, e.description, e.amount)));
    existingIncome.forEach(i => keys.add(dedupeKey(i.date, i.description, i.amount)));
    return keys;
  }, [existingExpenses, existingIncome]);

  // Mark duplicates
  const markRows = useCallback((parsed: ParsedRow[]): ParsedRow[] => {
    return parsed.map(row => {
      const key = dedupeKey(row.date, row.description, row.amount);
      const isDuplicate = existingKeys.has(key);
      return {
        ...row,
        isDuplicate,
        selected: !isDuplicate,
        classificationReason: isDuplicate ? '⚠️ Já importado no mesmo período' : row.classificationReason,
        confidence: isDuplicate ? 'low' : row.confidence,
      };
    });
  }, [existingKeys]);

  const handleForceImport = useCallback(() => {
    setForceImport(true);
    setBankRows(prev => prev.map(r => r.isDuplicate ? { ...r, selected: true } : r));
    setCcRows(prev => prev.map(r => r.isDuplicate ? { ...r, selected: true } : r));
    toast.info('Todas as transações foram marcadas. Revise e clique Importar.');
  }, []);

  const handleFileUpload = useCallback((slot: 'bank' | 'cc') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const result = parseFile(text, file.name, classificationRules, undefined, categories);
      
      if (result.rows.length === 0) {
        toast.error('Nenhuma transação encontrada no arquivo');
        return;
      }

      const isOFXCreditCard = result.detectedType === 'creditcard';
      
      // Auto-detect: if user uploaded a CC OFX in the bank slot, redirect to CC slot
      if (slot === 'bank' && isOFXCreditCard) {
        setCcFileName(file.name);
        setCcRows(result.rows);
        if (result.billMonth) setCcBillMonth(result.billMonth);
        setAutoDetectedInfo(`📋 "${file.name}" foi detectado como fatura de cartão de crédito e movido para o slot correto.`);
        toast.success(`${result.rows.length} transações da fatura lidas (auto-detectado como cartão de crédito)`);
        e.target.value = '';
        return;
      }
      
      // Auto-detect: if user uploaded a bank OFX in the CC slot, redirect to bank slot  
      if (slot === 'cc' && !isOFXCreditCard) {
        setBankFileName(file.name);
        const marked = markRows(result.rows);
        setBankRows(marked);
        setAutoDetectedInfo(`📋 "${file.name}" foi detectado como extrato bancário e movido para o slot correto.`);
        const dupes = marked.filter(r => r.isDuplicate).length;
        const ccPay = marked.filter(r => r.type === 'cc_payment').length;
        toast.success(`${result.rows.length} transações lidas (auto-detectado como extrato bancário)${dupes > 0 ? ` (${dupes} duplicadas)` : ''}${ccPay > 0 ? ` — ${ccPay} pagamento(s) de fatura` : ''}`);
        e.target.value = '';
        return;
      }

      // Normal flow
      if (slot === 'cc' || isOFXCreditCard) {
        setCcFileName(file.name);
        setCcRows(result.rows);
        if (result.billMonth) setCcBillMonth(result.billMonth);
        toast.success(`${result.rows.length} transações da fatura lidas`);
      } else {
        setBankFileName(file.name);
        const marked = markRows(result.rows);
        setBankRows(marked);
        const dupes = marked.filter(r => r.isDuplicate).length;
        const ccPay = marked.filter(r => r.type === 'cc_payment').length;
        toast.success(`${result.rows.length} transações lidas${dupes > 0 ? ` (${dupes} duplicadas)` : ''}${ccPay > 0 ? ` — ${ccPay} pagamento(s) de fatura` : ''}`);
      }
      
      setAutoDetectedInfo('');
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  }, [classificationRules, markRows, categories]);

  // Cross-reference: total CC rows vs CC payment in bank
  const ccTotal = useMemo(() => ccRows.filter(r => r.selected && r.type === 'expense').reduce((s, r) => s + r.amount, 0), [ccRows]);
  const bankCCPayment = useMemo(() => bankRows.filter(r => r.type === 'cc_payment').reduce((s, r) => s + r.amount, 0), [bankRows]);
  const ccPaymentCount = bankRows.filter(r => r.type === 'cc_payment').length;
  const ccItemCount = ccRows.filter(r => r.selected && r.type === 'expense').length;

  const toggleRow = (setter: React.Dispatch<React.SetStateAction<ParsedRow[]>>, i: number) =>
    setter(prev => prev.map((r, idx) => idx === i ? { ...r, selected: !r.selected } : r));

  const updateRow = (setter: React.Dispatch<React.SetStateAction<ParsedRow[]>>, i: number, field: keyof ParsedRow, value: unknown) =>
    setter(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));

  const handleImport = async () => {
    const bankSelected = bankRows.filter(r => r.selected && r.type !== 'cc_payment');
    const ccSelected = ccRows.filter(r => r.selected);
    const allSelected = [...bankSelected, ...ccSelected];

    if (allSelected.length === 0) { toast.error('Selecione ao menos uma transação'); return; }

    const expenseRows = bankSelected.filter(r => r.type === 'expense');
    const incomeRows  = bankSelected.filter(r => r.type === 'income');
    const investmentRows = bankSelected.filter(r => r.type === 'investment');

    console.log('[Import] Iniciando:', {
      expenses: expenseRows.length, income: incomeRows.length,
      investments: investmentRows.length, ccItems: ccSelected.length, userId: user?.id,
      ccBillMonth,
    });

    let successCount = 0;
    const errorMessages: string[] = [];

    const { supabase: sb } = await import('@/integrations/supabase/client');

    // ── Despesas ─────────────────────────────────────────────────
    if (expenseRows.length > 0) {
      const payload = expenseRows.map(r => ({
        date: r.date, description: r.description, amount: r.amount,
        category_id: r.categoryId || null, status: 'concluido', user_id: user!.id,
      }));
      console.log('[Import] Inserindo despesas:', payload);
      const { error } = await sb.from('expenses').insert(payload);
      if (error) { console.error('[Import] Erro despesas:', error); errorMessages.push(`Despesas: ${error.message}`); }
      else { successCount += expenseRows.length; console.log('[Import] Despesas OK'); }
    }

    // ── Receitas ─────────────────────────────────────────────────
    if (incomeRows.length > 0) {
      const payload = incomeRows.map(r => ({
        date: r.date, description: r.description, amount: r.amount,
        status: 'concluido', user_id: user!.id,
      }));
      console.log('[Import] Inserindo receitas:', payload);
      const { error } = await sb.from('income').insert(payload);
      if (error) { console.error('[Import] Erro receitas:', error); errorMessages.push(`Receitas: ${error.message}`); }
      else { successCount += incomeRows.length; console.log('[Import] Receitas OK'); }
    }

    // ── Investimentos ─────────────────────────────────────────────
    for (const r of investmentRows) {
      if (!r.investmentId) continue;
      try {
        await addInvestmentTx.mutateAsync({
          investment_id: r.investmentId, type: 'aporte',
          amount: r.amount, date: r.date, description: r.description,
        });
        successCount++;
      } catch (e) {
        const error = e as Error;
        errorMessages.push(`Investimento "${r.description}": ${error.message}`);
      }
    }

    // ── Fatura do cartão ──────────────────────────────────────────
    if (ccSelected.length > 0) {
      const defaultCardId = ccSelected[0]?.creditCardId || creditCards[0]?.id;
      if (defaultCardId) {
        // Use the detected bill month or derive from the transaction dates
        const effectiveBillMonth = ccBillMonth || ccSelected[0]?.date.substring(0, 7);
        
        const ccPayload = ccSelected.map(r => ({
          user_id: user!.id,
          credit_card_id: r.creditCardId || defaultCardId,
          category_id: r.categoryId || null,
          description: r.description,
          amount: r.amount,
          date: r.date,
          bill_month: effectiveBillMonth,
          is_installment: false,
          installment_number: null,
          total_installments: null,
          installment_group_id: null,
          is_recurring: false,
          notes: null,
          paid: false,
        }));
        
        console.log('[Import] Inserindo transações CC em lote:', ccPayload.length, 'bill_month:', effectiveBillMonth);
        const { error } = await sb.from('credit_card_transactions').insert(ccPayload);
        if (error) { 
          console.error('[Import] Erro CC:', error); 
          errorMessages.push(`Fatura: ${error.message}`); 
        } else { 
          successCount += ccSelected.length; 
          console.log('[Import] CC OK'); 
        }
      } else {
        // No credit card registered — save as regular expenses
        const payload = ccSelected.map(r => ({
          date: r.date, description: r.description, amount: r.amount,
          category_id: r.categoryId || null, status: 'concluido', user_id: user!.id,
        }));
        const { error } = await sb.from('expenses').insert(payload);
        if (error) errorMessages.push(`Fatura (sem cartão): ${error.message}`);
        else successCount += ccSelected.length;
      }
    }

    // ── Resultado ─────────────────────────────────────────────────
    if (errorMessages.length > 0) {
      console.error('[Import] Erros:', errorMessages);
      toast.error(
        `⚠️ ${successCount}/${allSelected.length} importadas. Erro: ${errorMessages[0]}`,
        { duration: 10000 }
      );
    }

    if (successCount > 0) {
      // Invalidate all queries so data appears everywhere
      await queryClient.invalidateQueries({ queryKey: ['income'] });
      await queryClient.invalidateQueries({ queryKey: ['expenses'] });
      await queryClient.invalidateQueries({ queryKey: ['finance-history'] });
      await queryClient.invalidateQueries({ queryKey: ['credit-card-transactions'] });
      await queryClient.invalidateQueries({ queryKey: ['accumulated-balance'] });

      const months = getImportedMonths(allSelected);
      const monthsLabel = months.map(m => {
        const [y, mo] = m.split('-');
        return `${['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][+mo-1]}/${y}`;
      }).join(', ');
      toast.success(`✅ ${successCount} transações salvas! Período: ${monthsLabel}.`, { duration: 8000 });
      setBankRows([]); setCcRows([]); setBankFileName(''); setCcFileName(''); setCcBillMonth(''); setForceImport(false); setAutoDetectedInfo('');
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
          {rows.map((row, i) => {
            const isCCPaymentReplaced = row.type === 'cc_payment' && !showCCColumn && ccRows.length > 0;
            return (
            <tr key={i} className={`border-b border-border/50 transition-colors ${
              isCCPaymentReplaced ? 'opacity-40 bg-warning/5' :
              row.isDuplicate ? 'opacity-30 bg-warning/5' : row.selected ? 'hover:bg-muted/50' : 'opacity-40'
            }`}>
              <td className="py-2 px-2">
                {isCCPaymentReplaced
                  ? <span className="block w-4 h-4 text-center text-warning/50 text-xs leading-4">—</span>
                  : <input type="checkbox" checked={row.selected} onChange={() => toggleRow(setter, i)} className="accent-primary" />
                }
              </td>
              <td className="py-2 px-2 text-muted-foreground whitespace-nowrap">{row.date}</td>
              <td className="py-2 px-2 max-w-[180px]">
                <p className="font-medium truncate">{row.description}</p>
                {isCCPaymentReplaced ? (
                  <p className="text-[10px] text-warning/70">↩ substituído pelos itens da fatura</p>
                ) : (
                  <p className={`text-[10px] ${CONFIDENCE_COLORS[row.confidence]}`}>
                    {row.isDuplicate ? '🔁' : row.confidence === 'high' ? '✅' : row.confidence === 'medium' ? '⚠️' : '❓'} {row.classificationReason}
                  </p>
                )}
              </td>
              <td className="py-2 px-2">
                <Select value={row.type} onValueChange={(v: string) => updateRow(setter, i, 'type', v)}>
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
          );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Importar Extrato</h1>
        <p className="text-sm text-muted-foreground">Importe o extrato do banco e a fatura do cartão — o app detecta automaticamente o tipo do arquivo OFX</p>
      </div>

      {/* Instructions */}
      <div className="rounded-lg bg-muted/60 border border-border p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Info className="w-4 h-4 text-primary" /> Como funciona
        </div>
        <ol className="text-xs text-muted-foreground space-y-1 ml-6 list-decimal">
          <li><strong>Extrato do banco:</strong> Exporte o OFX/CSV do seu banco (conta corrente)</li>
          <li><strong>Fatura do cartão:</strong> Exporte o OFX/CSV da fatura do cartão de crédito</li>
          <li>O app <strong>detecta automaticamente</strong> se o arquivo é extrato ou fatura (pode soltar em qualquer slot!)</li>
          <li>"Pagamento de fatura" no extrato é <strong>substituído pelos itens detalhados</strong> da fatura</li>
          <li>Transações duplicadas são identificadas e desmarcadas automaticamente</li>
        </ol>
      </div>

      {/* Auto-detection info */}
      {autoDetectedInfo && (
        <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3 text-sm text-primary flex items-center gap-2">
          <Info className="w-4 h-4 shrink-0" />
          {autoDetectedInfo}
        </div>
      )}

      {/* Upload areas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderUploadArea(
          bankFileName ? 'Extrato carregado ✓' : 'Extrato do Banco',
          <Building2 className={`w-6 h-6 ${bankFileName ? 'text-primary' : 'text-muted-foreground'}`} />,
          bankFileName,
          handleFileUpload('bank'),
          'CSV ou OFX do extrato bancário do mês',
          !!bankFileName
        )}
        {renderUploadArea(
          ccFileName ? 'Fatura carregada ✓' : 'Fatura do Cartão',
          <CreditCard className={`w-6 h-6 ${ccFileName ? 'text-primary' : 'text-muted-foreground'}`} />,
          ccFileName,
          handleFileUpload('cc'),
          'CSV ou OFX da fatura do cartão de crédito',
          !!ccFileName
        )}
      </div>

      {hasAnyData && (
        <>
          {/* Bill month info */}
          {ccBillMonth && (
            <div className="rounded-lg bg-muted/40 border border-border px-4 py-2 text-sm flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-muted-foreground" />
              <span>Mês da fatura detectado: <strong>{ccBillMonth.split('-').reverse().join('/')}</strong></span>
            </div>
          )}

          {/* Cross-reference banner */}
          {ccRows.length > 0 && bankCCPayment > 0 && (
            <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3 text-sm">
              <div className="flex items-center gap-2 mb-3 font-semibold text-foreground">
                <Link2 className="w-4 h-4 text-primary" />
                Cruzamento extrato + fatura
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-background/60 rounded-lg p-2.5 border border-border/50">
                  <p className="text-[11px] text-muted-foreground mb-0.5">💳 Fatura do cartão</p>
                  <p className="font-semibold text-foreground">{formatCurrency(ccTotal)}</p>
                  <p className="text-[11px] text-muted-foreground">{ccItemCount} compra{ccItemCount !== 1 ? 's' : ''}</p>
                </div>
                <div className="bg-background/60 rounded-lg p-2.5 border border-border/50">
                  <p className="text-[11px] text-muted-foreground mb-0.5">🏦 Pago no extrato</p>
                  <p className="font-semibold text-warning">{formatCurrency(bankCCPayment)}</p>
                  <p className="text-[11px] text-muted-foreground">{ccPaymentCount} lançamento{ccPaymentCount !== 1 ? 's' : ''} — excluído{ccPaymentCount !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                ✅ Os itens da fatura serão importados individualmente. Os pagamentos genéricos do extrato são ignorados para evitar duplicação.
                {Math.abs(ccTotal - bankCCPayment) > 1 && (
                  <> A diferença de <span className="text-foreground font-medium">{formatCurrency(Math.abs(ccTotal - bankCCPayment))}</span> é normal — pode incluir parcelas de meses anteriores ou coberturas de ciclos diferentes.</>
                )}
              </p>
            </div>
          )}

          {/* Duplicate warning */}
          {bankRows.filter(r => r.isDuplicate).length > 0 && !forceImport && (
            <div className="rounded-lg bg-warning/5 border border-warning/20 px-4 py-3 text-sm flex items-start gap-3 text-warning">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p><strong>{bankRows.filter(r => r.isDuplicate).length} transação(ões) detectada(s) como já importadas</strong> e desmarcadas automaticamente.</p>
                <p className="text-xs mt-1 text-muted-foreground">Se tiver certeza que <strong>não estão no banco</strong>, clique abaixo para forçar a importação.</p>
                <button
                  onClick={handleForceImport}
                  className="mt-2 text-xs underline text-warning hover:text-warning/80 transition-colors"
                >
                  Forçar reimportação de todas (ignorar dedup)
                </button>
              </div>
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
              <Button variant="outline" size="sm" onClick={() => { setBankRows([]); setCcRows([]); setBankFileName(''); setCcFileName(''); setCcBillMonth(''); setAutoDetectedInfo(''); }}>
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
