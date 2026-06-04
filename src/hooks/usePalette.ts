import { useState, useEffect, useCallback, useRef } from 'react';
import {
  type PaletteId,
  PALETTE_STORAGE_KEY,
  PALETTES,
  getStoredPalette,
  applyPalette,
} from '@/lib/palettes';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const isValid = (v: unknown): v is PaletteId =>
  typeof v === 'string' && PALETTES.some((p) => p.id === v);

/**
 * Manages the active color palette. Persists to localStorage (instant, no flash)
 * AND to the Supabase auth user_metadata so the choice syncs across devices.
 */
export function usePalette() {
  const { user } = useAuth();
  const [palette, setPaletteState] = useState<PaletteId>(() => getStoredPalette());
  const syncedFromServer = useRef(false);

  // Apply + cache locally on every change
  useEffect(() => {
    applyPalette(palette);
    try { localStorage.setItem(PALETTE_STORAGE_KEY, palette); } catch { /* ignore */ }
  }, [palette]);

  // When the user session loads, adopt the server-saved palette (cross-device sync)
  useEffect(() => {
    if (!user || syncedFromServer.current) return;
    const remote = (user.user_metadata as Record<string, unknown> | undefined)?.app_palette;
    if (isValid(remote) && remote !== palette) {
      setPaletteState(remote);
    }
    syncedFromServer.current = true;
  }, [user, palette]);

  // Sync across tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === PALETTE_STORAGE_KEY && e.newValue && isValid(e.newValue)) {
        setPaletteState(e.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setPalette = useCallback((id: PaletteId) => {
    setPaletteState(id);
    // Persist to the auth user so it follows the user to other devices
    supabase.auth.updateUser({ data: { app_palette: id } }).catch(() => { /* offline ok */ });
  }, []);

  return { palette, setPalette };
}
