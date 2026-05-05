import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  CreditCard,
  Trash2,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  CalendarClock,
  Layers3,
  Filter,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  useCreditCards,
  useAddCreditCard,
  useDeleteCreditCard,
  useUpdateCreditCard,
  useCreditCardTransactions,
  useAddCreditCardTransaction,
  useToggleCCTransactionPaid,
  useDeleteCCTransaction,
} from '@/hooks/useCreditCards';
import { useCategories } from '@/hooks/useFinanceData';
import { classifyDescription } from '@/hooks/useClassification';
import { getMonthYear, formatCurrency, formatDate } from '@/lib/format';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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

type TxFilter = 'all' | 'pending' | 'paid';

export default function CreditCardsPage() {
  const [billMonth, setBillMonth] = useState(getMonthYear());
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [showNewCard, setShowNewCard] = useState(false);
  const [showEditCard, setShowEditCard] = useState(false);
  const [showNewTx, setShowNewTx] = useState(false);
  const [txFilter, setTxFilter] = useState<TxFilter>('all');

  const { data: cards = [] } = useCreditCards();
  const { data: categories = [] } = useCategories();
  const { data: transactions = [] } = useCreditCardTransactions(selectedCard ?? undefined, billMonth);
  const addCard = useAddCreditCard();
  const updateCard = useUpdateCreditCard();
  const deleteCard = useDeleteCreditCard();
  const addTx = useAddCreditCardTransaction();
  const togglePaid = useToggleCCTransactionPaid();
  const deleteTx = useDeleteCCTransaction();

  useEffect(() => {
    if (!selectedCard && cards.length > 0) setSelectedCard(cards[0].id);
    if (selectedCard && cards.every((c) => c.id !== selectedCard)) setSelectedCard(cards[0]?.id ?? null);
  }, [cards, selectedCard]);

  const [newCard, setNewCard] = useState({
    name: '',
    color: CARD_COLORS[0],
    credit_limit: '',
    closing_day: '10',
    due_day: '17',
  });

  const [editCard, setEditCard] = useState({
    name: '',
    color: CARD_COLORS[0],
    credit_limit: '',
    closing_day: '10',
    due_day: '17',
  });

  const [newTx, setNewTx] = useState({
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    category_id: '',
    installments: '1',
    notes: '',
  });

  const currentCard = cards.find((c) => c.id === selectedCard);
  const activeCategories = categories.filter((c) => !c.archived);
  const categoryById = useMemo(
    () => activeCategories.reduce<Record<string, { name: string; icon: string }>>((acc, c) => {
      acc[c.id] = { name: c.name, icon: c.icon };
      return acc;
    }, {}),
    [activeCategories],
  );

  const billTotal = transactions.reduce((s, t) => s + Number(t.amount), 0);
  const paidTotal = transactions.filter((t) => t.paid).reduce((s, t) => s + Number(t.amount), 0);
  const unpaidTotal = Math.max(0, billTotal - paidTotal);
  const limitUsagePercent = currentCard ? Math.min(100, (billTotal / Number(currentCard.credit_limit || 1)) * 100) : 0;

  const byCategory = useMemo(() => {
    const grouped = transactions.reduce<Record<string, number>>((acc, tx) => {
      const key = tx.category_id ?? '__none__';
      acc[key] = (acc[key] ?? 0) + Number(tx.amount);
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([id, total]) => ({
        id,
        total,
        label: id === '__none__' ? 'Sem categoria' : `${categoryById[id]?.icon ?? '🏷️'} ${categoryById[id]?.name ?? 'Sem categoria'}`,
        pct: billTotal > 0 ? (total / billTotal) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [transactions, categoryById, billTotal]);

  const filteredTransactions = useMemo(() => {
    if (txFilter === 'pending') return transactions.filter((t) => !t.paid);
    if (txFilter === 'paid') return transactions.filter((t) => t.paid);
    return transactions;
  }, [transactions, txFilter]);

  const totalLimit = cards.reduce((sum, c) => sum + Number(c.credit_limit || 0), 0);

  const handleAddCard = async () => {
    if (!newCard.name.trim()) return toast.error('Informe o nome do cartao');

    try {
      await addCard.mutateAsync({
        name: newCard.name.trim(),
        color: newCard.color,
        credit_limit: parseFloat(newCard.credit_limit) || 0,
        closing_day: parseInt(newCard.closing_day) || 1,
        due_day: parseInt(newCard.due_day) || 10,
        icon: '💳',
      });
      toast.success('Cartao adicionado!');
      setShowNewCard(false);
      setNewCard({ name: '', color: CARD_COLORS[0], credit_limit: '', closing_day: '10', due_day: '17' });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const openEditCard = () => {
    if (!currentCard) return;
    setEditCard({
      name: currentCard.name,
      color: currentCard.color,
      credit_limit: String(currentCard.credit_limit ?? ''),
      closing_day: String(currentCard.closing_day ?? 1),
      due_day: String(currentCard.due_day ?? 10),
    });
    setShowEditCard(true);
  };

  const handleUpdateCard = async () => {
    if (!currentCard) return;

    try {
      await updateCard.mutateAsync({
        id: currentCard.id,
        data: {
          name: editCard.name.trim(),
          color: editCard.color,
          credit_limit: parseFloat(editCard.credit_limit) || 0,
          closing_day: Math.min(31, Math.max(1, parseInt(editCard.closing_day) || 1)),
          due_day: Math.min(31, Math.max(1, parseInt(editCard.due_day) || 1)),
        },
      });
      toast.success('Cartao atualizado!');
      setShowEditCard(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handlePayBill = async () => {
    const unpaid = transactions.filter((t) => !t.paid);
    if (unpaid.length === 0) {
      toast.info('Nao ha compras pendentes nesta fatura.');
      return;
    }

    try {
      await Promise.all(unpaid.map((t) => togglePaid.mutateAsync({ id: t.id, paid: true })));
      toast.success(`Fatura paga (${unpaid.length} compra${unpaid.length > 1 ? 's' : ''}).`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleAddTx = async () => {
    if (!selectedCard || !newTx.description || !newTx.amount) return toast.error('Preencha descricao e valor');

    const numericAmount = parseFloat(newTx.amount);
    if (isNaN(numericAmount) || numericAmount <= 0) return toast.error('Informe um valor valido');

    let resolvedCategoryId: string | null = newTx.category_id || null;
    if (!resolvedCategoryId) {
      const suggested = classifyDescription(
        newTx.description,
        -Math.abs(numericAmount),
        [],
        activeCategories.map((c) => ({ id: c.id, name: c.name })),
      );
      resolvedCategoryId = suggested.categoryId ?? null;

      if (!resolvedCategoryId) {
        const fallback = activeCategories.find((c) => ['compras', 'geral'].includes(c.name.toLowerCase()));
        resolvedCategoryId = fallback?.id ?? null;
      }
    }

    try {
      await addTx.mutateAsync({
        credit_card_id: selectedCard,
        description: newTx.description,
        amount: numericAmount,
        date: newTx.date,
        bill_month: billMonth,
        category_id: resolvedCategoryId,
        installments: parseInt(newTx.installments) || 1,
        notes: newTx.notes || undefined,
      });
      const n = parseInt(newTx.installments) || 1;
      toast.success(n > 1 ? `Compra lancada em ${n}x nas proximas faturas!` : 'Compra lancada!');
      setShowNewTx(false);
      setNewTx({ description: '', amount: '', date: new Date().toISOString().split('T')[0], category_id: '', installments: '1', notes: '' });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const monthLabel = () => {
    const [y, m] = billMonth.split('-').map(Number);
    return new Date(y, m - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  const getBillDates = () => {
    if (!currentCard) return null;
    const [year, month] = billMonth.split('-').map(Number);
    const closingDate = new Date(year, month - 1, currentCard.closing_day);
    const dueDate = new Date(year, month - 1, currentCard.due_day);
    const now = new Date();
    return {
      closingDate: closingDate.toLocaleDateString('pt-BR'),
      dueDate: dueDate.toLocaleDateString('pt-BR'),
      status: now > closingDate ? 'Fechada' : 'Aberta',
    };
  };

  const billDates = getBillDates();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-2xl border border-border/70 bg-card/70 p-5 shadow-sm flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cartoes de Credito</h1>
          <p className="text-sm text-muted-foreground">Controle visual da fatura com disciplina por categoria</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/80 px-2.5 py-1 text-xs text-muted-foreground">
              <Layers3 className="h-3 w-3" /> {cards.length} cartoes
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/80 px-2.5 py-1 text-xs text-muted-foreground">
              <CircleDollarSign className="h-3 w-3" /> Limite total {formatCurrency(totalLimit)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-primary">
              <Sparkles className="h-3 w-3" /> Orcamentos sincronizados com despesas do cartao
            </span>
          </div>
        </div>
        <Button className="w-full sm:w-auto h-11 rounded-xl" onClick={() => setShowNewCard(true)} data-tutorial-target="new-card">
          <Plus className="w-4 h-4 mr-1" /> Novo Cartao
        </Button>
      </div>

      {cards.length === 0 ? (
        <div className="stat-card py-16 text-center">
          <CreditCard className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="font-medium text-muted-foreground">Nenhum cartao cadastrado</p>
          <p className="text-sm text-muted-foreground mt-1">Adicione seus cartoes de credito</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {cards.map((card) => {
            const isSelected = selectedCard === card.id;
            return (
              <button
                key={card.id}
                onClick={() => setSelectedCard(isSelected ? null : card.id)}
                className={cn(
                  'relative rounded-xl p-4 text-left transition-all text-white overflow-hidden min-h-[140px]',
                  isSelected ? 'ring-2 ring-white/80 shadow-xl' : 'hover:-translate-y-0.5 opacity-90 hover:opacity-100',
                )}
                style={{ background: `linear-gradient(135deg, ${card.color}, ${card.color}aa)` }}
              >
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-white/70 text-xs">Cartao</p>
                    <p className="font-bold text-lg leading-tight">{card.name}</p>
                  </div>
                  <div className="flex gap-1">
                    <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold">Dia {card.due_day}</span>
                    <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold">Fecha {card.closing_day}</span>
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <div>
                    <p className="text-white/70 text-xs">Limite</p>
                    <p className="font-semibold">{formatCurrency(Number(card.credit_limit))}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteCard.mutate(card.id);
                    }}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                    aria-label={`Excluir cartao ${card.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <CreditCard className="absolute -right-4 -bottom-4 w-20 h-20 text-white/10" />
              </button>
            );
          })}
        </div>
      )}

      {selectedCard && currentCard && (
        <div className="rounded-2xl border border-border/70 bg-card/70 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-semibold text-lg leading-tight">{currentCard.name} - Fatura</h3>
              <p className="text-xs text-muted-foreground">Vencimento dia {currentCard.due_day}</p>
              {billDates && (
                <p className="text-xs text-muted-foreground mt-1">
                  {billDates.status} - Fecha em {billDates.closingDate} - Vence em {billDates.dueDate}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <Button size="sm" variant="outline" className="rounded-xl" onClick={openEditCard}>Editar cartao</Button>
              <Button size="sm" variant="outline" className="rounded-xl" onClick={handlePayBill} disabled={unpaidTotal <= 0 || togglePaid.isPending}>Pagar fatura</Button>
              <button onClick={() => setBillMonth(prevMonth(billMonth))} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="rounded-lg bg-muted px-2 py-1 text-sm font-medium capitalize inline-flex items-center gap-1">
                <CalendarClock className="h-3.5 w-3.5" /> {monthLabel()}
              </span>
              <button onClick={() => setBillMonth(nextMonth(billMonth))} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl bg-expense/5 border border-expense/20 p-4">
              <p className="text-xs text-muted-foreground">Total fatura</p>
              <p className="mt-1 text-lg font-extrabold text-expense">{formatCurrency(billTotal)}</p>
            </div>
            <div className="rounded-xl bg-income/5 border border-income/20 p-4">
              <p className="text-xs text-muted-foreground">Pago</p>
              <p className="mt-1 text-lg font-extrabold text-income">{formatCurrency(paidTotal)}</p>
            </div>
            <div className="rounded-xl bg-muted/70 p-4">
              <p className="text-xs text-muted-foreground">Disponivel</p>
              <p className="mt-1 text-lg font-extrabold">{formatCurrency(Number(currentCard.credit_limit) - billTotal)}</p>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Uso do limite</span>
              <span>{limitUsagePercent.toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  limitUsagePercent > 80 ? 'bg-expense' : limitUsagePercent > 50 ? 'bg-warning' : 'bg-income',
                )}
                style={{ width: `${limitUsagePercent}%` }}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-border/60 p-3 bg-background/35">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold">Fatura por categoria</p>
                <span className="text-[11px] text-muted-foreground">{byCategory.length} grupos</span>
              </div>
              {byCategory.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4">Sem compras nesta fatura.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {byCategory.map((row) => (
                    <div key={row.id} className="rounded-lg border border-border/50 bg-card/70 p-3">
                      <div className="flex items-center justify-between text-xs gap-2">
                        <span className="text-muted-foreground truncate">{row.label}</span>
                        <span className="font-semibold currency whitespace-nowrap">{formatCurrency(row.total)}</span>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${row.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold">{transactions.length} compras</h4>
                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center gap-1 rounded-lg bg-muted p-1 text-xs">
                    <button
                      onClick={() => setTxFilter('all')}
                      className={cn('px-2 py-1 rounded-md transition-colors', txFilter === 'all' ? 'bg-background shadow-sm' : 'text-muted-foreground')}
                    >
                      <Filter className="w-3 h-3 inline mr-1" />Todas
                    </button>
                    <button
                      onClick={() => setTxFilter('pending')}
                      className={cn('px-2 py-1 rounded-md transition-colors', txFilter === 'pending' ? 'bg-background shadow-sm text-warning' : 'text-muted-foreground')}
                    >
                      Pendentes
                    </button>
                    <button
                      onClick={() => setTxFilter('paid')}
                      className={cn('px-2 py-1 rounded-md transition-colors', txFilter === 'paid' ? 'bg-background shadow-sm text-income' : 'text-muted-foreground')}
                    >
                      Pagas
                    </button>
                  </div>
                  <Button size="sm" className="rounded-xl" onClick={() => setShowNewTx(true)}>
                    <Plus className="w-4 h-4 mr-1" /> Nova compra
                  </Button>
                </div>
              </div>

              {filteredTransactions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma compra no filtro atual</p>
              ) : (
                <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                  {filteredTransactions.map((t) => {
                    const cat = t.category_id ? categoryById[t.category_id] : null;
                    return (
                      <div key={t.id} className={cn('flex items-center justify-between py-3 px-3.5 rounded-xl transition-colors border', t.paid ? 'bg-income/5 border-income/20' : 'bg-background/35 hover:bg-muted/40 border-border/50')}>
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            onClick={() => togglePaid.mutate({ id: t.id, paid: !t.paid })}
                            className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0', t.paid ? 'bg-income border-income' : 'border-muted-foreground')}
                          >
                            {t.paid && <Check className="w-3 h-3 text-white" />}
                          </button>
                          <div className="min-w-0">
                            <p className={cn('text-sm font-medium truncate', t.paid && 'line-through text-muted-foreground')}>{t.description}</p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-xs text-muted-foreground">{formatDate(t.date)}</p>
                              <span className="text-[10px] rounded-full px-1.5 py-0.5 border border-primary/30 bg-primary/10 text-primary">
                                {cat ? `${cat.icon} ${cat.name}` : 'Sem categoria'}
                              </span>
                              {t.is_installment && (
                                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                                  {t.installment_number}/{t.total_installments}x
                                </span>
                              )}
                              {t.is_recurring && (
                                <span className="text-[10px] bg-warning/10 text-warning px-1.5 py-0.5 rounded-full font-medium">Recorrente</span>
                              )}
                              <span className={cn('text-[10px] rounded-full px-1.5 py-0.5', t.paid ? 'bg-income/10 text-income' : 'bg-warning/10 text-warning')}>
                                {t.paid ? 'Pago' : 'Pendente'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 pl-2">
                          <span className="text-sm font-semibold currency">{formatCurrency(Number(t.amount))}</span>
                          <button onClick={() => deleteTx.mutate(t.id)} className="p-1 text-muted-foreground hover:text-expense transition-colors" aria-label={`Excluir compra ${t.description}`}>
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Dialog open={showNewCard} onOpenChange={setShowNewCard}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Cartao de Credito</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome do cartao</Label><Input placeholder="Ex: Nubank" value={newCard.name} onChange={(e) => setNewCard((p) => ({ ...p, name: e.target.value }))} /></div>
            <div>
              <Label>Cor</Label>
              <div className="flex gap-2 mt-2">
                {CARD_COLORS.map((c) => (
                  <button key={c} onClick={() => setNewCard((p) => ({ ...p, color: c }))} className={cn('w-7 h-7 rounded-full transition-all', newCard.color === c && 'ring-2 ring-offset-2 ring-primary scale-110')} style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <div><Label>Limite (R$)</Label><Input type="number" placeholder="5000" value={newCard.credit_limit} onChange={(e) => setNewCard((p) => ({ ...p, credit_limit: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Dia de fechamento</Label><Input type="number" min={1} max={31} value={newCard.closing_day} onChange={(e) => setNewCard((p) => ({ ...p, closing_day: e.target.value }))} /></div>
              <div><Label>Dia de vencimento</Label><Input type="number" min={1} max={31} value={newCard.due_day} onChange={(e) => setNewCard((p) => ({ ...p, due_day: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewCard(false)}>Cancelar</Button>
            <Button onClick={handleAddCard} disabled={addCard.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditCard} onOpenChange={setShowEditCard}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Cartao de Credito</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome do cartao</Label><Input value={editCard.name} onChange={(e) => setEditCard((p) => ({ ...p, name: e.target.value }))} /></div>
            <div>
              <Label>Cor</Label>
              <div className="flex gap-2 mt-2">
                {CARD_COLORS.map((c) => (
                  <button key={c} onClick={() => setEditCard((p) => ({ ...p, color: c }))} className={cn('w-7 h-7 rounded-full transition-all', editCard.color === c && 'ring-2 ring-offset-2 ring-primary scale-110')} style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <div><Label>Limite (R$)</Label><Input type="number" value={editCard.credit_limit} onChange={(e) => setEditCard((p) => ({ ...p, credit_limit: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Dia de fechamento</Label><Input type="number" min={1} max={31} value={editCard.closing_day} onChange={(e) => setEditCard((p) => ({ ...p, closing_day: e.target.value }))} /></div>
              <div><Label>Dia de vencimento</Label><Input type="number" min={1} max={31} value={editCard.due_day} onChange={(e) => setEditCard((p) => ({ ...p, due_day: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditCard(false)}>Cancelar</Button>
            <Button onClick={handleUpdateCard} disabled={updateCard.isPending}>Salvar alteracoes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewTx} onOpenChange={setShowNewTx}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Compra - {currentCard?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Descricao</Label><Input placeholder="Ex: iFood, Academia..." value={newTx.description} onChange={(e) => setNewTx((p) => ({ ...p, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor total (R$)</Label><Input type="number" placeholder="0,00" value={newTx.amount} onChange={(e) => setNewTx((p) => ({ ...p, amount: e.target.value }))} /></div>
              <div>
                <Label>Parcelas</Label>
                <Input type="number" min={1} max={48} value={newTx.installments} onChange={(e) => setNewTx((p) => ({ ...p, installments: e.target.value }))} />
              </div>
            </div>
            {parseInt(newTx.installments) > 1 && (
              <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-xs text-muted-foreground">
                Serao geradas {newTx.installments} parcelas de {newTx.amount ? formatCurrency(parseFloat(newTx.amount) / parseInt(newTx.installments)) : 'R$ -'} nas proximas faturas.
              </div>
            )}
            <div><Label>Data da compra</Label><Input type="date" value={newTx.date} onChange={(e) => setNewTx((p) => ({ ...p, date: e.target.value }))} /></div>
            <div>
              <Label>Categoria</Label>
              <Select value={newTx.category_id || '__auto__'} onValueChange={(v) => setNewTx((p) => ({ ...p, category_id: v === '__auto__' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__auto__">Auto (recomendado)</SelectItem>
                  {activeCategories.map((c) => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Notas</Label><Input placeholder="Opcional..." value={newTx.notes} onChange={(e) => setNewTx((p) => ({ ...p, notes: e.target.value }))} /></div>
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
