import { useState } from 'react';
import { useAccounts, useAddAccount, useUpdateAccount, useIncome, useExpenses } from '@/hooks/useFinanceData';
import { useInvestmentTransactions } from '@/hooks/useInvestments';
import { formatCurrency } from '@/lib/format';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Landmark, TrendingUp, TrendingDown, Wallet, Info, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { accountBrandFromRow, resolveAccountBrand } from '@/lib/accountBrand';

function getInvestmentAccountImpact(type: string, amount: number) {
  if (!amount) return 0;
  if (type === 'aporte' || type === 'taxa' || type === 'ir') return -amount;
  if (type === 'resgate' || type === 'rendimento') return amount;
  return 0;
}

export default function AccountsPage() {
  const { data: accounts = [] } = useAccounts();
  const { data: income = [] } = useIncome();
  const { data: allExpenses = [] } = useExpenses();
  const { data: allTransactions = [] } = useInvestmentTransactions();
  const addAccount = useAddAccount();
  const updateAccount = useUpdateAccount();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🏦');
  const [initialBalance, setInitialBalance] = useState('');

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState('');
  const [editName, setEditName] = useState('');
  const [editInitialBalance, setEditInitialBalance] = useState('');

  const ICONS = ['🏦', '💳', '💰', '🏧', '📱', '🏛️'];

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addAccount.mutateAsync({
        name,
        icon: resolveAccountBrand(name, undefined, icon).icon,
        color: resolveAccountBrand(name).color,
        initial_balance: parseFloat(initialBalance.replace(',', '.')) || 0,
      });
      toast.success('Conta criada!');
      setName('');
      setIcon('🏦');
      setInitialBalance('');
      setOpen(false);
    } catch (err) {
      const error = err as Error;
      toast.error(error.message);
    }
  };

  const openEdit = (acc: typeof accounts[0]) => {
    setEditId(acc.id);
    setEditName(acc.name);
    setEditInitialBalance(String(Number(acc.initial_balance) || 0).replace('.', ','));
    setEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newBalance = parseFloat(editInitialBalance.replace(',', '.'));
      await updateAccount.mutateAsync({
        id: editId,
        name: editName,
        initial_balance: isNaN(newBalance) ? 0 : newBalance,
        color: resolveAccountBrand(editName).color,
        icon: resolveAccountBrand(editName).icon,
      });
      toast.success('Conta atualizada!');
      setEditOpen(false);
    } catch (err) {
      const error = err as Error;
      toast.error(error.message);
    }
  };

  const activeAccounts = accounts.filter(a => !a.archived);

  const totalIncomeAll = income.filter(i => i.status === 'concluido').reduce((s, i) => s + Number(i.amount), 0);
  const totalExpensesAll = allExpenses.filter(e => e.status === 'concluido').reduce((s, e) => s + Number(e.amount), 0);
  const totalInitialBalance = activeAccounts.reduce((s, a) => s + Number(a.initial_balance), 0);
  const totalInvestmentTransfers = allTransactions.reduce((s, t) => s + getInvestmentAccountImpact(t.type, Number(t.amount)), 0);
  const globalBalance = totalInitialBalance + totalIncomeAll - totalExpensesAll + totalInvestmentTransfers;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contas Bancárias</h1>
          <p className="text-sm text-muted-foreground">Gerencie suas contas e visualize o fluxo geral</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="w-full sm:w-auto" data-tutorial-target="new-account"><Plus className="w-4 h-4 mr-1" />Nova Conta</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Nova Conta</DialogTitle></DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Ícone</Label>
                <div className="flex gap-2">
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
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Nubank" required />
              </div>
              <div className="space-y-1.5">
                <Label>Saldo Inicial (R$)</Label>
                <Input value={initialBalance} onChange={e => setInitialBalance(e.target.value)} placeholder="0,00" className="font-mono" />
              </div>
              <Button type="submit" className="w-full" disabled={addAccount.isPending}>Criar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Account Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Editar Conta</DialogTitle></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Saldo Inicial (R$)</Label>
              <Input value={editInitialBalance} onChange={e => setEditInitialBalance(e.target.value)} placeholder="0,00" className="font-mono" />
              <p className="text-[11px] text-muted-foreground mt-1">
                💡 Ajuste este valor para corrigir o saldo acumulado exibido na Dashboard. Se o saldo está mais alto do que deveria, diminua este número.
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={updateAccount.isPending}>Salvar Alterações</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Card de Saldo Global ── */}
      <div className="rounded-xl bg-primary/5 border border-primary/20 p-5">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Wallet className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-sm">Fluxo Geral de Caixa</h2>
          <span className="w-full text-xs text-muted-foreground flex items-center gap-1 sm:ml-auto sm:w-auto">
            <Info className="w-3 h-3" /> Todas as transações (com e sem conta vinculada)
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-income mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-medium">Receitas pagas</span>
            </div>
            <p className="currency font-bold text-income text-lg">{formatCurrency(totalIncomeAll)}</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-expense mb-1">
              <TrendingDown className="w-4 h-4" />
              <span className="text-xs font-medium">Despesas pagas</span>
            </div>
            <p className="currency font-bold text-expense text-lg">{formatCurrency(totalExpensesAll)}</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-foreground mb-1">
              <Wallet className="w-4 h-4" />
              <span className="text-xs font-medium">Saldo atual</span>
            </div>
            <p className={`currency font-bold text-lg ${globalBalance >= 0 ? 'text-income' : 'text-expense'}`}>
              {formatCurrency(globalBalance)}
            </p>
          </div>
        </div>
        {activeAccounts.length > 0 && (
          <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-primary/10">
            Inclui saldo inicial total de {formatCurrency(totalInitialBalance)} das {activeAccounts.length} conta(s) cadastrada(s)
          </p>
        )}
      </div>

      {/* ── Contas individuais ── */}
      {activeAccounts.length > 0 && (
        <>
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-sm">Contas Cadastradas</h2>
            <span className="text-xs text-muted-foreground ml-1">— transações vinculadas a cada conta</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeAccounts.map(acc => {
              const brand = accountBrandFromRow(acc);
              const accIncome = income.filter(i => i.account_id === acc.id && i.status === 'concluido').reduce((s, i) => s + Number(i.amount), 0);
              const accExpenses = allExpenses.filter(e => e.account_id === acc.id && e.status === 'concluido').reduce((s, e) => s + Number(e.amount), 0);
              const accTransfers = allTransactions
                .filter(t => t.account_id === acc.id)
                .reduce((sum, t) => sum + getInvestmentAccountImpact(t.type, Number(t.amount)), 0);
              const currentBalance = Number(acc.initial_balance) + accIncome - accExpenses + accTransfers;

              return (
                <div key={acc.id} className="stat-card relative group" style={{ borderColor: `${brand.color}35`, background: `linear-gradient(135deg, ${brand.color}12, transparent 35%)` }}>
                  <button
                    onClick={() => openEdit(acc)}
                    className="absolute top-3 right-3 p-2 rounded-lg bg-muted/50 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted hover:text-foreground transition-all"
                    title="Editar conta"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex items-center gap-2 mb-4">
                    {brand.logoUrl ? (
                      <img src={brand.logoUrl} alt={acc.name} className="w-5 h-5 rounded-sm object-contain" />
                    ) : (
                      <span className="text-xl">{brand.icon}</span>
                    )}
                    <h3 className="font-semibold">{acc.name}</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Receitas vinculadas</span>
                      <span className="currency font-medium text-income">{formatCurrency(accIncome)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Despesas vinculadas</span>
                      <span className="currency font-medium text-expense">{formatCurrency(accExpenses)}</span>
                    </div>
                    <div className="border-t border-border pt-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Saldo inicial</span>
                        <span className="currency">{formatCurrency(Number(acc.initial_balance))}</span>
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="font-semibold">Saldo</span>
                        <span className={`currency font-bold ${currentBalance >= 0 ? 'text-income' : 'text-expense'}`}>
                          {formatCurrency(currentBalance)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {activeAccounts.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Landmark className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Adicione sua primeira conta bancária</p>
        </div>
      )}
    </div>
  );
}
