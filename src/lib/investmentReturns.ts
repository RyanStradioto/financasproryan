/**
 * Investment return engine — computes REAL fixed-income yields for the app.
 *
 * Grounded in Brazilian market rules (researched, mid-2026):
 * - CDI ≈ Selic − 0.10 p.p.  (default CDI 14.40% a.a. for Selic 14.50%).
 * - Post-fixed "% do CDI": the percentage applies to the DAILY CDI rate, compounded
 *   over 252 business days/year (DU/252 convention).
 * - IR regressivo on yield only, by holding days: ≤180d 22.5%, ≤360d 20%, ≤720d 17.5%, >720d 15%.
 * - IOF regressivo on yield only, for redemptions before 30 days (table below).
 * - LCI/LCA/Poupança are IR-exempt. (MP 1.303/2025 was rejected — current rules stand.)
 *
 * Value model = "crystallize-on-movement":
 *   `current_value` holds the accrued value AS OF `value_date`. The live value is that
 *   baseline compounded forward to today. On each aporte/resgate the hook crystallizes the
 *   accrued yield into `current_value` and resets `value_date`, so the engine only ever has
 *   to compound a single baseline — simple and drift-free.
 */

// ─── Rates ────────────────────────────────────────────────────────────────────
export type InvestmentRates = {
  cdiAnnual: number;   // decimal, e.g. 0.144 (14.40% a.a.)
  selicAnnual: number; // decimal, e.g. 0.145
  ipcaAnnual: number;  // decimal, e.g. 0.044
};

/** Shipped defaults (2026-06-05): Selic 14.50% → CDI 14.40%; IPCA ~4.4%. User-overridable. */
export const DEFAULT_RATES: InvestmentRates = {
  cdiAnnual: 0.144,
  selicAnnual: 0.145,
  ipcaAnnual: 0.044,
};

export const RATES_STORAGE_KEY = 'investment_rates_v1';

export function loadRates(): InvestmentRates {
  try {
    const raw = localStorage.getItem(RATES_STORAGE_KEY);
    if (!raw) return DEFAULT_RATES;
    const parsed = JSON.parse(raw);
    return {
      cdiAnnual: Number(parsed.cdiAnnual) || DEFAULT_RATES.cdiAnnual,
      selicAnnual: Number(parsed.selicAnnual) || DEFAULT_RATES.selicAnnual,
      ipcaAnnual: Number(parsed.ipcaAnnual) || DEFAULT_RATES.ipcaAnnual,
    };
  } catch {
    return DEFAULT_RATES;
  }
}

export function saveRates(rates: InvestmentRates) {
  try {
    localStorage.setItem(RATES_STORAGE_KEY, JSON.stringify(rates));
    // Notify same-tab listeners (storage event only fires cross-tab).
    window.dispatchEvent(new CustomEvent('investment-rates-changed'));
  } catch (err) {
    console.warn('saveRates falhou', err);
  }
}

// ─── Index types & product taxonomy ───────────────────────────────────────────
export type IndexType = 'cdi' | 'prefixado' | 'ipca' | 'poupanca' | 'manual';

export const INDEX_TYPES: { value: IndexType; label: string; help: string }[] = [
  { value: 'cdi',        label: '% do CDI',        help: 'Pós-fixado atrelado ao CDI (ex.: Caixinha 100%, Turbo 115%).' },
  { value: 'prefixado',  label: 'Prefixado (% a.a.)', help: 'Taxa fixa contratada, ex.: 12,5% ao ano.' },
  { value: 'ipca',       label: 'IPCA + taxa',     help: 'Inflação (IPCA) mais um spread fixo ao ano.' },
  { value: 'poupanca',   label: 'Poupança',        help: '0,5% a.m. + TR (regra atual com Selic acima de 8,5%).' },
  { value: 'manual',     label: 'Valor manual',    help: 'Você atualiza o valor à mão (ações, cripto, FIIs, fundos).' },
];

/** Whether the value is auto-accrued by the engine (true) or user-maintained (false). */
export function isAutoCalc(indexType?: string | null): boolean {
  return indexType === 'cdi' || indexType === 'prefixado' || indexType === 'ipca' || indexType === 'poupanca';
}

/** IR-exempt products for individuals (by `type`): LCI, LCA, Poupança. */
export function isIRExempt(type?: string | null, indexType?: string | null): boolean {
  const t = (type || '').toLowerCase();
  return t === 'lci' || t === 'lca' || t === 'poupanca' || indexType === 'poupanca';
}

// ─── Day-count helpers ────────────────────────────────────────────────────────
const MS_PER_DAY = 86_400_000;

export function parseDate(d?: string | null): Date | null {
  if (!d) return null;
  // Accept 'YYYY-MM-DD' or full ISO; normalize to local midnight.
  const iso = d.length > 10 ? d : `${d}T00:00:00`;
  const dt = new Date(iso);
  return isNaN(dt.getTime()) ? null : dt;
}

export function calendarDaysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY));
}

/** Approximate business days (DU) from calendar days: ~252/365. Good enough for an app estimate. */
export function businessDaysApprox(calendarDays: number): number {
  return Math.round(calendarDays * 252 / 365);
}

// ─── Effective annual rate per investment ─────────────────────────────────────
export type RateInvestment = {
  index_type?: string | null;
  cdi_percent?: number | null;
  annual_rate?: number | null; // prefixado: % a.a.; ipca: spread % a.a.
};

/** Effective annual rate (decimal) used to compound the baseline. */
export function effectiveAnnualRate(inv: RateInvestment, rates: InvestmentRates): number {
  const idx = (inv.index_type || 'cdi') as IndexType;
  if (idx === 'manual') return 0;
  if (idx === 'prefixado') return Math.max(0, (Number(inv.annual_rate) || 0) / 100);
  if (idx === 'ipca') {
    const spread = (Number(inv.annual_rate) || 0) / 100;
    return (1 + rates.ipcaAnnual) * (1 + spread) - 1;
  }
  if (idx === 'poupanca') {
    // Rule (Lei 12.703/2012): Selic > 8.5% → 0.5%/mês (≈6.17% a.a.); else 70% Selic. TR≈0.
    return rates.selicAnnual > 0.085 ? Math.pow(1.005, 12) - 1 : 0.70 * rates.selicAnnual;
  }
  // CDI: apply the percentage to the DAILY CDI rate, then compound over 252 (precise method).
  const p = (Number(inv.cdi_percent) || 100) / 100;
  const dailyCdi = Math.pow(1 + rates.cdiAnnual, 1 / 252) - 1;
  return Math.pow(1 + p * dailyCdi, 252) - 1;
}

/** Day-count base for an index: IPCA uses calendar (365); CDI/prefixado/poupança use DU/252. */
function baseFor(indexType?: string | null): 252 | 365 {
  return indexType === 'ipca' ? 365 : 252;
}

/** Compound factor for an annual rate between two dates, honoring the day-count base. */
export function accrualFactor(annualRate: number, from: Date, to: Date, base: 252 | 365): number {
  if (annualRate <= 0) return 1;
  const cal = calendarDaysBetween(from, to);
  if (cal <= 0) return 1;
  const days = base === 252 ? businessDaysApprox(cal) : cal;
  return Math.pow(1 + annualRate, days / base);
}

// ─── Core: compute an investment's live value & yield ─────────────────────────
export type ComputedInvestment = {
  value: number;        // live GROSS current value (accrued for auto types)
  invested: number;     // principal (total_invested)
  yieldAbs: number;     // value - invested (gross)
  yieldPct: number;     // yieldAbs / invested * 100
  annualRate: number;   // effective annual rate (decimal); 0 for manual
  isAuto: boolean;
  /** estimated yield earned per day at the current value (R$/day), for "rende ~X/dia" copy */
  perDayYield: number;
  /** NET value if redeemed today (after IR + IOF on the gain). Equals value for manual/exempt. */
  netValue: number;
  /** estimated GROSS yield earned over the trailing 12 months (or since inception if younger). */
  yield12m: number;
  /** calendar days since the value baseline (holding period) */
  ageDays: number;
};

export type ValueInvestment = RateInvestment & {
  current_value: number | string;
  total_invested: number | string;
  value_date?: string | null;
  created_at?: string | null;
  type?: string | null;
};

export function computeInvestment(
  inv: ValueInvestment,
  rates: InvestmentRates,
  asOf: Date = new Date(),
): ComputedInvestment {
  const baseline = Number(inv.current_value) || 0;
  const invested = Number(inv.total_invested) || 0;
  const idx = (inv.index_type || 'cdi') as IndexType;
  const auto = isAutoCalc(idx);

  if (!auto) {
    const yieldAbs = baseline - invested;
    return {
      value: baseline,
      invested,
      yieldAbs,
      yieldPct: invested > 0 ? (yieldAbs / invested) * 100 : 0,
      annualRate: 0,
      isAuto: false,
      perDayYield: 0,
      netValue: baseline, // user-maintained; we don't auto-apply variable-asset taxes
      yield12m: yieldAbs,
      ageDays: 0,
    };
  }

  const annualRate = effectiveAnnualRate(inv, rates);
  const base = baseFor(idx);
  const from = parseDate(inv.value_date) || parseDate(inv.created_at) || asOf;
  const factor = accrualFactor(annualRate, from, asOf, base);
  const value = baseline * factor;
  const yieldAbs = value - invested;
  // Daily yield estimate at current value: value * (dailyFactor - 1)
  const dailyFactor = Math.pow(1 + annualRate, 1 / base);
  const perDayYield = value * (dailyFactor - 1);

  // Net value if redeemed today: IR/IOF on the gain by holding period (exempt for LCI/LCA/poupança).
  const ageDays = calendarDaysBetween(from, asOf);
  const exempt = isIRExempt(inv.type, idx);
  const netValue = invested + netYield(invested, yieldAbs, ageDays, exempt);

  // Trailing-12-month gross yield estimate (since inception if younger than a year).
  const yearDays = base === 252 ? businessDaysApprox(365) : 365;
  const yearFactor = Math.pow(1 + annualRate, yearDays / base);
  const yield12m = ageDays >= 365 && yearFactor > 0 ? value * (1 - 1 / yearFactor) : yieldAbs;

  return {
    value,
    invested,
    yieldAbs,
    yieldPct: invested > 0 ? (yieldAbs / invested) * 100 : 0,
    annualRate,
    isAuto: true,
    perDayYield,
    netValue,
    yield12m,
    ageDays,
  };
}

// ─── Projections ──────────────────────────────────────────────────────────────
export type ProjectionPoint = { label: string; months: number; gross: number; gain: number; net: number };

const PROJECTION_HORIZONS: { label: string; months: number }[] = [
  { label: '1 mês', months: 1 },
  { label: '3 meses', months: 3 },
  { label: '6 meses', months: 6 },
  { label: '1 ano', months: 12 },
  { label: '2 anos', months: 24 },
  { label: '5 anos', months: 60 },
];

/** Project future GROSS and NET value of a present value compounding at annualRate. */
export function projectInvestment(
  presentValue: number,
  annualRate: number,
  type?: string | null,
  indexType?: string | null,
): ProjectionPoint[] {
  return PROJECTION_HORIZONS.map(({ label, months }) => {
    const years = months / 12;
    const gross = presentValue * Math.pow(1 + annualRate, years);
    const gain = gross - presentValue;
    const calDays = Math.round(months * 30.4375);
    const net = presentValue + netYield(presentValue, gain, calDays, isIRExempt(type, indexType));
    return { label, months, gross, gain, net };
  });
}

// ─── Taxes (IR + IOF) on yield only ───────────────────────────────────────────
/** IOF regressivo (% of yield) for redemptions in the first 30 calendar days. */
const IOF_TABLE = [96, 93, 90, 86, 83, 80, 76, 73, 70, 66, 63, 60, 56, 53, 50,
  46, 43, 40, 36, 33, 30, 26, 23, 20, 16, 13, 10, 6, 3, 0]; // index 0 = day 1

export function iofRate(calendarDaysHeld: number): number {
  if (calendarDaysHeld >= 30) return 0;
  if (calendarDaysHeld < 1) return IOF_TABLE[0] / 100;
  return IOF_TABLE[calendarDaysHeld - 1] / 100;
}

/** IR regressivo (% of yield) by holding period in calendar days. */
export function irRate(calendarDaysHeld: number): number {
  if (calendarDaysHeld <= 180) return 0.225;
  if (calendarDaysHeld <= 360) return 0.20;
  if (calendarDaysHeld <= 720) return 0.175;
  return 0.15;
}

/** Net yield after IOF (if <30d) then IR (on yield net of IOF). Taxes hit gains only. */
export function netYield(_principal: number, grossGain: number, calendarDaysHeld: number, exempt = false): number {
  if (grossGain <= 0) return grossGain;
  const iof = grossGain * iofRate(calendarDaysHeld);
  const afterIof = grossGain - iof;
  const ir = exempt ? 0 : afterIof * irRate(calendarDaysHeld);
  return afterIof - ir;
}

// ─── Goal helpers ─────────────────────────────────────────────────────────────
export function goalProgress(currentValue: number, goalAmount?: number | null): number | null {
  const goal = Number(goalAmount) || 0;
  if (goal <= 0) return null;
  return Math.min(currentValue / goal, 1);
}

/** Estimated months to reach a goal from current value, given monthly growth + optional aporte. */
export function monthsToGoal(currentValue: number, goalAmount: number, annualRate: number, monthlyAporte = 0): number | null {
  if (goalAmount <= currentValue) return 0;
  const monthlyRate = annualRate > 0 ? Math.pow(1 + annualRate, 1 / 12) - 1 : 0;
  let v = currentValue;
  for (let m = 1; m <= 1200; m++) {
    v = v * (1 + monthlyRate) + monthlyAporte;
    if (v >= goalAmount) return m;
  }
  return null;
}

// ─── Simulator ────────────────────────────────────────────────────────────────
export type SimInput = {
  initial: number;       // valor inicial
  monthly: number;       // aporte mensal
  months: number;        // prazo em meses
  annualRate: number;    // taxa anual efetiva (decimal)
  type?: string | null;       // produto (para isenção de IR)
  indexType?: string | null;
};

export type SimPoint = { month: number; invested: number; gross: number; savings: number };

export type SimResult = {
  invested: number;     // total aportado (inicial + mensais)
  gross: number;        // valor final bruto
  grossGain: number;
  net: number;          // valor final líquido (IR/IOF sobre o ganho)
  netGain: number;
  savings: number;      // mesmo cenário na poupança (comparação)
  series: SimPoint[];
};

/** Future value of an initial amount + monthly contributions compounding monthly, with net (IR/IOF). */
export function simulate(inp: SimInput, rates: InvestmentRates): SimResult {
  const months = Math.max(0, Math.round(inp.months));
  const monthlyRate = inp.annualRate > 0 ? Math.pow(1 + inp.annualRate, 1 / 12) - 1 : 0;
  const poupAnnual = rates.selicAnnual > 0.085 ? Math.pow(1.005, 12) - 1 : 0.70 * rates.selicAnnual;
  const poupMonthly = Math.pow(1 + poupAnnual, 1 / 12) - 1;

  let gross = inp.initial;
  let invested = inp.initial;
  let savings = inp.initial;
  const series: SimPoint[] = [{ month: 0, invested, gross, savings }];
  for (let t = 1; t <= months; t++) {
    gross = gross * (1 + monthlyRate) + inp.monthly;
    savings = savings * (1 + poupMonthly) + inp.monthly;
    invested += inp.monthly;
    series.push({ month: t, invested, gross, savings });
  }
  const grossGain = gross - invested;
  const calDays = Math.round(months * 30.4375);
  const netGain = netYield(invested, grossGain, calDays, isIRExempt(inp.type, inp.indexType));
  return { invested, gross, grossGain, net: invested + netGain, netGain, savings, series };
}
