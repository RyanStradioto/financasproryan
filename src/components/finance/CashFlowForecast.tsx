import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, LabelList, Cell } from 'recharts';
import { useFinanceHistory } from '@/hooks/useFinanceHistory';
import { formatCurrency } from '@/lib/format';
import { Calculator } from 'lucide-react';
import { useSensitiveData } from '@/components/finance/SensitiveData';

interface TooltipPayload {
  value: number;
  payload?: { forecast?: boolean };
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  const { maskCurrency } = useSensitiveData();

  if (!active || !payload?.length) return null;

  return (
    <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-xl shadow-xl p-3 min-w-[140px]">
      <p className="font-bold text-xs mb-2 pb-2 border-b border-border/50">{label}</p>
      <div className="space-y-1.5">
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex justify-between items-center text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              {entry.name}
            </span>
            <span className="font-bold currency" style={{ color: entry.color }}>
              {maskCurrency(formatCurrency(entry.value))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Custom label renderer to avoid overlap and format nicely
const renderCustomBarLabel = (props: any) => {
  const { x, y, width, value, fill } = props;
  if (!value || value < 100) return null; // Don't show labels for tiny bars to avoid clutter
  
  // Format as 1.2k, etc.
  const formatted = value >= 1000 ? `${(value / 1000).toFixed(1).replace('.0', '')}k` : String(value);
  
  return (
    <text x={x + width / 2} y={y - 8} fill={fill} textAnchor="middle" fontSize={10} fontWeight={600} className="currency">
      {formatted}
    </text>
  );
};

export default function CashFlowForecast() {
  const { data: history = [] } = useFinanceHistory(6);

  const chartData = useMemo(() => {
    const shortMonthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    return history.map(item => {
      const [year, month] = item.month.split('-').map(Number);
      return {
        ...item,
        label: `${shortMonthNames[month - 1]}`,
      };
    });
  }, [history]);

  return (
    <div className="stat-card">
      <div className="flex items-center gap-2 mb-8">
        <Calculator className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Receitas x Despesas</h3>
      </div>
      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 10, left: 0, bottom: 0 }} accessibilityLayer={false}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))', fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
              dy={10}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: 'hsl(var(--muted) / 0.3)', radius: 8 }}
              wrapperStyle={{ outline: 'none', pointerEvents: 'none', zIndex: 20 }}
            />
            <Bar
              dataKey="income"
              name="Receita"
              radius={[6, 6, 0, 0]}
              fill="hsl(160, 84%, 39%)"
              maxBarSize={40}
              isAnimationActive={true}
              animationDuration={1500}
            >
              <LabelList dataKey="income" content={renderCustomBarLabel} />
            </Bar>
            <Bar
              dataKey="expenses"
              name="Despesa"
              radius={[6, 6, 0, 0]}
              fill="hsl(0, 72%, 51%)"
              maxBarSize={40}
              isAnimationActive={true}
              animationDuration={1500}
            >
              <LabelList dataKey="expenses" content={renderCustomBarLabel} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-center gap-6 mt-6 text-xs font-semibold text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-income shadow-[0_0_8px_hsl(160,84%,39%,0.4)]" />
          <span>Receitas</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-expense shadow-[0_0_8px_hsl(0,72%,51%,0.4)]" />
          <span>Despesas</span>
        </div>
      </div>
    </div>
  );
}
