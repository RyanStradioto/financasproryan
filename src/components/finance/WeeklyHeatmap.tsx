import { useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';
import { useSensitiveData } from '@/components/finance/SensitiveData';

interface WeeklyHeatmapProps {
  month: Date;
  data: Array<{ date: string; amount: number }>;
}

export default function WeeklyHeatmap({ month, data }: WeeklyHeatmapProps) {
  const { maskCurrency } = useSensitiveData();

  const days = useMemo(() => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    const interval = eachDayOfInterval({ start, end });

    // Pad beginning of month to start on Sunday
    const startDay = start.getDay();
    const prefix = Array.from({ length: startDay }).map(() => null);

    const valuesByDate = data.reduce((acc, curr) => {
      acc[curr.date] = (acc[curr.date] || 0) + curr.amount;
      return acc;
    }, {} as Record<string, number>);

    const maxAmount = Math.max(...Object.values(valuesByDate), 1);

    const daysWithData = interval.map(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const amount = valuesByDate[dateStr] || 0;
      const intensity = amount / maxAmount;
      return { date, dateStr, amount, intensity };
    });

    return [...prefix, ...daysWithData];
  }, [month, data]);

  const getIntensityColor = (intensity: number) => {
    if (intensity === 0) return 'bg-muted/30';
    if (intensity < 0.25) return 'bg-expense/20';
    if (intensity < 0.5) return 'bg-expense/40';
    if (intensity < 0.75) return 'bg-expense/60';
    return 'bg-expense/80';
  };

  const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((day, i) => (
          <div key={i} className="text-[10px] text-center font-medium text-muted-foreground mb-1">
            {day}
          </div>
        ))}
        {days.map((day, i) => {
          if (!day) {
            return <div key={`empty-${i}`} className="aspect-square rounded-sm" />;
          }

          const { dateStr, amount, intensity, date } = day;
          return (
            <div
              key={dateStr}
              className="group relative aspect-square"
            >
              <div
                className={cn(
                  'w-full h-full rounded-sm transition-colors duration-300',
                  getIntensityColor(intensity),
                  isToday(date) && 'ring-1 ring-primary ring-offset-1 ring-offset-card'
                )}
              />
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover text-popover-foreground text-[10px] rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 border border-border">
                <p className="font-semibold">{format(date, "dd 'de' MMM", { locale: ptBR })}</p>
                {amount > 0 ? (
                  <p className="text-expense currency">{maskCurrency(formatCurrency(amount))}</p>
                ) : (
                  <p className="text-muted-foreground">Sem gastos</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-end gap-1.5 text-[9px] text-muted-foreground mt-1">
        <span>Menos</span>
        <div className="flex gap-0.5">
          <div className="w-2.5 h-2.5 rounded-[1px] bg-muted/30" />
          <div className="w-2.5 h-2.5 rounded-[1px] bg-expense/20" />
          <div className="w-2.5 h-2.5 rounded-[1px] bg-expense/40" />
          <div className="w-2.5 h-2.5 rounded-[1px] bg-expense/60" />
          <div className="w-2.5 h-2.5 rounded-[1px] bg-expense/80" />
        </div>
        <span>Mais</span>
      </div>
    </div>
  );
}
