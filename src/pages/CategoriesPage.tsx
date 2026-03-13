import { useState } from 'react';
import { useCategories, useAddCategory, useExpenses } from '@/hooks/useFinanceData';
import { formatCurrency, getMonthYear } from '@/lib/format';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import MonthSelector from '@/components/finance/MonthSelector';

const ICONS = ['🏠', '🛒', '🚗', '💰', '🎮', '🍔', '📚', '🏋️', '⚕️', '👕', '🎬', '🏷️'];

export default function CategoriesPage() {
  const [month, setMonth] = useState(getMonthYear());
  const { data: categories = [] } = useCategories();
  const { data: expenses = [] } = useExpenses(month);
  const addCategory = useAddCategory();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🏷️');
  const [budget, setBudget] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addCategory.mutateAsync({
        name,
        icon,
        monthly_budget: parseFloat(budget.replace(',', '.')) || 0,
      });
      toast.success('Categoria criada!');
      setName('');
      setIcon('🏷️');
      setBudget('');
      setOpen(false);
    } catch (err: any) { toast.error(err.message); }
  };

  const activeCategories = categories.filter(c => !c.archived);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Categorias</h1>
          <p className="text-sm text-muted-foreground">Orçamento por categoria</p>
        </div>
        <div className="flex items-center gap-3">
          <MonthSelector month={month} onChange={setMonth} />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-1" />Nova Categoria</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Nova Categoria</DialogTitle></DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Ícone</Label>
                  <div className="flex flex-wrap gap-2">
                    {ICONS.map(i => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setIcon(i)}
                        className={`w-10 h-10 rounded-lg text-lg flex items-center justify-center transition-all ${icon === i ? 'bg-primary/10 ring-2 ring-primary' : 'bg-muted hover:bg-muted/80'}`}
                      >{i}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Nome</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Alimentação" required />
                </div>
                <div className="space-y-1.5">
                  <Label>Orçamento Mensal (R$)</Label>
                  <Input value={budget} onChange={e => setBudget(e.target.value)} placeholder="0,00" className="font-mono" />
                </div>
                <Button type="submit" className="w-full" disabled={addCategory.isPending}>Criar</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeCategories.map(cat => {
          const spent = expenses
            .filter(e => e.category_id === cat.id)
            .reduce((s, e) => s + Number(e.amount), 0);
          const budgetNum = Number(cat.monthly_budget);
          const pct = budgetNum > 0 ? Math.min((spent / budgetNum) * 100, 100) : 0;

          return (
            <div key={cat.id} className="stat-card">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">{cat.icon}</span>
                <h3 className="font-semibold text-sm">{cat.name}</h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Gasto no mês</span>
                  <span className="currency font-medium text-foreground">{formatCurrency(spent)}</span>
                </div>
                {budgetNum > 0 && (
                  <>
                    <Progress
                      value={pct}
                      className="h-2"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Orçamento: {formatCurrency(budgetNum)}</span>
                      <span className={pct >= 90 ? 'text-expense font-semibold' : pct >= 60 ? 'text-warning font-semibold' : ''}>
                        {Math.round(pct)}%
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {activeCategories.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            Crie sua primeira categoria para organizar seus gastos
          </div>
        )}
      </div>
    </div>
  );
}
