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
