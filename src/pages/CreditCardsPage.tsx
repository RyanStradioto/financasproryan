import { useState } from 'react';
import { Plus, CreditCard, Trash2, Check, X, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  useCreditCards,
  useAddCreditCard,
  useDeleteCreditCard,
  useCreditCardTransactions,
  useAddCreditCardTransaction,
  useToggleCCTransactionPaid,
  useDeleteCCTransaction,
} from '@/hooks/useCreditCards';
import { useCategories } from '@/hooks/useFinanceData';
import { getMonthYear, formatCurrency, formatDate } from '@/lib/format';
import { toast } from 'sonner';

function getBillMonth(month: string) {
  return month; // already YYYY-MM
}

function prevMonth(m: string) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function nextMonth(m: string) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const CARD_COLORS = ['#6366f1', '#ec4899', '#f97316', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444'];

export default function CreditCardsPage() {
  const [billMonth, setBillMonth] = useState(getMonthYear());
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [showNewCard, setShowNewCard] = useState(false);
  const [showNewTx, setShowNewTx] = useState(false);

  const { data: cards = [] } = useCreditCards();
  const { data: categories = [] } = useCategories();
  const { data: transactions = [] } = useCreditCardTransactions(selectedCard ?? undefined, billMonth);
  const addCard = useAddCreditCard();
  const deleteCard = useDeleteCreditCard();
  const addTx = useAddCreditCardTransaction();
  const togglePaid = useToggleCCTransactionPaid();
  const deleteTx = useDeleteCCTransaction();

  const [newCard, setNewCard] = useState({
    name: '', color: CARD_COLORS[0], credit_limit: '', closing_day: '10', due_day: '17'
  });

  const [newTx, setNewTx] = useState({
    description: '', amount: '', date: new Date().toISOString().split('T')[0],
    category_id: '', installments: '1', notes: '',
  });

  const currentCard = cards.find(c => c.id === selectedCard);
  const billTotal = transactions.reduce((s, t) => s + Number(t.amount), 0);
  const paidTotal = transactions.filter(t => t.paid).reduce((s, t) => s + Number(t.amount), 0);
  const limitUsagePercent = currentCard
    ? Math.min(100, (billTotal / Number(currentCard.credit_limit)) * 100)
    : 0;

  const handleAddCard = async () => {
    if (!newCard.name) return toast.error('Informe o nome do cartão');
    try {
      const created = await addCard.mutateAsync({
        name: newCard.name,
        color: newCard.color,
        credit_limit: parseFloat(newCard.credit_limit) || 0,
        closing_day: parseInt(newCard.closing_day),
        due_day: parseInt(newCard.due_day),
        icon: '💳',
      });
      toast.success('Cartão adicionado!');
      setShowNewCard(false);
      setNewCard({ name: '', color: CARD_COLORS[0], credit_limit: '', closing_day: '10', due_day: '17' });
    } catch (e: any) { toast.error(e.message); }
  };

  const handleAddTx = async () => {
    if (!selectedCard || !newTx.description || !newTx.amount) {
      return toast.error('Preencha descrição e valor');
    }
    try {
      await addTx.mutateAsync({
        credit_card_id: selectedCard,
        description: newTx.description,
        amount: parseFloat(newTx.amount),
        date: newTx.date,
        bill_month: billMonth,
        category_id: newTx.category_id || null,
        installments: parseInt(newTx.installments) || 1,
        notes: newTx.notes || undefined,
      });
      const n = parseInt(newTx.installments);
      toast.success(n > 1 ? `Compra lançada em ${n}x nas próximas faturas!` : 'Compra lançada!');
      setShowNewTx(false);
      setNewTx({ description: '', amount: '', date: new Date().toISOString().split('T')[0], category_id: '', installments: '1', notes: '' });
    } catch (e: any) { toast.error(e.message); }
  };

  const monthLabel = () => {
    const [y, m] = billMonth.split('-').map(Number);
    return new Date(y, m - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  const activeCategories = categories.filter(c => !c.archived);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cartões de Crédito</h1>
          <p className="text-sm text-muted-foreground">Controle de fatura e parcelamentos</p>
        </div>
        <Button onClick={() => setShowNewCard(true)}>
          <Plus className="w-4 h-4 mr-1" /> Novo Cartão
        </Button>
      </div>

      {/* Card List */}
      {cards.length === 0 ? (
        <div className="stat-card py-16 text-center">
          <CreditCard className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="font-medium text-muted-foreground">Nenhum cartão cadastrado</p>
          <p className="text-sm text-muted-foreground mt-1">Adicione seus cartões de crédito</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map(card => {
            const isSelected = selectedCard === card.id;
            return (
              <div
                key={card.id}
                onClick={() => setSelectedCard(isSelected ? null : card.id)}
                className={`relative rounded-2xl p-5 cursor-pointer transition-all text-white overflow-hidden ${isSelected ? 'ring-2 ring-white/80 scale-[1.02]' : 'hover:scale-[1.01]'}`}
                style={{ background: `linear-gradient(135deg, ${card.color}, ${card.color}aa)` }}
              >
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <p className="text-white/70 text-xs">Cartão</p>
                    <p className="font-bold text-lg">{card.name}</p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); deleteCard.mutate(card.id); }}
                    className="p-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex justify-between text-sm">
                  <div>
                    <p className="text-white/70 text-xs">Limite</p>
                    <p className="font-semibold">{formatCurrency(Number(card.credit_limit))}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white/70 text-xs">Fechamento/Venc.</p>
                    <p className="font-semibold">Dia {card.closing_day}/{card.due_day}</p>
                  </div>
                </div>
                <CreditCard className="absolute -right-4 -bottom-4 w-20 h-20 text-white/10" />
              </div>
            );
          })}
        </div>
      )}

      {/* Bill Details */}
      {selectedCard && currentCard && (
        <div className="stat-card space-y-4">
          {/* Bill Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-semibold">{currentCard.name} — Fatura</h3>
              <p className="text-xs text-muted-foreground">Vencimento dia {currentCard.due_day}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setBillMonth(prevMonth(billMonth))} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium capitalize">{monthLabel()}</span>
              <button onClick={() => setBillMonth(nextMonth(billMonth))} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Bill Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-expense/5 border border-expense/20 p-3">
              <p className="text-xs text-muted-foreground">Total fatura</p>
              <p className="font-bold text-expense">{formatCurrency(billTotal)}</p>
            </div>
            <div className="rounded-xl bg-income/5 border border-income/20 p-3">
              <p className="text-xs text-muted-foreground">Pago</p>
              <p className="font-bold text-income">{formatCurrency(paidTotal)}</p>
            </div>
            <div className="rounded-xl bg-muted p-3">
              <p className="text-xs text-muted-foreground">Disponível</p>
              <p className="font-bold">{formatCurrency(Number(currentCard.credit_limit) - billTotal)}</p>
            </div>
          </div>

          {/* Limit Usage Bar */}
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Uso do limite</span>
              <span>{limitUsagePercent.toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${limitUsagePercent > 80 ? 'bg-expense' : limitUsagePercent > 50 ? 'bg-warning' : 'bg-income'}`}
                style={{ width: `${limitUsagePercent}%` }}
              />
            </div>
          </div>

          <div className="flex justify-between items-center">
            <h4 className="text-sm font-medium">{transactions.length} compras</h4>
            <Button size="sm" onClick={() => setShowNewTx(true)}>
              <Plus className="w-4 h-4 mr-1" /> Nova compra
            </Button>
          </div>

          {/* Transactions */}
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma compra nesta fatura</p>
          ) : (
            <div className="space-y-1">
              {transactions.map(t => (
                <div key={t.id} className={`flex items-center justify-between py-2.5 px-3 rounded-lg transition-colors ${t.paid ? 'bg-income/5' : 'hover:bg-muted/50'}`}>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => togglePaid.mutate({ id: t.id, paid: !t.paid })}
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${t.paid ? 'bg-income border-income' : 'border-muted-foreground'}`}
                    >
                      {t.paid && <Check className="w-3 h-3 text-white" />}
                    </button>
                    <div>
                      <p className={`text-sm font-medium ${t.paid ? 'line-through text-muted-foreground' : ''}`}>{t.description}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground">{formatDate(t.date)}</p>
                        {t.is_installment && (
                          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                            {t.installment_number}/{t.total_installments}x
                          </span>
                        )}
                        {t.is_recurring && (
                          <span className="text-[10px] bg-warning/10 text-warning px-1.5 py-0.5 rounded-full font-medium">Recorrente</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold currency">{formatCurrency(Number(t.amount))}</span>
                    <button onClick={() => deleteTx.mutate(t.id)} className="p-1 text-muted-foreground hover:text-expense transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Card Dialog */}
      <Dialog open={showNewCard} onOpenChange={setShowNewCard}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Cartão de Crédito</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome do cartão</Label><Input placeholder="Ex: Nubank Roxinho" value={newCard.name} onChange={e => setNewCard(p => ({ ...p, name: e.target.value }))} /></div>
            <div>
              <Label>Cor</Label>
              <div className="flex gap-2 mt-2">
                {CARD_COLORS.map(c => (
                  <button key={c} onClick={() => setNewCard(p => ({ ...p, color: c }))}
                    className={`w-7 h-7 rounded-full transition-all ${newCard.color === c ? 'ring-2 ring-offset-2 ring-primary scale-110' : ''}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <div><Label>Limite (R$)</Label><Input type="number" placeholder="5000" value={newCard.credit_limit} onChange={e => setNewCard(p => ({ ...p, credit_limit: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Dia de fechamento</Label><Input type="number" min={1} max={31} value={newCard.closing_day} onChange={e => setNewCard(p => ({ ...p, closing_day: e.target.value }))} /></div>
              <div><Label>Dia de vencimento</Label><Input type="number" min={1} max={31} value={newCard.due_day} onChange={e => setNewCard(p => ({ ...p, due_day: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewCard(false)}>Cancelar</Button>
            <Button onClick={handleAddCard} disabled={addCard.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Transaction Dialog */}
      <Dialog open={showNewTx} onOpenChange={setShowNewTx}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Compra — {currentCard?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Descrição</Label><Input placeholder="Ex: iFood, Netflix..." value={newTx.description} onChange={e => setNewTx(p => ({ ...p, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor total (R$)</Label><Input type="number" placeholder="0,00" value={newTx.amount} onChange={e => setNewTx(p => ({ ...p, amount: e.target.value }))} /></div>
              <div>
                <Label>Parcelas</Label>
                <Input type="number" min={1} max={48} value={newTx.installments} onChange={e => setNewTx(p => ({ ...p, installments: e.target.value }))} />
              </div>
            </div>
            {parseInt(newTx.installments) > 1 && (
              <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-xs text-muted-foreground">
                📅 Serão geradas {newTx.installments} parcelas de {newTx.amount ? formatCurrency(parseFloat(newTx.amount) / parseInt(newTx.installments)) : 'R$ -'} nas próximas faturas.
              </div>
            )}
            <div><Label>Data da compra</Label><Input type="date" value={newTx.date} onChange={e => setNewTx(p => ({ ...p, date: e.target.value }))} /></div>
            <div>
              <Label>Categoria</Label>
              <Select value={newTx.category_id} onValueChange={v => setNewTx(p => ({ ...p, category_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {activeCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Notas</Label><Input placeholder="Opcional..." value={newTx.notes} onChange={e => setNewTx(p => ({ ...p, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewTx(false)}>Cancelar</Button>
            <Button onClick={handleAddTx} disabled={addTx.isPending}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
