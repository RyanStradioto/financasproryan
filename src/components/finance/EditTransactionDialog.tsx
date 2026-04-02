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
      setAmount(String(transaction.amount));
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
    const numAmount = parseFloat(amount.replace(',', '.'));
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar {transaction.type === 'income' ? 'Receita' : 'Despesa'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="font-mono"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Input
              placeholder="Descreva a transação..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          {transaction.type === 'expense' && (
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={categoryId || '__none__'} onValueChange={(v) => setCategoryId(v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem categoria</SelectItem>
                  {categories?.filter(c => !c.archived).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Conta</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {accounts?.filter(a => !a.archived).map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.icon} {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="concluido">Concluído</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="agendado">Agendado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea
              placeholder="Notas adicionais..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {/* Attachment */}
          <div className="space-y-1.5">
            <Label>Anexo</Label>
            {attachmentUrl ? (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted border border-border">
                <FileText className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm truncate flex-1">{attachmentName || 'Arquivo'}</span>
                <a href={attachmentUrl} target="_blank" rel="noopener noreferrer" className="p-1 text-muted-foreground hover:text-primary transition-colors">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button type="button" onClick={() => { setAttachmentUrl(null); setAttachmentName(null); }} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-2 p-3 rounded-lg border border-dashed border-border hover:border-primary/50 hover:bg-muted/50 cursor-pointer transition-all">
                <Paperclip className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{uploading ? 'Enviando...' : 'Anexar comprovante ou documento'}</span>
                <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} accept="image/*,.pdf,.doc,.docx" />
              </label>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={updateIncome.isPending || updateExpense.isPending}>
            Salvar Alterações
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
