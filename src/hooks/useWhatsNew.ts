import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { CHANGELOG, LATEST_CHANGELOG_ID, type ChangelogEntry } from '@/lib/changelog';

const SEEN_KEY = 'financaspro:whatsnew:lastSeenId';

/** Detecta se o tutorial já foi concluído por este usuário, sem acoplar à versão. */
function tutorialWasSeen(uid: string): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('financaspro:tutorial:') && k.endsWith(`:${uid}`) && localStorage.getItem(k) === 'seen') {
        return true;
      }
    }
  } catch {
    /* ignore */
  }
  return false;
}

function readLastSeen(): number {
  try {
    return Number(localStorage.getItem(SEEN_KEY) || '0') || 0;
  } catch {
    return 0;
  }
}
function writeLastSeen(id: number) {
  try {
    localStorage.setItem(SEEN_KEY, String(id));
  } catch {
    /* ignore */
  }
}

/**
 * Controla o modal de "Novidades".
 * - Mostra as entradas do changelog ainda não vistas (id > lastSeen).
 * - Para usuário NOVO (tutorial ainda não concluído), não empilha o modal:
 *   marca a versão como vista para não poluir a primeira experiência.
 * - `dismiss` persiste a versão mais recente — robusto contra reaparecer/travar.
 */
export function useWhatsNew() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);

  useEffect(() => {
    if (!user?.id) return;

    const lastSeen = readLastSeen();
    const unseen = CHANGELOG.filter((e) => e.id > lastSeen).sort((a, b) => b.id - a.id);
    if (unseen.length === 0) return;

    // Usuário novo: deixa o tutorial guiar; não mostra changelog agora.
    if (!tutorialWasSeen(user.id)) {
      writeLastSeen(LATEST_CHANGELOG_ID);
      return;
    }

    // Pequeno atraso para não competir com a montagem da tela.
    const t = window.setTimeout(() => {
      setEntries(unseen);
      setOpen(true);
    }, 900);
    return () => window.clearTimeout(t);
  }, [user?.id]);

  const dismiss = useCallback(() => {
    writeLastSeen(LATEST_CHANGELOG_ID);
    setOpen(false);
  }, []);

  return { open, entries, dismiss };
}
