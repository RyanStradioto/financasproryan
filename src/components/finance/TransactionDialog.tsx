import { useState, useMemo, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCategories, useAccounts, useAddIncome, useAddExpense, useAddExpenseBatch, useRecentDescriptions } from '@/hooks/useFinanceData';
import { useAddInvestmentTransaction, useInvestments } from '@/hooks/useInvestments';
import { useAddCreditCardTransaction, useCreditCards } from '@/hooks/useCreditCards';
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
  const [amountFocused, setAmountFocused] = useState(false);
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
  const [investmentId, setInvestmentId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'account' | 'credit_card'>('account');
  const [creditCardId, setCreditCardId] = useState('');
  const aiDebounce = useRef<ReturnType<typeof setTimeout>>();

  const { data: categories } = useCategories();
  const { data: accounts } = useAccounts();
  const { data: investments } = useInvestments();
  const { data: creditCards } = useCreditCards();
  const { data: recentDescs = [] } = useRecentDescriptions(type === 'income' ? 'income' : 'expenses');
  const addIncome = useAddIncome();
  const addExpense = useAddExpense();
  const addExpenseBatch = useAddExpenseBatch();
  const addInvestmentTransaction = useAddInvestmentTransaction();
  const addCreditCardTransaction = useAddCreditCardTransaction();
  const { upload, uploading } = useFileUpload();

  const filteredSuggestions = useMemo(() => {
    if (!description || description.length < 2) return [];
    const lower = description.toLowerCase();
    return recentDescs.filter(d => d.toLowerCase().includes(lower)).slice(0, 5);
  }, [description, recentDescs]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '');
    if (!digits) { setAmount(''); return; }
    const num = parseInt(digits, 10) / 100;
    setAmount(num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  };

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
    setInvestmentId('');
    setPaymentMethod('account');
    setCreditCardId('');
  };

  const getCreditCardBillMonth = (purchaseDate: string, closingDay: number) => {
    const [year, month, day] = purchaseDate.split('-').map(Number);
    const billDate = day > closingDay ? new Date(year, month, 1) : new Date(year, month - 1, 1);
    return `${billDate.getFullYear()}-${String(billDate.getMonth() + 1).padStart(2, '0')}`;
  };

  const addMonthsToDate = (baseDate: string, monthsToAdd: number) => {
    const d = new Date(baseDate + 'T00:00:00');
    d.setMonth(d.getMonth() + monthsToAdd);
    return d.toISOString().split('T')[0];
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
      toast.error('Valor invÃ¡lido');
      return;
    }

    const numInstallments = parseInt(installments) || 1;
    const selectedCreditCard = creditCards?.find((cc) => cc.id === creditCardId);

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
      } else if (paymentMethod === 'credit_card') {
        if (!selectedCreditCard) {
          toast.error('Selecione um cartao de credito');
          return;
        }

        await addCreditCardTransaction.mutateAsync({
          credit_card_id: selectedCreditCard.id,
          category_id: categoryId || null,
          description,
          amount: numAmount,
          date,
          bill_month: getCreditCardBillMonth(date, selectedCreditCard.closing_day),
          installments: numInstallments,
          notes: notes || undefined,
        });

        if (numInstallments > 1) {
          const perInstallmentAmount = Number((numAmount / numInstallments).toFixed(2));
          const ccExpenseItems = Array.from({ length: numInstallments }, (_, i) => ({
            date: addMonthsToDate(date, i),
            description: `${description || 'Despesa'} (${i + 1}/${numInstallments})`,
            amount: perInstallmentAmount,
            category_id: categoryId || null,
            account_id: null,
            status: i === 0 ? status : 'agendado',
            notes: notes ? `[Cartao de credito] ${notes}` : '[Cartao de credito]',
            attachment_url: i === 0 ? attachmentUrl : null,
            attachment_name: i === 0 ? attachmentName : null,
          }));
          await addExpenseBatch.mutateAsync(ccExpenseItems);
        } else {
          await addExpense.mutateAsync({
            date,
            description,
            amount: numAmount,
            category_id: categoryId || null,
            account_id: null,
            status,
            notes: notes ? `[Cartao de credito] ${notes}` : '[Cartao de credito]',
            attachment_url: attachmentUrl,
            attachment_name: attachmentName,
          });
        }
      } else if (investmentId) {
        if (numInstallments > 1) {
          toast.error('Para enviar para investimento, lance em parcela Ãºnica ou faÃ§a aportes separados.');
          return;
        }

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

        await addInvestmentTransaction.mutateAsync({
          investment_id: investmentId,
          type: 'aporte',
          amount: numAmount,
          date,
          account_id: accountId || null,
          description: description || 'Aporte via despesa',
          notes: notes || undefined,
          skipLedgerSync: true,
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
      console.error('Erro ao adicionar transaÃ§Ã£o:', err);
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
          <Button size="sm" variant={type === 'income' ? 'default' : 'destructive'} className="w-full" data-tutorial-target={type === 'income' ? 'new-income' : 'new-expense'}>
            <Plus className="w-4 h-4 mr-1" />
            {type === 'income' ? 'Nova Receita' : 'Nova Despesa'}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto">
        <DialogHeader className="mb-3">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-white text-sm font-bold ${type === 'income' ? 'bg-income' : 'bg-expense'}`}>
              {type === 'income' ? 'â†‘' : 'â†“'}
            </span>
            {type === 'income' ? 'Nova Receita' : 'Nova Despesa'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 pb-2">

          {/* Amount â€” currency masked */}
          <div
            onClick={() => document.getElementById('amount-input-' + type)?.focus()}
            className={`rounded-2xl p-4 cursor-text transition-all ${
              type === 'income'
                ? amountFocused ? 'bg-income/10 border-2 border-income/60' : 'bg-income/8 border border-income/20'
                : amountFocused ? 'bg-expense/10 border-2 border-expense/60' : 'bg-expense/8 border border-expense/20'
            }`}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Valor</p>
            <div className="flex items-center gap-2 overflow-hidden">
              <span className={`text-xl font-bold shrink-0 ${ type === 'income' ? 'text-income' : 'text-expense'}`}>R$</span>
              <input
                id={`amount-input-${type}`}
                placeholder="0,00"
                value={amount}
                onChange={handleAmountChange}
                onFocus={() => setAmountFocused(true)}
                onBlur={() => setAmountFocused(false)}
                required
                inputMode="decimal"
                style={{ fontSize: '26px', lineHeight: 1.2, outline: 'none', boxShadow: 'none' }}
                className={`flex-1 font-mono font-bold bg-transparent border-none min-w-0 w-0 ${
                  type === 'income' ? 'text-income' : 'text-expense'
                } placeholder:text-muted-foreground/30`}
              />
            </div>
          </div>

          {/* Date + Status */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Data</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                style={{ fontSize: '16px' }}
                className="h-11"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-11" style={{ fontSize: '14px' }}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="concluido">{type === 'income' ? 'âœ“ Recebido' : 'âœ“ Pago'}</SelectItem>
                  <SelectItem value="pendente">â³ Pendente</SelectItem>
                  <SelectItem value="agendado">ðŸ“… Agendado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1 relative">
            <Label className="text-xs font-medium text-muted-foreground">DescriÃ§Ã£o</Label>
            <Input
              placeholder="Descreva a transaÃ§Ã£o..."
              value={description}
              onChange={(e) => { setDescription(e.target.value); setShowSuggestions(true); suggestCategory(e.target.value); }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              autoComplete="off"
              style={{ fontSize: '16px' }}
              className="h-11"
            />
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-popover border border-border rounded-xl shadow-lg overflow-hidden">
                {filteredSuggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    className="w-full text-left px-4 py-3 text-sm hover:bg-muted active:bg-muted transition-colors border-b border-border/40 last:border-0"
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
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  Categoria
                  {aiSuggesting && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
                  {!aiSuggesting && categoryId && <Sparkles className="w-3 h-3 text-primary" />}
                </Label>
                <Select value={categoryId} onValueChange={(v) => setCategoryId(v === '__none__' ? '' : v)}>
                  <SelectTrigger className="h-11" style={{ fontSize: '14px' }}><SelectValue placeholder="Selecionar categoria..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sem categoria</SelectItem>
                    {categories?.filter(c => !c.archived).map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">Forma de pagamento</Label>
                <Select
                  value={paymentMethod}
                  onValueChange={(v) => {
                    const method = v as 'account' | 'credit_card';
                    setPaymentMethod(method);
                    if (method === 'credit_card') setInvestmentId('');
                  }}
                >
                  <SelectTrigger className="h-11" style={{ fontSize: '14px' }}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="account">Conta / DÃ©bito / PIX</SelectItem>
                    <SelectItem value="credit_card">CartÃ£o de crÃ©dito</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">Parcelas</Label>
                  <Select value={installments} onValueChange={setInstallments}>
                    <SelectTrigger className="h-11" style={{ fontSize: '14px' }}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1,2,3,4,5,6,7,8,9,10,11,12,18,24,36,48].map(n => (
                        <SelectItem key={n} value={String(n)}>{n === 1 ? 'Ã€ vista' : `${n}x`}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {paymentMethod === 'account' ? (
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-muted-foreground">Conta</Label>
                    <Select value={accountId} onValueChange={setAccountId}>
                      <SelectTrigger className="h-11" style={{ fontSize: '14px' }}><SelectValue placeholder="Conta..." /></SelectTrigger>
                      <SelectContent>
                        {accounts?.filter(a => !a.archived).map(a => (
                          <SelectItem key={a.id} value={a.id}>{a.icon} {a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-muted-foreground">CartÃ£o</Label>
                    <Select value={creditCardId} onValueChange={setCreditCardId}>
                      <SelectTrigger className="h-11" style={{ fontSize: '14px' }}><SelectValue placeholder="CartÃ£o..." /></SelectTrigger>
                      <SelectContent>
                        {creditCards?.filter(c => !c.archived).map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {paymentMethod === 'account' && (
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">Vincular a investimento (opcional)</Label>
                  <Select value={investmentId || '__none__'} onValueChange={(v) => setInvestmentId(v === '__none__' ? '' : v)}>
                    <SelectTrigger className="h-11" style={{ fontSize: '14px' }}>
                      <SelectValue placeholder="Escolha a caixinha/ativo para aportar..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">NÃ£o vincular</SelectItem>
                      {investments?.filter(inv => !inv.archived).map(inv => (
                        <SelectItem key={inv.id} value={inv.id}>{inv.icon} {inv.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {investmentId && (
                    <p className="text-[11px] text-muted-foreground">
                      Ao salvar, essa despesa tambÃ©m serÃ¡ lanÃ§ada como aporte no investimento selecionado.
                    </p>
                  )}
                </div>
              )}

              {parseInt(installments) > 1 && (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-muted-foreground">Parcela inicial</Label>
                    <Select value={startInstallment} onValueChange={setStartInstallment}>
                      <SelectTrigger className="h-11" style={{ fontSize: '14px' }}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: parseInt(installments) }, (_, i) => i + 1).map(n => (
                          <SelectItem key={n} value={String(n)}>
                            {n === 1 ? '1Âª (nenhuma paga)' : `${n}Âª (${n - 1} jÃ¡ paga${n - 1 > 1 ? 's' : ''})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="rounded-xl bg-primary/5 border border-primary/15 p-3 text-xs text-muted-foreground">
                    ðŸ’³ <span className="font-semibold text-foreground">{parseInt(installments) - parseInt(startInstallment) + 1} parcelas</span> de{' '}
                    <span className="font-semibold text-foreground currency">R$ {amount || '0,00'}</span>
                    {' '}({startInstallment}/{installments} atÃ© {installments}/{installments})
                  </div>
                </>
              )}
              {paymentMethod === 'credit_card' && creditCardId && (
                <div className="rounded-xl bg-muted/50 border border-border/60 p-3 text-xs text-muted-foreground">
                  A compra vai para a fatura automaticamente com base no fechamento do cartÃ£o selecionado.
                </div>
              )}
            </>
          )}

          {type === 'income' && (
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
          )}

          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">ObservaÃ§Ãµes (opcional)</Label>
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
            <Label className="text-xs font-medium text-muted-foreground">Comprovante (opcional)</Label>
            {attachmentUrl ? (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/60 border border-border">
                <FileText className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm truncate flex-1">{attachmentName || 'Arquivo'}</span>
                <button type="button" onClick={() => { setAttachmentUrl(null); setAttachmentName(null); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-border/60 hover:border-primary/40 hover:bg-muted/30 cursor-pointer transition-all active:bg-muted/50">
                <Paperclip className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground">{uploading ? 'Enviando...' : 'Foto ou PDF do comprovante'}</span>
                <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} accept="image/*,.pdf,.doc,.docx" />
              </label>
            )}
          </div>

          <Button
            type="submit"
            className={`w-full h-12 text-[15px] font-semibold ${type === 'income' ? 'bg-income hover:bg-income/90' : 'bg-expense hover:bg-expense/90'} text-white`}
            disabled={addIncome.isPending || addExpense.isPending || addExpenseBatch.isPending || addInvestmentTransaction.isPending || addCreditCardTransaction.isPending}
          >
            {(addIncome.isPending || addExpense.isPending || addExpenseBatch.isPending || addInvestmentTransaction.isPending || addCreditCardTransaction.isPending)
              ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
              : <Plus className="w-4 h-4 mr-2" />}
            {type === 'income' ? 'Adicionar Receita' : 'Adicionar Despesa'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}


