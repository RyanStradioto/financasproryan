import { useState, useMemo } from 'react';
import { Plus, CreditCard, Trash2, Check, X, ChevronLeft, ChevronRight, ChevronDown, Wallet, CalendarDays, Zap, Receipt } from 'lucide-react';
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
  useUpcomingInstallments,
} from '@/hooks/useCreditCards';
import { useCategories, useAccounts, useAddExpense } from '@/hooks/useFinanceData';
import { getMonthYear, formatCurrency, formatDate, calcBillMonth } from '@/lib/format';
import { toast } from 'sonner';

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

function monthLabel(m: string) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

const CARD_COLORS = ['#6366f1', '#ec4899', '#f97316', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#0ea5e9', '#f59e0b'];

export default function CreditCardsPage() {
  const [billMonth, setBillMonth] = useState(getMonthYear());
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [showNewCard, setShowNewCard] = useState(false);
  const [showNewTx, setShowNewTx] = useState(false);
  const [showPayBill, setShowPayBill] = useState(false);
  const [payBillAccountId, setPayBillAccountId] = useState('');
  const [expandedUpcomingMonth, setExpandedUpcomingMonth] = useState<string | null>(getMonthYear());

  const { data: cards = [] } = useCreditCards();
  const { data: categories = [] } = useCategories();
  const { data: accounts = [] } = useAccounts();
  const { data: transactions = [] } = useCreditCardTransactions(selectedCard ?? undefined, billMonth);
  const { data: upcomingTxns = [] } = useUpcomingInstallments(3);
  const addCard = useAddCreditCard();
  const deleteCard = useDeleteCreditCard();
  const addTx = useAddCreditCardTransaction();
  const togglePaid = useToggleCCTransactionPaid();
  const deleteTx = useDeleteCCTransaction();
  const addExpense = useAddExpense();

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
  const unpaidTotal = billTotal - paidTotal;
  const limitUsagePercent = currentCard
    ? Math.min(100, (billTotal / Math.max(Number(currentCard.credit_limit), 1)) * 100)
    : 0;

  const newTxBillMonth = useMemo(() => {
    if (!currentCard) return billMonth;
    return calcBillMonth(newTx.date, Number(currentCard.closing_day));
  }, [currentCard, newTx.date, billMonth]);

  const newTxBillLabel = useMemo(() => monthLabel(newTxBillMonth), [newTxBillMonth]);

  const upcomingByMonth = useMemo(() => {
    const groups: Record<string, typeof upcomingTxns> = {};
    for (const t of upcomingTxns) {
      if (!groups[t.bill_month]) groups[t.bill_month] = [];
      groups[t.bill_month].push(t);
    }
    return groups;
  }, [upcomingTxns]);

  const upcomingMonths = useMemo(() => Object.keys(upcomingByMonth).sort(), [upcomingByMonth]);

  // Category breakdown for current bill
  const catBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of transactions) {
      if (t.category_id) map[t.category_id] = (map[t.category_id] || 0) + Number(t.amount);
    }
    return Object.entries(map)
      .map(([id, total]) => ({ cat: categories.find(c => c.id === id), total }))
      .filter(r => r.cat)
      .sort((a, b) => b.total - a.total);
  }, [transactions, categories]);

  const handleAddCard = async () => {
    if (!newCard.name) return toast.error('Informe o nome do cartão');
    try {
      await addCard.mutateAsync({
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
    } catch (e) { toast.error((e as Error).message); }
  };

  const handleAddTx = async () => {
    if (!selectedCard || !newTx.description || !newTx.amount) return toast.error('Preencha descrição e valor');
    try {
      await addTx.mutateAsync({
        credit_card_id: selectedCard,
        description: newTx.description,
        amount: parseFloat(newTx.amount),
        date: newTx.date,
        bill_month: newTxBillMonth,
        category_id: newTx.category_id || null,
        installments: parseInt(newTx.installments) || 1,
        notes: newTx.notes || undefined,
      });
      const n = parseInt(newTx.installments);
      toast.success(n > 1 ? `${n}x lançado! Primeira fatura: ${newTxBillLabel}` : `Lançado na fatura de ${newTxBillLabel}!`);
      setShowNewTx(false);
      setNewTx({ description: '', amount: '', date: new Date().toISOString().split('T')[0], category_id: '', installments: '1', notes: '' });
    } catch (e) { toast.error((e as Error).message); }
  };

  const handlePayBill = async () => {
    if (!currentCard || unpaidTotal <= 0) return;
    try {
      await addExpense.mutateAsync({
        date: new Date().toISOString().split('T')[0],
        description: `💳 Fatura ${currentCard.name} — ${monthLabel(billMonth)}`,
        amount: unpaidTotal,
        account_id: (payBillAccountId && payBillAccountId !== '__none__') ? payBillAccountId : null,
        status: 'concluido',
        notes: `[FATURA_CARTAO] ${currentCard.name} ${billMonth}`,
      });
      const unpaid = transactions.filter(t => !t.paid);
      await Promise.all(unpaid.map(t => togglePaid.mutateAsync({ id: t.id, paid: true })));
      toast.success(`Fatura paga! ${unpaid.length} item(ns) marcado(s).`);
      setShowPayBill(false);
      setPayBillAccountId('');
    } catch (e) { toast.error((e as Error).message); }
  };

  const activeCategories = categories.filter(c => !c.archived);

  // Total de faturas do mês por cartão (para o grid)
  const cardTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    return totals;
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Hero Header ─────────────────────────────────────────── */}
      <div className="hero-card flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-56 h-56 bg-[#6366f1]/15 blur-3xl rounded-full pointer-events-none" />
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-[#6366f1]/30 to-[#6366f1]/10 flex items-center justify-center shadow-inner border border-[#6366f1]/20">
            <CreditCard className="w-7 h-7 sm:w-8 sm:h-8 text-[#6366f1] drop-shadow-md" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-1">Cartões de Crédito</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-[#6366f1] animate-pulse" />
              {cards.length} cartão{cards.length !== 1 ? 'ões' : ''} · {upcomingTxns.length} parcelas futuras
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 relative z-10">
          <Button variant="outline" size="sm" onClick={() => setShowNewCard(true)} className="gap-1.5">
            <Plus className="w-4 h-4" /> Novo Cartão
          </Button>
          {selectedCard && (
            <Button size="sm" onClick={() => setShowNewTx(true)} className="gap-1.5 bg-[#6366f1] hover:bg-[#6366f1]/90 text-white">
              <Plus className="w-4 h-4" /> Nova Compra
            </Button>
          )}
        </div>
      </div>

      {/* ── Próximas Parcelas ─────────────────────────────────────── */}
      {upcomingTxns.length > 0 && (
        <div className="stat-card space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-[#6366f1]/10 flex items-center justify-center">
              <CalendarDays className="w-4 h-4 text-[#6366f1]" />
            </div>
            <h3 className="font-semibold">Calendário de Parcelas</h3>
            <span className="text-xs text-muted-foreground ml-1">próximos 3 meses</span>
          </div>
          <div className="space-y-2">
            {upcomingMonths.map(mo => {
              const monthTxns = upcomingByMonth[mo];
              const monthTotal = monthTxns.reduce((s, t) => s + Number(t.amount), 0);
              const isExpanded = expandedUpcomingMonth === mo;
              const label = monthLabel(mo);

              return (
                <div key={mo} className="rounded-xl border border-border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedUpcomingMonth(isExpanded ? null : mo)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                      <span className="text-sm font-semibold capitalize">{label}</span>
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {monthTxns.length} item{monthTxns.length !== 1 ? 'ns' : ''}
                      </span>
                    </div>
                    <span className="text-sm font-bold currency text-expense">{formatCurrency(monthTotal)}</span>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border divide-y divide-border/40">
                      {monthTxns.map(t => {
                        const card = cards.find(c => c.id === t.credit_card_id);
                        const cat = categories.find(c => c.id === t.category_id);
                        return (
                          <div key={t.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors">
                            <div className="flex items-center gap-3 min-w-0">
                              {card && (
                                <div className="w-3 h-3 rounded-full shrink-0 ring-1 ring-border" style={{ backgroundColor: card.color ?? '#6366f1' }} />
                              )}
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{t.description}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {card && <p className="text-[10px] text-muted-foreground font-medium">{card.name}</p>}
                                  {cat && <p className="text-[10px] text-muted-foreground">{cat.icon} {cat.name}</p>}
                                  {t.is_installment && (
                                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold">
                                      {t.installment_number}/{t.total_installments}x
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <span className="text-sm font-bold currency shrink-0 ml-3">{formatCurrency(Number(t.amount))}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Card Grid ────────────────────────────────────────────── */}
      {cards.length === 0 ? (
        <div className="stat-card py-20 text-center">
          <div className="w-20 h-20 rounded-2xl bg-[#6366f1]/10 flex items-center justify-center mx-auto mb-4 border border-[#6366f1]/20">
            <CreditCard className="w-10 h-10 text-[#6366f1]/50" />
          </div>
          <p className="font-bold text-lg mb-1">Nenhum cartão cadastrado</p>
          <p className="text-sm text-muted-foreground mb-5">Adicione seus cartões para controlar faturas e parcelamentos</p>
          <Button onClick={() => setShowNewCard(true)} className="bg-[#6366f1] hover:bg-[#6366f1]/90 text-white">
            <Plus className="w-4 h-4 mr-1.5" /> Adicionar primeiro cartão
          </Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map(card => {
            const isSelected = selectedCard === card.id;
            return (
              <div
                key={card.id}
                onClick={() => setSelectedCard(isSelected ? null : card.id)}
                className={`relative rounded-2xl p-5 cursor-pointer transition-all text-white overflow-hidden select-none ${isSelected ? 'ring-2 ring-white/60 shadow-xl scale-[1.02]' : 'hover:scale-[1.01] hover:shadow-lg'}`}
                style={{ background: `linear-gradient(135deg, ${card.color}ee, ${card.color}99)` }}
              >
                {/* Decorative circles */}
                <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10" />
                <div className="absolute -right-2 -bottom-8 w-32 h-32 rounded-full bg-white/5" />

                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-0.5">Cartão</p>
                      <p className="font-extrabold text-xl leading-tight">{card.name}</p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); deleteCard.mutate(card.id); }}
                      className="p-1.5 rounded-lg bg-white/10 hover:bg-white/25 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Card chip visual */}
                  <div className="w-10 h-7 rounded-md bg-white/20 mb-5 border border-white/30" />

                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-white/60 text-[10px] font-bold uppercase tracking-wider mb-0.5">Limite</p>
                      <p className="font-bold text-base">{formatCurrency(Number(card.credit_limit))}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white/60 text-[10px] font-bold uppercase tracking-wider mb-0.5">Fecha · Vence</p>
                      <p className="font-bold text-base">Dia {card.closing_day} · {card.due_day}</p>
                    </div>
                  </div>
                </div>

                <CreditCard className="absolute right-3 bottom-3 w-8 h-8 text-white/20" />

                {isSelected && (
                  <div className="absolute top-2 left-1/2 -translate-x-1/2">
                    <span className="text-[10px] bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded-full font-medium">
                      ▲ Ver fatura
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Bill Details ─────────────────────────────────────────── */}
      {selectedCard && currentCard && (
        <div className="stat-card space-y-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 rounded-t-2xl" style={{ background: `linear-gradient(90deg, ${currentCard.color}, ${currentCard.color}44)` }} />

          {/* Bill Header */}
          <div className="flex items-center justify-between flex-wrap gap-4 pt-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${currentCard.color}20`, border: `1.5px solid ${currentCard.color}40` }}>
                <CreditCard className="w-5 h-5" style={{ color: currentCard.color }} />
              </div>
              <div>
                <h3 className="font-bold text-base">{currentCard.name}</h3>
                <p className="text-xs text-muted-foreground">Fecha dia {currentCard.closing_day} · Vence dia {currentCard.due_day}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-muted/40 rounded-xl px-2 py-1.5">
              <button onClick={() => setBillMonth(prevMonth(billMonth))} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-semibold capitalize px-1 min-w-[120px] text-center">{monthLabel(billMonth)}</span>
              <button onClick={() => setBillMonth(nextMonth(billMonth))} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Bill Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border p-3 space-y-1" style={{ borderColor: `${currentCard.color}30`, backgroundColor: `${currentCard.color}08` }}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total fatura</p>
              <p className="font-extrabold text-lg currency text-expense">{formatCurrency(billTotal)}</p>
            </div>
            <div className="rounded-xl border border-income/20 bg-income/5 p-3 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pago</p>
              <p className="font-extrabold text-lg currency text-income">{formatCurrency(paidTotal)}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Em aberto</p>
              <p className={`font-extrabold text-lg currency ${unpaidTotal > 0 ? 'text-warning' : 'text-muted-foreground'}`}>{formatCurrency(unpaidTotal)}</p>
            </div>
          </div>

          {/* Limit Usage Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Uso do limite — {formatCurrency(billTotal)} de {formatCurrency(Number(currentCard.credit_limit))}</span>
              <span className={`font-bold ${limitUsagePercent > 80 ? 'text-expense' : limitUsagePercent > 50 ? 'text-warning' : 'text-income'}`}>
                {limitUsagePercent.toFixed(0)}%
              </span>
            </div>
            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${limitUsagePercent > 80 ? 'bg-expense' : limitUsagePercent > 50 ? 'bg-warning' : 'bg-income'}`}
                style={{ width: `${limitUsagePercent}%` }}
              />
            </div>
          </div>

          {/* Category Breakdown */}
          {catBreakdown.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Por categoria</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {catBreakdown.slice(0, 6).map(({ cat, total }) => (
                  <div key={cat!.id} className="flex items-center gap-2.5 rounded-lg bg-muted/30 border border-border/50 px-3 py-2">
                    <span className="text-lg shrink-0">{cat!.icon}</span>
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground truncate">{cat!.name}</p>
                      <p className="text-sm font-bold currency">{formatCurrency(total)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-border/50">
            <p className="text-sm text-muted-foreground">{transactions.length} compra{transactions.length !== 1 ? 's' : ''} · {transactions.filter(t => t.paid).length} paga{transactions.filter(t => t.paid).length !== 1 ? 's' : ''}</p>
            <div className="flex gap-2">
              {unpaidTotal > 0 && (
                <Button size="sm" variant="outline" className="border-income/30 text-income hover:bg-income/5 gap-1.5" onClick={() => setShowPayBill(true)}>
                  <Wallet className="w-3.5 h-3.5" />
                  Pagar {formatCurrency(unpaidTotal)}
                </Button>
              )}
              <Button size="sm" className="gap-1.5" style={{ backgroundColor: currentCard.color }} onClick={() => setShowNewTx(true)}>
                <Plus className="w-3.5 h-3.5" /> Nova compra
              </Button>
            </div>
          </div>

          {/* Transactions */}
          {transactions.length === 0 ? (
            <div className="flex flex-col items-center py-10 gap-3 text-center">
              <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center">
                <Receipt className="w-6 h-6 text-muted-foreground/50" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Nenhuma compra nesta fatura</p>
                <p className="text-xs text-muted-foreground/70 mt-0.5">Adicione uma compra para começar</p>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {transactions.map(t => {
                const cat = categories.find(c => c.id === t.category_id);
                return (
                  <div
                    key={t.id}
                    className={`flex items-center justify-between py-2.5 px-3 rounded-xl transition-all border ${t.paid ? 'bg-income/[0.04] border-income/15' : 'hover:bg-muted/30 border-transparent hover:border-border/40'}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        onClick={() => togglePaid.mutate({ id: t.id, paid: !t.paid })}
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${t.paid ? 'bg-income border-income shadow-sm shadow-income/30' : 'border-muted-foreground/40 hover:border-income/60'}`}
                      >
                        {t.paid && <Check className="w-2.5 h-2.5 text-white" />}
                      </button>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-sm font-medium ${t.paid ? 'line-through text-muted-foreground' : ''}`}>{t.description}</p>
                          {t.is_installment && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0" style={{ backgroundColor: `${currentCard.color}15`, color: currentCard.color, border: `1px solid ${currentCard.color}30` }}>
                              {t.installment_number}/{t.total_installments}x
                            </span>
                          )}
                          {t.is_recurring && (
                            <span className="text-[10px] bg-warning/10 text-warning px-1.5 py-0.5 rounded-full font-medium shrink-0">Recorrente</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-muted-foreground">{formatDate(t.date)}</p>
                          {cat && (
                            <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full">
                              {cat.icon} {cat.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className={`text-sm font-bold currency ${t.paid ? 'text-muted-foreground' : ''}`}>{formatCurrency(Number(t.amount))}</span>
                      <button
                        onClick={() => deleteTx.mutate(t.id)}
                        className="p-1 text-muted-foreground/40 hover:text-expense hover:bg-expense/10 rounded-lg transition-all"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── No card selected hint ──────────────────────────────── */}
      {cards.length > 0 && !selectedCard && (
        <div className="stat-card py-10 text-center">
          <Zap className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Clique em um cartão para ver a fatura</p>
        </div>
      )}

      {/* ── Add Card Dialog ────────────────────────────────────────── */}
      <Dialog open={showNewCard} onOpenChange={setShowNewCard}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Cartão de Crédito</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome do cartão</Label><Input placeholder="Ex: Nubank Roxinho" value={newCard.name} onChange={e => setNewCard(p => ({ ...p, name: e.target.value }))} /></div>
            <div>
              <Label>Cor</Label>
              <div className="flex gap-2 mt-2 flex-wrap">
                {CARD_COLORS.map(c => (
                  <button key={c} onClick={() => setNewCard(p => ({ ...p, color: c }))}
                    className={`w-8 h-8 rounded-full transition-all border-2 ${newCard.color === c ? 'ring-2 ring-offset-2 ring-primary scale-110 border-white' : 'border-transparent'}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
              {/* Preview */}
              <div className="mt-3 rounded-xl p-3 text-white text-xs font-medium" style={{ background: `linear-gradient(135deg, ${newCard.color}, ${newCard.color}88)` }}>
                {newCard.name || 'Prévia do cartão'} · Dia {newCard.closing_day}/{newCard.due_day}
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
            <Button onClick={handleAddCard} disabled={addCard.isPending} style={{ backgroundColor: newCard.color }} className="text-white">Salvar cartão</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Transaction Dialog ─────────────────────────────────── */}
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
            <div><Label>Data da compra</Label><Input type="date" value={newTx.date} onChange={e => setNewTx(p => ({ ...p, date: e.target.value }))} /></div>

            {/* Auto-calculated bill month chip */}
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium border" style={{ backgroundColor: `${currentCard?.color}10`, borderColor: `${currentCard?.color}30`, color: currentCard?.color }}>
              <CreditCard className="w-3.5 h-3.5 shrink-0" />
              <span>
                {parseInt(newTx.installments) > 1
                  ? `${newTx.installments}x · Primeira fatura: `
                  : 'Entrará na fatura de '}
                <strong className="capitalize">{newTxBillLabel}</strong>
              </span>
            </div>

            {parseInt(newTx.installments) > 1 && newTx.amount && (
              <div className="rounded-xl bg-muted/50 border border-border px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
                <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                {newTx.installments}x de {formatCurrency(parseFloat(newTx.amount) / parseInt(newTx.installments))} por mês
              </div>
            )}

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
            <Button onClick={handleAddTx} disabled={addTx.isPending} style={{ backgroundColor: currentCard?.color }} className="text-white">Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Pay Bill Dialog ────────────────────────────────────────── */}
      <Dialog open={showPayBill} onOpenChange={setShowPayBill}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pagar Fatura — {currentCard?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-2xl p-5 text-center" style={{ background: `linear-gradient(135deg, ${currentCard?.color}20, ${currentCard?.color}08)`, border: `1px solid ${currentCard?.color}30` }}>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Valor a pagar</p>
              <p className="text-3xl font-extrabold text-expense currency">{formatCurrency(unpaidTotal)}</p>
              <p className="text-xs text-muted-foreground mt-1.5 capitalize">{monthLabel(billMonth)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{transactions.filter(t => !t.paid).length} item(ns) em aberto</p>
            </div>
            <div className="space-y-1.5">
              <Label>Debitar da conta (opcional)</Label>
              <Select value={payBillAccountId} onValueChange={setPayBillAccountId}>
                <SelectTrigger><SelectValue placeholder="Selecionar conta..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Não especificar</SelectItem>
                  {accounts.filter(a => !a.archived).map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.icon} {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">Ao selecionar uma conta, o valor será debitado do saldo.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayBill(false)}>Cancelar</Button>
            <Button
              className="text-white gap-1.5"
              style={{ backgroundColor: '#10b981' }}
              onClick={handlePayBill}
              disabled={addExpense.isPending || togglePaid.isPending}
            >
              <Check className="w-4 h-4" /> Confirmar Pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
