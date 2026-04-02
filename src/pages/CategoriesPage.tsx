import { useState } from 'react';
import { useCategories, useAddCategory, useUpdateCategory, useDeleteCategory, useExpenses } from '@/hooks/useFinanceData';
import { formatCurrency, getMonthYear } from '@/lib/format';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import MonthSelector from '@/components/finance/MonthSelector';

const ICONS = ['🏠', '🛒', '🚗', '💰', '🎮', '🍔', '📚', '🏋️', '⚕️', '👕', '🎬', '🏷️', '💳', '📱', '✈️', '🐶'];

function CurrencyInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d]/g, '');
    if (!raw) { onChange(''); return; }
    const num = parseInt(raw) / 100;
    onChange(num.toFixed(2).replace('.', ','));
  };
  return (
    <Input
      value={value ? `R$ ${value}` : ''}
      onChange={handleChange}
      placeholder="R$ 0,00"
      className="font-mono"
    />
  );
}

export default function CategoriesPage() {
  const [month, setMonth] = useState(getMonthYear());
  const { data: categories = [] } = useCategories();
  const { data: expenses = [] } = useExpenses(month);
  const addCategory = useAddCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🏷️');
  const [budget, setBudget] = useState('');

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState('');
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [editBudget, setEditBudget] = useState('');

  const activeCategories = categories.filter(c => !c.archived);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { toast.error('Nome é obrigatório'); return; }
    if (activeCategories.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('Já existe uma categoria com este nome');
      return;
    }
    const numBudget = parseFloat(budget.replace(',', '.')) || 0;
    if (numBudget < 0) { toast.error('Orçamento não pode ser negativo'); return; }
    try {
      await addCategory.mutateAsync({ name: trimmed, icon, monthly_budget: numBudget });
      toast.success('Categoria criada!');
      setName(''); setIcon('🏷️'); setBudget(''); setOpen(false);
    } catch (err) {
      const error = err as Error;
      toast.error(error.message);
    }
  };

  const openEdit = (cat: typeof activeCategories[0]) => {
    setEditId(cat.id);
    setEditName(cat.name);
    setEditIcon(cat.icon);
    setEditBudget(Number(cat.monthly_budget).toFixed(2).replace('.', ','));
    setEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = editName.trim();
    if (!trimmed) { toast.error('Nome é obrigatório'); return; }
    if (activeCategories.some(c => c.id !== editId && c.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('Já existe uma categoria com este nome');
      return;
    }
    const numBudget = parseFloat(editBudget.replace(',', '.')) || 0;
    if (numBudget < 0) { toast.error('Orçamento não pode ser negativo'); return; }
    try {
      await updateCategory.mutateAsync({ id: editId, name: trimmed, icon: editIcon, monthly_budget: numBudget });
      toast.success('Categoria atualizada!');
      setEditOpen(false);
    } catch (err) {
      const error = err as Error;
      toast.error(error.message);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteCategory.mutateAsync(editId);
      toast.success('Categoria arquivada');
      setEditOpen(false);
    } catch (err) {
      const error = err as Error;
      toast.error(error.message);
    }
  };

  const isAddValid = name.trim().length > 0;

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
                  <Label>Orçamento Mensal</Label>
                  <CurrencyInput value={budget} onChange={setBudget} />
                </div>
                <Button type="submit" className="w-full" disabled={addCategory.isPending || !isAddValid}>Criar</Button>
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
          const overBudget = budgetNum > 0 && spent > budgetNum;

          return (
            <div
              key={cat.id}
              className="stat-card cursor-pointer group hover:ring-1 hover:ring-primary/30 transition-all"
              onClick={() => openEdit(cat)}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{cat.icon}</span>
                  <h3 className="font-semibold text-sm">{cat.name}</h3>
                </div>
                <Pencil className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Gasto no mês</span>
                  <span className={`currency font-medium ${overBudget ? 'text-expense' : 'text-foreground'}`}>{formatCurrency(spent)}</span>
                </div>
                {budgetNum > 0 && (
                  <>
                    <div className="relative">
                      <Progress value={pct} className="h-2.5" />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Orçamento: {formatCurrency(budgetNum)}</span>
                      <span className={pct >= 90 ? 'text-expense font-semibold' : pct >= 60 ? 'text-warning font-semibold' : 'text-income font-medium'}>
                        {Math.round(pct)}%
                      </span>
                    </div>
                    {overBudget && (
                      <p className="text-xs text-expense font-medium">
                        ⚠️ Excedido em {formatCurrency(spent - budgetNum)}
                      </p>
                    )}
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

      {/* Edit Category Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Editar Categoria</DialogTitle></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Ícone</Label>
              <div className="flex flex-wrap gap-2">
                {ICONS.map(i => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setEditIcon(i)}
                    className={`w-10 h-10 rounded-lg text-lg flex items-center justify-center transition-all ${editIcon === i ? 'bg-primary/10 ring-2 ring-primary' : 'bg-muted hover:bg-muted/80'}`}
                  >{i}</button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Orçamento Mensal</Label>
              <CurrencyInput value={editBudget} onChange={setEditBudget} />
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={updateCategory.isPending}>Salvar</Button>
              <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleteCategory.isPending}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
