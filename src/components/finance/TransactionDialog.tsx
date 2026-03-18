import { useState, useMemo, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCategories, useAccounts, useAddIncome, useAddExpense, useAddExpenseBatch, useRecentDescriptions } from '@/hooks/useFinanceData';
import { useFileUpload } from '@/hooks/useFileUpload';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Paperclip, X, FileText, Sparkles, Loader2 } from 'lucide-react';

type Props = {
  type: 'income' | 'expense';
  children?: React.ReactNode;
};

export default function TransactionDialog({ type, children }: Props) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [status, setStatus] = useState('concluido');
  const [notes, setNotes] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [installments, setInstallments] = useState('1');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const aiDebounce = useRef<ReturnType<typeof setTimeout>>();

  const { data: categories } = useCategories();
  const { data: accounts } = useAccounts();
  const { data: recentDescs = [] } = useRecentDescriptions(type === 'income' ? 'income' : 'expenses');
  const addIncome = useAddIncome();
  const addExpense = useAddExpense();
  const addExpenseBatch = useAddExpenseBatch();
  const { upload, uploading } = useFileUpload();

  const filteredSuggestions = useMemo(() => {
    if (!description || description.length < 2) return [];
    const lower = description.toLowerCase();
    return recentDescs.filter(d => d.toLowerCase().includes(lower)).slice(0, 5);
  }, [description, recentDescs]);

  const reset = () => {
    setDate(new Date().toISOString().split('T')[0]);
    setDescription('');
    setAmount('');
    setCategoryId('');
    setAccountId('');
    setStatus('concluido');
    setNotes('');
    setAttachmentUrl(null);
    setAttachmentName(null);
    setInstallments('1');
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
    const numAmount = parseFloat(amount.replace(',', '.'));
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Valor inválido');
      return;
    }

    const numInstallments = parseInt(installments) || 1;

    try {
      if (type === 'income') {
        await addIncome.mutateAsync({
          date,
          description,
          amount: numAmount,
          account_id: accountId || null,
          status,
          notes: notes || null,
          attachment_url: attachmentUrl,
          attachment_name: attachmentName,
        });
      } else if (numInstallments > 1) {
        // Create installment records
        const baseDate = new Date(date + 'T00:00:00');
        const items = Array.from({ length: numInstallments }, (_, i) => {
          const d = new Date(baseDate);
          d.setMonth(d.getMonth() + i);
          return {
            date: d.toISOString().split('T')[0],
            description: `${description || 'Despesa'} (${i + 1}/${numInstallments})`,
            amount: numAmount,
            category_id: categoryId || null,
            account_id: accountId || null,
            status: i === 0 ? status : 'agendado',
            notes: notes || null,
            attachment_url: i === 0 ? attachmentUrl : null,
            attachment_name: i === 0 ? attachmentName : null,
          };
        });
        await addExpenseBatch.mutateAsync(items);
        toast.success(`${numInstallments} parcelas criadas!`);
        reset();
        setOpen(false);
        return;
      } else {
        await addExpense.mutateAsync({
          date,
          description,
          amount: numAmount,
          category_id: categoryId || null,
          account_id: accountId || null,
          status,
          notes: notes || null,
          attachment_url: attachmentUrl,
          attachment_name: attachmentName,
        });
      }
      toast.success(type === 'income' ? 'Receita adicionada!' : 'Despesa adicionada!');
      reset();
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button size="sm" variant={type === 'income' ? 'default' : 'destructive'}>
            <Plus className="w-4 h-4 mr-1" />
            {type === 'income' ? 'Nova Receita' : 'Nova Despesa'}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{type === 'income' ? 'Nova Receita' : 'Nova Despesa'}</DialogTitle>
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
          <div className="space-y-1.5 relative">
            <Label>Descrição</Label>
            <Input
              placeholder="Descreva a transação..."
              value={description}
              onChange={(e) => { setDescription(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              autoComplete="off"
            />
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
                {filteredSuggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                    onMouseDown={() => { setDescription(s); setShowSuggestions(false); }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          {type === 'expense' && (
            <>
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {categories?.filter(c => !c.archived).map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Parcelas</Label>
                  <Select value={installments} onValueChange={setInstallments}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1,2,3,4,5,6,7,8,9,10,11,12,18,24,36,48].map(n => (
                        <SelectItem key={n} value={String(n)}>{n === 1 ? 'À vista' : `${n}x`}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="concluido">Pago</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="agendado">Agendado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {parseInt(installments) > 1 && (
                <div className="rounded-lg bg-muted/50 border border-border p-3 text-xs text-muted-foreground">
                  💳 Serão criadas <span className="font-semibold text-foreground">{installments} parcelas</span> de{' '}
                  <span className="font-semibold text-foreground currency">
                    R$ {amount ? parseFloat(amount.replace(',', '.')).toFixed(2).replace('.', ',') : '0,00'}
                  </span>{' '}
                  nos próximos meses.
                </div>
              )}
            </>
          )}
          {type === 'income' && (
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
                    <SelectItem value="concluido">Recebido</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="agendado">Agendado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          {type === 'expense' && (
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
          )}
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
                <button type="button" onClick={() => { setAttachmentUrl(null); setAttachmentName(null); }} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-2 p-3 rounded-lg border border-dashed border-border hover:border-primary/50 hover:bg-muted/50 cursor-pointer transition-all">
                <Paperclip className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{uploading ? 'Enviando...' : 'Anexar comprovante'}</span>
                <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} accept="image/*,.pdf,.doc,.docx" />
              </label>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={addIncome.isPending || addExpense.isPending || addExpenseBatch.isPending}>
            Adicionar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
