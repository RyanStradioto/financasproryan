import { useState } from 'react';
import { Plus, TrendingUp, ArrowUpCircle, ArrowDownCircle, Pencil, Trash2, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  useInvestments,
  useAddInvestment,
  useDeleteInvestment,
  useAddInvestmentTransaction,
  useInvestmentTransactions,
} from '@/hooks/useInvestments';
import { useAccounts } from '@/hooks/useFinanceData';
import { formatCurrency, formatDate } from '@/lib/format';
import { toast } from 'sonner';
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const INVESTMENT_TYPES = [
  { value: 'cdb', label: 'CDB', icon: '🏦' },
  { value: 'lci', label: 'LCI', icon: '🏛️' },
  { value: 'lca', label: 'LCA', icon: '🌾' },
  { value: 'tesouro', label: 'Tesouro Direto', icon: '🏛️' },
  { value: 'acoes', label: 'Ações', icon: '📈' },
  { value: 'fii', label: 'FII', icon: '🏢' },
  { value: 'poupanca', label: 'Poupança', icon: '🐷' },
  { value: 'caixinha', label: 'Caixinha', icon: '📦' },
  { value: 'fundo', label: 'Fundo', icon: '📊' },
  { value: 'cripto', label: 'Cripto', icon: '₿' },
  { value: 'outro', label: 'Outro', icon: '💼' },
];

const TYPE_COLORS: Record<string, string> = {
  cdb: '#10b981', lci: '#06b6d4', lca: '#84cc16', tesouro: '#3b82f6',
  acoes: '#f59e0b', fii: '#8b5cf6', poupanca: '#ec4899', caixinha: '#f97316',
  fundo: '#6366f1', cripto: '#ef4444', outro: '#6b7280',
};

export default function InvestmentsPage() {
  const { data: investments = [] } = useInvestments();
  const { data: accounts = [] } = useAccounts();
  const { data: allTransactions = [] } = useInvestmentTransactions();
  const addInvestment = useAddInvestment();
  const deleteInvestment = useDeleteInvestment();
  const addTransaction = useAddInvestmentTransaction();

  const [showNewInvestment, setShowNewInvestment] = useState(false);
  const [showAporte, setShowAporte] = useState<string | null>(null);
  const [selectedInvestment, setSelectedInvestment] = useState<string | null>(null);

  const [newInv, setNewInv] = useState({ name: '', type: 'cdb', institution: '', current_value: '' });
  const [aporteData, setAporteData] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    type: 'aporte' as const,
    account_id: '',
    description: '',
  });

  const totalPatrimony = investments.reduce((s, i) => s + Number(i.current_value), 0);
  const totalInvested = investments.reduce((s, i) => s + Number(i.total_invested), 0);
  const totalReturn = totalPatrimony - totalInvested;
  const returnPct = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;

  const selectedTxns = selectedInvestment
    ? allTransactions.filter(t => t.investment_id === selectedInvestment)
    : allTransactions;

  const handleNewInvestment = async () => {
    if (!newInv.name) return toast.error('Informe o nome do investimento');
    try {
      await addInvestment.mutateAsync({
        name: newInv.name,
        type: newInv.type,
        institution: newInv.institution,
        current_value: parseFloat(newInv.current_value) || 0,
        total_invested: parseFloat(newInv.current_value) || 0,
        icon: INVESTMENT_TYPES.find(t => t.value === newInv.type)?.icon ?? '📈',
        color: TYPE_COLORS[newInv.type] ?? '#10b981',
      });
      toast.success('Investimento cadastrado!');
      setShowNewInvestment(false);
      setNewInv({ name: '', type: 'cdb', institution: '', current_value: '' });
    } catch (e: any) { toast.error(e.message); }
  };

  const handleAporte = async () => {
    if (!aporteData.amount || !showAporte) return;
    try {
      await addTransaction.mutateAsync({
        investment_id: showAporte,
        type: aporteData.type,
        amount: parseFloat(aporteData.amount),
        date: aporteData.date,
        account_id: aporteData.account_id || null,
        description: aporteData.description || (aporteData.type === 'aporte' ? 'Aporte' : 'Movimentação'),
      });
      const label = aporteData.type === 'aporte' ? 'Aporte' : aporteData.type === 'resgate' ? 'Resgate' : 'Movimentação';
      toast.success(`${label} registrado como movimentação patrimonial ✅`);
      setShowAporte(null);
      setAporteData({ amount: '', date: new Date().toISOString().split('T')[0], type: 'aporte', account_id: '', description: '' });
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Investimentos</h1>
          <p className="text-sm text-muted-foreground">Gestão patrimonial — investimentos não são despesas</p>
        </div>
        <Button onClick={() => setShowNewInvestment(true)}>
          <Plus className="w-4 h-4 mr-1" /> Novo Ativo
        </Button>
      </div>

      {/* Patrimony Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card">
          <p className="text-xs text-muted-foreground mb-1">Patrimônio Total</p>
          <p className="text-xl font-bold text-primary">{formatCurrency(totalPatrimony)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground mb-1">Total Investido</p>
          <p className="text-xl font-bold">{formatCurrency(totalInvested)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground mb-1">Rendimento</p>
          <p className={`text-xl font-bold ${totalReturn >= 0 ? 'text-income' : 'text-expense'}`}>
            {totalReturn >= 0 ? '+' : ''}{formatCurrency(totalReturn)}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground mb-1">Retorno %</p>
          <p className={`text-xl font-bold ${returnPct >= 0 ? 'text-income' : 'text-expense'}`}>
            {returnPct >= 0 ? '+' : ''}{returnPct.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3 text-sm flex items-start gap-3">
        <BarChart3 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        <div>
          <span className="font-medium text-primary">Lógica patrimonial ativa</span>
          <span className="text-muted-foreground ml-2">Aportes transferem patrimônio (conta → investimento). Nunca são registrados como despesas.</span>
        </div>
      </div>

      {/* Investment Cards */}
      {investments.length === 0 ? (
        <div className="stat-card py-16 text-center">
          <TrendingUp className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="font-medium text-muted-foreground">Nenhum investimento cadastrado</p>
          <p className="text-sm text-muted-foreground mt-1">Adicione seus ativos para acompanhar o patrimônio</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {investments.map(inv => {
            const typeInfo = INVESTMENT_TYPES.find(t => t.value === inv.type);
            const returnVal = Number(inv.current_value) - Number(inv.total_invested);
            const pct = Number(inv.total_invested) > 0
              ? (returnVal / Number(inv.total_invested)) * 100 : 0;
            const isSelected = selectedInvestment === inv.id;
            return (
              <div
                key={inv.id}
                className={`stat-card cursor-pointer transition-all ${isSelected ? 'ring-2 ring-primary' : 'hover:ring-1 hover:ring-border'}`}
                onClick={() => setSelectedInvestment(isSelected ? null : inv.id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
                      style={{ backgroundColor: (inv.color ?? '#10b981') + '22' }}>
                      {inv.icon}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{inv.name}</p>
                      <p className="text-xs text-muted-foreground">{typeInfo?.label} {inv.institution && `· ${inv.institution}`}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowAporte(inv.id); }}
                      className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors"
                      title="Registrar movimentação"
                    >
                      <ArrowUpCircle className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteInvestment.mutate(inv.id); }}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Valor atual</span>
                    <span className="font-bold">{formatCurrency(Number(inv.current_value))}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Investido</span>
                    <span>{formatCurrency(Number(inv.total_invested))}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Rendimento</span>
                    <span className={returnVal >= 0 ? 'text-income font-medium' : 'text-expense font-medium'}>
                      {returnVal >= 0 ? '+' : ''}{formatCurrency(returnVal)} ({pct >= 0 ? '+' : ''}{pct.toFixed(2)}%)
                    </span>
                  </div>
                </div>
                <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, (Number(inv.current_value) / (totalPatrimony || 1)) * 100)}%`,
                      backgroundColor: inv.color ?? '#10b981'
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Transactions History */}
      {selectedTxns.length > 0 && (
        <div className="stat-card">
          <h3 className="font-semibold text-sm mb-4">
            {selectedInvestment
              ? `Histórico — ${investments.find(i => i.id === selectedInvestment)?.name}`
              : 'Histórico de movimentações'}
          </h3>
          <div className="space-y-2">
            {selectedTxns.slice(0, 20).map(t => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    t.type === 'aporte' ? 'bg-primary' :
                    t.type === 'resgate' ? 'bg-expense' :
                    t.type === 'rendimento' ? 'bg-income' : 'bg-warning'
                  }`} />
                  <div>
                    <p className="text-sm font-medium">{t.description || t.type}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(t.date)}</p>
                  </div>
                </div>
                <span className={`text-sm font-semibold currency ${
                  t.type === 'aporte' || t.type === 'rendimento' ? 'text-income' : 'text-expense'
                }`}>
                  {t.type === 'aporte' || t.type === 'rendimento' ? '+' : '-'}{formatCurrency(Number(t.amount))}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New Investment Dialog */}
      <Dialog open={showNewInvestment} onOpenChange={setShowNewInvestment}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Investimento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input placeholder="Ex: CDB Nubank 100% CDI" value={newInv.name} onChange={e => setNewInv(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={newInv.type} onValueChange={v => setNewInv(p => ({ ...p, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INVESTMENT_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Instituição</Label>
              <Input placeholder="Ex: Nubank, XP, BTG..." value={newInv.institution} onChange={e => setNewInv(p => ({ ...p, institution: e.target.value }))} />
            </div>
            <div>
              <Label>Valor atual (R$)</Label>
              <Input type="number" placeholder="0,00" value={newInv.current_value} onChange={e => setNewInv(p => ({ ...p, current_value: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewInvestment(false)}>Cancelar</Button>
            <Button onClick={handleNewInvestment} disabled={addInvestment.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Aporte/Resgate Dialog */}
      <Dialog open={!!showAporte} onOpenChange={o => !o && setShowAporte(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Movimentação Patrimonial</DialogTitle>
          </DialogHeader>
          <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-xs text-muted-foreground mb-2">
            ℹ️ Esta movimentação <strong>não é uma despesa</strong>. Ela transfere dinheiro entre sua conta e o investimento.
          </div>
          <div className="space-y-4">
            <div>
              <Label>Tipo</Label>
              <Select value={aporteData.type} onValueChange={(v: any) => setAporteData(p => ({ ...p, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aporte">Aporte (entrada no investimento)</SelectItem>
                  <SelectItem value="resgate">Resgate (retirada)</SelectItem>
                  <SelectItem value="rendimento">Rendimento recebido</SelectItem>
                  <SelectItem value="taxa">Taxa/custo</SelectItem>
                  <SelectItem value="ir">IR sobre rendimento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor (R$)</Label>
              <Input type="number" placeholder="0,00" value={aporteData.amount} onChange={e => setAporteData(p => ({ ...p, amount: e.target.value }))} />
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={aporteData.date} onChange={e => setAporteData(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div>
              <Label>Conta de origem (opcional)</Label>
              <Select value={aporteData.account_id} onValueChange={v => setAporteData(p => ({ ...p, account_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione conta..." /></SelectTrigger>
                <SelectContent>
                  {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.icon} {a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descrição</Label>
              <Input placeholder="Ex: Aporte mensal..." value={aporteData.description} onChange={e => setAporteData(p => ({ ...p, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAporte(null)}>Cancelar</Button>
            <Button onClick={handleAporte} disabled={addTransaction.isPending}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
