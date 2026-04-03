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
  const [startInstallment, setStartInstallment] = useState('1');
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

  const suggestCategory = useCallback((desc: string) => {
    if (!desc || desc.length < 3 || type !== 'expense') return;
    if (aiDebounce.current) clearTimeout(aiDebounce.current);
    aiDebounce.current = setTimeout(async () => {
      const cats = categories?.filter(c => !c.archived);
      if (!cats || cats.length === 0) return;
      setAiSuggesting(true);
      try {
        const { data } = await supabase.functions.invoke('suggest-category', {
          body: {
            description: desc,
            categories: cats.map(c => ({ id: c.id, name: c.name, icon: c.icon })),
          },
        });
        if (data?.category_id && !categoryId) {
          setCategoryId(data.category_id);
          const cat = cats.find(c => c.id === data.category_id);
          if (cat) toast.info(`IA sugeriu: ${cat.icon} ${cat.name}`, { duration: 2000 });
        }
      } catch { /* silent */ }
      finally { setAiSuggesting(false); }
    }, 800);
  }, [categories, categoryId, type]);

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
    setStartInstallment('1');
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
        const start = parseInt(startInstallment) || 1;
        const remaining = numInstallments - start + 1;
        const items = Array.from({ length: remaining }, (_, i) => {
          const installNum = start + i;
          const d = new Date(baseDate);
          d.setMonth(d.getMonth() + i);
          return {
            date: d.toISOString().split('T')[0],
            description: `${description || 'Despesa'} (${installNum}/${numInstallments})`,
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
        toast.success(`${remaining} parcelas criadas! (${start}/${numInstallments} a ${numInstallments}/${numInstallments})`);
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
    } catch (err) {
      console.error('Erro ao adicionar transação:', err);
      const msg = err instanceof Error
        ? err.message
        : (typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Erro desconhecido ao salvar');
      toast.error(msg || 'Erro ao salvar. Verifique o console.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button size="sm" variant={type === 'income' ? 'default' : 'destructive'} className="w-full">
            <Plus className="w-4 h-4 mr-1" />
            {type === 'income' ? 'Nova Receita' : 'Nova Despesa'}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto">
        <DialogHeader className="mb-1">
          <DialogTitle className="text-base font-bold">
            {type === 'income' ? '+ Nova Receita' : '- Nova Despesa'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3.5 pb-2">
          {/* Amount — big and prominent */}
          <div className="rounded-2xl bg-muted/40 border border-border/60 p-4 space-y-1">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Valor (R$)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold text-lg">R$</span>
              <Input
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                inputMode="decimal"
                className="font-mono text-2xl font-bold h-14 pl-12 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-foreground"
              />
            </div>
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Data</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="h-12 text-base"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5 relative">
            <Label className="text-sm font-medium">Descrição</Label>
            <Input
              placeholder="Descreva a transação..."
              value={description}
              onChange={(e) => { setDescription(e.target.value); setShowSuggestions(true); suggestCategory(e.target.value); }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              autoComplete="off"
              className="h-12 text-base"
            />
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-popover border border-border rounded-xl shadow-lg overflow-hidden">
                {filteredSuggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    className="w-full text-left px-4 py-3 text-sm hover:bg-muted transition-colors border-b border-border/40 last:border-0"
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
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  Categoria
                  {aiSuggesting && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
                  {!aiSuggesting && categoryId && <Sparkles className="w-3 h-3 text-primary" />}
                </Label>
                <Select value={categoryId} onValueChange={(v) => setCategoryId(v === '__none__' ? '' : v)}>
                  <SelectTrigger className="h-12 text-base"><SelectValue placeholder="Selecionar categoria..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sem categoria</SelectItem>
                    {categories?.filter(c => !c.archived).map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Parcelas</Label>
                  <Select value={installments} onValueChange={setInstallments}>
                    <SelectTrigger className="h-12 text-base"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1,2,3,4,5,6,7,8,9,10,11,12,18,24,36,48].map(n => (
                        <SelectItem key={n} value={String(n)}>{n === 1 ? 'À vista' : `${n}x`}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="h-12 text-base"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="concluido">Pago</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="agendado">Agendado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {parseInt(installments) > 1 && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Parcela inicial (já pagas antes)</Label>
                    <Select value={startInstallment} onValueChange={setStartInstallment}>
                      <SelectTrigger className="h-12 text-base"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: parseInt(installments) }, (_, i) => i + 1).map(n => (
                          <SelectItem key={n} value={String(n)}>
                            {n === 1 ? '1ª (nenhuma paga)' : `${n}ª (${n - 1} já paga${n - 1 > 1 ? 's' : ''})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="rounded-xl bg-primary/5 border border-primary/15 p-3 text-xs text-muted-foreground">
                    💳 Serão criadas <span className="font-semibold text-foreground">{parseInt(installments) - parseInt(startInstallment) + 1} parcelas</span> de{' '}
                    <span className="font-semibold text-foreground currency">
                      R$ {amount ? parseFloat(amount.replace(',', '.')).toFixed(2).replace('.', ',') : '0,00'}
                    </span>{' '}
                    ({startInstallment}/{installments} até {installments}/{installments})
                  </div>
                </>
              )}
            </>
          )}

          {type === 'income' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Conta</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger className="h-12 text-base"><SelectValue placeholder="Conta..." /></SelectTrigger>
                  <SelectContent>
                    {accounts?.filter(a => !a.archived).map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.icon} {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="h-12 text-base"><SelectValue /></SelectTrigger>
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
              <Label className="text-sm font-medium">Conta</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger className="h-12 text-base"><SelectValue placeholder="Selecionar conta..." /></SelectTrigger>
                <SelectContent>
                  {accounts?.filter(a => !a.archived).map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.icon} {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Observações</Label>
            <Textarea
              placeholder="Notas adicionais..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="text-base resize-none"
            />
          </div>

          {/* Attachment */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Comprovante</Label>
            {attachmentUrl ? (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-muted border border-border">
                <FileText className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm truncate flex-1">{attachmentName || 'Arquivo'}</span>
                <button type="button" onClick={() => { setAttachmentUrl(null); setAttachmentName(null); }} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded-lg hover:bg-destructive/10">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-3 p-3.5 rounded-xl border border-dashed border-border hover:border-primary/50 hover:bg-muted/50 cursor-pointer transition-all active:bg-muted">
                <Paperclip className="w-5 h-5 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground">{uploading ? 'Enviando...' : 'Foto / PDF do comprovante'}</span>
                <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} accept="image/*,.pdf,.doc,.docx" />
              </label>
            )}
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full h-13 text-base font-semibold mt-2"
            disabled={addIncome.isPending || addExpense.isPending || addExpenseBatch.isPending}
          >
            {(addIncome.isPending || addExpense.isPending || addExpenseBatch.isPending)
              ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
              : <Plus className="w-4 h-4 mr-2" />}
            {type === 'income' ? 'Adicionar Receita' : 'Adicionar Despesa'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
