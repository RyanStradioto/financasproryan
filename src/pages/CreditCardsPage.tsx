import { useState, useMemo, useEffect } from 'react';
import { Plus, CreditCard, Trash2, Check, ChevronLeft, ChevronRight, Wallet, CalendarDays, Zap, Receipt, Sparkles, Search, ShieldCheck, Layers3, PieChart, Pencil, BarChart3 } from 'lucide-react';
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
  useUpdateCCTransaction,
  useAllFutureCCTransactions,
  useAllOutstandingCCTransactions,
  useCardOutstanding,
  getCardDefaultAccount,
  setCardDefaultAccount,
  type CreditCardTransaction,
  type CreditCard as CreditCardRow,
} from '@/hooks/useCreditCards';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCategories, useAccounts } from '@/hooks/useFinanceData';
import { getMonthYear, formatCurrency, formatDate, calcBillMonth } from '@/lib/format';
import { useSensitiveData } from '@/components/finance/SensitiveData';
import CreditCardAnalytics from '@/components/finance/CreditCardAnalytics';
import { cn } from '@/lib/utils';
import { CARD_COLORS } from '@/lib/colors';
import { resolveAccountBrand, getAccountBrandPresets } from '@/lib/accountBrand';
import { toast } from 'sonner';

// ── Brand helpers ──────────────────────────────────────────────────────────
/** Resolve the visual brand (color/logo) for a card from its name. */
function cardBrand(card: { name: string; color: string }) {
  return resolveAccountBrand(card.name, card.color);
}

function hexToRgb(hex: string) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return { r: 109, g: 33, b: 119 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function darkenColor(hex: string, amount: number) {
  const { r, g, b } = hexToRgb(hex);
  const d = (v: number) => Math.max(0, Math.round(v * (1 - amount)));
  return `rgb(${d(r)}, ${d(g)}, ${d(b)})`;
}

/** A pleasant diagonal gradient built from a single brand color. */
function cardGradient(hex: string) {
  return `linear-gradient(135deg, ${hex} 0%, ${darkenColor(hex, 0.5)} 100%)`;
}

const CC_BRAND_PRESETS = getAccountBrandPresets().filter((p) =>
  ['nubank', 'itau', 'bradesco', 'santander', 'caixa', 'inter', 'caju', 'alelo'].includes(p.name),
);
const CC_BRAND_LABELS: Record<string, string> = {
  nubank: 'Nubank', itau: 'Itaú', bradesco: 'Bradesco', santander: 'Santander',
  caixa: 'Caixa', inter: 'Inter', caju: 'Caju', alelo: 'Alelo',
};

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

function shortMonthLabel(m: string) {
  const [y, mo] = m.split('-').map(Number);
  const date = new Date(y, mo - 1);
  const month = date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${String(y).slice(-2)}`;
}

function addMonths(m: string, count: number) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 1 + count, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}


type TxFilter = 'all' | 'pending' | 'paid' | 'installments' | 'uncategorized';

export default function CreditCardsPage() {
  const { maskCurrency } = useSensitiveData();
  const fmt = (v: number) => maskCurrency(formatCurrency(v));
  const [billMonth, setBillMonth] = useState(getMonthYear());
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [showNewCard, setShowNewCard] = useState(false);
  const [showNewTx, setShowNewTx] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showPayBill, setShowPayBill] = useState(false);
  const [payBillAccountId, setPayBillAccountId] = useState('');
  const [txFilter, setTxFilter] = useState<TxFilter>('all');
  const [txSearch, setTxSearch] = useState('');

  // Per-item quick-pay state
  const [payItem, setPayItem] = useState<{ id: string; description: string; amount: number } | null>(null);
  const [payItemAccountId, setPayItemAccountId] = useState('');
  const [editingTx, setEditingTx] = useState<CreditCardTransaction | null>(null);
  const [editTx, setEditTx] = useState({
    description: '',
    amount: '',
    date: '',
    category_id: '',
  });

  // Edit card + delete confirmation state
  const [editingCard, setEditingCard] = useState<CreditCardRow | null>(null);
  const [editCardForm, setEditCardForm] = useState({
    name: '', color: CARD_COLORS[0], credit_limit: '', closing_day: '10', due_day: '17', payment_account_id: '',
  });
  const [confirmDeleteCard, setConfirmDeleteCard] = useState<CreditCardRow | null>(null);

  const { user } = useAuth();
  const { data: cards = [] } = useCreditCards();
  const { data: categories = [] } = useCategories();
  const { data: accounts = [] } = useAccounts();
  const { data: transactions = [] } = useCreditCardTransactions(selectedCard ?? undefined, billMonth);
  // All transactions for the card (every bill month) — used by the estorno purchase picker.
  const { data: allCardTxns = [] } = useCreditCardTransactions(selectedCard ?? undefined);
  const { data: futureTxns = [] } = useAllFutureCCTransactions();
  const { data: allOutstandingTxns = [] } = useAllOutstandingCCTransactions();
  const { data: outstandingTxns = [] } = useCardOutstanding(selectedCard ?? undefined);
  const addCard = useAddCreditCard();
  const updateCard = useUpdateCreditCard();
  const deleteCard = useDeleteCreditCard();
  const addTx = useAddCreditCardTransaction();
  const togglePaid = useToggleCCTransactionPaid();
  const deleteTx = useDeleteCCTransaction();
  const updateTx = useUpdateCCTransaction();

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
    payment_account_id: '',
  });

  // Bumps to force re-renders when localStorage default-account changes
  const [defaultAcctBump, setDefaultAcctBump] = useState(0);
  const queryClientCC = useQueryClient();

  const [newTx, setNewTx] = useState({
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    category_id: '',
    installments: '1',
    notes: '',
  });
  // Estorno/Reembolso mode: records a NEGATIVE transaction that credits (abate) the open fatura.
  const [refundMode, setRefundMode] = useState(false);
  const [refundTxId, setRefundTxId] = useState('');   // the original purchase being refunded
  const [refundPartial, setRefundPartial] = useState(false);

  const currentCard = cards.find((c) => c.id === selectedCard);
  const activeCategories = categories.filter((c) => !c.archived);
  const categoryById = useMemo(
    () => activeCategories.reduce<Record<string, { name: string; icon: string }>>((acc, c) => {
      acc[c.id] = { name: c.name, icon: c.icon };
      return acc;
    }, {}),
    [activeCategories],
  );

  // Purchases that can be refunded: real (positive) charges on this card, newest first.
  const refundablePurchases = useMemo(
    () => allCardTxns
      .filter(t => Number(t.amount) > 0)
      .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [allCardTxns],
  );

  const billTotal = transactions.reduce((s, t) => s + Number(t.amount), 0);
  const paidTotal = transactions.filter(t => t.paid).reduce((s, t) => s + Number(t.amount), 0);
  const unpaidTotal = billTotal - paidTotal;
  const limitUsagePercent = currentCard
    ? Math.min(100, Math.max(0, (billTotal / Math.max(Number(currentCard.credit_limit), 1)) * 100))
    : 0;

  const selectedFutureTxns = useMemo(
    () => futureTxns.filter(t => !selectedCard || t.credit_card_id === selectedCard),
    [futureTxns, selectedCard],
  );

  // Outstanding = ALL unpaid transactions on this card (any bill month). This is
  // the true committed debt that reduces the available limit — not just the
  // current/future months. Falls back to the future-only set while loading.
  const committedTotal = useMemo(
    () => outstandingTxns.reduce((s, t) => s + Number(t.amount), 0),
    [outstandingTxns],
  );

  // Count of unpaid future installments (and their value) — what's coming up.
  const openInstallments = useMemo(
    () => outstandingTxns.filter(t => t.is_installment),
    [outstandingTxns],
  );
  const openInstallmentCount = openInstallments.length;
  const openInstallmentTotal = useMemo(
    () => openInstallments.reduce((s, t) => s + Number(t.amount), 0),
    [openInstallments],
  );

  const availableLimit = currentCard
    ? Math.max(0, Number(currentCard.credit_limit) - committedTotal)
    : 0;

  const committedLimitPercent = currentCard
    ? Math.min(100, (committedTotal / Math.max(Number(currentCard.credit_limit), 1)) * 100)
    : 0;

  // "Próximo vencimento" = due date of the next bill that still has an open
  // balance (earliest unpaid bill_month). If everything is paid, fall back to
  // the selected month. This avoids showing a stale/far-future due date.
  const nextOpenBillMonth = useMemo(() => {
    const openMonths = outstandingTxns
      .map(t => t.bill_month)
      .filter(Boolean)
      .sort();
    return openMonths[0] ?? billMonth;
  }, [outstandingTxns, billMonth]);

  const billDueDate = useMemo(() => {
    if (!currentCard) return null;
    const [year, month] = nextOpenBillMonth.split('-').map(Number);
    if (!year || !month) return null;
    const dueMonthOffset = Number(currentCard.due_day) <= Number(currentCard.closing_day) ? 1 : 0;
    return new Date(year, month - 1 + dueMonthOffset, Number(currentCard.due_day));
  }, [nextOpenBillMonth, currentCard]);

  const daysUntilDue = useMemo(() => {
    if (!billDueDate) return 0;
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const due = new Date(billDueDate.getFullYear(), billDueDate.getMonth(), billDueDate.getDate());
    return Math.ceil((due.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }, [billDueDate]);

  const timelineBills = useMemo(() => {
    return Array.from({ length: 6 }, (_, index) => {
      const month = addMonths(billMonth, index);
      const monthTxns = month === billMonth
        ? transactions
        : selectedFutureTxns.filter(t => t.bill_month === month);
      const total = monthTxns.reduce((s, t) => s + Number(t.amount), 0);
      const paid = monthTxns.filter(t => t.paid).reduce((s, t) => s + Number(t.amount), 0);
      return {
        month,
        total,
        paid,
        open: Math.max(0, total - paid),
        count: monthTxns.length,
      };
    });
  }, [billMonth, transactions, selectedFutureTxns]);

  const normalizedTxSearch = txSearch.trim().toLowerCase();
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const cat = categories.find(c => c.id === t.category_id);
      const matchesFilter =
        txFilter === 'all' ||
        (txFilter === 'pending' && !t.paid) ||
        (txFilter === 'paid' && t.paid) ||
        (txFilter === 'installments' && t.is_installment) ||
        (txFilter === 'uncategorized' && !t.category_id);

      if (!matchesFilter) return false;
      if (!normalizedTxSearch) return true;

      const haystack = [
        t.description,
        cat?.name ?? 'Sem categoria',
        String(Number(t.amount).toFixed(2)).replace('.', ','),
        formatDate(t.date),
      ].join(' ').toLowerCase();

      return haystack.includes(normalizedTxSearch);
    });
  }, [transactions, categories, txFilter, normalizedTxSearch]);

  const openTransactions = filteredTransactions.filter(t => !t.paid);
  const paidTransactions = filteredTransactions.filter(t => t.paid);

  const numericAmount = parseFloat(newTx.amount.replace(',', '.')) || 0;

  const newTxBillMonth = useMemo(() => {
    if (!currentCard) return billMonth;
    return calcBillMonth(newTx.date, Number(currentCard.closing_day));
  }, [currentCard, newTx.date, billMonth]);

  const newTxBillLabel = useMemo(() => monthLabel(newTxBillMonth), [newTxBillMonth]);

  const categorySummary = useMemo(() => {
    const map = new Map<string, { id: string; name: string; icon: string; total: number }>();
    for (const t of transactions) {
      const cat = categories.find(c => c.id === t.category_id);
      const key = cat?.id ?? '__uncategorized__';
      const current = map.get(key) ?? {
        id: key,
        name: cat?.name ?? 'Sem categoria',
        icon: cat?.icon ?? '○',
        total: 0,
      };
      current.total += Number(t.amount);
      map.set(key, current);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [transactions, categories]);

  const topCategoryTotal = Math.max(1, ...categorySummary.map(c => c.total));

  const handleAddCard = async () => {
    if (!newCard.name.trim()) return toast.error('Informe o nome do cartão');
    try {
      // Optimistically use a temporary id for the localStorage write later
      await addCard.mutateAsync({
        name: newCard.name,
        color: newCard.color,
        credit_limit: parseFloat(newCard.credit_limit) || 0,
        closing_day: parseInt(newCard.closing_day) || 1,
        due_day: parseInt(newCard.due_day) || 10,
        icon: '💳',
      });
      // The newest card by name is the one we just created — find it after the query refresh
      // (We can't get the new id from the mutation result without changing the hook signature.)
      // Instead, rely on the next render to find it; persist a pending mapping.
      if (newCard.payment_account_id) {
        // Store pending payment account by name+createdAt; we'll resolve on next render
        try { localStorage.setItem('cc_pending_default_account', JSON.stringify({ name: newCard.name, accountId: newCard.payment_account_id })); }
        catch (storageErr) { console.warn('Nao foi possivel salvar a conta padrao pendente', storageErr); }
      }
      toast.success('Cartão adicionado!');
      setShowNewCard(false);
      setNewCard({ name: '', color: CARD_COLORS[0], credit_limit: '', closing_day: '10', due_day: '17', payment_account_id: '' });
    } catch (e) { toast.error((e as Error).message); }
  };

  const openEditCard = (card: CreditCardRow) => {
    setEditingCard(card);
    setEditCardForm({
      name: card.name,
      color: card.color,
      credit_limit: String(Number(card.credit_limit) || ''),
      closing_day: String(card.closing_day),
      due_day: String(card.due_day),
      payment_account_id: getCardDefaultAccount(card.id) || '',
    });
  };

  const handleSaveEditCard = async () => {
    if (!editingCard) return;
    if (!editCardForm.name.trim()) return toast.error('Informe o nome do cartão');
    try {
      await updateCard.mutateAsync({
        id: editingCard.id,
        data: {
          name: editCardForm.name.trim(),
          color: editCardForm.color,
          credit_limit: parseFloat(editCardForm.credit_limit) || 0,
          closing_day: parseInt(editCardForm.closing_day) || 1,
          due_day: parseInt(editCardForm.due_day) || 10,
        },
      });
      // Persist / clear the default payment account binding
      setCardDefaultAccount(editingCard.id, editCardForm.payment_account_id || null);
      setDefaultAcctBump(b => b + 1);
      toast.success('Cartão atualizado!');
      setEditingCard(null);
    } catch (e) { toast.error((e as Error).message); }
  };

  const handleDeleteCard = async () => {
    if (!confirmDeleteCard) return;
    try {
      await deleteCard.mutateAsync(confirmDeleteCard.id);
      setCardDefaultAccount(confirmDeleteCard.id, null);
      if (selectedCard === confirmDeleteCard.id) {
        setSelectedCard(cards.find(c => c.id !== confirmDeleteCard.id)?.id ?? null);
      }
      toast.success(`Cartão "${confirmDeleteCard.name}" removido.`);
      setConfirmDeleteCard(null);
      setEditingCard(null);
    } catch (e) { toast.error((e as Error).message); }
  };

  // Resolve pending default-account mapping after card creation
  useEffect(() => {
    try {
      const raw = localStorage.getItem('cc_pending_default_account');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const justCreated = cards.find(c => c.name === parsed.name && !getCardDefaultAccount(c.id));
      if (justCreated) {
        setCardDefaultAccount(justCreated.id, parsed.accountId);
        localStorage.removeItem('cc_pending_default_account');
        setDefaultAcctBump(b => b + 1);
      }
    } catch (storageErr) {
      console.warn('Nao foi possivel resolver a conta padrao pendente', storageErr);
    }
  }, [cards]);

  // Apply default payment account to ALL existing CC data for a card.
  // This is a complete backfill that:
  //  1. Sets account_id on all CC mirror expenses for this card (so balance counts them)
  //  2. Syncs mirror status with the linked CC tx's paid flag (paid → concluido,
  //     so the balance hook actually deducts it; otherwise mirrors stay pendente and
  //     don't affect balance)
  //  3. Removes any old [FATURA_CARTAO] expenses for this card name to avoid
  //     double-counting (they were created by the legacy "Pagar Fatura" flow and
  //     are now superseded by the per-item mirrors)
  // Apply default payment account to ALL existing CC data for a card.
  // Enhanced to also CREATE mirror expenses for old transactions that have none.
  // This fully reconciles the bank balance with the CC history.
  const applyDefaultAccountToHistory = async (cardId: string) => {
    const accountId = getCardDefaultAccount(cardId);
    if (!accountId) { toast.error('Configure a conta padrão primeiro'); return; }
    const card = cards.find(c => c.id === cardId);
    if (!card || !user) return;

    try {
      // Step 1: fetch ALL CC transactions for this card
      const { data: ccTxData, error: ccTxErr } = await supabase
        .from('credit_card_transactions')
        .select('id, description, amount, date, bill_month, category_id, notes, paid, deleted_at')
        .eq('credit_card_id', cardId);
      if (ccTxErr) throw ccTxErr;
      const allCcTxs = (ccTxData || []).filter(tx => !tx.deleted_at);

      // Step 2: find all existing CC mirror expenses for this card
      const { data: mirrors, error: selErr } = await supabase
        .from('expenses')
        .select('id, notes, account_id, status')
        .like('notes', `%card:${cardId}%`);
      if (selErr) throw selErr;
      const mirrorList = mirrors || [];

      // Build set of CC tx ids that already have a mirror expense
      const mirroredTxIds = new Set<string>();
      for (const m of mirrorList) {
        const match = m.notes?.match(/tx:([^|\]\s]+)/);
        if (match) mirroredTxIds.add(match[1]);
      }

      // Step 3: create mirror expenses for old CC transactions that have NO mirror
      const txsWithoutMirror = allCcTxs.filter(tx => !mirroredTxIds.has(tx.id));
      let created = 0;
      if (txsWithoutMirror.length > 0) {
        const newExpenses = txsWithoutMirror.map(tx => {
          const cardMarker = `[Cartao de credito|card:${cardId}|bill:${tx.bill_month}|tx:${tx.id}]`;
          const baseNote = (tx.notes as string | null)?.trim();
          return {
            user_id: user.id,
            date: tx.date as string,
            description: tx.description as string,
            amount: tx.amount as number,
            category_id: (tx.category_id as string | null) ?? null,
            account_id: accountId,
            // Paid CC tx → concluido (deducts from balance); unpaid → pendente (doesn't)
            status: tx.paid ? 'concluido' : 'pendente',
            notes: baseNote ? `${cardMarker} ${baseNote}` : cardMarker,
          };
        });
        const { error: createErr } = await supabase.from('expenses').insert(newExpenses);
        if (createErr) throw createErr;
        created = txsWithoutMirror.length;
      }

      // Step 4: set account_id on existing mirrors that don't have one yet
      const idsNeedingAccount = mirrorList
        .filter(m => !m.account_id)
        .map(m => m.id);
      if (idsNeedingAccount.length > 0) {
        await supabase
          .from('expenses')
          .update({ account_id: accountId })
          .in('id', idsNeedingAccount);
      }

      // Step 5: sync status of existing mirrors based on their CC tx paid flag
      const mirrorTxMap: Array<{ mirrorId: string; txId: string }> = [];
      for (const m of mirrorList) {
        const match = m.notes?.match(/tx:([^|\]\s]+)/);
        if (match) mirrorTxMap.push({ mirrorId: m.id, txId: match[1] });
      }

      let statusUpdated = 0;
      if (mirrorTxMap.length > 0) {
        const txIds = Array.from(new Set(mirrorTxMap.map(p => p.txId)));
        const { data: ccTxs } = await supabase
          .from('credit_card_transactions')
          .select('id, paid')
          .in('id', txIds);

        const paidSet = new Set((ccTxs || []).filter(t => t.paid).map(t => t.id));
        const mirrorsToConcluir = mirrorTxMap.filter(p => paidSet.has(p.txId)).map(p => p.mirrorId);
        const mirrorsToPendente = mirrorTxMap.filter(p => !paidSet.has(p.txId)).map(p => p.mirrorId);

        if (mirrorsToConcluir.length > 0) {
          await supabase.from('expenses').update({ status: 'concluido' }).in('id', mirrorsToConcluir);
          statusUpdated += mirrorsToConcluir.length;
        }
        if (mirrorsToPendente.length > 0) {
          await supabase.from('expenses').update({ status: 'pendente' }).in('id', mirrorsToPendente);
        }
      }

      // Step 6: remove legacy [FATURA_CARTAO] single-payment expenses to avoid double-counting
      const { data: oldBillPayments } = await supabase
        .from('expenses')
        .select('id, notes')
        .like('notes', '%[FATURA_CARTAO]%');

      const billPaymentsToDelete = (oldBillPayments || [])
        .filter(e => e.notes?.includes(card.name))
        .map(e => e.id);

      if (billPaymentsToDelete.length > 0) {
        await supabase.from('expenses').delete().in('id', billPaymentsToDelete);
      }

      const parts: string[] = [];
      if (created > 0) parts.push(`${created} transação(ões) antiga(s) sincronizada(s)`);
      if (idsNeedingAccount.length > 0) parts.push(`${idsNeedingAccount.length} mirror(s) com conta`);
      if (statusUpdated > 0) parts.push(`${statusUpdated} status sincronizado(s)`);
      if (billPaymentsToDelete.length > 0) parts.push(`${billPaymentsToDelete.length} duplicata(s) removida(s)`);
      toast.success(parts.length > 0 ? `✅ ${parts.join(' · ')}` : 'Tudo já estava em ordem ✓');

      queryClientCC.invalidateQueries({ queryKey: ['expenses'] });
      queryClientCC.invalidateQueries({ queryKey: ['accumulated-balance'] });
      queryClientCC.invalidateQueries({ queryKey: ['cc-transactions'] });
    } catch (e) { toast.error((e as Error).message); }
  };

  const handleAddTx = async () => {
    if (!selectedCard) return toast.error('Selecione um cartão');
    if (refundMode && !refundTxId) return toast.error('Escolha a compra que será reembolsada');
    if (!newTx.description || !newTx.amount) return toast.error('Preencha descrição e valor');
    try {
      if (refundMode) {
        // Estorno/Reembolso: a NEGATIVE transaction on the chosen (usually open) fatura.
        // It abate o valor da fatura; quando a fatura for paga, o saldo é debitado de menos
        // (o espelho negativo devolve o valor à conta), batendo com o crédito real do banco.
        const desc = /estorno|reembolso|estorn/i.test(newTx.description) ? newTx.description : `Estorno: ${newTx.description}`;
        await addTx.mutateAsync({
          credit_card_id: selectedCard,
          description: desc,
          amount: -Math.abs(numericAmount),
          amount_mode: 'total',
          date: newTx.date,
          bill_month: newTxBillMonth,
          category_id: newTx.category_id || null,
          installments: 1,
          notes: `[ESTORNO]${newTx.notes ? ` ${newTx.notes}` : ''}`,
        });
        toast.success(`Estorno de ${fmt(Math.abs(numericAmount))} creditado na fatura de ${newTxBillLabel}!`);
      } else {
        await addTx.mutateAsync({
          credit_card_id: selectedCard,
          description: newTx.description,
          amount: numericAmount,
          amount_mode: 'total',
          date: newTx.date,
          bill_month: newTxBillMonth,
          category_id: newTx.category_id || null,
          installments: parseInt(newTx.installments) || 1,
          notes: newTx.notes || undefined,
        });
        const n = parseInt(newTx.installments);
        toast.success(n > 1 ? `${n}x lançado! Primeira fatura: ${newTxBillLabel}` : `Lançado na fatura de ${newTxBillLabel}!`);
      }
      setShowNewTx(false);
      setRefundMode(false);
      setRefundTxId('');
      setRefundPartial(false);
      setNewTx({ description: '', amount: '', date: new Date().toISOString().split('T')[0], category_id: '', installments: '1', notes: '' });
    } catch (e) { toast.error((e as Error).message); }
  };

  // Default payment account per card — remembered in localStorage so future
  // payments use the same account without re-asking.
  const openEditTx = (tx: CreditCardTransaction) => {
    setEditingTx(tx);
    setEditTx({
      description: tx.description || '',
      amount: Number(tx.amount).toFixed(2),
      date: tx.date,
      category_id: tx.category_id || '',
    });
  };

  const handleSaveEditTx = async () => {
    if (!editingTx) return;
    const amount = parseFloat(editTx.amount.replace(',', '.'));
    if (!editTx.description.trim()) return toast.error('Informe a descrição');
    if (!amount || amount <= 0) return toast.error('Informe um valor válido');
    if (!editTx.date) return toast.error('Informe a data');

    try {
      await updateTx.mutateAsync({
        id: editingTx.id,
        description: editTx.description.trim(),
        amount,
        date: editTx.date,
        bill_month: currentCard ? calcBillMonth(editTx.date, Number(currentCard.closing_day)) : editingTx.bill_month,
        category_id: editTx.category_id || null,
      });
      toast.success('Compra atualizada e dashboard sincronizada');
      setEditingTx(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const defaultPayAccountKey = (cardId: string) => `cc_default_pay_account_${cardId}`;
  const getDefaultPayAccount = (cardId: string): string => {
    try { return localStorage.getItem(defaultPayAccountKey(cardId)) || ''; }
    catch { return ''; }
  };
  const setDefaultPayAccount = (cardId: string, accountId: string) => {
    try { localStorage.setItem(defaultPayAccountKey(cardId), accountId); }
    catch (storageErr) { console.warn('Nao foi possivel salvar a conta padrao do cartao', storageErr); }
  };

  // Open Pay Bill dialog with smart defaults
  const openPayBill = () => {
    if (!currentCard) return;
    setPayBillAccountId(getDefaultPayAccount(currentCard.id) || (accounts.find(a => !a.archived)?.id ?? ''));
    setShowPayBill(true);
  };

  // Pay the whole open bill. SINGLE accounting model: marking each item as paid
  // flips its mirror expense to "concluido" (and assigns the chosen account if
  // it had none), which debits the bank balance EXACTLY ONCE. We never create a
  // separate [FATURA_CARTAO] expense — doing both was what double-counted the
  // bill against the balance.
  const handlePayBill = async () => {
    if (!currentCard) return;
    const accountId = payBillAccountId
      || getCardDefaultAccount(currentCard.id)
      || (accounts.find(a => !a.archived)?.id ?? '');
    if (!accountId) { toast.error('Selecione a conta de pagamento'); return; }
    try {
      const unpaid = transactions.filter(t => !t.paid);
      await Promise.all(unpaid.map(t => togglePaid.mutateAsync({ id: t.id, paid: true, accountId })));
      // Remember the account so future payments + new purchases stay consistent.
      setDefaultPayAccount(currentCard.id, accountId);
      setCardDefaultAccount(currentCard.id, accountId);
      const acctName = accounts.find(a => a.id === accountId)?.name ?? 'conta';
      toast.success(`Fatura paga! ${unpaid.length} item(ns) debitado(s) de ${acctName}.`);
      setShowPayBill(false);
    } catch (e) { toast.error((e as Error).message); }
  };

  // Per-item check.
  // If the card has a default payment account configured, just toggle —
  // the togglePaid hook automatically updates the mirror expense's status,
  // and the mirror already has account_id set so the bank balance reflects
  // it correctly.
  // If no default, open dialog asking which account.
  const handleItemCheckboxClick = (t: { id: string; paid: boolean; description: string; amount: number }) => {
    if (!currentCard) return;
    // Un-marking is always instant.
    if (t.paid) {
      togglePaid.mutate({ id: t.id, paid: false });
      return;
    }
    const def = getCardDefaultAccount(currentCard.id);
    if (def) {
      // Has a default payment account — pay instantly via the mirror.
      togglePaid.mutate({ id: t.id, paid: true, accountId: def });
      return;
    }
    // No default account yet: ask which account to debit (and remember it).
    setPayItem({ id: t.id, description: t.description, amount: Number(t.amount) });
    setPayItemAccountId(getDefaultPayAccount(currentCard.id) || (accounts.find(a => !a.archived)?.id ?? ''));
  };

  // Confirm paying a single item. Same single-model rule: flip the mirror to
  // paid with the chosen account. No separate [FATURA_CARTAO_ITEM] expense.
  const handleConfirmItemPayment = async () => {
    if (!payItem || !currentCard) return;
    if (!payItemAccountId) { toast.error('Selecione a conta'); return; }
    try {
      await togglePaid.mutateAsync({ id: payItem.id, paid: true, accountId: payItemAccountId });
      setDefaultPayAccount(currentCard.id, payItemAccountId);
      setCardDefaultAccount(currentCard.id, payItemAccountId);
      toast.success(`Pago: ${fmt(payItem.amount)} debitado da conta`);
      setPayItem(null);
    } catch (e) { toast.error((e as Error).message); }
  };

  const filterOptions: Array<{ id: TxFilter; label: string }> = [
    { id: 'all', label: 'Todas' },
    { id: 'pending', label: 'Em aberto' },
    { id: 'paid', label: 'Pagas' },
    { id: 'installments', label: 'Parceladas' },
    { id: 'uncategorized', label: 'Sem categoria' },
  ];

  const renderTransactionRow = (t: typeof transactions[number]) => {
    const cat = categories.find(c => c.id === t.category_id);
    const categoryName = cat?.name ?? 'Sem categoria';
    const categoryIcon = cat?.icon ?? '○';
    const isPaid = Boolean(t.paid);

    return (
      <div
        key={t.id}
        className={cn(
          'grid grid-cols-[auto_1fr] gap-3 rounded-2xl border px-3 py-3 transition-all sm:grid-cols-[auto_minmax(0,1.3fr)_120px_150px_90px_auto] sm:items-center',
          isPaid
            ? 'border-emerald-400/15 bg-emerald-400/[0.055] shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]'
            : 'border-border/40 dark:border-white/[0.08] bg-muted/40 dark:bg-white/[0.025] hover:border-primary/25 hover:bg-muted/50 dark:bg-white/[0.045]',
        )}
      >
        <button
          onClick={() => handleItemCheckboxClick({ id: t.id, paid: t.paid, description: t.description, amount: Number(t.amount) })}
          title={isPaid ? 'Desmarcar como pago' : 'Marcar como pago'}
          className={cn(
            'mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border transition-all sm:mt-0',
            isPaid
              ? 'border-emerald-300/60 bg-emerald-400 text-slate-950 shadow-sm shadow-emerald-500/20'
              : 'border-slate-500/60 bg-slate-950/60 hover:border-primary hover:bg-primary/15',
          )}
        >
          {isPaid && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
        </button>

        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-border/60 dark:border-white/10 bg-muted/50 dark:bg-slate-900/80 text-sm">
              {categoryIcon}
            </span>
            <div className="min-w-0">
              <p className={cn('truncate text-sm font-extrabold tracking-tight', isPaid ? 'text-foreground/70 line-through' : 'text-foreground')}>
                {t.description}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-muted-foreground sm:hidden">
                {formatDate(t.date)} · {categoryName}
              </p>
            </div>
          </div>
        </div>

        <p className="col-start-2 text-xs font-semibold text-muted-foreground dark:text-slate-400 sm:col-auto">
          {formatDate(t.date)}
        </p>

        <div className="col-start-2 min-w-0 sm:col-auto">
          <select
            value={t.category_id ?? ''}
            onChange={(e) => updateTx.mutate({ id: t.id, category_id: e.target.value || null })}
            onClick={(e) => e.stopPropagation()}
            className="max-w-full cursor-pointer rounded-full border border-border/60 dark:border-white/10 bg-muted/30 dark:bg-slate-950/70 px-2.5 py-1 text-[11px] font-semibold text-foreground/80 dark:text-slate-300 outline-none transition-colors hover:border-primary/35"
            style={{ fontFamily: 'inherit' }}
          >
            <option value="">Sem categoria</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>
        </div>

        <div className="col-start-2 flex flex-wrap gap-1.5 sm:col-auto">
          {t.is_installment && (
            <span className="rounded-full border border-primary/25 bg-primary/15 px-2 py-0.5 text-[11px] font-extrabold text-primary dark:text-primary">
              {t.installment_number}/{t.total_installments}x
            </span>
          )}
          {t.is_recurring && (
            <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-2 py-0.5 text-[11px] font-extrabold text-amber-600 dark:text-amber-200">
              Recorrente
            </span>
          )}
        </div>

        <div className="col-start-2 flex items-center justify-between gap-3 sm:col-auto sm:justify-end">
          <span className={cn('currency text-sm font-black tabular-nums', Number(t.amount) < 0 ? 'text-income' : isPaid ? 'text-emerald-600 dark:text-emerald-600 dark:text-emerald-200' : 'text-foreground')}>
            {Number(t.amount) < 0 ? `− ${fmt(Math.abs(Number(t.amount)))}` : fmt(Number(t.amount))}
          </span>
          <div className="flex items-center gap-1 sm:hidden">
            <button
              onClick={() => openEditTx(t)}
              title="Editar compra"
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => deleteTx.mutate(t.id)}
              title="Excluir compra"
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-600 dark:text-red-300"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="hidden items-center justify-end gap-1 sm:flex">
          <button
            onClick={() => openEditTx(t)}
            title="Editar compra"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => deleteTx.mutate(t.id)}
            title="Excluir compra"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-600 dark:text-red-300"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="relative overflow-hidden rounded-3xl border border-border/60 dark:border-white/10 bg-card dark:bg-[#070a12] p-3 shadow-xl shadow-black/30 sm:rounded-[2rem] sm:p-6 xl:p-7">
        <div className="pointer-events-none absolute -right-28 -top-28 h-72 w-72 rounded-full bg-primary/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,hsl(var(--primary)/0.18),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.05),transparent_42%)]" />

        <div className="relative z-10 flex flex-col gap-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/15 shadow-inner shadow-primary/10">
                <CreditCard className="h-7 w-7 text-primary dark:text-primary" />
              </div>
              <div className="min-w-0">
                <p className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-primary dark:text-primary/80">
                  <Sparkles className="h-3.5 w-3.5" /> Central de cartões
                </p>
                <h1 className="truncate text-xl font-black tracking-tight text-foreground sm:text-3xl lg:text-4xl">Cartões de Crédito</h1>
                <p className="mt-1.5 text-sm font-medium text-muted-foreground dark:text-slate-400">
                  {currentCard
                    ? <><span className="font-extrabold text-primary dark:text-primary">{currentCard.name}</span> · fecha dia {currentCard.closing_day} · vence dia {currentCard.due_day}</>
                    : 'Cadastre um cartão para acompanhar faturas, limite e parcelas.'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
              <Button
                variant="outline"
                onClick={() => setShowAnalytics(true)}
                className="col-span-2 h-11 rounded-xl border-primary/30 bg-primary/10 px-4 text-primary hover:bg-primary/15 sm:col-span-1"
              >
                <BarChart3 className="mr-2 h-4 w-4" /> Análises
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowNewCard(true)}
                className="h-11 rounded-xl border-border/60 dark:border-white/10 bg-muted/50 dark:bg-white/[0.035] px-4 text-foreground hover:bg-muted/60 dark:bg-white/[0.07]"
              >
                <Plus className="mr-2 h-4 w-4" /> Novo cartão
              </Button>
              <Button
                onClick={() => setShowNewTx(true)}
                disabled={!selectedCard}
                className="h-11 rounded-xl bg-primary px-4 text-white shadow-lg shadow-primary/25 hover:bg-primary disabled:opacity-50"
              >
                <Plus className="mr-2 h-4 w-4" /> Nova compra
              </Button>
            </div>
          </div>

          {cards.length > 0 && (
            <div className="overflow-x-auto pb-1">
              <div className="flex min-w-max gap-3 pr-2">
                {cards.map((card) => {
                  const isSelected = selectedCard === card.id;
                  const brand = cardBrand(card);
                  // Dívida comprometida = TODAS as não pagas (inclui atrasadas),
                  // igual ao card de detalhe (useCardOutstanding). Antes usava
                  // futureTxns (só bill_month >= mês atual) e divergia.
                  const cardCommitment = allOutstandingTxns
                    .filter(t => t.credit_card_id === card.id)
                    .reduce((s, t) => s + Number(t.amount), 0);
                  const cardUsage = Math.min(100, Math.max(0, (cardCommitment / Math.max(Number(card.credit_limit), 1)) * 100));

                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => setSelectedCard(card.id)}
                      className={cn(
                        'group relative h-[100px] w-[210px] sm:h-[104px] sm:w-[230px] overflow-hidden rounded-2xl border p-3 sm:p-4 text-left transition-all',
                        isSelected
                          ? 'border-2 shadow-xl'
                          : 'border-border/60 dark:border-white/10 bg-muted/50 dark:bg-white/[0.035] hover:bg-muted/70 dark:hover:bg-white/[0.06]',
                      )}
                      style={isSelected ? { borderColor: brand.color, backgroundColor: `${brand.color}14` } : undefined}
                    >
                      <div className="absolute -right-8 -top-12 h-28 w-28 rounded-full opacity-30 blur-xl" style={{ backgroundColor: brand.color }} />
                      <div className="relative flex h-full flex-col justify-between">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span
                              className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/60 dark:border-white/10 shadow-inner"
                              style={{ backgroundColor: brand.logoUrl ? '#fff' : brand.color }}
                            >
                              {brand.logoUrl ? (
                                <img src={brand.logoUrl} alt={card.name} className="h-5 w-5 object-contain" />
                              ) : (
                                <CreditCard className="h-[18px] w-[18px] text-white" />
                              )}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-foreground">{card.name}</p>
                              <p className="truncate whitespace-nowrap text-[11px] font-semibold text-muted-foreground">{cardUsage.toFixed(0)}% comprometido</p>
                            </div>
                          </div>
                          {isSelected && <Check className="h-4 w-4 shrink-0" style={{ color: brand.color }} />}
                        </div>
                        <div className="space-y-1.5">
                          <div className="h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                            <div className="h-full rounded-full" style={{ width: `${cardUsage}%`, backgroundColor: brand.color }} />
                          </div>
                          <div className="flex justify-between text-[11px] font-bold text-muted-foreground dark:text-slate-400">
                            <span>{fmt(cardCommitment)}</span>
                            <span>{fmt(Number(card.credit_limit))}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}

                {/* Add card chip */}
                <button
                  type="button"
                  onClick={() => setShowNewCard(true)}
                  className="flex h-[100px] w-[120px] sm:h-[104px] shrink-0 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-border/60 dark:border-white/15 text-muted-foreground transition-all hover:border-primary/50 hover:text-primary"
                >
                  <Plus className="h-5 w-5" />
                  <span className="text-xs font-bold">Novo cartão</span>
                </button>
              </div>
            </div>
          )}

          {currentCard && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-border/60 dark:border-white/10 bg-muted/50 dark:bg-white/[0.045] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl">
                <div className="mb-3 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary dark:text-primary"><Receipt className="h-5 w-5" /></span>
                  <p className="text-sm font-bold text-foreground/80 dark:text-slate-300">Fatura atual</p>
                </div>
                <p className="currency text-lg sm:text-2xl font-black text-foreground tabular-nums truncate">{fmt(billTotal)}</p>
                <p className="mt-1 text-sm font-extrabold text-amber-600 dark:text-amber-300">{fmt(unpaidTotal)} em aberto</p>
              </div>

              <div className="rounded-2xl border border-border/60 dark:border-white/10 bg-muted/50 dark:bg-white/[0.045] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl">
                <div className="mb-3 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"><Wallet className="h-5 w-5" /></span>
                  <p className="text-sm font-bold text-foreground/80 dark:text-slate-300">Limite disponível</p>
                </div>
                <p className="currency text-lg sm:text-2xl font-black text-emerald-600 dark:text-emerald-300 tabular-nums truncate">{fmt(availableLimit)}</p>
                <p className="mt-1 text-sm font-semibold text-muted-foreground dark:text-slate-400">{Math.max(0, 100 - committedLimitPercent).toFixed(0)}% livre</p>
              </div>

              <div className="rounded-2xl border border-border/60 dark:border-white/10 bg-muted/50 dark:bg-white/[0.045] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl">
                <div className="mb-3 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary dark:text-primary"><CalendarDays className="h-5 w-5" /></span>
                  <p className="text-sm font-bold text-foreground/80 dark:text-slate-300">Próximo vencimento</p>
                </div>
                <p className="text-lg sm:text-2xl font-black text-foreground tabular-nums">
                  {billDueDate ? billDueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '') : '--'}
                </p>
                <p className={cn('mt-1 text-sm font-semibold', daysUntilDue < 0 ? 'text-red-600 dark:text-red-300' : daysUntilDue <= 7 ? 'text-amber-600 dark:text-amber-300' : 'text-muted-foreground dark:text-slate-400')}>
                  {daysUntilDue < 0 ? `venceu há ${Math.abs(daysUntilDue)} dias` : `faltam ${daysUntilDue} dias`}
                </p>
              </div>

              <div className="rounded-2xl border border-border/60 dark:border-white/10 bg-muted/50 dark:bg-white/[0.045] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl">
                <div className="mb-3 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-500/15 text-foreground/80 dark:text-slate-200"><Layers3 className="h-5 w-5" /></span>
                  <p className="text-sm font-bold text-foreground/80 dark:text-slate-300">Parcelas futuras</p>
                </div>
                <p className="text-lg sm:text-2xl font-black text-foreground tabular-nums">{openInstallmentCount}</p>
                <p className="mt-1 text-sm font-semibold text-muted-foreground dark:text-slate-400">
                  {openInstallmentCount === 0 ? 'nenhuma a vencer' : `a vencer · ${fmt(openInstallmentTotal)}`}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-primary/30 bg-primary/[0.035] px-6 py-16 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl border border-primary/20 bg-primary/10">
            <CreditCard className="h-10 w-10 text-primary dark:text-primary/70" />
          </div>
          <p className="text-lg font-black text-foreground">Nenhum cartão cadastrado</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground dark:text-slate-400">Adicione seu primeiro cartão para controlar faturas, parcelas e limite em um só lugar.</p>
          <Button onClick={() => setShowNewCard(true)} className="mt-5 rounded-xl bg-primary text-white hover:bg-primary">
            <Plus className="mr-2 h-4 w-4" /> Adicionar cartão
          </Button>
        </div>
      ) : currentCard ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-5">
            <section className="rounded-[1.75rem] border border-border/60 dark:border-white/10 bg-card/95 dark:bg-[#090d16]/95 p-4 shadow-xl shadow-black/20 backdrop-blur-xl sm:p-5">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black tracking-tight text-foreground">Linha do tempo das faturas</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Total, pago e aberto por mês. Ao pagar, o aberto diminui aqui também.</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button onClick={() => setBillMonth(prevMonth(billMonth))} className="rounded-xl border border-border/60 dark:border-white/10 bg-muted/50 dark:bg-white/[0.035] p-2 text-foreground/80 dark:text-slate-300 transition-colors hover:bg-muted/60 dark:bg-white/[0.07]"><ChevronLeft className="h-4 w-4" /></button>
                  <button onClick={() => setBillMonth(nextMonth(billMonth))} className="rounded-xl border border-border/60 dark:border-white/10 bg-muted/50 dark:bg-white/[0.035] p-2 text-foreground/80 dark:text-slate-300 transition-colors hover:bg-muted/60 dark:bg-white/[0.07]"><ChevronRight className="h-4 w-4" /></button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3 2xl:grid-cols-6">
                {timelineBills.map((item) => {
                  const isSelected = item.month === billMonth;
                  const isCurrent = item.month === getMonthYear();
                  return (
                    <button
                      key={item.month}
                      type="button"
                      onClick={() => setBillMonth(item.month)}
                      className={cn(
                        'relative overflow-hidden rounded-2xl border p-4 text-left transition-all',
                        isSelected
                          ? 'border-primary/60 bg-primary/15 shadow-lg shadow-primary/30'
                          : 'border-border/60 dark:border-white/10 bg-muted/40 dark:bg-white/[0.03] hover:border-primary/30 hover:bg-muted/50 dark:bg-white/[0.05]',
                      )}
                    >
                      <div className="absolute -bottom-8 -right-8 h-20 w-20 rounded-full bg-primary/10 blur-2xl" />
                      <div className="relative space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-base font-black text-foreground">{shortMonthLabel(item.month)}</p>
                          {isCurrent && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">Atual</span>}
                        </div>
                        <div>
                          <p className="currency text-lg font-black text-foreground tabular-nums">{fmt(item.total)}</p>
                          <p className="mt-1 text-[11px] font-semibold text-muted-foreground">{item.count} compra{item.count === 1 ? '' : 's'}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-bold">
                          <span className="text-emerald-600 dark:text-emerald-300">Pago {fmt(item.paid)}</span>
                          <span className="text-right text-amber-600 dark:text-amber-300">Aberto {fmt(item.open)}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-border/60 dark:border-white/10 bg-card/95 dark:bg-[#090d16]/95 p-4 shadow-xl shadow-black/20 backdrop-blur-xl sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-2xl font-black capitalize tracking-tight text-foreground">{monthLabel(billMonth)}</h2>
                  <p className="mt-2 text-sm font-semibold text-muted-foreground dark:text-slate-400">
                    <span className="text-emerald-600 dark:text-emerald-300">Pago {fmt(paidTotal)}</span>
                    <span className="mx-2 text-muted-foreground/70">•</span>
                    <span className="text-amber-600 dark:text-amber-300">Em aberto {fmt(unpaidTotal)}</span>
                    <span className="mx-2 text-muted-foreground/70">•</span>
                    <span>{transactions.length} compra{transactions.length === 1 ? '' : 's'}</span>
                  </p>
                </div>
                <div className="lg:text-right">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Total da fatura</p>
                  <p className="currency mt-1 text-3xl font-black text-red-600 dark:text-red-300 tabular-nums">{fmt(billTotal)}</p>
                </div>
              </div>

              <div className="mt-5 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-muted-foreground dark:text-slate-400">
                  <span>Fatura do mês — {fmt(Math.max(0, billTotal))} de {fmt(Number(currentCard.credit_limit))}</span>
                  <span className={cn('font-black', limitUsagePercent > 80 ? 'text-red-600 dark:text-red-300' : limitUsagePercent > 50 ? 'text-amber-600 dark:text-amber-300' : 'text-emerald-600 dark:text-emerald-300')}>{limitUsagePercent.toFixed(0)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted/70 dark:bg-white/[0.08]">
                  <div
                    className={cn('h-full rounded-full transition-all', limitUsagePercent > 80 ? 'bg-red-400' : limitUsagePercent > 50 ? 'bg-amber-300' : 'bg-emerald-400')}
                    style={{ width: `${limitUsagePercent}%` }}
                  />
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {filterOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setTxFilter(option.id)}
                      className={cn(
                        'shrink-0 rounded-xl border px-3.5 py-2 text-sm font-bold transition-colors',
                        txFilter === option.id
                          ? 'border-primary/50 bg-primary text-white shadow-lg shadow-primary/20'
                          : 'border-border/60 dark:border-white/10 bg-muted/40 dark:bg-white/[0.025] text-foreground/80 dark:text-slate-300 hover:bg-white/[0.055]',
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <div className="relative w-full lg:max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={txSearch}
                    onChange={(e) => setTxSearch(e.target.value)}
                    placeholder="Buscar compra, categoria ou valor..."
                    className="h-11 rounded-xl border-border/60 dark:border-white/10 bg-muted/30 dark:bg-slate-950/70 pl-9 text-sm text-foreground placeholder:text-muted-foreground/70 focus-visible:ring-primary/60"
                  />
                </div>
              </div>

              {transactions.length === 0 ? (
                <div className="mt-8 flex flex-col items-center rounded-3xl border border-dashed border-border/60 dark:border-white/10 bg-muted/40 dark:bg-white/[0.025] px-6 py-12 text-center">
                  <Receipt className="mb-3 h-9 w-9 text-muted-foreground/70" />
                  <p className="font-black text-foreground">Nenhuma compra nesta fatura</p>
                  <p className="mt-1 text-sm text-muted-foreground">Adicione uma compra para começar o acompanhamento do mês.</p>
                </div>
              ) : openTransactions.length === 0 && paidTransactions.length === 0 ? (
                <div className="mt-8 rounded-3xl border border-border/60 dark:border-white/10 bg-muted/40 dark:bg-white/[0.025] px-6 py-10 text-center text-sm font-semibold text-muted-foreground">
                  Nenhuma compra encontrada com os filtros atuais.
                </div>
              ) : (
                <div className="mt-6 space-y-6">
                  {openTransactions.length > 0 && (
                    <div>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h3 className="text-sm font-black uppercase tracking-[0.18em] text-amber-600 dark:text-amber-300">Em aberto</h3>
                        <span className="text-xs font-bold text-muted-foreground">{openTransactions.length} item{openTransactions.length === 1 ? '' : 's'}</span>
                      </div>
                      <div className="space-y-2">{openTransactions.map(renderTransactionRow)}</div>
                    </div>
                  )}

                  {paidTransactions.length > 0 && (
                    <div>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h3 className="text-sm font-black uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-300">Pagas</h3>
                        <span className="text-xs font-bold text-muted-foreground">{paidTransactions.length} item{paidTransactions.length === 1 ? '' : 's'}</span>
                      </div>
                      <div className="space-y-2">{paidTransactions.map(renderTransactionRow)}</div>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-5 xl:sticky xl:top-4 xl:self-start">
            <div
              className="relative overflow-hidden rounded-[1.75rem] border border-white/15 p-5 text-white shadow-2xl shadow-black/30"
              style={{ background: cardGradient(cardBrand(currentCard).color) }}
            >
              <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
              <div className="relative space-y-7">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xl font-black">{currentCard.name}</p>
                    <p className="mt-1 text-xs font-semibold text-white/70">Crédito • fatura</p>
                  </div>
                  {/* Brand logo in a white chip, or card icon */}
                  {cardBrand(currentCard).logoUrl ? (
                    <span className="flex h-9 items-center justify-center rounded-lg bg-white px-2 shadow-md shrink-0">
                      <img src={cardBrand(currentCard).logoUrl} alt={currentCard.name} className="h-5 max-w-[60px] object-contain" />
                    </span>
                  ) : (
                    <CreditCard className="h-7 w-7 text-white/50 shrink-0" />
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="h-8 w-11 rounded-lg border border-white/25 bg-gradient-to-br from-white/80 to-white/30 shadow-inner" />
                  <CreditCard className="h-7 w-7 text-white/35" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-bold text-white/60">Comprometido</p>
                    <p className="currency mt-1 font-black tabular-nums">{fmt(committedTotal)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-white/60">Disponível</p>
                    <p className="currency mt-1 font-black tabular-nums">{fmt(availableLimit)}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="h-1.5 overflow-hidden rounded-full bg-black/25">
                    <div className="h-full rounded-full bg-white/[0.85]" style={{ width: `${committedLimitPercent}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold text-white/70">
                    <span>Limite {fmt(Number(currentCard.credit_limit))}</span>
                    <span>{committedLimitPercent.toFixed(0)}% do limite</span>
                  </div>
                </div>

                {/* Card management actions */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => openEditCard(currentCard)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/15 py-2 text-xs font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/25"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </button>
                  <button
                    onClick={() => setConfirmDeleteCard(currentCard)}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-black/20 px-3 py-2 text-xs font-bold text-white/90 backdrop-blur-sm transition-colors hover:bg-red-500/40"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Excluir
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-border/60 dark:border-white/10 bg-card/95 dark:bg-[#090d16]/95 p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-foreground">Resumo por categoria</h3>
                  <p className="text-sm text-muted-foreground">Distribuição da fatura selecionada</p>
                </div>
                <PieChart className="h-5 w-5 text-primary dark:text-primary" />
              </div>

              {categorySummary.length === 0 ? (
                <div className="rounded-2xl border border-border/60 dark:border-white/10 bg-muted/40 dark:bg-white/[0.025] p-4 text-sm font-semibold text-muted-foreground">
                  Sem categorias nesta fatura.
                </div>
              ) : (
                <div className="space-y-4">
                  {categorySummary.slice(0, 5).map((row) => {
                    const percent = billTotal > 0 ? (row.total / billTotal) * 100 : 0;
                    const barWidth = Math.max(4, (row.total / topCategoryTotal) * 100);
                    return (
                      <div key={row.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-border/60 dark:border-white/10 bg-muted/50 dark:bg-white/[0.04] text-sm">{row.icon}</span>
                        <div className="min-w-0">
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-bold text-foreground/80 dark:text-slate-300">{row.name}</p>
                            <p className="currency text-xs font-black text-foreground tabular-nums">{fmt(row.total)}</p>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted/60 dark:bg-white/[0.07]">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${barWidth}%` }} />
                          </div>
                        </div>
                        <span className="w-10 text-right text-xs font-bold text-muted-foreground">{percent.toFixed(0)}%</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-[1.75rem] border border-border/60 dark:border-white/10 bg-card/95 dark:bg-[#090d16]/95 p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
              <div className="grid gap-3">
                <Button
                  onClick={openPayBill}
                  disabled={unpaidTotal <= 0}
                  className="h-12 rounded-xl bg-primary text-base font-black text-foreground shadow-lg shadow-primary/25 hover:bg-primary disabled:opacity-50"
                >
                  <Wallet className="mr-2 h-4 w-4" /> Pagar {fmt(unpaidTotal)}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowNewTx(true)}
                  className="h-12 rounded-xl border-border/60 dark:border-white/10 bg-muted/50 dark:bg-white/[0.035] text-base font-black text-foreground hover:bg-muted/60 dark:bg-white/[0.07]"
                >
                  <Plus className="mr-2 h-4 w-4" /> Nova compra
                </Button>
                <p className="flex items-center justify-center gap-2 text-xs font-semibold text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" /> Ambiente seguro e criptografado
                </p>
              </div>
            </div>

            {!getCardDefaultAccount(currentCard.id) ? (
              <div className="rounded-[1.75rem] border border-amber-300/20 bg-amber-400/[0.045] p-5">
                <div className="mb-3 flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-amber-600 dark:text-amber-200"><Wallet className="h-5 w-5" /></span>
                  <div>
                    <p className="font-black text-foreground">Conta de pagamento</p>
                    <p className="mt-1 text-sm text-muted-foreground dark:text-slate-400">Vincule uma conta para as compras do cartão refletirem no saldo corretamente.</p>
                  </div>
                </div>
                <Select onValueChange={(v) => {
                  setCardDefaultAccount(currentCard.id, v);
                  setDefaultAcctBump(b => b + 1);
                  toast.success('Conta padrão vinculada!');
                }}>
                  <SelectTrigger className="h-11 rounded-xl border-border/60 dark:border-white/10 bg-muted/30 dark:bg-slate-950/70"><SelectValue placeholder="Selecionar conta padrão..." /></SelectTrigger>
                  <SelectContent>
                    {accounts.filter(a => !a.archived).map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.icon} {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (() => {
              const acctId = getCardDefaultAccount(currentCard.id);
              const acct = accounts.find(a => a.id === acctId);
              return (
                <div className="rounded-[1.75rem] border border-emerald-300/20 bg-emerald-400/[0.045] p-5">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-600 dark:text-emerald-200"><Check className="h-5 w-5" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="font-black text-foreground">Pagamento vinculado</p>
                      <p className="mt-1 truncate text-sm font-semibold text-foreground/80 dark:text-slate-300">{acct?.icon} {acct?.name || 'Conta vinculada'}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button onClick={() => applyDefaultAccountToHistory(currentCard.id)} className="rounded-lg bg-muted/50 dark:bg-white/[0.05] px-3 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-200 hover:bg-muted/70 dark:bg-white/[0.08]">
                          Sincronizar antigas
                        </button>
                        <button onClick={() => { setCardDefaultAccount(currentCard.id, null); setDefaultAcctBump(b => b + 1); toast.success('Conta padrão removida'); }} className="rounded-lg bg-muted/50 dark:bg-white/[0.05] px-3 py-1.5 text-xs font-bold text-muted-foreground dark:text-slate-400 hover:bg-muted/70 dark:bg-white/[0.08]">
                          Remover
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </aside>
        </div>
      ) : (
        <div className="rounded-[1.75rem] border border-border/60 dark:border-white/10 bg-muted/40 dark:bg-white/[0.025] px-6 py-12 text-center">
          <Zap className="mx-auto mb-3 h-8 w-8 text-muted-foreground/70" />
          <p className="text-sm font-bold text-muted-foreground dark:text-slate-400">Selecione um cartão para ver a fatura.</p>
        </div>
      )}
      {/* ── Análises do cartão (dashboard sob demanda) ──────────────── */}
      <Dialog open={showAnalytics} onOpenChange={setShowAnalytics}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" /> Análises do cartão de crédito
            </DialogTitle>
          </DialogHeader>
          <CreditCardAnalytics />
        </DialogContent>
      </Dialog>

      {/* ── Add Card Dialog ────────────────────────────────────────── */}
      <Dialog open={showNewCard} onOpenChange={setShowNewCard}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Cartão de Crédito</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* Brand presets — pick bank to auto-fill name + color + logo */}
            <div className="space-y-2">
              <Label>Bandeira / Banco</Label>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {CC_BRAND_PRESETS.map((preset) => {
                  const active = resolveAccountBrand(newCard.name).name === preset.name;
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => setNewCard(p => ({ ...p, name: CC_BRAND_LABELS[preset.name] || preset.name, color: preset.color }))}
                      className={cn(
                        'flex items-center gap-1.5 rounded-xl border px-2 py-2 text-left transition-all',
                        active ? 'border-primary bg-primary/10' : 'border-border/60 hover:border-primary/40 hover:bg-primary/5',
                      )}
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/60 bg-white p-0.5">
                        {preset.logoUrl ? (
                          <img src={preset.logoUrl} alt={preset.name} className="h-full w-full object-contain" />
                        ) : (
                          <span className="text-xs">{preset.icon}</span>
                        )}
                      </span>
                      <span className="truncate text-[11px] font-semibold">{CC_BRAND_LABELS[preset.name] || preset.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div><Label>Nome do cartão</Label><Input placeholder="Ex: Nubank, Bradesco..." value={newCard.name} onChange={(e) => setNewCard((p) => ({ ...p, name: e.target.value }))} /></div>
            <div>
              <Label>Cor (cartões sem bandeira conhecida)</Label>
              <div className="flex gap-2 mt-2 flex-wrap">
                {CARD_COLORS.map(c => (
                  <button key={c} onClick={() => setNewCard(p => ({ ...p, color: c }))}
                    className={`w-8 h-8 rounded-full transition-all border-2 ${newCard.color === c ? 'ring-2 ring-offset-2 ring-primary scale-110 border-white' : 'border-transparent'}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
              {/* Preview — uses brand color/logo when name matches a known brand */}
              <div className="mt-3 flex items-center justify-between rounded-xl p-3 text-white text-xs font-medium" style={{ background: cardGradient(resolveAccountBrand(newCard.name, newCard.color).color) }}>
                <span>{newCard.name || 'Prévia do cartão'} · Dia {newCard.closing_day}/{newCard.due_day}</span>
                {resolveAccountBrand(newCard.name).logoUrl && (
                  <span className="flex h-6 items-center rounded bg-white px-1.5">
                    <img src={resolveAccountBrand(newCard.name).logoUrl} alt="" className="h-3.5 max-w-[44px] object-contain" />
                  </span>
                )}
              </div>
            </div>
            <div><Label>Limite (R$)</Label><Input type="number" placeholder="5000" value={newCard.credit_limit} onChange={(e) => setNewCard((p) => ({ ...p, credit_limit: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Dia de fechamento</Label><Input type="number" min={1} max={31} value={newCard.closing_day} onChange={(e) => setNewCard((p) => ({ ...p, closing_day: e.target.value }))} /></div>
              <div><Label>Dia de vencimento</Label><Input type="number" min={1} max={31} value={newCard.due_day} onChange={(e) => setNewCard((p) => ({ ...p, due_day: e.target.value }))} /></div>
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
              <Label className="flex items-center gap-1.5 text-primary">
                <Wallet className="w-3.5 h-3.5" /> Conta de pagamento padrão
              </Label>
              <Select value={newCard.payment_account_id} onValueChange={(v) => setNewCard(p => ({ ...p, payment_account_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione a conta..." /></SelectTrigger>
                <SelectContent>
                  {accounts.filter(a => !a.archived).map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.icon} {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Toda compra neste cartão vai automaticamente debitar desta conta. O saldo reflete a obrigação no momento da compra.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewCard(false)}>Cancelar</Button>
            <Button onClick={handleAddCard} disabled={addCard.isPending} style={{ backgroundColor: newCard.color }} className="text-white">Salvar cartão</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Transaction Dialog ─────────────────────────────────── */}
      <Dialog open={showNewTx} onOpenChange={(o) => { setShowNewTx(o); if (!o) { setRefundMode(false); setRefundTxId(''); setRefundPartial(false); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{refundMode ? 'Estorno / Reembolso' : 'Nova Compra'} - {currentCard?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* Compra vs Estorno toggle */}
            <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-muted/50 p-1">
              <button type="button" onClick={() => { setRefundMode(false); setRefundTxId(''); setRefundPartial(false); }} className={cn('rounded-lg py-2 text-sm font-semibold transition-all', !refundMode ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>Compra</button>
              <button type="button" onClick={() => { setRefundMode(true); setRefundTxId(''); setRefundPartial(false); setNewTx(p => ({ ...p, description: '', amount: '' })); }} className={cn('rounded-lg py-2 text-sm font-semibold transition-all', refundMode ? 'bg-card text-income shadow-sm' : 'text-muted-foreground hover:text-foreground')}>↩ Estorno</button>
            </div>
            {refundMode ? (
              <>
                <div className="flex items-start gap-2 rounded-xl border border-income/20 bg-income/5 p-3 text-xs leading-relaxed text-muted-foreground">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-income" />
                  <span>Escolha a <strong>compra que foi reembolsada</strong>. O valor é preenchido sozinho e <strong>abate</strong> da fatura escolhida — ao pagar essa fatura, o saldo é debitado de menos, batendo com o crédito real. Não entra como receita na conta.</span>
                </div>
                <div>
                  <Label>Compra reembolsada</Label>
                  <Select value={refundTxId} onValueChange={(v) => {
                    setRefundTxId(v);
                    setRefundPartial(false);
                    const orig = refundablePurchases.find(t => t.id === v);
                    if (orig) setNewTx(p => ({ ...p, description: orig.description || 'Compra', amount: Number(orig.amount).toFixed(2), category_id: orig.category_id || '' }));
                  }}>
                    <SelectTrigger><SelectValue placeholder="Escolha a compra..." /></SelectTrigger>
                    <SelectContent>
                      {refundablePurchases.length === 0 ? (
                        <div className="px-2 py-3 text-center text-xs text-muted-foreground">Nenhuma compra neste cartão</div>
                      ) : refundablePurchases.map(t => (
                        <SelectItem key={t.id} value={t.id}>{(t.description || 'Compra')} · {fmt(Number(t.amount))} · {monthLabel(t.bill_month)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {refundTxId && (
                  <div className="rounded-xl border border-income/20 bg-income/[0.06] p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Valor a estornar</span>
                      <span className="currency text-lg font-black text-income">− {fmt(Math.abs(parseFloat((newTx.amount || '0').replace(',', '.')) || 0))}</span>
                    </div>
                    {!refundPartial ? (
                      <button type="button" onClick={() => setRefundPartial(true)} className="mt-1 text-[11px] font-semibold text-primary hover:underline">Reembolso parcial? ajustar valor</button>
                    ) : (
                      <div className="mt-2">
                        <Label className="text-[11px]">Valor reembolsado (R$)</Label>
                        <Input type="number" step="0.01" value={newTx.amount} onChange={(e) => setNewTx(p => ({ ...p, amount: e.target.value }))} />
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                <div><Label>Descrição</Label><Input placeholder="Ex: iFood, Academia..." value={newTx.description} onChange={(e) => setNewTx((p) => ({ ...p, description: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Valor total (R$)</Label><Input type="number" placeholder="0,00" value={newTx.amount} onChange={(e) => setNewTx((p) => ({ ...p, amount: e.target.value }))} /></div>
                  <div>
                    <Label>Parcelas</Label>
                    <Input type="number" min={1} max={48} value={newTx.installments} onChange={(e) => setNewTx((p) => ({ ...p, installments: e.target.value }))} />
                  </div>
                </div>
              </>
            )}
            <div><Label>{refundMode ? 'Data do crédito' : 'Data da compra'}</Label><Input type="date" value={newTx.date} onChange={e => setNewTx(p => ({ ...p, date: e.target.value }))} /></div>

            {/* Auto-calculated bill month chip */}
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium border" style={{ backgroundColor: `${currentCard?.color}10`, borderColor: `${currentCard?.color}30`, color: currentCard?.color }}>
              <CreditCard className="w-3.5 h-3.5 shrink-0" />
              <span>
                {refundMode
                  ? 'Crédito na fatura de '
                  : parseInt(newTx.installments) > 1
                    ? `${newTx.installments}x · Primeira fatura: `
                    : 'Entrará na fatura de '}
                <strong className="capitalize">{newTxBillLabel}</strong>
              </span>
            </div>

            {!refundMode && parseInt(newTx.installments) > 1 && newTx.amount && (
              <div className="rounded-xl bg-muted/50 border border-border px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
                <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                {newTx.installments}x de {fmt(parseFloat(newTx.amount) / parseInt(newTx.installments))} por mês
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
            <Button variant="outline" onClick={() => { setShowNewTx(false); setRefundMode(false); setRefundTxId(''); setRefundPartial(false); }}>Cancelar</Button>
            <Button onClick={handleAddTx} disabled={addTx.isPending} style={refundMode ? undefined : { backgroundColor: currentCard?.color }} className={refundMode ? 'bg-income text-white hover:bg-income/90' : 'text-white'}>{refundMode ? 'Lançar estorno' : 'Registrar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Pay Bill Dialog ────────────────────────────────────────── */}
      {/* Edit Transaction Dialog */}
      <Dialog open={!!editingTx} onOpenChange={(open) => !open && setEditingTx(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar compra</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Descrição</Label><Input value={editTx.description} onChange={(e) => setEditTx((p) => ({ ...p, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor (R$)</Label>
                <Input type="number" step="0.01" min="0.01" value={editTx.amount} onChange={(e) => setEditTx((p) => ({ ...p, amount: e.target.value }))} />
              </div>
              <div>
                <Label>Data</Label>
                <Input type="date" value={editTx.date} onChange={(e) => setEditTx((p) => ({ ...p, date: e.target.value }))} />
              </div>
            </div>
            {currentCard && editTx.date && (
              <div className="flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium" style={{ backgroundColor: `${currentCard.color}10`, borderColor: `${currentCard.color}30`, color: currentCard.color }}>
                <CreditCard className="w-3.5 h-3.5 shrink-0" />
                <span>Fatura recalculada: <strong className="capitalize">{monthLabel(calcBillMonth(editTx.date, Number(currentCard.closing_day)))}</strong></span>
              </div>
            )}
            <div>
              <Label>Categoria</Label>
              <Select value={editTx.category_id || '__none__'} onValueChange={(v) => setEditTx((p) => ({ ...p, category_id: v === '__none__' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem categoria</SelectItem>
                  {activeCategories.map((c) => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTx(null)}>Cancelar</Button>
            <Button onClick={handleSaveEditTx} disabled={updateTx.isPending} style={{ backgroundColor: currentCard?.color }} className="text-white">
              Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPayBill} onOpenChange={setShowPayBill}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pagar Fatura — {currentCard?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-2xl p-5 text-center" style={{ background: `linear-gradient(135deg, ${currentCard?.color}20, ${currentCard?.color}08)`, border: `1px solid ${currentCard?.color}30` }}>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Total em aberto</p>
              <p className="text-2xl font-extrabold text-expense currency">{fmt(unpaidTotal)}</p>
              <p className="text-xs text-muted-foreground mt-1.5 capitalize">{monthLabel(billMonth)} · {transactions.filter(t => !t.paid).length} item(ns)</p>
            </div>
            <div className="space-y-1.5">
              <Label>Debitar da conta *</Label>
              <Select value={payBillAccountId} onValueChange={setPayBillAccountId}>
                <SelectTrigger><SelectValue placeholder="Selecionar conta..." /></SelectTrigger>
                <SelectContent>
                  {accounts.filter(a => !a.archived).map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.icon} {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Os {transactions.filter(t => !t.paid).length} item(ns) em aberto serão marcados como pagos e {fmt(unpaidTotal)} debitado(s) do saldo desta conta — uma única vez. Próximas faturas usarão esta conta por padrão.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayBill(false)}>Cancelar</Button>
            <Button
              className="text-white gap-1.5"
              style={{ backgroundColor: '#10b981' }}
              onClick={handlePayBill}
              disabled={togglePaid.isPending || !payBillAccountId || unpaidTotal <= 0}
            >
              <Check className="w-4 h-4" /> Confirmar Pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Per-item Quick Pay Dialog ──────────────────────────────── */}
      <Dialog open={!!payItem} onOpenChange={(o) => !o && setPayItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como pago</DialogTitle>
          </DialogHeader>
          {payItem && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border/50 bg-muted/30 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Item</p>
                <p className="text-sm font-semibold mt-0.5 truncate">{payItem.description}</p>
                <p className="text-2xl font-extrabold text-expense currency mt-1">{fmt(payItem.amount)}</p>
              </div>
              <div className="space-y-1.5">
                <Label>Debitar da conta *</Label>
                <Select value={payItemAccountId} onValueChange={setPayItemAccountId}>
                  <SelectTrigger><SelectValue placeholder="Selecionar conta..." /></SelectTrigger>
                  <SelectContent>
                    {accounts.filter(a => !a.archived).map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.icon} {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">{fmt(payItem.amount)} será debitado do saldo desta conta — uma única vez.</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayItem(null)}>Cancelar</Button>
            <Button
              className="text-white gap-1.5"
              style={{ backgroundColor: '#10b981' }}
              onClick={handleConfirmItemPayment}
              disabled={togglePaid.isPending || !payItemAccountId}
            >
              <Check className="w-4 h-4" /> Confirmar e debitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Card Dialog ───────────────────────────────────────── */}
      <Dialog open={!!editingCard} onOpenChange={(o) => !o && setEditingCard(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar cartão</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome do cartão</Label><Input value={editCardForm.name} onChange={(e) => setEditCardForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Nubank, Bradesco..." /></div>
            <div>
              <Label>Cor (cartões sem bandeira conhecida)</Label>
              <div className="flex gap-2 mt-2 flex-wrap">
                {CARD_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setEditCardForm(p => ({ ...p, color: c }))}
                    className={`w-8 h-8 rounded-full transition-all border-2 ${editCardForm.color === c ? 'ring-2 ring-offset-2 ring-primary scale-110 border-white' : 'border-transparent'}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between rounded-xl p-3 text-white text-xs font-medium" style={{ background: cardGradient(resolveAccountBrand(editCardForm.name, editCardForm.color).color) }}>
                <span>{editCardForm.name || 'Prévia'} · Dia {editCardForm.closing_day}/{editCardForm.due_day}</span>
                {resolveAccountBrand(editCardForm.name).logoUrl && (
                  <span className="flex h-6 items-center rounded bg-white px-1.5">
                    <img src={resolveAccountBrand(editCardForm.name).logoUrl} alt="" className="h-3.5 max-w-[44px] object-contain" />
                  </span>
                )}
              </div>
            </div>
            <div><Label>Limite (R$)</Label><Input type="number" value={editCardForm.credit_limit} onChange={(e) => setEditCardForm(p => ({ ...p, credit_limit: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Dia de fechamento</Label><Input type="number" min={1} max={31} value={editCardForm.closing_day} onChange={(e) => setEditCardForm(p => ({ ...p, closing_day: e.target.value }))} /></div>
              <div><Label>Dia de vencimento</Label><Input type="number" min={1} max={31} value={editCardForm.due_day} onChange={(e) => setEditCardForm(p => ({ ...p, due_day: e.target.value }))} /></div>
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
              <Label className="flex items-center gap-1.5 text-primary"><Wallet className="w-3.5 h-3.5" /> Conta de pagamento padrão</Label>
              <Select value={editCardForm.payment_account_id || '__none__'} onValueChange={(v) => setEditCardForm(p => ({ ...p, payment_account_id: v === '__none__' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione a conta..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem conta padrão</SelectItem>
                  {accounts.filter(a => !a.archived).map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.icon} {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground leading-relaxed">Compras neste cartão debitam automaticamente desta conta.</p>
            </div>
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button
              variant="ghost"
              onClick={() => { if (editingCard) setConfirmDeleteCard(editingCard); }}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive gap-1.5"
            >
              <Trash2 className="w-4 h-4" /> Excluir cartão
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditingCard(null)}>Cancelar</Button>
              <Button onClick={handleSaveEditCard} disabled={updateCard.isPending}>Salvar</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirm Delete Card Dialog ─────────────────────────────── */}
      <Dialog open={!!confirmDeleteCard} onOpenChange={(o) => !o && setConfirmDeleteCard(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Excluir cartão?</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
              <Trash2 className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-semibold">{confirmDeleteCard?.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  O cartão será arquivado e deixará de aparecer na lista. As compras e o histórico de faturas são preservados (não somem do saldo). Você pode recriar o cartão depois se precisar.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteCard(null)}>Cancelar</Button>
            <Button onClick={handleDeleteCard} disabled={deleteCard.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1.5">
              <Trash2 className="w-4 h-4" /> Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
