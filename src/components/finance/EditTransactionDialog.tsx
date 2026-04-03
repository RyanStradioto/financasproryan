import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCategories, useAccounts, useUpdateIncome, useUpdateExpense, type Income, type Expense } from '@/hooks/useFinanceData';
import { useFileUpload } from '@/hooks/useFileUpload';
import { toast } from 'sonner';
import { Paperclip, X, FileText, ExternalLink } from 'lucide-react';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: (Income | Expense) & { type: 'income' | 'expense' };
};

export default function EditTransactionDialog({ open, onOpenChange, transaction }: Props) {
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);

  const { data: categories } = useCategories();
  const { data: accounts } = useAccounts();
  const updateIncome = useUpdateIncome();
  const updateExpense = useUpdateExpense();
  const { upload, uploading } = useFileUpload();

  useEffect(() => {
    if (transaction) {
      setDate(transaction.date);
      setDescription(transaction.description || '');
      // Pre-format the existing amount as BRL
      const num = Number(transaction.amount);
      setAmount(num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      setAccountId(transaction.account_id || '');
      setStatus(transaction.status || 'concluido');
      setNotes(transaction.notes || '');
      setAttachmentUrl(transaction.attachment_url || null);
      setAttachmentName(transaction.attachment_name || null);
      if (transaction.type === 'expense') {
        setCategoryId(transaction.category_id || '');
      }
    }
  }, [transaction]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '');
    if (!digits) { setAmount(''); return; }
    const num = parseInt(digits, 10) / 100;
    setAmount(num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await upload(file);
    if (url) {
      setAttachmentUrl(url);
      setAttachmentName(file.name);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount.replace(/\./g, '').replace(',', '.'));
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Valor inválido');
      return;
    }

    try {
      const baseData = {
        id: transaction.id,
        date,
        description,
        amount: numAmount,
        account_id: accountId || null,
        status,
        notes: notes || null,
        attachment_url: attachmentUrl,
        attachment_name: attachmentName,
      };

      if (transaction.type === 'income') {
        await updateIncome.mutateAsync(baseData);
      } else {
        await updateExpense.mutateAsync({
          ...baseData,
          category_id: categoryId || null,
        });
      }
      toast.success('Transação atualizada!');
      onOpenChange(false);
    } catch (err) {
      const error = err as Error;
      toast.error(error.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto">
        <DialogHeader className="mb-3">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-white text-sm font-bold ${
              transaction.type === 'income' ? 'bg-income' : 'bg-expense'
            }`}>
              {transaction.type === 'income' ? '↑' : '↓'}
            </span>
            Editar {transaction.type === 'income' ? 'Receita' : 'Despesa'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 pb-2">

          {/* Amount — currency masked */}
          <div className={`rounded-2xl p-4 ${
            transaction.type === 'income' ? 'bg-income/8 border border-income/20' : 'bg-expense/8 border border-expense/20'
          }`}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Valor</p>
            <div className="flex items-center gap-2">
              <span className={`text-xl font-bold shrink-0 ${
                transaction.type === 'income' ? 'text-income' : 'text-expense'
              }`}>R$</span>
              <input
                placeholder="0,00"
                value={amount}
                onChange={handleAmountChange}
                required
                inputMode="decimal"
                style={{ fontSize: '28px', lineHeight: 1.2 }}
                className={`flex-1 font-mono font-bold bg-transparent outline-none border-none min-w-0 ${
                  transaction.type === 'income' ? 'text-income' : 'text-expense'
                } placeholder:text-muted-foreground/30`}
              />
            </div>
          </div>

          {/* Date + Status row */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required style={{ fontSize: '16px' }} className="h-11" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-11" style={{ fontSize: '14px' }}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="concluido">✓ Concluído</SelectItem>
                  <SelectItem value="pendente">⏳ Pendente</SelectItem>
                  <SelectItem value="agendado">📅 Agendado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Descrição</Label>
            <Input
              placeholder="Descreva a transação..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ fontSize: '16px' }}
              className="h-11"
            />
          </div>

          {transaction.type === 'expense' && (
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Categoria</Label>
              <Select value={categoryId || '__none__'} onValueChange={(v) => setCategoryId(v === '__none__' ? '' : v)}>
                <SelectTrigger className="h-11" style={{ fontSize: '14px' }}><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem categoria</SelectItem>
                  {categories?.filter(c => !c.archived).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Conta</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="h-11" style={{ fontSize: '14px' }}><SelectValue placeholder="Selecionar conta..." /></SelectTrigger>
              <SelectContent>
                {accounts?.filter(a => !a.archived).map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.icon} {a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Observações</Label>
            <Textarea
              placeholder="Notas adicionais..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              style={{ fontSize: '16px' }}
              className="resize-none"
            />
          </div>

          {/* Attachment */}
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Comprovante</Label>
            {attachmentUrl ? (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/60 border border-border">
                <FileText className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm truncate flex-1">{attachmentName || 'Arquivo'}</span>
                <a href={attachmentUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button type="button" onClick={() => { setAttachmentUrl(null); setAttachmentName(null); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-border/60 hover:border-primary/40 hover:bg-muted/30 cursor-pointer transition-all active:bg-muted/50">
                <Paperclip className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{uploading ? 'Enviando...' : 'Foto ou PDF do comprovante'}</span>
                <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} accept="image/*,.pdf,.doc,.docx" />
              </label>
            )}
          </div>

          <Button type="submit" className="w-full h-12 text-[15px] font-semibold" disabled={updateIncome.isPending || updateExpense.isPending}>
            Salvar Alterações
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
