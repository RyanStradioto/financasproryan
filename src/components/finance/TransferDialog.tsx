import { useState, type ReactNode } from 'react';
import { ArrowLeftRight, ArrowRight, Trash2, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAccounts } from '@/hooks/useFinanceData';
import { useTransferBetweenAccounts, useRecentTransfers, useDeleteTransfer } from '@/hooks/useTransfers';
import { formatCurrency, formatDate } from '@/lib/format';
import { toast } from 'sonner';

const todayLocal = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD (local)

export default function TransferDialog({ children, defaultFromId }: { children: ReactNode; defaultFromId?: string }) {
  const [open, setOpen] = useState(false);
  const { data: accounts = [] } = useAccounts();
  const active = accounts.filter((a) => !a.archived);
  const transfer = useTransferBetweenAccounts();
  const del = useDeleteTransfer();
  const { data: recent = [] } = useRecentTransfers(8);

  const [fromId, setFromId] = useState(defaultFromId ?? '');
  const [toId, setToId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayLocal());
  const [desc, setDesc] = useState('');

  const acc = (id: string | null) => active.find((a) => a.id === id) || accounts.find((a) => a.id === id);

  const reset = () => { setAmount(''); setDesc(''); setDate(todayLocal()); };

  const submit = async () => {
    if (!fromId || !toId) return toast.error('Escolha a conta de origem e a de destino.');
    if (fromId === toId) return toast.error('As contas precisam ser diferentes.');
    const val = Number(amount);
    if (!(val > 0)) return toast.error('Informe um valor válido.');
    try {
      await transfer.mutateAsync({ fromAccountId: fromId, toAccountId: toId, amount: val, date, description: desc });
      toast.success('Transferência registrada!', { description: 'É neutra: sai de uma conta e entra na outra, sem contar como gasto.' });
      reset();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ArrowLeftRight className="h-5 w-5 text-primary" /> Transferir entre contas</DialogTitle>
        </DialogHeader>

        <div className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">De</Label>
              <Select value={fromId} onValueChange={setFromId}>
                <SelectTrigger><SelectValue placeholder="Origem" /></SelectTrigger>
                <SelectContent>{active.map((a) => <SelectItem key={a.id} value={a.id}>{a.icon} {a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">Para</Label>
              <Select value={toId} onValueChange={setToId}>
                <SelectTrigger><SelectValue placeholder="Destino" /></SelectTrigger>
                <SelectContent>{active.filter((a) => a.id !== fromId).map((a) => <SelectItem key={a.id} value={a.id}>{a.icon} {a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">Valor (R$)</Label>
              <Input inputMode="decimal" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Descrição (opcional)</Label>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex: reserva, pagar cartão..." maxLength={80} />
          </div>

          <div className="rounded-xl border border-info/20 bg-info/[0.06] p-2.5 text-[11px] leading-relaxed text-muted-foreground">
            💡 A transferência é <b className="text-foreground">neutra</b>: reduz o saldo da conta de origem e aumenta o da conta de destino, mas <b className="text-foreground">não</b> entra como gasto nem receita nas análises.
          </div>

          <Button onClick={submit} disabled={transfer.isPending} className="w-full gap-2">
            <ArrowLeftRight className="h-4 w-4" /> {transfer.isPending ? 'Transferindo...' : 'Transferir'}
          </Button>

          {recent.length > 0 && (
            <div className="pt-1">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Clock className="h-3.5 w-3.5" /> Transferências recentes</p>
              <div className="space-y-1.5">
                {recent.map((t) => {
                  const from = acc(t.fromAccountId);
                  const to = acc(t.toAccountId);
                  return (
                    <div key={t.id} className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
                      <div className="flex min-w-0 items-center gap-1.5 text-xs">
                        <span className="truncate">{from?.icon} {from?.name || '—'}</span>
                        <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className="truncate">{to?.icon} {to?.name || '—'}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-xs font-bold tabular-nums">{formatCurrency(t.amount)}</span>
                        <span className="text-[10px] text-muted-foreground">{formatDate(t.date)}</span>
                        <button
                          onClick={async () => { try { await del.mutateAsync(t.id); toast.success('Transferência excluída'); } catch (e) { toast.error((e as Error).message); } }}
                          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          title="Excluir transferência"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
