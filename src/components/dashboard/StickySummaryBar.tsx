/**
 * Sticky Summary Bar — fixed top bar visible on mobile while scrolling.
 *
 * Shows: balance + daily allowance. The two most-important numbers always
 * within reach. Hidden on desktop (>= lg).
 */

import { useEffect, useState } from 'react';
import { Wallet, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';

interface Props {
  balance: number;
  perDayAllowance: number;
  monthBudgetSet: boolean;
  maskCurrency: (s: string) => string;
}

export default function StickySummaryBar({ balance, perDayAllowance, monthBudgetSet, maskCurrency }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      // Only show after user has scrolled past the entire hero block (~360px).
      // Keeps the bar from overlapping the welcome card title on mobile.
      setVisible(window.scrollY > 360);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      aria-hidden={!visible}
      className={cn(
        'fixed top-[52px] left-0 right-0 z-40 lg:hidden transition-transform duration-300',
        visible ? 'translate-y-0' : '-translate-y-full pointer-events-none',
      )}
    >
      <div className="bg-card border-b border-border/60 shadow-md px-3 py-2">
        <div className="flex items-center justify-between gap-3 max-w-[1600px] mx-auto">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
              <Wallet className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground leading-none">Saldo</p>
              <p className={cn('text-xs font-extrabold tabular-nums truncate',
                balance >= 0 ? 'text-foreground' : 'text-expense',
              )}>
                {maskCurrency(formatCurrency(balance))}
              </p>
            </div>
          </div>
          {monthBudgetSet && perDayAllowance > 0 && (
            <div className="flex items-center gap-2 min-w-0 shrink-0">
              <div className="w-7 h-7 rounded-lg bg-income/15 flex items-center justify-center shrink-0">
                <Flame className="w-3.5 h-3.5 text-income" />
              </div>
              <div className="min-w-0 text-right">
                <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground leading-none">/dia</p>
                <p className="text-xs font-extrabold tabular-nums text-income truncate">
                  {maskCurrency(formatCurrency(perDayAllowance))}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
