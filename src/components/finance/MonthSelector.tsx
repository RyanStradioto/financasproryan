import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getMonthLabel } from '@/lib/format';

type Props = {
  month: string;
  onChange: (month: string) => void;
};

export default function MonthSelector({ month, onChange }: Props) {
  const shift = (dir: number) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + dir);
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="icon" onClick={() => shift(-1)} className="h-8 w-8">
        <ChevronLeft className="w-4 h-4" />
      </Button>
      <span className="text-sm font-semibold capitalize min-w-[140px] text-center">
        {getMonthLabel(month)}
      </span>
      <Button variant="ghost" size="icon" onClick={() => shift(1)} className="h-8 w-8">
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
}
