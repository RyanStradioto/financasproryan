import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from 'recharts';
import { useFinanceHistory } from '@/hooks/useFinanceHistory';
import { formatCurrency } from '@/lib/format';
import { TrendingUp } from 'lucide-react';

export default function TrendChart() {
  const { data: history = [], isLoading } = useFinanceHistory(6);

  if (isLoading) {
    return (
      <div className="stat-card h-[320px] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="stat-card">
      <div className="flex items-center gap-2 mb-1">
        <TrendingUp className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Evolucao Financeira</h3>
        <span className="text-xs text-muted-foreground ml-auto">Ultimos 6 meses</span>
      </div>
      <div className="flex items-center gap-4 mb-4 px-1">
        {history.length > 0 && (
          <>
            <div className="text-xs">
              <span className="text-muted-foreground">Receitas avg: </span>
              <span className="font-semibold text-income">
                {formatCurrency(history.reduce((sum, item) => sum + item.income, 0) / history.length)}
              </span>
            </div>
            <div className="text-xs">
              <span className="text-muted-foreground">Despesas avg: </span>
              <span className="font-semibold text-expense">
                {formatCurrency(history.reduce((sum, item) => sum + item.expenses, 0) / history.length)}
              </span>
            </div>
          </>
        )}
      </div>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.2} />
                <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
              width={36}
            />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
            <Area
              type="monotone"
              dataKey="income"
              name="Receitas"
              stroke="hsl(160, 84%, 39%)"
              fill="url(#incomeGrad)"
              strokeWidth={2.5}
              dot={{ r: 3.5, fill: 'hsl(160, 84%, 39%)', strokeWidth: 0 }}
              activeDot={false}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="expenses"
              name="Despesas"
              stroke="hsl(0, 72%, 51%)"
              fill="url(#expenseGrad)"
              strokeWidth={2.5}
              dot={{ r: 3.5, fill: 'hsl(0, 72%, 51%)', strokeWidth: 0 }}
              activeDot={false}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="balance"
              name="Saldo"
              stroke="hsl(217, 91%, 60%)"
              fill="url(#balanceGrad)"
              strokeWidth={2}
              strokeDasharray="4 2"
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
