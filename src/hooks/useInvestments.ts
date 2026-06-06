import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';
import {
  type InvestmentRates, type ComputedInvestment,
  loadRates, saveRates, computeInvestment,
  effectiveAnnualRate, accrualFactor, parseDate, isAutoCalc,
} from '@/lib/investmentReturns';

export type Investment = Tables<'investments'>;
export type InvestmentTransaction = Tables<'investment_transactions'>;
export type PortfolioInvestment = Investment & ComputedInvestment;

const OPTIONAL_INVESTMENT_COLUMNS = [
  'annual_rate', 'liquidity', 'photo_url', 'index_type', 'cdi_percent', 'goal_amount', 'value_date',
] as const;

function stripUnsupportedColumns<T extends Record<string, unknown>>(payload: T, message?: string): Partial<T> {
  if (!message) return payload;
  const next: Record<string, unknown> = { ...payload };

  for (const key of OPTIONAL_INVESTMENT_COLUMNS) {
    if (message.includes(`'${key}'`) || message.includes(`"${key}"`) || message.includes(key)) {
      delete next[key];
    }
  }

  return next as Partial<T>;
}

export function useInvestments() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['investments', user?.id],
    queryFn: async () => {
      const [{ data: investments, error: investmentsError }, { data: transactions, error: transactionsError }] = await Promise.all([
        supabase
          .from('investments')
          .select('*')
          .or('archived.is.null,archived.eq.false')
          .order('name'),
        supabase
          .from('investment_transactions')
          .select('investment_id, type, amount'),
      ]);

      if (investmentsError) throw investmentsError;
      if (transactionsError) throw transactionsError;

      const transactionsByInvestment = (transactions ?? []).reduce<Record<string, { current: number; invested: number; count: number }>>((acc, item) => {
        const bucket = acc[item.investment_id] ?? { current: 0, invested: 0, count: 0 };
        const amount = Number(item.amount) || 0;

        if (item.type === 'aporte') {
          bucket.current += amount;
          bucket.invested += amount;
        } else if (item.type === 'resgate') {
          bucket.current -= amount;
          bucket.invested -= amount;
        } else if (item.type === 'rendimento') {
          bucket.current += amount;
        } else if (item.type === 'taxa' || item.type === 'ir') {
          bucket.current -= amount;
        }

        bucket.count += 1;
        acc[item.investment_id] = bucket;
        return acc;
      }, {});

      return (investments as Investment[]).map((investment) => {
        const currentValue = Number(investment.current_value) || 0;
        const totalInvested = Number(investment.total_invested) || 0;
        const derived = transactionsByInvestment[investment.id];

        if (!derived || derived.count === 0) {
          return investment;
        }

        const shouldHydrateFromTransactions = currentValue === 0 && totalInvested === 0;

        return shouldHydrateFromTransactions
          ? {
              ...investment,
              current_value: derived.current,
              total_invested: derived.invested,
            }
          : investment;
      });
    },
    enabled: !!user,
  });
}

export function useInvestmentTransactions(investmentId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['investment-transactions', user?.id, investmentId],
    queryFn: async () => {
      let q = supabase
        .from('investment_transactions')
        .select('*')
        .order('date', { ascending: false });
      if (investmentId) q = q.eq('investment_id', investmentId);
      const { data, error } = await q;
      if (error) throw error;
      return data as InvestmentTransaction[];
    },
    enabled: !!user,
  });
}

/** Reactive access to the user's index rates (CDI/Selic/IPCA), persisted in localStorage. */
export function useInvestmentRates() {
  const [rates, setRatesState] = useState<InvestmentRates>(() => loadRates());
  useEffect(() => {
    const handler = () => setRatesState(loadRates());
    window.addEventListener('investment-rates-changed', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('investment-rates-changed', handler);
      window.removeEventListener('storage', handler);
    };
  }, []);
  const setRates = useCallback((next: InvestmentRates) => {
    saveRates(next);
    setRatesState(next);
  }, []);
  return { rates, setRates };
}

/**
 * Central computed portfolio: each investment enriched with its live (accrued) value,
 * yield and effective rate, plus portfolio-wide totals. Single source of truth so the
 * page, the dashboard and useNetWorth all agree.
 */
export function usePortfolio() {
  const { data: investments = [], isLoading } = useInvestments();
  const { rates } = useInvestmentRates();

  return useMemo(() => {
    const now = new Date();
    const enriched: PortfolioInvestment[] = investments.map((inv) => ({
      ...inv,
      ...computeInvestment(inv as Investment, rates, now),
    }));
    const toCents = (v: number) => Math.round((Number(v) || 0) * 100);
    const valueCents = enriched.reduce((s, i) => s + toCents(i.value), 0);
    const investedCents = enriched.reduce((s, i) => s + toCents(i.invested), 0);
    const netCents = enriched.reduce((s, i) => s + toCents(i.netValue), 0);
    const yield12mCents = enriched.reduce((s, i) => s + toCents(i.yield12m), 0);
    const yieldCents = valueCents - investedCents;
    return {
      investments: enriched,
      isLoading,
      rates,
      totalValue: valueCents / 100,          // bruto
      totalNet: netCents / 100,              // líquido (resgatando hoje)
      totalInvested: investedCents / 100,
      totalYield: yieldCents / 100,
      totalYieldPct: investedCents > 0 ? (yieldCents / investedCents) * 100 : 0,
      totalYield12m: yield12mCents / 100,    // rendeu nos últimos 12 meses
      perDayYield: enriched.reduce((s, i) => s + i.perDayYield, 0),
      count: enriched.length,
    };
  }, [investments, rates, isLoading]);
}

/** Back-compat summary used by the dashboard; now backed by the real return engine. */
export function useNetWorth() {
  const p = usePortfolio();
  return {
    investmentTotal: p.totalValue,
    totalInvested: p.totalInvested,
    totalReturn: p.totalYield,
    returnPct: p.totalYieldPct,
    perDayYield: p.perDayYield,
    count: p.count,
    investments: p.investments,
  };
}

export function useAddInvestment() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (data: Omit<TablesInsert<'investments'>, 'user_id'>) => {
      const firstPayload = { ...data, user_id: user!.id };
      const { error } = await supabase
        .from('investments')
        .insert(firstPayload);
      if (!error) return;

      const fallbackPayload = stripUnsupportedColumns(firstPayload, error.message);
      if (Object.keys(fallbackPayload).length === Object.keys(firstPayload).length) throw error;

      const { error: fallbackError } = await supabase
        .from('investments')
        .insert(fallbackPayload as TablesInsert<'investments'>);
      if (fallbackError) throw fallbackError;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['investments'] }),
  });
}

export function useUpdateInvestment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<TablesInsert<'investments'>>) => {
      const { error } = await supabase.from('investments').update(data).eq('id', id);
      if (!error) return;

      const fallbackPayload = stripUnsupportedColumns(data, error.message);
      if (Object.keys(fallbackPayload).length === Object.keys(data).length) throw error;

      const { error: fallbackError } = await supabase.from('investments').update(fallbackPayload).eq('id', id);
      if (fallbackError) throw fallbackError;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['investments'] }),
  });
}

export function useDeleteInvestment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('investments').update({ archived: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['investments'] }),
  });
}

/** 
 * PATRIMONIAL TRANSFER — records investment and updates the investment balance.
 * This is NOT an expense. Transfers money from account to investment.
 */
export function useAddInvestmentTransaction() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (data: {
      investment_id: string;
      account_id?: string | null;
      type: 'aporte' | 'resgate' | 'rendimento' | 'taxa' | 'ir';
      amount: number;
      date: string;
      description?: string;
      notes?: string;
      skipLedgerSync?: boolean;
    }) => {
      const { skipLedgerSync, ...txPayload } = data;

      // 1. Load the investment (need name, balances, and rate model for accrual)
      const { data: inv, error: invError } = await supabase
        .from('investments')
        .select('current_value, total_invested, name, index_type, cdi_percent, annual_rate, value_date, created_at')
        .eq('id', data.investment_id)
        .single();
      if (invError) throw invError;

      // 2. Mirror to the bank ledger FIRST (the most failure-prone external write).
      // We THROW on error: a failed sync must NOT silently leave the investment
      // out of step with the bank balance. Doing it before the value update means
      // a ledger failure leaves the investment untouched (clean retry).
      // Aporte  -> expense  (money leaves the account; tagged [INVESTIMENTO], so it
      //            lowers the balance but never counts as a "gasto").
      // Resgate -> income   (money returns to the account; tagged [INVESTIMENTO]).
      // rendimento/taxa/ir  -> no ledger row (the asset value changes, the bank does not).
      if (!skipLedgerSync && data.account_id && (data.type === 'aporte' || data.type === 'resgate')) {
        if (data.type === 'aporte') {
          const { error: expError } = await supabase
            .from('expenses')
            .insert({
              user_id: user!.id,
              date: data.date,
              description: `📊 Aporte: ${inv.name}`,
              amount: data.amount,
              account_id: data.account_id,
              status: 'concluido',
              notes: `[INVESTIMENTO] Transferência patrimonial para ${inv.name}. Não é um gasto real.`,
              is_recurring: false,
            });
          if (expError) throw expError;
        } else {
          const { error: incError } = await supabase
            .from('income')
            .insert({
              user_id: user!.id,
              date: data.date,
              description: `📊 Resgate: ${inv.name}`,
              amount: data.amount,
              account_id: data.account_id,
              status: 'concluido',
              notes: `[INVESTIMENTO] Resgate patrimonial de ${inv.name}.`,
            });
          if (incError) throw incError;
        }
      }

      // 3. Record the investment transaction (history / ledger of movements)
      const { error: txError } = await supabase
        .from('investment_transactions')
        .insert({ ...txPayload, user_id: user!.id, description: data.description ?? '' });
      if (txError) throw txError;

      // 4. Update investment balances. For AUTO-calc (CDI/prefixado/IPCA/poupança) we
      // CRYSTALLIZE the accrued yield into the baseline up to the movement date and reset
      // value_date — so the engine only ever compounds a single fresh baseline (no drift,
      // no double-count). For MANUAL types the stored value is the truth, so we just apply.
      const rates = loadRates();
      const idx = inv.index_type || 'cdi';
      const auto = isAutoCalc(idx);
      const toCents = (v: number) => Math.round((Number(v) || 0) * 100);
      let currentCents = toCents(inv.current_value);
      let investedCents = toCents(inv.total_invested);
      const amountCents = toCents(data.amount);
      const movementDate = (data.date || '').slice(0, 10);
      let newValueDate: string | null = inv.value_date ?? null;

      if (auto) {
        const annual = effectiveAnnualRate(inv as { index_type?: string; cdi_percent?: number; annual_rate?: number }, rates);
        const base = idx === 'ipca' ? 365 : 252;
        const from = parseDate(inv.value_date) || parseDate(inv.created_at) || parseDate(movementDate) || new Date();
        const to = parseDate(movementDate) || new Date();
        const factor = accrualFactor(annual, from, to, base);
        currentCents = Math.round(currentCents * factor); // crystallized value at movement date
        newValueDate = movementDate || newValueDate;
      }

      if (data.type === 'aporte') {
        currentCents += amountCents;
        investedCents += amountCents;
      } else if (data.type === 'resgate') {
        currentCents -= amountCents;
        investedCents -= amountCents;
      } else if (data.type === 'rendimento') {
        currentCents += amountCents;
      } else if (data.type === 'taxa' || data.type === 'ir') {
        currentCents -= amountCents;
      }

      // A withdrawal/fee can never push a balance below zero (backstop; the UI also validates).
      currentCents = Math.max(0, currentCents);
      investedCents = Math.max(0, investedCents);

      const updatePayload: Record<string, number | string | null> = {
        current_value: currentCents / 100,
        total_invested: investedCents / 100,
      };
      if (auto) updatePayload.value_date = newValueDate;

      const { error: updateError } = await supabase
        .from('investments')
        .update(updatePayload)
        .eq('id', data.investment_id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['investments'] });
      qc.invalidateQueries({ queryKey: ['investment-transactions'] });
      qc.invalidateQueries({ queryKey: ['income'] });
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
      qc.invalidateQueries({ queryKey: ['accumulated-balance'] });
    },
  });
}



