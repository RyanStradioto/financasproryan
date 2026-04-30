import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';
import { useSensitiveData } from '@/components/finance/SensitiveData';

interface BudgetRingsProps {
  budgets: Array<{
    name: string;
    icon?: string;
    spent: number;
    budget: number;
  }>;
  size?: number;
}

const RING_COLORS = [
  'hsl(160, 84%, 39%)',
  'hsl(217, 91%, 60%)',
  'hsl(280, 67%, 55%)',
  'hsl(38, 92%, 50%)',
  'hsl(350, 80%, 55%)',
];

export default function BudgetRings({ budgets, size = 140 }: BudgetRingsProps) {
  const { maskCurrency } = useSensitiveData();
  const rings = useMemo(() => {
    const maxRings = Math.min(budgets.length, 5);
    const baseRadius = size * 0.38;
    const gap = 11;

    return budgets.slice(0, maxRings).map((b, i) => {
      const radius = baseRadius - i * gap;
      const circumference = 2 * Math.PI * radius;
      const pct = Math.min(b.spent / b.budget, 1);
      const over = b.spent > b.budget;
      const color = over ? 'hsl(0, 72%, 51%)' : RING_COLORS[i % RING_COLORS.length];

      return { ...b, radius, circumference, pct, color, over };
    });
  }, [budgets, size]);

  if (rings.length === 0) return null;

  return (
    <div className="flex flex-col items-center w-full gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {rings.map((ring, i) => (
            <g key={ring.name}>
              {/* Track */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={ring.radius}
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth={5}
                strokeLinecap="round"
                opacity={0.3}
                transform={`rotate(-90, ${size / 2}, ${size / 2})`}
              />
              {/* Progress */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={ring.radius}
                fill="none"
                stroke={ring.color}
                strokeWidth={5}
                strokeLinecap="round"
                strokeDasharray={ring.circumference}
                strokeDashoffset={ring.circumference * (1 - ring.pct)}
                transform={`rotate(-90, ${size / 2}, ${size / 2})`}
                className="transition-all duration-1000 ease-out"
                style={{
                  animationDelay: `${i * 0.15}s`,
                  filter: ring.over ? 'drop-shadow(0 0 6px hsl(0, 72%, 51%, 0.5))' : undefined,
                }}
              />
            </g>
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-extrabold">{rings.length}</span>
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">metas</span>
        </div>
      </div>
      <div className="w-full flex flex-col gap-3">
        {rings.map((ring, i) => (
          <div key={ring.name} className="flex flex-col gap-1.5 w-full">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 overflow-hidden mr-2">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: ring.color, boxShadow: `0 0 8px ${ring.color}` }} />
                <span className={cn('truncate font-semibold', ring.over ? 'text-expense' : 'text-foreground')}>
                  {ring.icon} {ring.name}
                </span>
              </div>
              <span className={cn("currency font-bold shrink-0", ring.over ? 'text-expense' : 'text-foreground')}>
                {maskCurrency(formatCurrency(ring.spent))}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Orçamento: <span className="currency">{maskCurrency(formatCurrency(ring.budget))}</span></span>
              <span className={cn("font-bold", ring.over ? 'text-expense' : 'text-muted-foreground')}>
                {Math.round(ring.pct * 100)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
