type CreditCardLike = { id: string; name: string };
type AccountLike = { id: string; name: string };
type ExpenseLike = { notes?: string | null; account_id?: string | null };

export type ParsedCardMarker = {
  cardId?: string;
  billMonth?: string;
  transactionId?: string;
};

export function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseStructuredCardMarker(raw?: string | null): ParsedCardMarker | null {
  if (!raw) return null;
  const match = raw.match(
    /\[Cartao de credito\|card:([^|\]]+)(?:\|bill:([0-9]{4}-[0-9]{2}))?(?:\|tx:([^|\]]+))?\]/i,
  );
  if (!match) return null;
  return {
    cardId: match[1],
    billMonth: match[2],
    transactionId: match[3],
  };
}

export function hasCreditCardHint(raw?: string | null) {
  if (!raw) return false;
  return /\[(?:Backfill cartao|Cartao de credito[^\]]*)\]/i.test(raw) || /\bcartao de credito\b/i.test(raw);
}

export function stripCreditCardMarkers(raw?: string | null) {
  if (!raw) return '';
  return raw
    .replace(/\[Cartao de credito[^\]]*\]\s*/gi, '')
    .replace(/\[Backfill cartao\]\s*/gi, '')
    .trim();
}

export function detectCreditCardExpense(
  expense: ExpenseLike,
  cards: CreditCardLike[],
  accounts: AccountLike[] = [],
) {
  const marker = parseStructuredCardMarker(expense.notes);
  if (marker?.cardId) {
    const card = cards.find((c) => c.id === marker.cardId);
    return {
      isCreditCard: true,
      cardId: marker.cardId,
      cardName: card?.name ?? 'Cartao de credito',
      billMonth: marker.billMonth,
      transactionId: marker.transactionId,
    };
  }

  const noteSuggestsCard = hasCreditCardHint(expense.notes);
  const accountName = expense.account_id
    ? accounts.find((a) => a.id === expense.account_id)?.name
    : undefined;

  if (noteSuggestsCard && accountName) {
    const normalizedAccount = normalizeText(accountName);
    const matchedCard = cards.find((c) => normalizeText(c.name) === normalizedAccount);
    return {
      isCreditCard: true,
      cardId: matchedCard?.id,
      cardName: matchedCard?.name ?? 'Cartao de credito',
    };
  }

  if (noteSuggestsCard) {
    return {
      isCreditCard: true,
      cardName: 'Cartao de credito',
    };
  }

  return {
    isCreditCard: false,
  };
}

function normalizeExpenseDescription(description: string) {
  return normalizeText(description)
    .replace(/\(\d+\/\d+\)/g, '')
    .replace(/- parcela \d+\/\d+/gi, '')
    .trim();
}

export function buildExpenseMatchKey(description: string, date: string, amount: number) {
  return `${normalizeExpenseDescription(description)}|${date}|${amount.toFixed(2)}`;
}
