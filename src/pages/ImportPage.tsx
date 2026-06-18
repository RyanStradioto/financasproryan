import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCategories, useAddExpenseBatch, useAddIncome, useExpenses, useIncome as useIncomeData, useAccounts } from '@/hooks/useFinanceData';
import { useInvestments, useAddInvestmentTransaction } from '@/hooks/useInvestments';
import { useCreditCards, useAddCreditCardTransaction } from '@/hooks/useCreditCards';
import { useClassificationRules } from '@/hooks/useClassification';
import {
  parseFile, bradescoStatementToRows,
  type ParsedRow, type RowType,
} from '@/lib/importParsers';
import { parseBradescoPdfFile } from '@/lib/bradescoStatementParser';
import { formatCurrency } from '@/lib/format';
import { useSensitiveData } from '@/components/finance/SensitiveData';
import { toast } from 'sonner';
import { Upload, Trash2, Check, TrendingUp, TrendingDown, BarChart3, Info, CreditCard, Building2, Link2, AlertTriangle, FileText } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { useQueryClient } from '@tanstack/react-query';
import NubankImporter from '@/components/finance/NubankImporter';

// Parsing lives in src/lib/importParsers.ts (CSV/OFX/Bradesco-PDF) — kept out of
// the component so it can be unit-tested.

function dedupeKey(date: string, description: string, amount: number): string {
  const month = date.substring(0, 7);
  return `${month}|${description.toLowerCase().trim()}|${Math.abs(amount).toFixed(2)}`;
}

function getImportedMonths(rows: ParsedRow[]): string[] {
  const months = new Set(rows.map(r => r.date.substring(0, 7)));
  return [...months].sort();
}

// â"€â"€ Type labels & colors â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Component
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export default function ImportPage() {
  const { maskCurrency } = useSensitiveData();
  const fmt = (v: number) => maskCurrency(formatCurrency(v));
  const [bankRows, setBankRows] = useState<ParsedRow[]>([]);
  const [ccRows, setCcRows] = useState<ParsedRow[]>([]);
  const [bankFileName, setBankFileName] = useState('');
  const [ccFileName, setCcFileName] = useState('');
  const [ccBillMonth, setCcBillMonth] = useState('');
  const [activeTab, setActiveTab] = useState('bank');
  const [forceImport, setForceImport] = useState(false);
  const [autoDetectedInfo, setAutoDetectedInfo] = useState('');
  // Conta a que o extrato pertence — sem isso, as transações entram "órfãs"
  // (sem account_id) e ficam fora do saldo. Era a causa das 97 órfãs.
  const [importAccountId, setImportAccountId] = useState('');

  const { data: categories = [] } = useCategories();
  const { data: accounts = [] } = useAccounts();
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

    // ── PDF: Bradesco statement (the PDF carries the merchant name — much
    // better auto-classification than the CSV, which only has the history).
    if (file.name.toLowerCase().endsWith('.pdf')) {
      e.target.value = '';
      if (slot === 'cc') {
        toast.error('PDF de fatura ainda não é suportado — exporte a fatura em OFX/CSV. PDFs de extrato (Bradesco) vão no slot "Extrato do Banco".');
        return;
      }
      toast.info('Lendo PDF do extrato...');
      parseBradescoPdfFile(file)
        .then(statement => {
          const rows = bradescoStatementToRows(statement, classificationRules, categories);
          const marked = markRows(rows);
          setBankFileName(file.name);
          setBankRows(marked);
          const dupes = marked.filter(r => r.isDuplicate).length;
          setAutoDetectedInfo(`🏦 Extrato Bradesco detectado (${statement.accountInfo}${statement.periodStart ? ` · ${statement.periodStart.split('-').reverse().join('/')} a ${statement.periodEnd?.split('-').reverse().join('/')}` : ''}) — estabelecimentos extraídos do PDF.`);
          toast.success(`${rows.length} transações lidas do PDF${dupes > 0 ? ` (${dupes} duplicadas)` : ''}`);
        })
        .catch((err: Error) => {
          const isNubankHint = /nubank/i.test(file.name);
          toast.error(`${err.message}${isNubankHint ? ' Para extratos do Nubank, use a aba "Nubank PDF".' : ' Suportamos PDF de extrato do Bradesco — para Nubank, use a aba "Nubank PDF".'}`, { duration: 8000 });
        });
      return;
    }

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

    // Conta de destino do extrato — vincula as transações ao saldo (evita órfãs).
    const acctId = (importAccountId || accounts.find(a => !a.archived)?.id) || null;

    const { supabase: sb } = await import('@/integrations/supabase/client');

    // â"€â"€ Despesas â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
    if (expenseRows.length > 0) {
      const payload = expenseRows.map(r => ({
        date: r.date, description: r.description, amount: r.amount,
        category_id: r.categoryId || null, account_id: acctId, status: 'concluido', user_id: user!.id,
      }));
      const { error } = await sb.from('expenses').insert(payload);
      if (error) { console.error('[Import] Erro despesas:', error); errorMessages.push(`Despesas: ${error.message}`); }
      else { successCount += expenseRows.length; }
    }

    // â"€â"€ Receitas â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
    if (incomeRows.length > 0) {
      const payload = incomeRows.map(r => ({
        date: r.date, description: r.description, amount: r.amount,
        account_id: acctId, status: 'concluido', user_id: user!.id,
      }));
      const { error } = await sb.from('income').insert(payload);
      if (error) { console.error('[Import] Erro receitas:', error); errorMessages.push(`Receitas: ${error.message}`); }
      else { successCount += incomeRows.length; }
    }

    // â"€â"€ Investimentos â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
    const invWithoutAsset = investmentRows.filter(r => !r.investmentId).length;
    if (invWithoutAsset > 0) {
      errorMessages.push(`${invWithoutAsset} investimento(s) sem ativo selecionado — escolha o ativo na coluna "Categoria / Ativo" ou mude o tipo para Despesa`);
    }
    // Sequencial DE PROPÓSITO: o aporte faz read-modify-write em current_value do
    // ativo; rodar em paralelo aportes do MESMO ativo perderia atualizações.
    for (const r of investmentRows) {
      if (!r.investmentId) continue;
      try {
        await addInvestmentTx.mutateAsync({
          investment_id: r.investmentId, type: 'aporte',
          amount: r.amount, date: r.date, account_id: acctId, description: r.description,
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
          const expenseMirrorPayload = ccSelected.map(r => ({
            user_id: user!.id,
            date: r.date,
            description: r.description,
            amount: r.amount,
            category_id: r.categoryId || null,
            account_id: null,
            status: 'pendente',
            notes: '[Cartao de credito] Importado pela fatura',
            is_recurring: false,
          }));

          const { error: mirrorError } = await sb.from('expenses').insert(expenseMirrorPayload);
          if (mirrorError) {
            console.error('[Import] Erro espelho despesas CC:', mirrorError);
            errorMessages.push(`Fatura (espelho despesas): ${mirrorError.message}`);
          }

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

    // â"€â"€ Resultado â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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

  // â"€â"€ Upload area â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const renderUploadArea = (
    label: string,
    icon: React.ReactNode,
    fileName: string,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
    hint: string,
    loaded: boolean,
    accept = '.csv,.ofx,.qfx',
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
      <input type="file" className="hidden" onChange={onChange} accept={accept} />
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
                {fmt(row.amount)}
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
        <p className="text-sm text-muted-foreground">Importe extratos do banco em PDF (Nubank, Bradesco), OFX ou CSV.</p>
      </div>

      <Tabs defaultValue="nubank-pdf" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-xl">
          <TabsTrigger value="nubank-pdf" className="gap-2">
            <FileText className="w-4 h-4" /> Nubank PDF
          </TabsTrigger>
          <TabsTrigger value="ofx-csv" className="gap-2">
            <Building2 className="w-4 h-4" /> Outros bancos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="nubank-pdf" className="mt-6">
          <NubankImporter />
        </TabsContent>

        <TabsContent value="ofx-csv" className="mt-6 space-y-6">

      {/* Instructions */}
      <div className="rounded-lg bg-muted/60 border border-border p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Info className="w-4 h-4 text-primary" /> Como funciona
        </div>
        <ol className="text-xs text-muted-foreground space-y-1 ml-6 list-decimal">
          <li><strong>Extrato do banco:</strong> Exporte o PDF, OFX ou CSV do seu banco (conta corrente)</li>
          <li><strong>Bradesco:</strong> prefira o <strong>PDF do extrato</strong> — ele traz o nome do estabelecimento e a classificação automática funciona muito melhor que no CSV</li>
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

      {/* Conta de destino — sem isso as transações entram sem conta e ficam fora do saldo */}
      {accounts.filter(a => !a.archived).length > 0 && (
        <div className="rounded-lg border border-border bg-muted/40 p-4">
          <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
            <Building2 className="h-4 w-4 text-primary" /> Conta deste extrato
          </label>
          <p className="mb-2 text-xs text-muted-foreground">As transações importadas entram nesta conta e contam no seu saldo. (Itens da fatura do cartão são lançados no cartão, não aqui.)</p>
          <Select value={importAccountId || accounts.find(a => !a.archived)?.id || ''} onValueChange={setImportAccountId}>
            <SelectTrigger className="max-w-xs"><SelectValue placeholder="Selecione a conta..." /></SelectTrigger>
            <SelectContent>
              {accounts.filter(a => !a.archived).map(a => (
                <SelectItem key={a.id} value={a.id}>{a.icon} {a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Upload areas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderUploadArea(
          bankFileName ? 'Extrato carregado ✓' : 'Extrato do Banco',
          <Building2 className={`w-6 h-6 ${bankFileName ? 'text-primary' : 'text-muted-foreground'}`} />,
          bankFileName,
          handleFileUpload('bank'),
          'PDF (Bradesco), CSV ou OFX do extrato do mês',
          !!bankFileName,
          '.csv,.ofx,.qfx,.pdf'
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
              <div className="grid grid-cols-1 gap-2 mb-3 min-[430px]:grid-cols-2">
                <div className="bg-background/60 rounded-lg p-2.5 border border-border/50">
                  <p className="text-[11px] text-muted-foreground mb-0.5">💳 Fatura do cartão</p>
                  <p className="font-semibold text-foreground">{fmt(ccTotal)}</p>
                  <p className="text-[11px] text-muted-foreground">{ccItemCount} compra{ccItemCount !== 1 ? 's' : ''}</p>
                </div>
                <div className="bg-background/60 rounded-lg p-2.5 border border-border/50">
                  <p className="text-[11px] text-muted-foreground mb-0.5">🏦 Pago no extrato</p>
                  <p className="font-semibold text-warning">{fmt(bankCCPayment)}</p>
                  <p className="text-[11px] text-muted-foreground">{ccPaymentCount} lançamento{ccPaymentCount !== 1 ? 's' : ''} — excluído{ccPaymentCount !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                ✅ Os itens da fatura serão importados individualmente. Os pagamentos genéricos do extrato são ignorados para evitar duplicação.
                {Math.abs(ccTotal - bankCCPayment) > 1 && (
                  <> A diferença de <span className="text-foreground font-medium">{fmt(Math.abs(ccTotal - bankCCPayment))}</span> é normal — pode incluir parcelas de meses anteriores ou coberturas de ciclos diferentes.</>
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-4">
              {bankFileName && <span>🏦 <span className="font-medium text-foreground">{bankFileName}</span> ({bankRows.length})</span>}
              {ccFileName && <span>💳 <span className="font-medium text-foreground">{ccFileName}</span> ({ccRows.length})</span>}
              <span className="font-medium text-foreground">{totalSelected} selecionadas</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
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
        </TabsContent>
      </Tabs>
    </div>
  );
}




