import type { ElementType } from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import SparklineChart from '@/components/finance/SparklineChart';
import { useSensitiveData } from '@/components/finance/SensitiveData';
import { cn } from '@/lib/utils';

interface Props {
  label: string;
  value: string;
  sub?: string;
  color: string;
  icon: ElementType;
  trend?: 'up' | 'down' | 'neutral';
  sparklineData?: number[];
  delta?: number | null;
  deltaInverted?: boolean;
}

export default function KpiCard({
  label, value, sub, color, icon: Icon, trend, sparklineData, delta, deltaInverted,
}: Props) {
  const { maskCurrency, maskText } = useSensitiveData();
  const displayValue = value.startsWith('R$') ? maskCurrency(value) : maskText(value);
  const deltaIsGood = delta == null ? null : (deltaInverted ? delta < 0 : delta > 0);
  // Neutral trend follows the active palette; up/down stay semantic.
  const sparkColor = trend === 'up' ? 'hsl(var(--income))' : trend === 'down' ? 'hsl(var(--expense))' : 'hsl(var(--primary))';

  return (
    <div className={cn('relative min-h-[96px] sm:min-h-[116px] rounded-3xl border border-border/60 bg-gradient-to-br from-card/95 via-card/75 to-background/55 p-3 sm:p-4 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-border hover:shadow-xl hover:shadow-black/5 group overflow-hidden animate-slide-up', color)}>
      <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-[0.06] group-hover:opacity-[0.10] group-hover:scale-110 transition-all duration-500 pointer-events-none" style={{ background: `radial-gradient(circle, ${sparkColor} 0%, transparent 70%)` }} />

      <div className="relative z-10 flex h-full flex-col justify-between gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn('w-8 h-8 rounded-xl items-center justify-center flex shrink-0',
              trend === 'up' ? 'bg-income/10 text-income' : trend === 'down' ? 'bg-expense/10 text-expense' : 'bg-primary/10 text-primary'
            )}>
              <Icon className="w-4 h-4" />
            </div>
            <p className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-[0.08em] sm:tracking-[0.1em]">{label}</p>
          </div>
          {delta !== null && delta !== undefined && (
            <span className={cn(
              'inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md',
              deltaIsGood ? 'bg-income/10 text-income' : 'bg-expense/10 text-expense',
            )}>
              {delta > 0 ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
              {Math.abs(delta).toFixed(0)}%
            </span>
          )}
        </div>

        <div className="flex items-end justify-between mt-1 gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] sm:text-base lg:text-lg font-extrabold currency tracking-tight leading-none tabular-nums truncate">{displayValue}</p>
            {sub && <p className="text-[10px] text-muted-foreground mt-1 leading-tight line-clamp-1 sm:line-clamp-2">{sub}</p>}
          </div>
          {sparklineData && sparklineData.length > 1 && (
            <div className="shrink-0 -mr-1 opacity-60 group-hover:opacity-100 transition-opacity hidden sm:block">
              <SparklineChart data={sparklineData} color={sparkColor} width={48} height={22} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
