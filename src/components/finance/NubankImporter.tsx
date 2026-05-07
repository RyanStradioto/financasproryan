/**
 * Nubank PDF Statement Importer
 *
 * Lets the user drop one or more Nubank checking-account PDF statements,
 * automatically extracts every transaction, classifies them, and imports
 * the selected ones into the right place:
 *   - Aplicação RDB → investment aporte (linked to selected investment)
 *   - Resgate RDB → investment resgate
 *   - Pagamento de fatura → expense tagged [FATURA_CARTAO]
 *   - Pix in / refund / auto credit → income
 *   - Pix out / debit / auto debit → expense
 */

import { useState } from 'react';
import {
  Upload, FileText, CheckCircle2, AlertCircle, Trash2, Loader2,
  ArrowDown, ArrowUp, Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAccounts, useAddIncome, useAddExpense } from '@/hooks/useFinanceData';
import { useInvestments, useAddInvestmentTransaction } from '@/hooks/useInvestments';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  parseNubankPdfFile, TX_KIND_LABEL,
  type NubankStatement, type NubankTransaction, type NubankTxKind,
} from '@/lib/nubankStatementParser';

interface ParsedFile {
  fileName: string;
  statement: NubankStatement;
}

export default function NubankImporter() {
  const { data: accounts = [] } = useAccounts();
  const { data: investments = [] } = useInvestments();
  const addIncome = useAddIncome();
  const addExpense = useAddExpense();
  const addInvestmentTx = useAddInvestmentTransaction();

  const [parsedFiles, setParsedFiles] = useState<ParsedFile[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [selectedInvestment, setSelectedInvestment] = useState<string>('');
  const [skipKinds, setSkipKinds] = useState<Set<NubankTxKind>>(new Set());
  const [excludedTxs, setExcludedTxs] = useState<Set<string>>(new Set());

  // Auto-pick Nubank-named account if present
  const nubankAccount = accounts.find(a => /nubank|nu\s/i.test(a.name)) || accounts[0];
  const effectiveAccountId = selectedAccount || nubankAccount?.id || '';
  // Auto-pick caixinha/RDB investment if present
  const rdbInvestment = investments.find(i => /caixinha|rdb|nubank/i.test(i.name)) || investments[0];
  const effectiveInvestmentId = selectedInvestment || rdbInvestment?.id || '';

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setParsing(true);
    const results: ParsedFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const statement = await parseNubankPdfFile(file);
        results.push({ fileName: file.name, statement });
      } catch (e) {
        console.error('Erro ao ler', file.name, e);
        toast.error(`Erro ao ler ${file.name}: ${(e as Error).message}`);
      }
    }
    setParsedFiles(prev => [...prev, ...results].sort((a, b) =>
      a.statement.periodStart.localeCompare(b.statement.periodStart),
    ));
    setParsing(false);
    if (results.length > 0) toast.success(`${results.length} extrato(s) lido(s)`);
  };

  const allTransactions = parsedFiles.flatMap((f, fileIdx) =>
    f.statement.transactions.map((t, txIdx) => ({
      ...t,
      _id: `${fileIdx}-${txIdx}`,
      _file: f.fileName,
    })),
  );

  const summaryByKind = allTransactions.reduce<Record<NubankTxKind, { count: number; total: number }>>((acc, t) => {
    if (!acc[t.kind]) acc[t.kind] = { count: 0, total: 0 };
    acc[t.kind].count += 1;
    acc[t.kind].total += t.amount;
    return acc;
  }, {} as Record<NubankTxKind, { count: number; total: number }>);

  const willImport = allTransactions.filter(t => !skipKinds.has(t.kind) && !excludedTxs.has(t._id));

  const toggleKind = (k: NubankTxKind) => {
    setSkipKinds(prev => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const toggleTx = (id: string) => {
    setExcludedTxs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const removeFile = (fileName: string) => {
    setParsedFiles(prev => prev.filter(f => f.fileName !== fileName));
  };

  const importAll = async () => {
    if (willImport.length === 0) {
      toast.info('Nada para importar');
      return;
    }
    if (!effectiveAccountId) {
      toast.error('Selecione uma conta');
      return;
    }
    setImporting(true);
    let okCount = 0;
    let errCount = 0;

    for (const t of willImport) {
      try {
        await importOneTransaction(t);
        okCount++;
      } catch (e) {
        console.error('Falha ao importar', t, e);
        errCount++;
      }
    }

    setImporting(false);
    if (okCount > 0) toast.success(`${okCount} transação(ões) importada(s)`);
    if (errCount > 0) toast.error(`${errCount} falha(s) na importação`);
    if (okCount > 0 && errCount === 0) {
      setParsedFiles([]);
      setExcludedTxs(new Set());
    }
  };

  const importOneTransaction = async (t: NubankTransaction) => {
    const noteTag = `[NUBANK_PDF_IMPORT|${t.kind}|${t.date}]`;
    const desc = t.description || t.rawType;

    switch (t.kind) {
      case 'aporte_rdb':
        if (!effectiveInvestmentId) {
          throw new Error('Sem investimento selecionado para aporte RDB');
        }
        await addInvestmentTx.mutateAsync({
          investment_id: effectiveInvestmentId,
          type: 'aporte',
          amount: t.amount,
          date: t.date,
          account_id: effectiveAccountId,
          description: `Aplicação RDB ${t.date}`,
          notes: noteTag,
        });
        break;

      case 'resgate_rdb':
        if (!effectiveInvestmentId) {
          throw new Error('Sem investimento selecionado para resgate RDB');
        }
        await addInvestmentTx.mutateAsync({
          investment_id: effectiveInvestmentId,
          type: 'resgate',
          amount: t.amount,
          date: t.date,
          account_id: effectiveAccountId,
          description: `Resgate RDB ${t.date}`,
          notes: noteTag,
        });
        break;

      case 'cc_bill_payment':
        await addExpense.mutateAsync({
          date: t.date,
          description: `Pagamento de fatura — ${t.date}`,
          amount: t.amount,
          account_id: effectiveAccountId,
          status: 'concluido',
          notes: `[FATURA_CARTAO] ${noteTag} ${desc}`,
          is_recurring: false,
        });
        break;

      case 'pix_in':
      case 'auto_credit':
      case 'refund':
        await addIncome.mutateAsync({
          date: t.date,
          description: desc.slice(0, 80) || t.rawType,
          amount: t.amount,
          account_id: effectiveAccountId,
          status: 'concluido',
          notes: noteTag,
          is_recurring: false,
        });
        break;

      case 'pix_out':
      case 'debit_purchase':
      case 'auto_debit':
      case 'unknown':
      default:
        await addExpense.mutateAsync({
          date: t.date,
          description: desc.slice(0, 80) || t.rawType,
          amount: t.amount,
          account_id: effectiveAccountId,
          status: 'concluido',
          notes: noteTag,
          is_recurring: false,
        });
        break;
    }
  };

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="rounded-2xl border border-info/30 bg-info/5 p-4">
        <h3 className="text-base font-bold flex items-center gap-2">
          <FileText className="w-5 h-5 text-info" />
          Importar Extrato Nubank (PDF)
        </h3>
        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
          Solte aqui os PDFs de extrato do Nubank. O app lê todas as movimentações,
          classifica automaticamente (Pix, débito, RDB, fatura) e importa para a conta selecionada.
        </p>
      </div>

      {/* Account + Investment selectors */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
            Conta de destino
          </label>
          <Select value={effectiveAccountId} onValueChange={setSelectedAccount}>
            <SelectTrigger><SelectValue placeholder="Selecione uma conta..." /></SelectTrigger>
            <SelectContent>
              {accounts.filter(a => !a.archived).map(a => (
                <SelectItem key={a.id} value={a.id}>{a.icon} {a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
            Investimento para Aplicações RDB
          </label>
          <Select value={effectiveInvestmentId} onValueChange={setSelectedInvestment}>
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {investments.length === 0 && (
                <SelectItem value="__none__" disabled>Nenhum investimento — crie um primeiro</SelectItem>
              )}
              {investments.map(i => (
                <SelectItem key={i.id} value={i.id}>{i.icon} {i.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* File drop / picker */}
      <label className={cn(
        'block rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors',
        parsing ? 'border-primary/40 bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-primary/5',
      )}>
        <input
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={e => handleFilesSelected(e.target.files)}
          disabled={parsing}
        />
        {parsing ? (
          <>
            <Loader2 className="w-8 h-8 mx-auto text-primary animate-spin" />
            <p className="mt-3 text-sm font-semibold">Lendo PDFs...</p>
          </>
        ) : (
          <>
            <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold">Solte os PDFs aqui ou clique para selecionar</p>
            <p className="text-xs text-muted-foreground mt-1">Aceita múltiplos extratos de uma vez</p>
          </>
        )}
      </label>

      {/* Parsed files summary */}
      {parsedFiles.length > 0 && (
        <div className="space-y-2">
          {parsedFiles.map(f => {
            const s = f.statement;
            return (
              <div key={f.fileName} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/50 p-3">
                <FileText className="w-5 h-5 text-info shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{f.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.periodStart} → {s.periodEnd} · {s.transactions.length} transações ·
                    Saldo {formatCurrency(s.saldoInicial)} → {formatCurrency(s.saldoFinal)}
                  </p>
                </div>
                <button
                  onClick={() => removeFile(f.fileName)}
                  className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary by kind */}
      {allTransactions.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card/50 p-4 space-y-3">
          <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
            O que será importado ({willImport.length} de {allTransactions.length})
          </p>
          <div className="space-y-1.5">
            {Object.entries(summaryByKind)
              .sort((a, b) => b[1].total - a[1].total)
              .map(([kind, { count, total }]) => {
                const k = kind as NubankTxKind;
                const skipped = skipKinds.has(k);
                return (
                  <button
                    key={k}
                    onClick={() => toggleKind(k)}
                    className={cn(
                      'w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors',
                      skipped ? 'bg-muted/30 opacity-50' : 'bg-muted/40 hover:bg-muted/60',
                    )}
                  >
                    <div className={cn(
                      'w-5 h-5 rounded shrink-0 border flex items-center justify-center',
                      skipped ? 'border-muted-foreground/40' : 'border-primary bg-primary/15',
                    )}>
                      {!skipped && <CheckCircle2 className="w-3 h-3 text-primary" />}
                    </div>
                    <span className="flex-1 text-sm">{TX_KIND_LABEL[k]}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {count}× · {formatCurrency(total)}
                    </span>
                  </button>
                );
              })}
          </div>
          <p className="text-[11px] text-muted-foreground italic">
            Clique em uma categoria para excluir / incluir todo o grupo na importação.
          </p>
        </div>
      )}

      {/* Detail list */}
      {allTransactions.length > 0 && (
        <details className="rounded-2xl border border-border/60 bg-card/50">
          <summary className="cursor-pointer p-3 text-sm font-semibold">
            Ver todas as transações ({allTransactions.length})
          </summary>
          <div className="border-t border-border/40 max-h-[400px] overflow-y-auto">
            {allTransactions.map(t => {
              const groupSkipped = skipKinds.has(t.kind);
              const txExcluded = excludedTxs.has(t._id);
              const isImported = !groupSkipped && !txExcluded;
              return (
                <div
                  key={t._id}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 border-b border-border/30 last:border-0 text-xs',
                    !isImported && 'opacity-40',
                  )}
                >
                  <button
                    onClick={() => toggleTx(t._id)}
                    disabled={groupSkipped}
                    className={cn(
                      'w-4 h-4 rounded shrink-0 border flex items-center justify-center',
                      isImported ? 'border-primary bg-primary/15' : 'border-muted-foreground/40',
                    )}
                  >
                    {isImported && <CheckCircle2 className="w-2.5 h-2.5 text-primary" />}
                  </button>
                  <span className="text-muted-foreground tabular-nums w-20 shrink-0">{t.date}</span>
                  {t.direction === 'in' ? (
                    <ArrowDown className="w-3 h-3 text-income shrink-0" />
                  ) : (
                    <ArrowUp className="w-3 h-3 text-expense shrink-0" />
                  )}
                  <span className="flex-1 truncate">{t.description || t.rawType}</span>
                  <span className={cn(
                    'tabular-nums font-semibold shrink-0',
                    t.direction === 'in' ? 'text-income' : 'text-expense',
                  )}>
                    {t.direction === 'in' ? '+' : '-'}{formatCurrency(t.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        </details>
      )}

      {/* Action buttons */}
      {allTransactions.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-2 sticky bottom-4 bg-background/80 backdrop-blur p-3 rounded-2xl border border-border/60 shadow-lg">
          <Button
            variant="outline"
            onClick={() => { setParsedFiles([]); setExcludedTxs(new Set()); setSkipKinds(new Set()); }}
            disabled={importing}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            onClick={importAll}
            disabled={importing || willImport.length === 0 || !effectiveAccountId}
            className="flex-1 bg-info hover:bg-info/90 text-white"
          >
            {importing ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importando...</>
            ) : (
              <><Wallet className="w-4 h-4 mr-2" /> Importar {willImport.length} transações</>
            )}
          </Button>
        </div>
      )}

      {/* Validation warnings */}
      {!effectiveAccountId && parsedFiles.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-warning/10 border border-warning/30 px-3 py-2 text-xs text-warning">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Selecione uma conta antes de importar.
        </div>
      )}
      {investments.length === 0 && allTransactions.some(t => t.kind === 'aporte_rdb' || t.kind === 'resgate_rdb') && (
        <div className="flex items-center gap-2 rounded-lg bg-warning/10 border border-warning/30 px-3 py-2 text-xs text-warning">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Crie um investimento "Caixinha Nubank" / "RDB" antes de importar — aplicações e resgates serão vinculadas a ele.
        </div>
      )}
    </div>
  );
}
