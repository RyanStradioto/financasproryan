import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCategories, useAccounts, useUpdateIncome, useUpdateExpense, useDeleteExpense, type Income, type Expense } from '@/hooks/useFinanceData';
import { useAddCreditCardTransaction, useCreditCards } from '@/hooks/useCreditCards';
import { useFileUpload } from '@/hooks/useFileUpload';
import { detectCreditCardExpense, stripCreditCardMarkers } from '@/lib/paymentMethod';
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
  const [amountFocused, setAmountFocused] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'account' | 'credit_card'>('account');
  const [creditCardId, setCreditCardId] = useState('');
  const [installments, setInstallments] = useState('1');
  const [startInstallment, setStartInstallment] = useState('1');
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);

  const { data: categories } = useCategories();
  const { data: accounts } = useAccounts();
  const { data: creditCards } = useCreditCards();
  const updateIncome = useUpdateIncome();
  const updateExpense = useUpdateExpense();
  const deleteExpense = useDeleteExpense();
  const addCreditCardTransaction = useAddCreditCardTransaction();
  const { upload, uploading } = useFileUpload();

  useEffect(() => {
    if (transaction) {
      setDate(transaction.date);
      setDescription(transaction.description || '');
      const num = Number(transaction.amount);
      setAmount(num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      setAccountId(transaction.account_id || '');
      setStatus(transaction.status || 'concluido');
      setNotes(transaction.notes || '');
      setAttachmentUrl(transaction.attachment_url || null);
      setAttachmentName(transaction.attachment_name || null);
      if (transaction.type === 'expense') {
        detectCreditCardExpense(transaction as Expense, creditCards ?? [], accounts ?? []);
        setCategoryId((transaction as Expense).category_id || '');
        setPaymentMethod('account');
        setCreditCardId('');
        setInstallments('1');
        setStartInstallment('1');
      }
    }
  }, [transaction, creditCards, accounts]);

  const getCreditCardBillMonth = (purchaseDate: string, closingDay: number) => {
    const [year, month, day] = purchaseDate.split('-').map(Number);
    const billDate = day > closingDay ? new Date(year, month, 1) : new Date(year, month - 1, 1);
    return `${billDate.getFullYear()}-${String(billDate.getMonth() + 1).padStart(2, '0')}`;
  };

  const handlePaymentMethodChange = (v: string) => {
    setPaymentMethod(v as 'account' | 'credit_card');
    if (v === 'credit_card') {
      // Auto-detect installment info from description: "AIRBNB - PARCELA 3/6" or "AIRBNB (3/6)"
      const match =
        description.match(/[-–—]\s*PARCELA\s+(\d+)\s*\/\s*(\d+)/i) ||
        description.match(/\((\d+)\s*\/\s*(\d+)\)/);
      if (match) {
        setStartInstallment(match[1]);
        setInstallments(match[2]);
      }
    }
  };

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
      toast.error('Valor invalido');
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
      } else if (paymentMethod === 'credit_card') {
        const selectedCard = creditCards?.find(cc => cc.id === creditCardId);
        if (!selectedCard) {
          toast.error('Selecione um cartao de credito');
          return;
        }

        await addCreditCardTransaction.mutateAsync({
          credit_card_id: selectedCard.id,
          category_id: categoryId || null,
          description,
          amount: numAmount,
          date,
          bill_month: getCreditCardBillMonth(date, selectedCard.closing_day),
          installments: parseInt(installments) || 1,
          start_installment: parseInt(startInstallment) || 1,
          notes: notes || undefined,
          paid: status === 'concluido',
        });

        await deleteExpense.mutateAsync(transaction.id);
      } else {
        const cleanNotes = stripCreditCardMarkers(notes) || null;
        await updateExpense.mutateAsync({
          ...baseData,
          category_id: categoryId || null,
          notes: cleanNotes,
        });
      }

      toast.success('Transacao atualizada!');
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
          <div
            onClick={() => document.getElementById('edit-amount-input')?.focus()}
            className={`rounded-2xl p-4 cursor-text transition-all ${
              transaction.type === 'income'
                ? amountFocused ? 'bg-income/10 border-2 border-income/60' : 'bg-income/8 border border-income/20'
                : amountFocused ? 'bg-expense/10 border-2 border-expense/60' : 'bg-expense/8 border border-expense/20'
            }`}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Valor</p>
            <div className="flex items-center gap-2 overflow-hidden">
              <span className={`text-xl font-bold shrink-0 ${
                transaction.type === 'income' ? 'text-income' : 'text-expense'
              }`}>R$</span>
              <input
                id="edit-amount-input"
                placeholder="0,00"
                value={amount}
                onChange={handleAmountChange}
                onFocus={() => setAmountFocused(true)}
                onBlur={() => setAmountFocused(false)}
                required
                inputMode="decimal"
                style={{ fontSize: '26px', lineHeight: 1.2, outline: 'none', boxShadow: 'none' }}
                className={`flex-1 font-mono font-bold bg-transparent border-none min-w-0 w-0 ${
                  transaction.type === 'income' ? 'text-income' : 'text-expense'
                } placeholder:text-muted-foreground/30`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 min-[430px]:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required style={{ fontSize: '16px' }} className="h-11" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-11" style={{ fontSize: '14px' }}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="concluido">Concluido</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="agendado">Agendado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Descricao</Label>
            <Input
              placeholder="Descreva a transacao..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ fontSize: '16px' }}
              className="h-11"
            />
          </div>

          {transaction.type === 'expense' && (
            <>
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

              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">Forma de pagamento</Label>
                <Select value={paymentMethod} onValueChange={handlePaymentMethodChange}>
                  <SelectTrigger className="h-11" style={{ fontSize: '14px' }}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="account">Conta / Debito / PIX</SelectItem>
                    <SelectItem value="credit_card">Cartao de credito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {transaction.type === 'expense' ? (
            paymentMethod === 'account' ? (
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
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-2 min-[430px]:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-muted-foreground">Cartão</Label>
                    <Select value={creditCardId} onValueChange={setCreditCardId}>
                      <SelectTrigger className="h-11" style={{ fontSize: '14px' }}><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                      <SelectContent>
                        {creditCards?.filter(c => !c.archived).map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-muted-foreground">Total de parcelas</Label>
                    <Input
                      type="number" min={1} max={48}
                      value={installments}
                      onChange={(e) => {
                        setInstallments(e.target.value);
                        const total = parseInt(e.target.value) || 1;
                        const cur = parseInt(startInstallment) || 1;
                        if (cur > total) setStartInstallment(String(total));
                      }}
                      className="h-11"
                    />
                  </div>
                </div>

                {/* Qual parcela é essa? */}
                <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Qual parcela é essa?</Label>
                  <Select value={startInstallment} onValueChange={setStartInstallment}>
                    <SelectTrigger className="h-11 bg-background" style={{ fontSize: '14px' }}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: parseInt(installments) || 1 }, (_, i) => i + 1).map(n => {
                        const total = parseInt(installments) || 1;
                        const remaining = total - n + 1;
                        return (
                          <SelectItem key={n} value={String(n)}>
                            {n}ª de {total}
                            {n > 1 ? ` — ${n - 1} já ${n - 1 === 1 ? 'paga' : 'pagas'}` : ' — início'}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {(() => {
                    const total = parseInt(installments) || 1;
                    const start = parseInt(startInstallment) || 1;
                    const remaining = total - start + 1;
                    return remaining > 0 ? (
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary/15 text-primary text-[10px] font-bold shrink-0">↓</span>
                        {remaining === 1
                          ? 'Será criado 1 lançamento no cartão'
                          : `Serão criados ${remaining} lançamentos (parcelas ${start} a ${total})`}
                      </p>
                    ) : null;
                  })()}
                </div>
              </div>
            )
          ) : (
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
            <Label className="text-xs font-medium text-muted-foreground">Observacoes</Label>
            <Textarea
              placeholder="Notas adicionais..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              style={{ fontSize: '16px' }}
              className="resize-none"
            />
          </div>

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

          <Button type="submit" className="w-full h-12 text-[15px] font-semibold" disabled={updateIncome.isPending || updateExpense.isPending || deleteExpense.isPending || addCreditCardTransaction.isPending}>
            Salvar Alteracoes
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}


