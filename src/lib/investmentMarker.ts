/**
 * Investment patrimonial-transfer marker.
 *
 * When the user makes an "aporte" (contribution) or "resgate" (withdrawal),
 * the app mirrors it as an expense/income row tagged with this marker in the
 * `notes` field. Such rows are NOT real spending/income — they are transfers
 * of patrimony between a bank account and an investment.
 *
 * IMPORTANT semantics:
 * - These rows DO affect the bank-account balance (the money really left /
 *   entered the account), so `useAccumulatedBalance` intentionally keeps them.
 * - These rows must NOT be counted as "gastos"/"receitas" in any spending,
 *   budget, allowance, insight, report, chart or analytics aggregation.
 *
 * Use `isInvestmentTransfer(notes)` everywhere expenses/income are summed for
 * spending/earning purposes to exclude them.
 */
export const INVESTMENT_MARKER = '[INVESTIMENTO]';

/** True when the given notes string marks an investment patrimonial transfer. */
export function isInvestmentTransfer(notes?: string | null): boolean {
  return !!notes && notes.includes(INVESTMENT_MARKER);
}

/** True when a row (expense/income) is an investment patrimonial transfer. */
export function isInvestmentTransferRow(row: { notes?: string | null } | null | undefined): boolean {
  return !!row && isInvestmentTransfer(row.notes);
}

/**
 * Convenience predicate for Array.filter to KEEP only real spending/income
 * (i.e. drop investment transfers).
 *   const realExpenses = expenses.filter(notInvestmentTransfer);
 */
export function notInvestmentTransfer<T extends { notes?: string | null }>(row: T): boolean {
  return !isInvestmentTransfer(row.notes);
}

/**
 * Transferência entre contas (dinheiro só mudou de conta — NEUTRO).
 * Mesma semântica do marcador de investimento: afeta o SALDO das contas
 * (sai de uma, entra na outra), mas NÃO é gasto nem receita em nenhuma
 * agregação de análise. Cada transferência gera duas linhas com este marcador:
 *   - despesa na conta de origem:  [TRANSFERENCIA|id:<uuid>|para:<contaDestino>]
 *   - receita na conta de destino: [TRANSFERENCIA|id:<uuid>|de:<contaOrigem>]
 */
export const TRANSFER_MARKER = '[TRANSFERENCIA';

export function isAccountTransfer(notes?: string | null): boolean {
  return !!notes && notes.includes(TRANSFER_MARKER);
}

/** Extrai os metadados do marcador de transferência (id, para, de). */
export function parseTransfer(notes?: string | null): { id?: string; para?: string; de?: string } | null {
  if (!isAccountTransfer(notes)) return null;
  const seg = (notes || '').match(/\[TRANSFERENCIA\|([^\]]*)\]/i)?.[1] ?? '';
  const out: { id?: string; para?: string; de?: string } = {};
  for (const part of seg.split('|')) {
    const [k, v] = part.split(':');
    if (k === 'id') out.id = v;
    else if (k === 'para') out.para = v;
    else if (k === 'de') out.de = v;
  }
  return out;
}

/** True para qualquer transferência NEUTRA (investimento OU entre contas). */
export function isNeutralTransfer(notes?: string | null): boolean {
  return isInvestmentTransfer(notes) || isAccountTransfer(notes);
}

/** Predicado p/ Array.filter: mantém só gastos/receitas reais (dropa neutros). */
export function notNeutralTransfer<T extends { notes?: string | null }>(row: T): boolean {
  return !isNeutralTransfer(row.notes);
}
