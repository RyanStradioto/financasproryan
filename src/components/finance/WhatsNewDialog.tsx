import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, PartyPopper, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWhatsNew } from '@/hooks/useWhatsNew';

/** Tons suaves para os ícones — variam por item e ficam bem em claro/escuro. */
const ITEM_ACCENTS = [
  'from-violet-500/20 to-fuchsia-500/10 ring-violet-500/25',
  'from-sky-500/20 to-cyan-500/10 ring-sky-500/25',
  'from-emerald-500/20 to-teal-500/10 ring-emerald-500/25',
  'from-amber-500/20 to-orange-500/10 ring-amber-500/25',
  'from-rose-500/20 to-pink-500/10 ring-rose-500/25',
];

/**
 * Modal "Novidades" — aparece uma vez por versão ao abrir o app.
 *
 * À prova de travar: o estado é controlado e QUALQUER forma de fechar
 * (botão X, ESC, clique fora, ou "Entendi!") passa por onOpenChange -> dismiss(),
 * que persiste a versão como vista. Sem acoplamento com service worker/reload.
 *
 * À prova de "sumir": a animação de entrada é uma transição CSS cujo estado
 * final é SEMPRE visível (opacity-100). Mesmo sem animação, os itens aparecem.
 */
export default function WhatsNewDialog() {
  const { open, entries, dismiss } = useWhatsNew();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!open) {
      setShown(false);
      return;
    }
    const t = window.setTimeout(() => setShown(true), 40);
    return () => window.clearTimeout(t);
  }, [open]);

  if (entries.length === 0) return null;

  const latest = entries[0];
  const items = entries.flatMap((e) => e.items);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) dismiss(); }}>
      <DialogContent className="sm:max-w-lg">
        {/* ── Cabeçalho ── */}
        <div className="flex flex-col items-center pr-6 text-center">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 shadow-xl shadow-fuchsia-500/30">
            <Sparkles className="h-8 w-8 text-white" />
            <span className="absolute -right-1 -top-1 h-3 w-3 animate-pulse rounded-full bg-amber-400 ring-2 ring-background" />
          </div>

          <span className="mt-3.5 inline-flex items-center gap-1.5 rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-300">
            <PartyPopper className="h-3 w-3" /> Atualização • {latest.version}
          </span>

          <DialogTitle className="mt-3 text-2xl font-extrabold tracking-tight">
            Novidades no app
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm">
            Demos um trato no app — veja o que acabou de chegar pra você ✨
          </DialogDescription>
        </div>

        {/* faixa de gradiente decorativa */}
        <div className="mx-auto mt-5 h-1 w-24 rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500" />

        {/* ── Itens ── */}
        <div className="mt-4 max-h-[50dvh] space-y-2.5 overflow-y-auto overflow-x-hidden px-0.5 py-0.5">
          {items.map((item, i) => (
            <div
              key={`${latest.id}-${i}`}
              style={{ transitionDelay: shown ? `${i * 70}ms` : '0ms' }}
              className={cn(
                'flex items-start gap-3 rounded-2xl border border-border/60 bg-gradient-to-br from-muted/50 to-muted/10 p-3.5 transition-all duration-500 ease-out',
                shown ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
              )}
            >
              <div
                className={cn(
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-xl shadow-sm ring-1 ring-inset',
                  ITEM_ACCENTS[i % ITEM_ACCENTS.length],
                )}
              >
                <span aria-hidden>{item.icon}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold leading-tight">{item.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Ação ── */}
        <Button
          onClick={dismiss}
          className="mt-5 w-full gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 font-semibold text-white shadow-lg shadow-fuchsia-500/25 hover:opacity-95"
        >
          Entendi! Vamos lá <ArrowRight className="h-4 w-4" />
        </Button>
      </DialogContent>
    </Dialog>
  );
}
