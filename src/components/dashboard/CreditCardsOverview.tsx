import { Link } from 'react-router-dom';
import { CreditCard as CreditCardIcon, CalendarClock, Plus, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';
import type { CreditCard, CreditCardTransaction } from '@/hooks/useCreditCards';

type Props = {
  cards: CreditCard[];
  transactions: CreditCardTransaction[]; // TODAS as transações (todos os cartões/meses)
  month: string;                          // YYYY-MM selecionado na dashboard
  maskCurrency: (s: string) => string;
};

const monthShort = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) return '';
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
};

const usageTier = (pct: number) =>
  pct > 80 ? 'bg-expense' : pct > 50 ? 'bg-warning' : 'bg-income';

export default function CreditCardsOverview({ cards, transactions, month, maskCurrency }: Props) {
  const fmt = (v: number) => maskCurrency(formatCurrency(v));
  const mLabel = monthShort(month);

  // Estado vazio: convida a cadastrar um cartão.
  if (cards.length === 0) {
    return (
      <Link
        to="/cartoes"
        className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4 transition-colors hover:border-primary/40"
      >
        <span className="flex items-center gap-3 min-w-0">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10"><CreditCardIcon className="h-5 w-5 text-primary" /></span>
          <span className="min-w-0">
            <span className="block text-sm font-bold">Cadastre seu cartão de crédito</span>
            <span className="block text-xs text-muted-foreground">Acompanhe fatura, limite e vencimento aqui na dashboard.</span>
          </span>
        </span>
        <Plus className="h-5 w-5 shrink-0 text-primary" />
      </Link>
    );
  }

  const perCard = cards.map((card) => {
    const txns = transactions.filter((t) => t.credit_card_id === card.id);
    const faturaMes = txns.filter((t) => t.bill_month === month).reduce((s, t) => s + Number(t.amount), 0);
    const faturaMesPago = txns.filter((t) => t.bill_month === month && t.paid).reduce((s, t) => s + Number(t.amount), 0);
    const emAberto = txns.filter((t) => !t.paid).reduce((s, t) => s + Number(t.amount), 0); // dívida real (todas as faturas)
    const limite = Number(card.credit_limit) || 0;
    const usadoPct = limite > 0 ? Math.min(100, Math.max(0, (emAberto / limite) * 100)) : 0;
    const disponivel = limite > 0 ? Math.max(0, limite - emAberto) : null;
    const pago = faturaMes > 0 && faturaMesPago >= faturaMes - 0.005;
    return { card, faturaMes, emAberto, limite, usadoPct, disponivel, pago };
  });

  const totalFaturaMes = perCard.reduce((s, c) => s + c.faturaMes, 0);
  const totalEmAberto = perCard.reduce((s, c) => s + c.emAberto, 0);

  return (
    <div className="stat-card">
      {/* header */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10"><CreditCardIcon className="h-3.5 w-3.5 text-primary" /></span>
          Cartões de crédito
        </h3>
        <Link to="/cartoes" className="flex items-center gap-0.5 text-xs font-semibold text-primary hover:underline">
          Ver tudo <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* resumo agregado */}
      <div className="mb-4 grid grid-cols-2 gap-2.5">
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Fatura de {mLabel}</p>
          <p className="mt-0.5 currency text-lg font-black leading-tight tabular-nums sm:text-xl">{fmt(totalFaturaMes)}</p>
        </div>
        <div className="rounded-xl border border-warning/20 bg-warning/[0.06] p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total em aberto</p>
          <p className="mt-0.5 currency text-lg font-black leading-tight tabular-nums text-warning sm:text-xl">{fmt(totalEmAberto)}</p>
        </div>
      </div>

      {/* cartões */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {perCard.map(({ card, faturaMes, emAberto, limite, usadoPct, disponivel, pago }) => (
          <div
            key={card.id}
            className="relative overflow-hidden rounded-2xl border border-border/60 p-3.5"
            style={{ background: `linear-gradient(135deg, ${card.color}14, transparent 70%)` }}
          >
            <span className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl" style={{ background: `${card.color}22` }} />
            {/* header do cartão */}
            <div className="relative z-10 flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base" style={{ background: `${card.color}26` }}>
                  {card.icon || '💳'}
                </span>
                <p className="truncate text-sm font-bold">{card.name}</p>
              </div>
              {card.due_day ? (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-background/70 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  <CalendarClock className="h-3 w-3" /> dia {card.due_day}
                </span>
              ) : null}
            </div>

            {/* fatura do mês */}
            <div className="relative z-10 mt-3 flex items-end justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Fatura de {mLabel}</p>
                <p className="currency text-xl font-black leading-tight tabular-nums">{fmt(faturaMes)}</p>
              </div>
              <span className={cn(
                'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold',
                pago ? 'bg-income/15 text-income' : faturaMes > 0 ? 'bg-warning/15 text-warning' : 'bg-muted text-muted-foreground',
              )}>
                {pago ? 'paga' : faturaMes > 0 ? 'em aberto' : 'sem gastos'}
              </span>
            </div>

            {/* limite */}
            {limite > 0 && (
              <div className="relative z-10 mt-3">
                <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Limite usado</span>
                  <span className="font-semibold tabular-nums">{usadoPct.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className={cn('h-full rounded-full transition-all', usageTier(usadoPct))} style={{ width: `${usadoPct}%` }} />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Em aberto <span className="currency font-semibold text-foreground tabular-nums">{fmt(emAberto)}</span></span>
                  {disponivel !== null && (
                    <span className="text-muted-foreground">Disp. <span className="currency font-semibold text-income tabular-nums">{fmt(disponivel)}</span></span>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
