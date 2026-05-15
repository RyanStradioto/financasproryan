import type { ElementType } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  title: string;
  subtitle?: string;
  icon?: ElementType;
  iconColor?: string;
  action?: { label: string; href: string };
  className?: string;
}

export default function SectionHeader({ title, subtitle, icon: Icon, iconColor = 'text-primary', action, className }: Props) {
  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <div className="flex items-center gap-2.5 min-w-0">
        {Icon && (
          <div className={cn('w-5 h-5 shrink-0', iconColor)}>
            <Icon className="w-full h-full" />
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-sm font-black text-white leading-tight">{title}</h2>
          {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && (
        <a href={action.href} className="shrink-0 text-[11px] font-bold text-slate-400 hover:text-white transition-colors">
          {action.label} →
        </a>
      )}
    </div>
  );
}
