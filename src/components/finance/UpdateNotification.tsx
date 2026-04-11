import { useAppUpdate } from '@/hooks/useAppUpdate';
import { RefreshCw, X, Sparkles } from 'lucide-react';

export default function UpdateNotification() {
  const { updateAvailable, versionInfo, applyUpdate, dismiss } = useAppUpdate();

  if (!updateAvailable || !versionInfo) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-card border border-border/50 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-primary/10 to-primary/5 px-5 pt-5 pb-4">
          <button
            onClick={dismiss}
            className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-primary/15 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-base">Nova Atualização!</h2>
              <p className="text-xs text-muted-foreground">
                Versão {versionInfo.version} • {formatDate(versionInfo.date)}
              </p>
            </div>
          </div>
        </div>

        {/* Changelog */}
        <div className="px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 mb-3">
            O que há de novo
          </p>
          <ul className="space-y-2.5">
            {versionInfo.changes.map((change, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-foreground/90">
                <span>{change}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 pt-1 flex gap-3">
          <button
            onClick={dismiss}
            className="flex-1 h-11 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition-all"
          >
            Depois
          </button>
          <button
            onClick={applyUpdate}
            className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all shadow-sm shadow-primary/20 flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar Agora
          </button>
        </div>

        {/* Safe area bottom padding for mobile */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
}
