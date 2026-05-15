import { Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

function colorWithOpacity(hex: string, opacity: number) {
  const cleanHex = hex.replace('#', '');
  const normalized = cleanHex.length === 3
    ? cleanHex.split('').map((char) => char + char).join('')
    : cleanHex;
  const int = Number.parseInt(normalized, 16);
  if (Number.isNaN(int)) return `rgba(37, 99, 235, ${opacity})`;
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

interface Props {
  logoUrl?: string;
  label: string;
  color: string;
  icon?: string;
  active?: boolean;
  global?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function BrandLogoBadge({
  logoUrl, label, color, icon, active = false, global = false, size = 'md',
}: Props) {
  const isLg = size === 'lg';
  const isSm = size === 'sm';
  const shellSize = isLg ? 'h-20 w-20 rounded-[1.5rem]' : isSm ? 'h-8 w-8 rounded-xl' : 'h-12 w-12 rounded-2xl';
  const logoSize = isLg ? 'h-12 w-12' : isSm ? 'h-5 w-5' : 'h-8 w-8';
  const iconSize = isLg ? 'h-9 w-9' : isSm ? 'h-4 w-4' : 'h-6 w-6';

  if (global) {
    return (
      <span className={cn(
        'relative flex shrink-0 items-center justify-center border border-primary/25 bg-primary/10 text-primary shadow-lg shadow-primary/10',
        shellSize,
      )}>
        <Wallet className={iconSize} />
      </span>
    );
  }

  return (
    <span
      className={cn(
        'relative flex shrink-0 items-center justify-center border shadow-lg transition-transform group-hover:scale-105',
        shellSize,
        active ? 'border-white/20' : 'border-border/50',
      )}
      style={{
        background: `linear-gradient(145deg, ${colorWithOpacity(color, active ? 0.24 : 0.14)}, hsl(var(--card) / 0.92))`,
        boxShadow: active ? `0 18px 44px -24px ${color}` : undefined,
      }}
    >
      {logoUrl ? (
        <span className={cn('flex items-center justify-center rounded-lg bg-white p-1 shadow-sm', isLg ? 'h-14 w-14' : isSm ? 'h-6 w-6' : 'h-9 w-9')}>
          <img src={logoUrl} alt={label} className={cn('object-contain', logoSize)} />
        </span>
      ) : (
        <span className="text-2xl">{icon || '$'}</span>
      )}
    </span>
  );
}
