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
  return (
    <div className={cn('stat-card animate-slide-in', className)}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <div className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center',
          trend === 'up' ? 'bg-income/10' : trend === 'down' ? 'bg-expense/10' : 'bg-primary/10'
        )}>
          <Icon className={cn(
            'w-4 h-4',
            trend === 'up' ? 'text-income' : trend === 'down' ? 'text-expense' : 'text-primary'
          )} />
        </div>
      </div>
      <p className={cn(
        'text-xl font-bold currency animate-count-up',
        trend === 'up' ? 'text-income' : trend === 'down' ? 'text-expense' : ''
      )}>
        {suffix ? `${value.toFixed(1)}${suffix}` : formatCurrency(value)}
      </p>
    </div>
  );
}
