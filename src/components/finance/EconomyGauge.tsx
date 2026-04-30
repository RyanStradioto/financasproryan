import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface EconomyGaugeProps {
  percentage: number;
  size?: number;
  label?: string;
}

export default function EconomyGauge({ percentage, size = 120, label = 'Economia' }: EconomyGaugeProps) {
  const clampedPct = Math.max(0, Math.min(100, percentage));
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // Show 270 degrees (3/4 circle)
  const arcLength = circumference * 0.75;
  const dashOffset = arcLength - (clampedPct / 100) * arcLength;

  const color = useMemo(() => {
    if (clampedPct >= 20) return { stroke: 'hsl(160, 84%, 39%)', glow: 'hsl(160, 84%, 39%, 0.3)', text: 'text-income' };
    if (clampedPct >= 10) return { stroke: 'hsl(38, 92%, 50%)', glow: 'hsl(38, 92%, 50%, 0.3)', text: 'text-warning' };
    return { stroke: 'hsl(0, 72%, 51%)', glow: 'hsl(0, 72%, 51%, 0.3)', text: 'text-expense' };
  }, [clampedPct]);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative flex justify-center mb-2" style={{ width: size, height: size * 0.85 }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="overflow-visible"
          style={{ transform: 'rotate(135deg)' }}
        >
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
          />
          {/* Value arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color.stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
            style={{ filter: `drop-shadow(0 0 6px ${color.glow})` }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ paddingTop: size * 0.05 }}>
          <span className={cn('text-2xl font-extrabold currency', color.text)}>
            {clampedPct.toFixed(0)}%
          </span>
        </div>
      </div>
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-center">{label}</span>
    </div>
  );
}
