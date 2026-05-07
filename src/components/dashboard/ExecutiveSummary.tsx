/**
 * Executive Summary — 3-line summary of the month, auto-generated.
 *
 * Renders right below the hero. Reads "the bottom line" so the user
 * doesn't need to interpret charts to understand their position.
 */

import { Sparkles, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  lines: string[];
  tone: 'positive' | 'negative' | 'neutral';
}

export default function ExecutiveSummary({ lines, tone }: Props) {
  if (lines.length === 0) return null;

  const accent = tone === 'positive'
    ? 'border-income/30 bg-income/5'
    : tone === 'negative'
      ? 'border-expense/30 bg-expense/5'
      : 'border-primary/25 bg-primary/5';

  const Icon = tone === 'positive' ? TrendingUp : tone === 'negative' ? TrendingDown : Sparkles;
  const iconColor = tone === 'positive' ? 'text-income' : tone === 'negative' ? 'text-expense' : 'text-primary';

  return (
    <div className={cn('rounded-2xl border p-4 flex gap-3.5 shadow-sm', accent)}>
      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5',
        tone === 'positive' ? 'bg-income/15' : tone === 'negative' ? 'bg-expense/15' : 'bg-primary/15',
      )}>
        <Icon className={cn('w-4 h-4', iconColor)} />
      </div>
      <div className="flex-1 space-y-1.5 min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          Resumo do mes
        </p>
        {lines.map((line, i) => (
          <p key={i} className={cn(
            'text-sm leading-relaxed',
            i === 0 ? 'font-semibold text-foreground' : 'text-muted-foreground',
          )}>
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}
