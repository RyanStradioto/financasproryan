import { LucideIcon } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';

type Props = {
  label: string;
  value: number;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  suffix?: string;
  className?: string;
};

export default function StatCard({ label, value, icon: Icon, trend, suffix, className }: Props) {
  const gradientClass = trend === 'up' ? 'gradient-income' : trend === 'down' ? 'gradient-expense' : 'gradient-primary';

  return (
    <div className={cn('stat-card animate-slide-up', gradientClass, className)}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
        <div className={cn(
          'w-9 h-9 rounded-xl flex items-center justify-center shadow-sm',
          trend === 'up' ? 'bg-income/15 shadow-income/10' : trend === 'down' ? 'bg-expense/15 shadow-expense/10' : 'bg-primary/15 shadow-primary/10'
        )}>
          <Icon className={cn(
            'w-4.5 h-4.5',
            trend === 'up' ? 'text-income' : trend === 'down' ? 'text-expense' : 'text-primary'
          )} />
        </div>
      </div>
      <p className={cn(
        'text-2xl font-extrabold currency tracking-tight',
        trend === 'up' ? 'text-income' : trend === 'down' ? 'text-expense' : ''
      )}>
        {suffix ? `${value.toFixed(1)}${suffix}` : formatCurrency(value)}
      </p>
    </div>
  );
}
