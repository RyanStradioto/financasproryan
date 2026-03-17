import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCategories, useAddExpenseBatch, useAddIncome } from '@/hooks/useFinanceData';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/format';
import { toast } from 'sonner';
import { Upload, Trash2, Check, FileSpreadsheet } from 'lucide-react';

type ParsedRow = {
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  categoryId: string;
  selected: boolean;
};

function parseCSV(text: string): ParsedRow[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  
  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(/[;,]/).map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 3) continue;

    // Try to detect: date, description, amount
    let date = '', description = '', amount = 0;
    
    for (const col of cols) {
      // Check if date
      const dateMatch = col.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
      if (dateMatch && !date) {
        const [, d, m, y] = dateMatch;
        const year = y.length === 2 ? `20${y}` : y;
        date = `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        continue;
      }
      // ISO date
      const isoMatch = col.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (isoMatch && !date) {
        date = col.substring(0, 10);
        continue;
      }
      // Check if number
      const numStr = col.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
      const num = parseFloat(numStr);
      if (!isNaN(num) && num !== 0 && !amount) {
        amount = num;
        continue;
      }
      // Else description
      if (col.length > 1 && !description) {
        description = col;
      }
    }

    if (!date) date = new Date().toISOString().split('T')[0];
    if (!description) description = 'Transação importada';

    rows.push({
      date,
      description,
      amount: Math.abs(amount),
      type: amount < 0 ? 'expense' : (amount > 0 ? 'income' : 'expense'),
      categoryId: '',
      selected: true,
    });
  }
  return rows;
}

function parseOFX(text: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const stmtRx = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;
  while ((match = stmtRx.exec(text)) !== null) {
    const block = match[1];
    const get = (tag: string) => {
      const rx = new RegExp(`<${tag}>([^<\\n]+)`, 'i');
      const m = block.match(rx);
      return m ? m[1].trim() : '';
    };
    const dtStr = get('DTPOSTED');
    const date = dtStr.length >= 8 ? `${dtStr.slice(0, 4)}-${dtStr.slice(4, 6)}-${dtStr.slice(6, 8)}` : new Date().toISOString().split('T')[0];
    const amount = parseFloat(get('TRNAMT').replace(',', '.')) || 0;
    const description = get('MEMO') || get('NAME') || 'Transação OFX';

    rows.push({
      date,
      description,
      amount: Math.abs(amount),
      type: amount < 0 ? 'expense' : 'income',
      categoryId: '',
      selected: true,
    });
  }
  return rows;
}

export default function ImportPage() {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const { data: categories = [] } = useCategories();
  const addExpenseBatch = useAddExpenseBatch();
  const addIncome = useAddIncome();
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
        parsed = parseOFX(text);
      } else {
        parsed = parseCSV(text);
      }
      if (parsed.length === 0) {
        toast.error('Nenhuma transação encontrada no arquivo');
        return;
      }
      setRows(parsed);
      toast.success(`${parsed.length} transações encontradas`);
    };
    reader.readAsText(file);
  }, []);

  const toggleRow = (i: number) => {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, selected: !r.selected } : r));
  };

  const updateRow = (i: number, field: keyof ParsedRow, value: any) => {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  };

  const handleImport = async () => {
    const selected = rows.filter(r => r.selected);
    if (selected.length === 0) { toast.error('Selecione ao menos uma transação'); return; }

    try {
      const expenseRows = selected.filter(r => r.type === 'expense');
      const incomeRows = selected.filter(r => r.type === 'income');

      if (expenseRows.length > 0) {
        await addExpenseBatch.mutateAsync(
          expenseRows.map(r => ({
            date: r.date,
            description: r.description,
            amount: r.amount,
            category_id: r.categoryId || null,
            status: 'concluido',
          }))
        );
      }

      for (const r of incomeRows) {
        await addIncome.mutateAsync({
          date: r.date,
          description: r.description,
          amount: r.amount,
          status: 'concluido',
        });
      }

      toast.success(`${selected.length} transações importadas!`);
      setRows([]);
      setFileName('');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const selectedCount = rows.filter(r => r.selected).length;
  const activeCategories = categories.filter(c => !c.archived);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Importar Extrato</h1>
        <p className="text-sm text-muted-foreground">Importe transações de arquivos CSV ou OFX</p>
      </div>

      {rows.length === 0 ? (
        <label className="stat-card flex flex-col items-center justify-center py-16 cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <FileSpreadsheet className="w-8 h-8 text-primary" />
          </div>
          <p className="font-medium mb-1">Arraste ou clique para selecionar</p>
          <p className="text-sm text-muted-foreground">Aceita arquivos .csv, .ofx, .qfx</p>
          <input type="file" className="hidden" onChange={handleFile} accept=".csv,.ofx,.qfx" />
        </label>
      ) : (
        <>
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
                    <input
                      type="checkbox"
                      checked={rows.every(r => r.selected)}
                      onChange={() => {
                        const allSelected = rows.every(r => r.selected);
                        setRows(prev => prev.map(r => ({ ...r, selected: !allSelected })));
                      }}
                      className="accent-primary"
                    />
                  </th>
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">Data</th>
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">Descrição</th>
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">Tipo</th>
                  <th className="text-right py-3 px-2 font-medium text-muted-foreground">Valor</th>
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">Categoria</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className={`border-b border-border/50 transition-colors ${row.selected ? 'hover:bg-muted/50' : 'opacity-40'}`}>
                    <td className="py-2 px-2">
                      <input type="checkbox" checked={row.selected} onChange={() => toggleRow(i)} className="accent-primary" />
                    </td>
                    <td className="py-2 px-2 text-muted-foreground whitespace-nowrap">{row.date}</td>
                    <td className="py-2 px-2 font-medium max-w-[200px] truncate">{row.description}</td>
                    <td className="py-2 px-2">
                      <button
                        onClick={() => updateRow(i, 'type', row.type === 'income' ? 'expense' : 'income')}
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${row.type === 'income' ? 'bg-income/10 text-income' : 'bg-expense/10 text-expense'}`}
                      >
                        {row.type === 'income' ? 'Receita' : 'Despesa'}
                      </button>
                    </td>
                    <td className={`py-2 px-2 text-right currency font-semibold ${row.type === 'income' ? 'text-income' : 'text-expense'}`}>
                      {formatCurrency(row.amount)}
                    </td>
                    <td className="py-2 px-2">
                      {row.type === 'expense' && (
                        <Select value={row.categoryId} onValueChange={v => updateRow(i, 'categoryId', v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            {activeCategories.map(c => (
                              <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                            ))}
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
