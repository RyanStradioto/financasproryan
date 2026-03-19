import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCategories, useAddExpenseBatch, useAddIncome } from '@/hooks/useFinanceData';
import { useInvestments, useAddInvestmentTransaction } from '@/hooks/useInvestments';
import { useClassificationRules, classifyDescription } from '@/hooks/useClassification';
import { formatCurrency } from '@/lib/format';
import { toast } from 'sonner';
import { Upload, Trash2, Check, FileSpreadsheet, TrendingUp, TrendingDown, BarChart3, Info } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

type RowType = 'income' | 'expense' | 'investment';

type ParsedRow = {
  date: string;
  description: string;
  amount: number;
  type: RowType;
  categoryId: string;
  investmentId: string;
  selected: boolean;
  confidence: 'high' | 'medium' | 'low';
  classificationReason: string;
};

// ---------------------------------------------------------------------
// Nubank CSV format: "Data","Descrição","Valor"
// Positive = income, Negative = expense. Investment keywords override.
// ---------------------------------------------------------------------
function parseNubankCSV(text: string, rules: any[]): ParsedRow[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const rows: ParsedRow[] = [];

  // Detect if it's Nubank format by checking header
  const header = lines[0].toLowerCase();
  const isNubank = header.includes('data') && header.includes('descri') && header.includes('valor');

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i];
    // Handle quoted CSV
    const cols = raw.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 3) continue;

    let date = '', description = '', amount = 0;

    for (const col of cols) {
      // ISO date
      const isoMatch = col.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (isoMatch && !date) { date = col.substring(0, 10); continue; }
      // BR date DD/MM/YYYY
      const brMatch = col.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
      if (brMatch && !date) {
        const [, d, m, y] = brMatch;
        const year = y.length === 2 ? `20${y}` : y;
        date = `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        continue;
      }
      // Number
      const numStr = col.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
      const num = parseFloat(numStr);
      if (!isNaN(num) && numStr.length > 0 && !amount) { amount = num; continue; }
      // Description
      if (col.length > 1 && !description && !/^\d/.test(col)) description = col;
    }

    if (!date) date = new Date().toISOString().split('T')[0];
    if (!description) description = 'Transação importada';

    const result = classifyDescription(description, amount, rules);

    rows.push({
      date,
      description,
      amount: Math.abs(amount),
      type: result.type,
      categoryId: result.categoryId ?? '',
      investmentId: result.investmentId ?? '',
      selected: true,
      confidence: result.confidence,
      classificationReason: result.reason,
    });
  }
  return rows;
}

function parseOFX(text: string, rules: any[]): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const stmtRx = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;
  while ((match = stmtRx.exec(text)) !== null) {
    const block = match[1];
    const get = (tag: string) => {
      const rx = new RegExp(`<${tag}>([^<\n]+)`, 'i');
      const m = block.match(rx);
      return m ? m[1].trim() : '';
    };
    const dtStr = get('DTPOSTED');
    const date = dtStr.length >= 8
      ? `${dtStr.slice(0, 4)}-${dtStr.slice(4, 6)}-${dtStr.slice(6, 8)}`
      : new Date().toISOString().split('T')[0];
    const amount = parseFloat(get('TRNAMT').replace(',', '.')) || 0;
    const description = get('MEMO') || get('NAME') || 'Transação OFX';
    const result = classifyDescription(description, amount, rules);
    rows.push({
      date, description, amount: Math.abs(amount),
      type: result.type,
      categoryId: result.categoryId ?? '',
      investmentId: result.investmentId ?? '',
      selected: true,
      confidence: result.confidence,
      classificationReason: result.reason,
    });
  }
  return rows;
}

const TYPE_LABELS: Record<RowType, string> = {
  income: 'Receita',
  expense: 'Despesa',
  investment: 'Investimento',
};

const TYPE_COLORS: Record<RowType, string> = {
  income: 'bg-income/10 text-income',
  expense: 'bg-expense/10 text-expense',
  investment: 'bg-primary/10 text-primary',
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: 'text-income',
  medium: 'text-warning',
  low: 'text-muted-foreground',
};

export default function ImportPage() {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const { data: categories = [] } = useCategories();
  const { data: investments = [] } = useInvestments();
  const { data: classificationRules = [] } = useClassificationRules();
  const addExpenseBatch = useAddExpenseBatch();
  const addIncome = useAddIncome();
  const addInvestmentTx = useAddInvestmentTransaction();
  const { user } = useAuth();

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const ext = file.name.toLowerCase();
      let parsed: ParsedRow[];
      if (ext.endsWith('.ofx') || ext.endsWith('.qfx')) {
        parsed = parseOFX(text, classificationRules);
      } else {
        parsed = parseNubankCSV(text, classificationRules);
      }
      if (parsed.length === 0) {
        toast.error('Nenhuma transação encontrada no arquivo'); return;
      }
      setRows(parsed);

      const inv = parsed.filter(r => r.type === 'investment').length;
      const inc = parsed.filter(r => r.type === 'income').length;
      const exp = parsed.filter(r => r.type === 'expense').length;
      toast.success(`${parsed.length} transações lidas — ${exp} despesas, ${inc} receitas, ${inv} investimentos`);
    };
    reader.readAsText(file, 'UTF-8');
  }, [classificationRules]);

  const toggleRow = (i: number) => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, selected: !r.selected } : r));
  const updateRow = (i: number, field: keyof ParsedRow, value: any) => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));

  const handleImport = async () => {
    const selected = rows.filter(r => r.selected);
    if (selected.length === 0) { toast.error('Selecione ao menos uma transação'); return; }

    try {
      const expenseRows = selected.filter(r => r.type === 'expense');
      const incomeRows = selected.filter(r => r.type === 'income');
      const investmentRows = selected.filter(r => r.type === 'investment');

      if (expenseRows.length > 0) {
        await addExpenseBatch.mutateAsync(expenseRows.map(r => ({
          date: r.date, description: r.description, amount: r.amount,
          category_id: r.categoryId || null, status: 'concluido',
        })));
      }
      for (const r of incomeRows) {
        await addIncome.mutateAsync({ date: r.date, description: r.description, amount: r.amount, status: 'concluido' });
      }
      for (const r of investmentRows) {
        if (!r.investmentId) continue; // skip if no investment selected
        await addInvestmentTx.mutateAsync({
          investment_id: r.investmentId,
          type: 'aporte',
          amount: r.amount,
          date: r.date,
          description: r.description,
        });
      }

      toast.success(`✅ ${selected.length} transações importadas! (${investmentRows.length} investimentos tratados como patrimônio)`);
      setRows([]);
      setFileName('');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const selectedCount = rows.filter(r => r.selected).length;
  const investmentCount = rows.filter(r => r.selected && r.type === 'investment').length;
  const activeCategories = categories.filter(c => !c.archived);
  const activeInvestments = investments.filter(i => !i.archived);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Importar Extrato</h1>
        <p className="text-sm text-muted-foreground">Importe transações de arquivos CSV (Nubank) ou OFX</p>
      </div>

      {/* Nubank instructions */}
      <div className="rounded-lg bg-muted/60 border border-border p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Info className="w-4 h-4 text-primary" /> Como exportar pelo Nubank
        </div>
        <ol className="text-xs text-muted-foreground space-y-1 ml-6 list-decimal">
          <li>Abra o app Nubank → toque no seu <strong>perfil</strong> (canto superior esquerdo)</li>
          <li>Vá em <strong>"Exportar dados"</strong> ou navegue até <strong>Extrato</strong></li>
          <li>Selecione o período e escolha <strong>"Exportar em CSV"</strong> — o arquivo vem por e-mail</li>
          <li>Salve o arquivo e arraste aqui abaixo</li>
        </ol>
        <p className="text-xs text-muted-foreground">💡 Repita para <strong>NuConta</strong> (conta) e <strong>cartão</strong> separadamente caso use ambos.</p>
      </div>

      {rows.length === 0 ? (
        <label className="stat-card flex flex-col items-center justify-center py-16 cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <FileSpreadsheet className="w-8 h-8 text-primary" />
          </div>
          <p className="font-medium mb-1">Arraste ou clique para selecionar</p>
          <p className="text-sm text-muted-foreground">Aceita arquivos .csv (Nubank), .ofx, .qfx</p>
          <input type="file" className="hidden" onChange={handleFile} accept=".csv,.ofx,.qfx" />
        </label>
      ) : (
        <>
          {/* Summary Banner */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-expense/5 border border-expense/20 p-3 text-center">
              <TrendingDown className="w-5 h-5 text-expense mx-auto mb-1" />
              <p className="text-lg font-bold text-expense">{rows.filter(r => r.selected && r.type === 'expense').length}</p>
              <p className="text-xs text-muted-foreground">Despesas</p>
            </div>
            <div className="rounded-xl bg-income/5 border border-income/20 p-3 text-center">
              <TrendingUp className="w-5 h-5 text-income mx-auto mb-1" />
              <p className="text-lg font-bold text-income">{rows.filter(r => r.selected && r.type === 'income').length}</p>
              <p className="text-xs text-muted-foreground">Receitas</p>
            </div>
            <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-center">
              <BarChart3 className="w-5 h-5 text-primary mx-auto mb-1" />
              <p className="text-lg font-bold text-primary">{rows.filter(r => r.selected && r.type === 'investment').length}</p>
              <p className="text-xs text-muted-foreground">Investimentos*</p>
            </div>
          </div>

          {investmentCount > 0 && (
            <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3 text-xs text-muted-foreground">
              ⚠️ <strong>{investmentCount} transação(ões)</strong> foram identificadas como investimentos e serão registradas como <strong>movimentação patrimonial</strong> (não despesas). Para cada uma, selecione o ativo correspondente na tabela abaixo.
            </div>
          )}

          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{fileName}</span> — {rows.length} transações, {selectedCount} selecionadas
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setRows([]); setFileName(''); }}>
                <Trash2 className="w-4 h-4 mr-1" /> Limpar
              </Button>
              <Button size="sm" onClick={handleImport} disabled={selectedCount === 0 || addExpenseBatch.isPending}>
                <Check className="w-4 h-4 mr-1" /> Importar {selectedCount}
              </Button>
            </div>
          </div>

          <div className="stat-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-3 px-2 w-10">
                    <input type="checkbox" checked={rows.every(r => r.selected)}
                      onChange={() => { const all = rows.every(r => r.selected); setRows(prev => prev.map(r => ({ ...r, selected: !all }))); }}
                      className="accent-primary" />
                  </th>
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">Data</th>
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">Descrição</th>
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">Tipo</th>
                  <th className="text-right py-3 px-2 font-medium text-muted-foreground">Valor</th>
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">Categoria / Ativo</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className={`border-b border-border/50 transition-colors ${row.selected ? 'hover:bg-muted/50' : 'opacity-40'}`}>
                    <td className="py-2 px-2">
                      <input type="checkbox" checked={row.selected} onChange={() => toggleRow(i)} className="accent-primary" />
                    </td>
                    <td className="py-2 px-2 text-muted-foreground whitespace-nowrap">{row.date}</td>
                    <td className="py-2 px-2 max-w-[180px]">
                      <p className="font-medium truncate">{row.description}</p>
                      <p className={`text-[10px] ${CONFIDENCE_COLORS[row.confidence]}`} title={row.classificationReason}>
                        {row.confidence === 'high' ? '✅' : row.confidence === 'medium' ? '⚠️' : '❓'} {row.classificationReason}
                      </p>
                    </td>
                    <td className="py-2 px-2">
                      <Select value={row.type} onValueChange={(v: any) => updateRow(i, 'type', v)}>
                        <SelectTrigger className={`h-7 text-xs border-0 px-2 ${TYPE_COLORS[row.type]}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="expense">Despesa</SelectItem>
                          <SelectItem value="income">Receita</SelectItem>
                          <SelectItem value="investment">Investimento ⚠️</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className={`py-2 px-2 text-right currency font-semibold ${
                      row.type === 'income' ? 'text-income' : row.type === 'investment' ? 'text-primary' : 'text-expense'
                    }`}>
                      {formatCurrency(row.amount)}
                    </td>
                    <td className="py-2 px-2">
                      {row.type === 'expense' && (
                        <Select value={row.categoryId} onValueChange={v => updateRow(i, 'categoryId', v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            {activeCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                      {row.type === 'investment' && (
                        <Select value={row.investmentId} onValueChange={v => updateRow(i, 'investmentId', v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar ativo..." /></SelectTrigger>
                          <SelectContent>
                            {activeInvestments.map(inv => <SelectItem key={inv.id} value={inv.id}>{inv.icon} {inv.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
