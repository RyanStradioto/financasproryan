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
      toast.success(`"${item.description}" restaurado com sucesso!`, {
        icon: '✅',
      });
    } catch {
      toast.error('Erro ao restaurar item');
    }
  };

  const handlePermanentDelete = async (item: TrashedItem) => {
    try {
      await permanentDelete.mutateAsync({ id: item.id, table: item.table });
      toast.success('Item excluído permanentemente');
      setConfirmDelete(null);
    } catch {
      toast.error('Erro ao excluir permanentemente');
    }
  };

  const incomeItems = items.filter(i => i.table === 'income');
  const expenseItems = items.filter(i => i.table === 'expenses');

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lixeira</h1>
          <p className="text-sm text-muted-foreground">
            Itens excluídos ficam aqui por 30 dias antes da exclusão permanente
          </p>
        </div>
        {items.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg">
            <Clock className="w-3.5 h-3.5" />
            {items.length} {items.length === 1 ? 'item' : 'itens'} na lixeira
          </div>
        )}
      </div>

      {/* Info banner */}
      <div className="rounded-2xl bg-gradient-to-r from-warning/8 to-warning/2 border border-warning/15 p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-warning/15 flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5 text-warning" />
        </div>
        <div>
          <p className="text-sm font-medium">Recuperação Inteligente</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Excluiu algo sem querer? Restaure aqui! Os itens são mantidos por 30 dias para sua segurança.
          </p>
        </div>
      </div>

      {items.length === 0 && !isLoading && (
        <div className="stat-card flex flex-col items-center py-16 gap-3">
          <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
            <Trash2 className="w-8 h-8 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">A lixeira está vazia</p>
          <p className="text-xs text-muted-foreground/70">Itens excluídos aparecerão aqui</p>
        </div>
      )}

      {/* Income items */}
      {incomeItems.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-income" />
            Receitas excluídas ({incomeItems.length})
          </h2>
          <div className="space-y-2">
            {incomeItems.map(item => (
              <TrashItemCard
                key={item.id}
                item={item}
                onRestore={handleRestore}
                onDelete={() => setConfirmDelete(item)}
                isPending={restoreItem.isPending}
              />
            ))}
          </div>
        </div>
      )}

      {/* Expense items */}
      {expenseItems.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-expense" />
            Despesas excluídas ({expenseItems.length})
          </h2>
          <div className="space-y-2">
            {expenseItems.map(item => (
              <TrashItemCard
                key={item.id}
                item={item}
                onRestore={handleRestore}
                onDelete={() => setConfirmDelete(item)}
                isPending={restoreItem.isPending}
              />
            ))}
          </div>
        </div>
      )}

      {/* Confirm permanent delete dialog */}
      <Dialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Excluir Permanentemente?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir <strong>"{confirmDelete?.description}"</strong> permanentemente?
            Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
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

function TrashItemCard({ item, onRestore, onDelete, isPending }: {
  item: TrashedItem;
  onRestore: (item: TrashedItem) => void;
  onDelete: () => void;
  isPending: boolean;
}) {
  const isIncome = item.table === 'income';
  const urgency = item.days_remaining <= 5 ? 'text-destructive' : item.days_remaining <= 10 ? 'text-warning' : 'text-muted-foreground';

  return (
    <div className="stat-card p-4 flex items-center gap-4 group hover:shadow-md transition-all">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isIncome ? 'bg-income/10' : 'bg-expense/10'}`}>
        {isIncome ? <TrendingUp className="w-5 h-5 text-income" /> : <TrendingDown className="w-5 h-5 text-expense" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">{item.description}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          <span>{formatDate(item.date)}</span>
          <span className="text-border">·</span>
          <span className={`font-medium ${urgency}`}>
            <Clock className="w-3 h-3 inline mr-0.5" />
            {item.days_remaining}d restantes
          </span>
        </div>
      </div>
      <p className={`font-bold text-sm tabular-nums shrink-0 currency ${isIncome ? 'text-income' : 'text-expense'}`}>
        {formatCurrency(item.amount)}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onRestore(item)}
          disabled={isPending}
          className="p-2 rounded-xl text-income hover:bg-income/10 transition-all"
          title="Restaurar"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          onClick={onDelete}
          className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
          title="Excluir permanentemente"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
