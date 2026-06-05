import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import { useWhatsNew } from '@/hooks/useWhatsNew';

/**
 * Modal "Novidades" — aparece uma vez por versão ao abrir o app.
 *
 * Robustez: o estado é controlado e QUALQUER forma de fechar (botão X, ESC,
 * clique fora, ou o botão "Entendi!") passa por onOpenChange -> dismiss(), que
 * persiste a versão como vista. Não há acoplamento com service worker/reload,
 * então não há como travar nem reaparecer em loop.
 */
export default function WhatsNewDialog() {
  const { open, entries, dismiss } = useWhatsNew();

  if (entries.length === 0) return null;

  const latest = entries[0];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) dismiss(); }}>
      <DialogContent className="sm:max-w-lg">
        {/* Cabeçalho */}
        <div className="flex items-center gap-3 pr-6">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-violet-600 shadow-lg shadow-primary/30">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-xl font-extrabold tracking-tight">Novidades no app ✨</DialogTitle>
            <DialogDescription className="text-xs">
              Atualização de {latest.version} — veja o que chegou
            </DialogDescription>
          </div>
        </div>

        {/* Itens */}
        <div className="mt-4 max-h-[55dvh] space-y-3 overflow-y-auto pr-1">
          {entries.flatMap((entry) =>
            entry.items.map((item, i) => (
              <div
                key={`${entry.id}-${i}`}
                className="flex items-start gap-3 rounded-2xl border border-border/60 bg-muted/30 p-3.5"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-violet-500/10 text-xl">
                  {item.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold leading-tight">{item.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            )),
          )}
        </div>

        {/* Ação */}
        <Button onClick={dismiss} className="mt-5 w-full gap-2 font-semibold">
          Entendi! Vamos lá
        </Button>
      </DialogContent>
    </Dialog>
  );
}
