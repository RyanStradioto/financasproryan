import { ArrowUpRight, ArrowDownRight, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMarketQuotes } from '@/hooks/useMarketQuotes';

const brl = (v: number) =>
  v >= 1000
    ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
    : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function MarketQuotes() {
  const { data: quotes = [], isLoading, isError } = useMarketQuotes();

  // Sem dados (offline/erro): não renderiza nada — não atrapalha o app.
  if (isError || (!isLoading && quotes.length === 0)) return null;

  return (
    <div className="stat-card">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex items-center gap-1.5 text-sm font-bold">
          <Radio className="h-4 w-4 text-info" /> Mercado agora
        </span>
        <span className="flex items-center gap-1 rounded-full bg-income/10 px-2 py-0.5 text-[10px] font-bold text-income">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-income" /> AO VIVO
        </span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[68px] animate-pulse rounded-xl border border-border/60 bg-muted/30" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {quotes.map((q) => {
            const up = q.pctChange >= 0;
            return (
              <div key={q.code} className="rounded-xl border border-border/60 bg-muted/20 p-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-base leading-none">{q.emoji}</span>
                  <span className="truncate text-xs font-semibold">{q.label}</span>
                </div>
                <p className="mt-1.5 text-base font-bold leading-tight tabular-nums">{brl(q.price)}</p>
                <p className={cn('mt-0.5 flex items-center gap-0.5 text-[11px] font-semibold tabular-nums', up ? 'text-income' : 'text-expense')}>
                  {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {up ? '+' : ''}{q.pctChange.toFixed(2)}%
                  <span className="font-normal text-muted-foreground">hoje</span>
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
