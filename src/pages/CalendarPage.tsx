import { useState, useMemo } from 'react';
import { useIncome, useExpenses, useCategories } from '@/hooks/useFinanceData';
import { formatCurrency, getMonthYear } from '@/lib/format';
import MonthSelector from '@/components/finance/MonthSelector';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function CalendarPage() {
  const [month, setMonth] = useState(getMonthYear());
  const { data: income = [] } = useIncome(month);
  const { data: expenses = [] } = useExpenses(month);
  const { data: categories = [] } = useCategories();

  const [year, mon] = month.split('-').map(Number);

  const daysInMonth = new Date(year, mon, 0).getDate();
  const firstDayOfWeek = new Date(year, mon - 1, 1).getDay(); // 0=Sun

  const dayData = useMemo(() => {
    const map: Record<number, { income: number; expenses: { amount: number; desc: string; cat: string }[] }> = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(mon).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayIncome = income.filter(i => i.date === dateStr).reduce((s, i) => s + Number(i.amount), 0);
      const dayExpenses = expenses
        .filter(e => e.date === dateStr)
        .map(e => ({
          amount: Number(e.amount),
          desc: e.description || 'Despesa',
          cat: categories.find(c => c.id === e.category_id)?.icon || '',
        }));
      if (dayIncome > 0 || dayExpenses.length > 0) {
        map[d] = { income: dayIncome, expenses: dayExpenses };
      }
    }
    return map;
  }, [income, expenses, categories, daysInMonth, year, mon]);

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendário Financeiro</h1>
          <p className="text-sm text-muted-foreground">Visualize gastos e receitas por dia</p>
        </div>
        <MonthSelector month={month} onChange={setMonth} />
      </div>

      <div className="stat-card overflow-hidden p-0">
        <div className="grid grid-cols-7">
          {weekDays.map(d => (
            <div key={d} className="text-center py-3 text-xs font-semibold text-muted-foreground border-b border-border bg-muted/30">
              {d}
            </div>
          ))}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[100px] border-b border-r border-border/50 bg-muted/10" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const data = dayData[day];
            const isToday = new Date().getDate() === day && new Date().getMonth() + 1 === mon && new Date().getFullYear() === year;

            return (
              <div
                key={day}
                className={`min-h-[100px] border-b border-r border-border/50 p-1.5 text-xs transition-colors hover:bg-muted/30 ${isToday ? 'bg-primary/5' : ''}`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center mb-1 text-xs font-medium ${isToday ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
                  {day}
                </div>
                {data && (
                  <div className="space-y-0.5">
                    {data.income > 0 && (
                      <div className="bg-income/10 text-income rounded px-1 py-0.5 truncate currency text-[10px] font-medium">
                        +{formatCurrency(data.income)}
                      </div>
                    )}
                    {data.expenses.slice(0, 2).map((e, ei) => (
                      <div key={ei} className="bg-expense/10 text-expense rounded px-1 py-0.5 truncate text-[10px]">
                        {e.cat} {formatCurrency(e.amount)}
                      </div>
                    ))}
                    {data.expenses.length > 2 && (
                      <div className="text-[10px] text-muted-foreground px-1">+{data.expenses.length - 2} mais</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
