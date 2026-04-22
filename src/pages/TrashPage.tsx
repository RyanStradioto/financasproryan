import { useState } from 'react';
import { useTrash, useRestoreItem, usePermanentDelete, type TrashedItem } from '@/hooks/useTrash';
import { formatCurrency, formatDate } from '@/lib/format';
import { Trash2, RotateCcw, AlertTriangle, Clock, TrendingUp, TrendingDown, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function TrashPage() {
  const { data: items = [], isLoading } = useTrash();
  const restoreItem = useRestoreItem();
  const permanentDelete = usePermanentDelete();
  const [confirmDelete, setConfirmDelete] = useState<TrashedItem | null>(null);

  const handleRestore = async (item: TrashedItem) => {
    try {
      await restoreItem.mutateAsync({ id: item.id, table: item.table });
      toast.success(`"${item.description}" restaurado com sucesso!`);
    } catch {
      toast.error('Erro ao restaurar item');
    }
  };

  const handlePermanentDelete = async (item: TrashedItem) => {
    try {
      await permanentDelete.mutateAsync({ id: item.id, table: item.table });
      toast.success('Item excluido permanentemente');
      setConfirmDelete(null);
    } catch {
      toast.error('Erro ao excluir permanentemente');
    }
  };

  const incomeItems = items.filter((item) => item.table === 'income');
  const expenseItems = items.filter((item) => item.table === 'expenses');

  return (
    <div className="space-y-5 md:space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Lixeira</h1>
          <p className="text-sm text-muted-foreground max-w-xl">
            Itens excluidos ficam aqui por 30 dias antes da exclusao permanente.
          </p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-2xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          {items.length} {items.length === 1 ? 'item na lixeira' : 'itens na lixeira'}
        </div>
      </div>

      <div className="rounded-3xl border border-warning/20 bg-gradient-to-br from-warning/10 via-warning/5 to-transparent p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-warning/15">
            <Sparkles className="w-5 h-5 text-warning" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold">Recuperacao Inteligente</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Excluiu algo sem querer? Restaure aqui. Os itens ficam guardados por 30 dias para sua seguranca.
            </p>
          </div>
        </div>
      </div>

      {items.length === 0 && !isLoading && (
        <div className="stat-card flex flex-col items-center py-16 gap-3">
          <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
            <Trash2 className="w-8 h-8 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">A lixeira esta vazia</p>
          <p className="text-xs text-muted-foreground/70">Itens excluidos aparecerao aqui</p>
        </div>
      )}

      {incomeItems.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-income" />
            Receitas excluidas ({incomeItems.length})
          </h2>
          <div className="space-y-3">
            {incomeItems.map((item) => (
              <TrashItemCard
                key={item.id}
                item={item}
                onRestore={handleRestore}
                onDelete={() => setConfirmDelete(item)}
                isPending={restoreItem.isPending}
              />
            ))}
          </div>
        </section>
      )}

      {expenseItems.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-expense" />
            Despesas excluidas ({expenseItems.length})
          </h2>
          <div className="space-y-3">
            {expenseItems.map((item) => (
              <TrashItemCard
                key={item.id}
                item={item}
                onRestore={handleRestore}
                onDelete={() => setConfirmDelete(item)}
                isPending={restoreItem.isPending}
              />
            ))}
          </div>
        </section>
      )}

      <Dialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Excluir permanentemente?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir <strong>"{confirmDelete?.description}"</strong> permanentemente?
            Esta acao nao pode ser desfeita.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmDelete && handlePermanentDelete(confirmDelete)}
              disabled={permanentDelete.isPending}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Excluir para sempre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TrashItemCard({
  item,
  onRestore,
  onDelete,
  isPending,
}: {
  item: TrashedItem;
  onRestore: (item: TrashedItem) => void;
  onDelete: () => void;
  isPending: boolean;
}) {
  const isIncome = item.table === 'income';
  const urgencyClass =
    item.days_remaining <= 5 ? 'text-destructive' : item.days_remaining <= 10 ? 'text-warning' : 'text-muted-foreground';

  return (
    <div className="stat-card p-4 sm:p-5 transition-all hover:shadow-md">
      <div className="flex items-start gap-3 sm:gap-4">
        <div className={`mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${isIncome ? 'bg-income/10' : 'bg-expense/10'}`}>
          {isIncome ? <TrendingUp className="w-5 h-5 text-income" /> : <TrendingDown className="w-5 h-5 text-expense" />}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="font-semibold text-base leading-tight break-words">{item.description}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full bg-muted/60 px-2.5 py-1">{formatDate(item.date)}</span>
                <span className={`inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-1 font-medium ${urgencyClass}`}>
                  <Clock className="w-3 h-3" />
                  {item.days_remaining} dias restantes
                </span>
              </div>
            </div>

            <div className={`inline-flex w-fit items-center rounded-2xl px-3 py-2 text-base font-bold tabular-nums ${isIncome ? 'bg-income/10 text-income' : 'bg-expense/10 text-expense'}`}>
              {formatCurrency(item.amount)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onRestore(item)}
              disabled={isPending}
              className="h-11 rounded-2xl border-income/20 text-income hover:bg-income/10 hover:text-income"
            >
              <RotateCcw className="w-4 h-4" />
              Restaurar
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onDelete}
              className="h-11 rounded-2xl text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
              Excluir
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
