import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, ReferenceLine, Tooltip } from 'recharts';
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

  const value = payload[0]?.value || 0;
  const isForecast = payload[0]?.payload?.forecast;

  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold">{label} {isForecast ? '(previsao)' : ''}</p>
      <p className={`currency font-medium mt-1 ${value >= 0 ? 'text-income' : 'text-expense'}`}>
        {maskCurrency(formatCurrency(value))}
      </p>
    </div>
  );
};

export default function CashFlowForecast() {
  const { data: history = [] } = useFinanceHistory(6);

  const chartData = useMemo(() => {
    if (history.length < 3) return history.map((item) => ({ ...item, forecast: false }));

    const balances = history.map((item) => item.balance);
    const last3 = balances.slice(-3);
    const avgBalance = last3.reduce((a, b) => a + b, 0) / last3.length;
    const trend =
      balances.length >= 2 ? (balances[balances.length - 1] - balances[balances.length - 2]) * 0.3 : 0;

    const shortMonthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const lastMonth = history[history.length - 1];
    const [year, month] = lastMonth.month.split('-').map(Number);

    const forecasts = [];
    for (let offset = 1; offset <= 3; offset += 1) {
      const forecastDate = new Date(year, month - 1 + offset, 1);
      const forecastMonth = forecastDate.getMonth();
      const forecastYear = forecastDate.getFullYear();

      forecasts.push({
        month: `${forecastYear}-${String(forecastMonth + 1).padStart(2, '0')}`,
        label: `${shortMonthNames[forecastMonth]}/${String(forecastYear).slice(2)}`,
        income: 0,
        expenses: 0,
        balance: Math.round(avgBalance + trend * offset),
        forecast: true,
      });
    }

    return [...history.map((item) => ({ ...item, forecast: false })), ...forecasts];
  }, [history]);

  return (
    <div className="stat-card">
      <div className="flex items-center gap-2 mb-4">
        <Calculator className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Previsao de Fluxo</h3>
        <span className="text-xs text-muted-foreground ml-auto">Com projecao</span>
      </div>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }} accessibilityLayer={false}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
              width={40}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: 'transparent' }}
              wrapperStyle={{ outline: 'none', pointerEvents: 'none', zIndex: 20 }}
            />
            <ReferenceLine y={0} stroke="hsl(var(--border))" />
            <Bar
              dataKey="balance"
              radius={[4, 4, 0, 0]}
              fill="hsl(var(--primary))"
              opacity={0.8}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center gap-4 mt-3 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-sm bg-primary opacity-80" />
          <span>Realizado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-sm bg-primary opacity-40" />
          <span>Projecao</span>
        </div>
      </div>
    </div>
  );
}
