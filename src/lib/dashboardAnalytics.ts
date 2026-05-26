/**
 * Dashboard analytics utilities — pure functions, no side effects.
 *
 * Provides:
 *   - Daily allowance (how much / day until end of month)
 *   - Burn rate trajectory (cumulative spending vs ideal pace)
 *   - Anomaly detection (unusual spending vs N-month average)
 *   - Recurring expense detection (clusters by description + amount + cadence)
 *   - Category delta vs previous month
 *   - Pix counterparty aggregator
 *   - Executive summary phrases
 */

// ─── Constants ──────────────────────────────────────────────────────────────

/** Quantos múltiplos da média de uma categoria contam como anomalia. */
export const ANOMALY_MULTIPLIER_THRESHOLD = 2.5;

/** Mínimo de transações de mesma descrição para detectar gasto recorrente. */
export const RECURRING_MIN_OCCURRENCES = 3;

/** Margem (% sobre o orçamento mensal) acima da qual marcamos "vai estourar". */
export const BURN_RATE_OVERRUN_THRESHOLD = 1.05;

export interface MoneyLine {
  amount: number;
  date: string;          // YYYY-MM-DD
  description?: string | null;
  category_id?: string | null;
  notes?: string | null;
}

// ─── 1. Daily Allowance ──────────────────────────────────────────────────────

export interface AllowanceResult {
  remainingDays: number;
  remainingBudget: number;     // total budget left
  perDayAllowance: number;     // remainingBudget / remainingDays (clamped at 0)
  todayAllowanceRemaining: number;
  todaySpent: number;          // already spent today (warns if > perDayAllowance)
  monthBudget: number;
  monthSpent: number;
}

export function computeAllowance(opts: {
  monthBudget: number;
  monthSpent: number;
  dayOfMonth: number;
  lastDayOfMonth: number;
  todaySpent?: number;
}): AllowanceResult {
  const { monthBudget, monthSpent, dayOfMonth, lastDayOfMonth, todaySpent = 0 } = opts;
  const remainingDays = Math.max(1, lastDayOfMonth - dayOfMonth + 1);
  const remainingBudget = Math.max(0, monthBudget - monthSpent);
  const perDayAllowance = remainingBudget / remainingDays;
  const todayAllowanceRemaining = Math.max(0, perDayAllowance - todaySpent);
  return {
    remainingDays,
    remainingBudget,
    perDayAllowance,
    todayAllowanceRemaining,
    todaySpent,
    monthBudget,
    monthSpent,
  };
}

// ─── 2. Burn Rate Trajectory ────────────────────────────────────────────────

export interface BurnRatePoint {
  day: number;
  cumulativeActual: number;     // running total spent up to this day
  cumulativeIdeal: number;      // ideal pace if budget spread evenly
  isProjection: boolean;        // true for days after today (forecast)
}

export function computeBurnRate(opts: {
  expenses: MoneyLine[];
  monthBudget: number;
  dayOfMonth: number;
  lastDayOfMonth: number;
  monthYYYYMM: string;          // current month
}): { points: BurnRatePoint[]; projectedTotal: number; willOverrun: boolean } {
  const { expenses, monthBudget, dayOfMonth, lastDayOfMonth, monthYYYYMM } = opts;

  // Bucket expenses by day-of-month
  const dailyTotals: Record<number, number> = {};
  for (const e of expenses) {
    if (!e.date.startsWith(monthYYYYMM)) continue;
    const day = parseInt(e.date.slice(8, 10), 10);
    dailyTotals[day] = (dailyTotals[day] || 0) + Number(e.amount);
  }

  const points: BurnRatePoint[] = [];
  let cumulative = 0;
  for (let d = 1; d <= lastDayOfMonth; d++) {
    if (d <= dayOfMonth) {
      cumulative += dailyTotals[d] || 0;
    }
    const cumulativeIdeal = (monthBudget * d) / lastDayOfMonth;
    points.push({
      day: d,
      cumulativeActual: cumulative,
      cumulativeIdeal,
      isProjection: d > dayOfMonth,
    });
  }

  // Projected total: extrapolate current pace to end of month
  const dailyAvgSoFar = dayOfMonth > 0 ? cumulative / dayOfMonth : 0;
  const projectedTotal = dailyAvgSoFar * lastDayOfMonth;

  // Fill projection: linear extrapolation from today's cumulative
  for (const p of points) {
    if (p.isProjection) {
      p.cumulativeActual = cumulative + dailyAvgSoFar * (p.day - dayOfMonth);
    }
  }

  return {
    points,
    projectedTotal,
    willOverrun: monthBudget > 0 && projectedTotal > monthBudget * BURN_RATE_OVERRUN_THRESHOLD,
  };
}

// ─── 3. Anomaly Detection ───────────────────────────────────────────────────

export interface Anomaly {
  description: string;
  amount: number;
  date: string;
  category_id: string | null;
  averageForCategory: number;
  multiplier: number;   // amount / average
  reason: string;       // human-readable
}

/**
 * Flags expenses that are 2.5x+ the average per-transaction amount of their category
 * over the last 90 days. Caps at top 5 anomalies.
 */
export function detectAnomalies(opts: {
  currentExpenses: MoneyLine[];
  historicalExpenses: MoneyLine[];   // last 90 days excluding current
  threshold?: number;
}): Anomaly[] {
  const { currentExpenses, historicalExpenses, threshold = ANOMALY_MULTIPLIER_THRESHOLD } = opts;

  // Build category averages from historical data
  const categoryStats: Record<string, { sum: number; count: number }> = {};
  for (const e of historicalExpenses) {
    const cat = e.category_id || '__uncat';
    if (!categoryStats[cat]) categoryStats[cat] = { sum: 0, count: 0 };
    categoryStats[cat].sum += Number(e.amount);
    categoryStats[cat].count += 1;
  }

  const anomalies: Anomaly[] = [];
  for (const e of currentExpenses) {
    const cat = e.category_id || '__uncat';
    const stats = categoryStats[cat];
    if (!stats || stats.count < 3) continue;   // need enough data
    const avg = stats.sum / stats.count;
    if (avg <= 0) continue;
    const mult = Number(e.amount) / avg;
    if (mult >= threshold) {
      anomalies.push({
        description: e.description || 'Despesa',
        amount: Number(e.amount),
        date: e.date,
        category_id: e.category_id || null,
        averageForCategory: avg,
        multiplier: mult,
        reason: `${mult.toFixed(1)}x acima da média desta categoria`,
      });
    }
  }
  return anomalies.sort((a, b) => b.multiplier - a.multiplier).slice(0, 5);
}

// ─── 4. Recurring Expense Detection ─────────────────────────────────────────

export interface RecurringExpense {
  signature: string;            // normalized description
  description: string;          // original (most common)
  averageAmount: number;
  occurrences: number;
  lastDate: string;
  monthlyCost: number;          // average cost per month over the period
  category_id: string | null;
}

function normalizeDesc(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+\d+\/\d+/g, '')                       // remove "(2/12)" parcel suffix
    .replace(/\b(parcela|cota|fatura)\b.*$/, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectRecurring(opts: {
  expenses: MoneyLine[];
  minOccurrences?: number;
}): RecurringExpense[] {
  const { expenses, minOccurrences = RECURRING_MIN_OCCURRENCES } = opts;

  // Group by normalized description
  const groups: Record<string, MoneyLine[]> = {};
  for (const e of expenses) {
    const sig = normalizeDesc(e.description || '');
    if (sig.length < 3) continue;
    (groups[sig] ||= []).push(e);
  }

  const result: RecurringExpense[] = [];
  for (const [sig, items] of Object.entries(groups)) {
    if (items.length < minOccurrences) continue;
    const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));
    const first = sorted[0].date;
    const last  = sorted[sorted.length - 1].date;
    const months = Math.max(1, monthsBetween(first, last) + 1);
    const total = items.reduce((s, x) => s + Number(x.amount), 0);
    const avg = total / items.length;
    const monthly = total / months;
    // Most-common original description
    const descCounts: Record<string, number> = {};
    for (const i of items) {
      const d = (i.description || '').trim();
      if (d) descCounts[d] = (descCounts[d] || 0) + 1;
    }
    const description = Object.entries(descCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || sig;
    result.push({
      signature: sig,
      description,
      averageAmount: avg,
      occurrences: items.length,
      lastDate: last,
      monthlyCost: monthly,
      category_id: items[items.length - 1].category_id || null,
    });
  }
  return result.sort((a, b) => b.monthlyCost - a.monthlyCost);
}

function monthsBetween(a: string, b: string): number {
  const [y1, m1] = a.split('-').map(Number);
  const [y2, m2] = b.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
}

// ─── 5. Category Delta vs Previous Month ────────────────────────────────────

export interface CategoryDelta {
  category_id: string;
  current: number;
  previous: number;
  deltaAbs: number;
  deltaPct: number | null;     // null if previous = 0 and current > 0
  trend: 'up' | 'down' | 'flat' | 'new';
}

export function computeCategoryDeltas(opts: {
  currentExpenses: MoneyLine[];
  previousExpenses: MoneyLine[];
}): CategoryDelta[] {
  const { currentExpenses, previousExpenses } = opts;

  const sumByCat = (rows: MoneyLine[]) => {
    const out: Record<string, number> = {};
    for (const r of rows) {
      const c = r.category_id || '__uncat';
      out[c] = (out[c] || 0) + Number(r.amount);
    }
    return out;
  };

  const cur = sumByCat(currentExpenses);
  const prev = sumByCat(previousExpenses);
  const allCats = new Set([...Object.keys(cur), ...Object.keys(prev)]);

  const result: CategoryDelta[] = [];
  for (const cat of allCats) {
    const c = cur[cat] || 0;
    const p = prev[cat] || 0;
    if (c === 0 && p === 0) continue;
    let deltaPct: number | null = null;
    let trend: CategoryDelta['trend'] = 'flat';
    if (p === 0 && c > 0) {
      trend = 'new';
    } else if (c === 0 && p > 0) {
      deltaPct = -100;
      trend = 'down';
    } else {
      deltaPct = ((c - p) / p) * 100;
      if (Math.abs(deltaPct) < 5) trend = 'flat';
      else trend = deltaPct > 0 ? 'up' : 'down';
    }
    result.push({
      category_id: cat,
      current: c,
      previous: p,
      deltaAbs: c - p,
      deltaPct,
      trend,
    });
  }
  // Sort by abs delta (largest movers first), filter only categories with money
  return result
    .filter(d => d.current > 0 || d.previous > 0)
    .sort((a, b) => Math.abs(b.deltaAbs) - Math.abs(a.deltaAbs));
}

// ─── 6. Pix counterparty aggregator ─────────────────────────────────────────

export interface PixCounterparty {
  name: string;
  totalIn: number;
  totalOut: number;
  net: number;             // in - out
  transactions: number;
}

const PIX_NAME_REGEX = /(?:transfer.ncia\s+(?:recebida|enviada)\s+pelo\s+pix(?:\s+via\s+open\s+banking)?)?\s*(.+?)(?:\s+-\s+\d|$)/i;

export function aggregatePixCounterparties(opts: {
  income: MoneyLine[];
  expenses: MoneyLine[];
}): PixCounterparty[] {
  const { income, expenses } = opts;
  const map: Record<string, PixCounterparty> = {};

  const extractName = (desc: string): string | null => {
    const d = (desc || '').trim();
    if (!d) return null;
    // Try to extract name from pix-style strings
    const m = d.match(PIX_NAME_REGEX);
    let name = m?.[1] ?? d;
    name = name.replace(/[•.]+\d+/g, '').replace(/\s+/g, ' ').trim();
    // Take first 4 words max — names are usually short
    const words = name.split(' ').slice(0, 4).join(' ');
    return words.length >= 3 ? words : null;
  };

  for (const i of income) {
    const name = extractName(i.description || '');
    if (!name) continue;
    const key = name.toLowerCase();
    map[key] ||= { name, totalIn: 0, totalOut: 0, net: 0, transactions: 0 };
    map[key].totalIn += Number(i.amount);
    map[key].transactions += 1;
  }
  for (const e of expenses) {
    const name = extractName(e.description || '');
    if (!name) continue;
    const key = name.toLowerCase();
    map[key] ||= { name, totalIn: 0, totalOut: 0, net: 0, transactions: 0 };
    map[key].totalOut += Number(e.amount);
    map[key].transactions += 1;
  }

  const list = Object.values(map);
  for (const p of list) p.net = p.totalIn - p.totalOut;
  return list
    .filter(p => p.transactions >= 2 && (p.totalIn > 50 || p.totalOut > 50))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
}

// ─── 7. Executive Summary ───────────────────────────────────────────────────

export interface ExecutiveSummaryInput {
  balance: number;
  netWorth: number;
  totalIncome: number;
  totalExpenses: number;
  prevTotalExpenses: number;
  topGrowingCategoryName?: string;
  topGrowingCategoryDeltaPct?: number | null;
  unpaidCCTotal: number;
  daysLeft: number;
  perDayAllowance: number;
  savingsRate: number;
}

export function buildExecutiveSummary(
  input: ExecutiveSummaryInput,
  maskMoney: (s: string) => string = (s) => s,
): string[] {
  const m = (v: number) => maskMoney(fmtBRL(v));
  const lines: string[] = [];

  // Line 1: bottom line
  if (input.totalIncome === 0 && input.totalExpenses === 0) {
    lines.push('Sem movimentação neste mês ainda. Lance suas primeiras transações.');
    return lines;
  }
  const sobra = input.totalIncome - input.totalExpenses;
  if (sobra >= 0) {
    lines.push(`Mês positivo: sobra de ${m(sobra)} (${fmtPct(input.savingsRate)} de poupança).`);
  } else {
    lines.push(`Mês negativo: déficit de ${m(-sobra)} — está gastando mais do que recebe.`);
  }

  // Line 2: category trend
  if (input.topGrowingCategoryName && input.topGrowingCategoryDeltaPct !== undefined && input.topGrowingCategoryDeltaPct !== null) {
    const delta = input.topGrowingCategoryDeltaPct;
    const arrow = delta > 0 ? '↑' : '↓';
    lines.push(`${input.topGrowingCategoryName} ${arrow} ${Math.abs(delta).toFixed(0)}% vs mês passado — principal mudança no padrão de gasto.`);
  } else if (input.prevTotalExpenses > 0) {
    const delta = ((input.totalExpenses - input.prevTotalExpenses) / input.prevTotalExpenses) * 100;
    if (Math.abs(delta) > 5) {
      lines.push(`Gastos ${delta > 0 ? 'subiram' : 'caíram'} ${Math.abs(delta).toFixed(0)}% comparado ao mês anterior.`);
    }
  }

  // Line 3: forward-looking (allowance + CC)
  const parts: string[] = [];
  if (input.daysLeft > 0 && input.perDayAllowance > 0) {
    parts.push(`Allowance de ${m(input.perDayAllowance)}/dia para os ${input.daysLeft} dias restantes`);
  }
  if (input.unpaidCCTotal > 0) {
    parts.push(`fatura pendente de ${m(input.unpaidCCTotal)}`);
  }
  if (parts.length > 0) {
    lines.push(parts.join(' · ') + '.');
  }

  return lines;
}

function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtPct(v: number): string {
  return `${v.toFixed(0)}%`;
}
