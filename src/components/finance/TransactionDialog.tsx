import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCategories, useAccounts, useAddIncome, useAddExpense } from '@/hooks/useFinanceData';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

type Props = {
  type: 'income' | 'expense';
  children?: React.ReactNode;
};

export default function TransactionDialog({ type, children }: Props) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [status, setStatus] = useState('concluido');

  const { data: categories } = useCategories();
  const { data: accounts } = useAccounts();
  const addIncome = useAddIncome();
  const addExpense = useAddExpense();

  const reset = () => {
    setDate(new Date().toISOString().split('T')[0]);
    setDescription('');
    setAmount('');
    setCategoryId('');
    setAccountId('');
    setStatus('concluido');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount.replace(',', '.'));
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Valor inválido');
      return;
    }

    try {
      if (type === 'income') {
        await addIncome.mutateAsync({
          date,
          description,
          amount: numAmount,
          account_id: accountId || null,
          status,
        });
      } else {
        await addExpense.mutateAsync({
          date,
          description,
          amount: numAmount,
          category_id: categoryId || null,
          account_id: accountId || null,
          status,
        });
      }
      toast.success(type === 'income' ? 'Receita adicionada!' : 'Despesa adicionada!');
      reset();
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button size="sm" variant={type === 'income' ? 'default' : 'destructive'}>
            <Plus className="w-4 h-4 mr-1" />
            {type === 'income' ? 'Nova Receita' : 'Nova Despesa'}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{type === 'income' ? 'Nova Receita' : 'Nova Despesa'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="font-mono"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Input
              placeholder="Descreva a transação..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          {type === 'expense' && (
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {categories?.filter(c => !c.archived).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Conta</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {accounts?.filter(a => !a.archived).map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.icon} {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="concluido">Concluído</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="agendado">Agendado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={addIncome.isPending || addExpense.isPending}>
            Adicionar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
