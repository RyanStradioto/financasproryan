import { useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getMonthLabel } from '@/lib/format';
import { cn } from '@/lib/utils';

type Props = {
  month: string;
  onChange: (month: string) => void;
};

const SHORT_MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export default function MonthSelector({ month, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [y, m] = month.split('-').map(Number);
  const [viewYear, setViewYear] = useState(y);

  const shift = (dir: number) => {
    const d = new Date(y, m - 1 + dir);
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const selectMonth = (mo: number) => {
    onChange(`${viewYear}-${String(mo + 1).padStart(2, '0')}`);
    setOpen(false);
  };

  const nowMonth = new Date().getMonth();
  const nowYear = new Date().getFullYear();

  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" onClick={() => shift(-1)} className="h-8 w-8">
        <ChevronLeft className="w-4 h-4" />
      </Button>

      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setViewYear(y); }}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="min-w-[160px] gap-2 capitalize">
            <CalendarDays className="w-3.5 h-3.5" />
            {getMonthLabel(month)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-3" align="center">
          <div className="flex items-center justify-between mb-3">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewYear(v => v - 1)}>
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <span className="text-sm font-bold">{viewYear}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewYear(v => v + 1)}>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {SHORT_MONTHS.map((label, i) => {
              const isSelected = viewYear === y && i === m - 1;
              const isCurrent = viewYear === nowYear && i === nowMonth;
              return (
                <button
                  key={i}
                  onClick={() => selectMonth(i)}
                  className={cn(
                    'rounded-lg px-2 py-2 text-xs font-medium transition-all',
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : isCurrent
                        ? 'bg-primary/10 text-primary hover:bg-primary/20'
                        : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className="mt-2 pt-2 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => {
                onChange(`${nowYear}-${String(nowMonth + 1).padStart(2, '0')}`);
                setOpen(false);
              }}
            >
              Mês Atual
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Button variant="ghost" size="icon" onClick={() => shift(1)} className="h-8 w-8">
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
}
