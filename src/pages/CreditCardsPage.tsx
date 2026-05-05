import { useState, useMemo, useEffect } from 'react';
import { Plus, CreditCard, Trash2, Check, X, ChevronLeft, ChevronRight, ChevronDown, Wallet, CalendarDays, Zap, Receipt, TrendingUp, Sparkles } from 'lucide-react';
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
  useAllFutureCCTransactions,
} from '@/hooks/useCreditCards';
import { useCategories, useAccounts, useAddExpense } from '@/hooks/useFinanceData';
import { getMonthYear, formatCurrency, formatDate, calcBillMonth } from '@/lib/format';
import { cn } from '@/lib/utils';
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

type TxFilter = 'all' | 'pending' | 'paid';

export default function CreditCardsPage() {
  const [billMonth, setBillMonth] = useState(getMonthYear());
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [showNewCard, setShowNewCard] = useState(false);
  const [showEditCard, setShowEditCard] = useState(false);
  const [showNewTx, setShowNewTx] = useState(false);
  const [showPayBill, setShowPayBill] = useState(false);
  const [payBillAccountId, setPayBillAccountId] = useState('');
  const [expandedUpcomingMonth, setExpandedUpcomingMonth] = useState<string | null>(getMonthYear());

  const { data: cards = [] } = useCreditCards();
  const { data: categories = [] } = useCategories();
  const { data: accounts = [] } = useAccounts();
  const { data: transactions = [] } = useCreditCardTransactions(selectedCard ?? undefined, billMonth);
  const { data: futureTxns = [] } = useAllFutureCCTransactions();
  const addCard = useAddCreditCard();
  const updateCard = useUpdateCreditCard();
  const deleteCard = useDeleteCreditCard();
  const addTx = useAddCreditCardTransaction();
  const togglePaid = useToggleCCTransactionPaid();
  const deleteTx = useDeleteCCTransaction();
  const addExpense = useAddExpense();

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
  const paidTotal = transactions.filter(t => t.paid).reduce((s, t) => s + Number(t.amount), 0);
  const unpaidTotal = billTotal - paidTotal;
  const limitUsagePercent = currentCard
    ? Math.min(100, (billTotal / Math.max(Number(currentCard.credit_limit), 1)) * 100)
    : 0;

  const numericAmount = parseFloat(newTx.amount.replace(',', '.')) || 0;

  const newTxBillMonth = useMemo(() => {
    if (!currentCard) return billMonth;
    return calcBillMonth(newTx.date, Number(currentCard.closing_day));
  }, [currentCard, newTx.date, billMonth]);

  const newTxBillLabel = useMemo(() => monthLabel(newTxBillMonth), [newTxBillMonth]);

  const upcomingByMonth = useMemo(() => {
    const groups: Record<string, typeof futureTxns> = {};
    for (const t of futureTxns) {
      if (!groups[t.bill_month]) groups[t.bill_month] = [];
      groups[t.bill_month].push(t);
    }
    return groups;
  }, [futureTxns]);

  const upcomingMonths = useMemo(() => Object.keys(upcomingByMonth).sort(), [upcomingByMonth]);

  // Total commitment across all future bills
  const futureTotal = useMemo(() => futureTxns.reduce((s, t) => s + Number(t.amount), 0), [futureTxns]);
  const futureInstallmentCount = useMemo(() => futureTxns.filter(t => t.is_installment).length, [futureTxns]);

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
    if (!newCard.name.trim()) return toast.error('Informe o nome do cartao');

    try {
      await addCard.mutateAsync({
        name: newCard.name,
        color: newCard.color,
        credit_limit: parseFloat(newCard.credit_limit) || 0,
        closing_day: parseInt(newCard.closing_day) || 1,
        due_day: parseInt(newCard.due_day) || 10,
        icon: '💳',
      });
      toast.success('Cartao adicionado!');
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
        amount: numericAmount,
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

  // Total de faturas do mês por cartão (para o grid)
  const cardTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    return totals;
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ─── Hero Header ─── */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-[#6366f1]/[0.05] p-4 shadow-sm sm:rounded-3xl sm:p-7">
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-[#6366f1]/15 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute -bottom-32 -left-24 w-72 h-72 bg-[#8b5cf6]/[0.08] blur-3xl rounded-full pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-5">
          {/* Title row */}
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-[#6366f1]/25 to-[#6366f1]/5 flex items-center justify-center shadow-inner border border-[#6366f1]/15 shrink-0">
                <CreditCard className="w-6 h-6 sm:w-7 sm:h-7 text-[#6366f1]" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-none">Cartões de Crédito</h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#6366f1] animate-pulse" />
                    {cards.length} {cards.length === 1 ? 'cartão' : 'cartões'}
                  </span>
                  {futureInstallmentCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#6366f1]/10 text-[#6366f1] border border-[#6366f1]/20 font-semibold text-[10px] uppercase tracking-wide">
                      <CalendarDays className="w-3 h-3" />{futureInstallmentCount} parcelas futuras
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:flex sm:shrink-0">
              <Button variant="outline" size="sm" onClick={() => setShowNewCard(true)} className="h-9 gap-1.5">
                <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Novo Cartão</span>
              </Button>
              {selectedCard && (
                <Button size="sm" onClick={() => setShowNewTx(true)} className="h-9 gap-1.5 bg-[#6366f1] text-white shadow-sm shadow-[#6366f1]/20 hover:bg-[#6366f1]/90">
                  <Plus className="w-4 h-4" /> Nova Compra
                </Button>
              )}
            </div>
          </div>

          {/* Stats row */}
          {cards.length > 0 && (
            <div className="grid grid-cols-1 gap-2 min-[430px]:grid-cols-2 md:grid-cols-3 md:gap-3">
              <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
                  <Wallet className="h-3 w-3" />
                  <p className="text-[9px] font-bold uppercase tracking-wider">Limite total</p>
                </div>
                <p className="text-sm sm:text-base font-extrabold currency truncate">
                  {formatCurrency(cards.reduce((s, c) => s + Number(c.credit_limit), 0))}
                </p>
              </div>
              <div className="rounded-xl border border-[#6366f1]/25 bg-[#6366f1]/[0.06] px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-[#6366f1] mb-0.5">
                  <TrendingUp className="h-3 w-3" />
                  <p className="text-[9px] font-bold uppercase tracking-wider">Compromisso futuro</p>
                </div>
                <p className="text-sm sm:text-base font-extrabold currency text-[#6366f1] truncate">{formatCurrency(futureTotal)}</p>
              </div>
              <div className="min-[430px]:col-span-2 md:col-span-1 rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
                  <Sparkles className="h-3 w-3" />
                  <p className="text-[9px] font-bold uppercase tracking-wider">Próximas faturas</p>
                </div>
                <p className="text-sm sm:text-base font-extrabold truncate">{upcomingMonths.length} {upcomingMonths.length === 1 ? 'mês' : 'meses'}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Calendário de Faturas Futuras ─── */}
      {futureTxns.length > 0 && (
        <div className="rounded-3xl border border-border/60 bg-card/60 backdrop-blur-sm shadow-sm overflow-hidden">
          {/* Section header */}
          <div className="flex flex-col gap-3 px-4 py-4 bg-gradient-to-r from-[#6366f1]/5 via-transparent to-transparent border-b border-border/50 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#6366f1]/20 to-[#6366f1]/5 flex items-center justify-center border border-[#6366f1]/15 shrink-0">
                <CalendarDays className="w-4.5 h-4.5 text-[#6366f1]" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-sm sm:text-base leading-tight">Calendário de Faturas</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">{upcomingMonths.length} {upcomingMonths.length === 1 ? 'mês com lançamentos' : 'meses com lançamentos'} · todas as parcelas futuras</p>
              </div>
            </div>
            <div className="shrink-0 sm:text-right">
              <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/80">Total</p>
              <p className="text-sm sm:text-base font-extrabold currency text-[#6366f1] tabular-nums">{formatCurrency(futureTotal)}</p>
            </div>
          </div>

          {/* Months list */}
          <div className="divide-y divide-border/40">
            {upcomingMonths.map((mo, idx) => {
              const monthTxns = upcomingByMonth[mo];
              const monthTotal = monthTxns.reduce((s, t) => s + Number(t.amount), 0);
              const isExpanded = expandedUpcomingMonth === mo;
              const label = monthLabel(mo);
              const isCurrentMonth = mo === getMonthYear();

              // Per-card breakdown for this month
              const cardSplit = monthTxns.reduce<Record<string, number>>((acc, t) => {
                acc[t.credit_card_id] = (acc[t.credit_card_id] ?? 0) + Number(t.amount);
                return acc;
              }, {});

              return (
                <div key={mo} className={isExpanded ? 'bg-muted/20' : ''}>
                  <button
                    type="button"
                    onClick={() => setExpandedUpcomingMonth(isExpanded ? null : mo)}
                    className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors group/month"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn(
                        'w-9 h-9 rounded-xl flex flex-col items-center justify-center font-extrabold text-[10px] uppercase tracking-wider shrink-0 transition-colors',
                        isCurrentMonth
                          ? 'bg-[#6366f1] text-white shadow-sm shadow-[#6366f1]/30'
                          : isExpanded
                            ? 'bg-[#6366f1]/15 text-[#6366f1] border border-[#6366f1]/20'
                            : 'bg-muted text-muted-foreground border border-border/60',
                      )}>
                        <span className="text-[8px] opacity-70 leading-none">{label.split(' ')[1]?.slice(0, 4) ?? ''}</span>
                        <span className="text-[11px] leading-none mt-0.5">{label.split(' ')[0].slice(0, 3)}</span>
                      </div>
                      <div className="min-w-0 text-left">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold capitalize">{label}</span>
                          {isCurrentMonth && (
                            <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-[#6366f1] text-white font-bold">Atual</span>
                          )}
                          {idx === 0 && !isCurrentMonth && (
                            <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-warning/15 text-warning font-bold border border-warning/20">Próxima</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="text-[10px] text-muted-foreground">
                            {monthTxns.length} {monthTxns.length === 1 ? 'item' : 'itens'}
                          </span>
                          {Object.entries(cardSplit).map(([cardId]) => {
                            const card = cards.find(c => c.id === cardId);
                            if (!card) return null;
                            return (
                              <span key={cardId} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md font-semibold border" style={{ color: card.color ?? '#6366f1', backgroundColor: `${card.color ?? '#6366f1'}10`, borderColor: `${card.color ?? '#6366f1'}25` }}>
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: card.color ?? '#6366f1' }} />
                                {card.name}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm sm:text-base font-extrabold currency text-expense tabular-nums">{formatCurrency(monthTotal)}</span>
                      <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', isExpanded ? 'rotate-0' : '-rotate-90')} />
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-3 pb-3">
                      <div className="rounded-2xl border border-border/50 bg-card/80 overflow-hidden divide-y divide-border/30">
                        {monthTxns.map(t => {
                          const card = cards.find(c => c.id === t.credit_card_id);
                          const cat = categories.find(c => c.id === t.category_id);
                          const cardColor = card?.color ?? '#6366f1';
                          return (
                            <div key={t.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors group/tx">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: cardColor }} />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className={cn('text-sm font-semibold truncate', t.paid && 'line-through text-muted-foreground')}>{t.description}</p>
                                    {t.is_installment && (
                                      <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold shrink-0" style={{ color: cardColor, backgroundColor: `${cardColor}15`, border: `1px solid ${cardColor}30` }}>
                                        {t.installment_number}/{t.total_installments}x
                                      </span>
                                    )}
                                    {t.paid && (
                                      <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold bg-income/10 text-income border border-income/20">PAGA</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    {card && (
                                      <span className="text-[10px] font-semibold" style={{ color: cardColor }}>{card.name}</span>
                                    )}
                                    {cat && (
                                      <span className="text-[10px] text-muted-foreground">· {cat.icon} {cat.name}</span>
                                    )}
                                    <span className="text-[10px] text-muted-foreground">· {formatDate(t.date)}</span>
                                  </div>
                                </div>
                              </div>
                              <span className={cn('text-sm font-bold currency shrink-0 ml-3 tabular-nums', t.paid ? 'text-muted-foreground' : 'text-expense')}>{formatCurrency(Number(t.amount))}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Card Grid ─── */}
      {cards.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#6366f1]/30 bg-[#6366f1]/[0.03] py-16 px-6 text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#6366f1]/20 to-[#6366f1]/5 flex items-center justify-center mx-auto mb-4 border border-[#6366f1]/20 shadow-inner">
            <CreditCard className="w-10 h-10 text-[#6366f1]/60" />
          </div>
          <p className="font-extrabold text-lg mb-1">Nenhum cartão cadastrado</p>
          <p className="text-sm text-muted-foreground mb-5 max-w-sm mx-auto">Adicione seus cartões para controlar faturas e parcelamentos</p>
          <Button onClick={() => setShowNewCard(true)} className="bg-[#6366f1] hover:bg-[#6366f1]/90 text-white shadow-sm shadow-[#6366f1]/20">
            <Plus className="w-4 h-4 mr-1.5" /> Adicionar primeiro cartão
          </Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card) => {
            const isSelected = selectedCard === card.id;
            // Future commitment for THIS card across all months
            const cardFutureTotal = futureTxns
              .filter(t => t.credit_card_id === card.id)
              .reduce((s, t) => s + Number(t.amount), 0);
            const cardLimitUsage = Math.min(100, (cardFutureTotal / Math.max(Number(card.credit_limit), 1)) * 100);

            return (
              <button
                key={card.id}
                onClick={() => setSelectedCard(card.id)}
                className={cn(
                  'group/card relative rounded-2xl p-5 cursor-pointer transition-all text-white overflow-hidden select-none text-left',
                  'shadow-md hover:shadow-xl',
                  isSelected ? 'ring-2 ring-offset-2 ring-offset-background scale-[1.015]' : 'hover:scale-[1.015]',
                )}
                style={{
                  background: `linear-gradient(135deg, ${card.color}ff 0%, ${card.color}dd 50%, ${card.color}99 100%)`,
                  boxShadow: isSelected ? `0 0 0 2px ${card.color}, 0 12px 24px -8px ${card.color}50` : undefined,
                }}
              >
                {/* Decorative wave overlay */}
                <div className="absolute inset-0 opacity-20 pointer-events-none">
                  <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/30" />
                  <div className="absolute -right-12 top-12 w-40 h-40 rounded-full bg-white/15" />
                  <div className="absolute -left-8 -bottom-8 w-28 h-28 rounded-full bg-black/20" />
                </div>

                <div className="relative z-10 space-y-5">
                  {/* Top: name + delete */}
                  <div className="flex justify-between items-start">
                    <div className="min-w-0">
                      <p className="text-white/70 text-[9px] font-bold uppercase tracking-[0.2em] mb-1">Cartão</p>
                      <p className="font-extrabold text-lg leading-tight tracking-tight truncate">{card.name}</p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); deleteCard.mutate(card.id); }}
                      className="p-1.5 rounded-lg bg-black/15 hover:bg-black/30 backdrop-blur-sm transition-colors opacity-0 group-hover/card:opacity-100 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Chip + brand mark */}
                  <div className="flex items-center justify-between">
                    <div className="w-11 h-8 rounded-md bg-gradient-to-br from-yellow-100/80 to-yellow-300/40 border border-white/20 shadow-inner" />
                    <CreditCard className="w-7 h-7 text-white/40" />
                  </div>

                  {/* Bottom: limit usage bar */}
                  <div className="space-y-2">
                    <div className="flex items-end justify-between gap-2">
                      <div>
                        <p className="text-white/60 text-[9px] font-bold uppercase tracking-wider mb-0.5">Comprometido</p>
                        <p className="font-extrabold text-base tracking-tight tabular-nums">{formatCurrency(cardFutureTotal)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-white/60 text-[9px] font-bold uppercase tracking-wider mb-0.5">Fecha · Vence</p>
                        <p className="font-bold text-sm tabular-nums">{String(card.closing_day).padStart(2,'0')} · {String(card.due_day).padStart(2,'0')}</p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="h-1.5 bg-black/25 rounded-full overflow-hidden">
                        <div className="h-full bg-white/80 rounded-full transition-all" style={{ width: `${cardLimitUsage}%` }} />
                      </div>
                      <div className="flex items-center justify-between text-[9px] font-semibold">
                        <span className="text-white/60 uppercase tracking-wider">Limite {formatCurrency(Number(card.credit_limit))}</span>
                        <span className="text-white/90">{cardLimitUsage.toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Selected indicator */}
                {isSelected && (
                  <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white/95 flex items-center justify-center shadow-md">
                    <Check className="w-3.5 h-3.5" style={{ color: card.color }} strokeWidth={3} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Bill Details ─────────────────────────────────────────── */}
      {selectedCard && currentCard && (
        <div className="stat-card space-y-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 rounded-t-2xl" style={{ background: `linear-gradient(90deg, ${currentCard.color}, ${currentCard.color}44)` }} />

          {/* Bill Header */}
          <div className="flex flex-col gap-4 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${currentCard.color}20`, border: `1.5px solid ${currentCard.color}40` }}>
                <CreditCard className="w-5 h-5" style={{ color: currentCard.color }} />
              </div>
              <div>
                <h3 className="font-bold text-base">{currentCard.name}</h3>
                <p className="text-xs text-muted-foreground">Fecha dia {currentCard.closing_day} · Vence dia {currentCard.due_day}</p>
              </div>
            </div>
            <div className="flex w-full items-center gap-1.5 rounded-xl bg-muted/40 px-2 py-1.5 sm:w-auto">
              <button onClick={() => setBillMonth(prevMonth(billMonth))} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="min-w-0 flex-1 px-1 text-center text-sm font-semibold capitalize sm:min-w-[120px]">{monthLabel(billMonth)}</span>
              <button onClick={() => setBillMonth(nextMonth(billMonth))} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Bill Stats */}
          <div className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-3">
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
                className={cn(
                  'h-full rounded-full transition-all',
                  limitUsagePercent > 80 ? 'bg-expense' : limitUsagePercent > 50 ? 'bg-warning' : 'bg-income',
                )}
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
          <div className="flex flex-col gap-2 pt-1 border-t border-border/50 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">{transactions.length} compra{transactions.length !== 1 ? 's' : ''} · {transactions.filter(t => t.paid).length} paga{transactions.filter(t => t.paid).length !== 1 ? 's' : ''}</p>
            <div className="grid w-full grid-cols-1 gap-2 min-[430px]:grid-cols-2 sm:flex sm:w-auto">
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
                    className={`flex flex-col gap-2 rounded-xl border px-3 py-2.5 transition-all sm:flex-row sm:items-center sm:justify-between ${t.paid ? 'bg-income/[0.04] border-income/15' : 'hover:bg-muted/30 border-transparent hover:border-border/40'}`}
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
                    <div className="flex w-full items-center justify-between gap-2 sm:ml-2 sm:w-auto sm:shrink-0">
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
          <DialogHeader><DialogTitle>Novo Cartao de Credito</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome do cartao</Label><Input placeholder="Ex: Nubank" value={newCard.name} onChange={(e) => setNewCard((p) => ({ ...p, name: e.target.value }))} /></div>
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
            <div><Label>Limite (R$)</Label><Input type="number" placeholder="5000" value={newCard.credit_limit} onChange={(e) => setNewCard((p) => ({ ...p, credit_limit: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Dia de fechamento</Label><Input type="number" min={1} max={31} value={newCard.closing_day} onChange={(e) => setNewCard((p) => ({ ...p, closing_day: e.target.value }))} /></div>
              <div><Label>Dia de vencimento</Label><Input type="number" min={1} max={31} value={newCard.due_day} onChange={(e) => setNewCard((p) => ({ ...p, due_day: e.target.value }))} /></div>
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
