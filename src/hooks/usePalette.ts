import { useState, useEffect, useCallback } from 'react';
import {
  type PaletteId,
  PALETTE_STORAGE_KEY,
  getStoredPalette,
  applyPalette,
} from '@/lib/palettes';

/**
 * Manages the active color palette. Persists to localStorage and applies the
 * data-palette attribute on <html>. Syncs across tabs via the storage event.
 */
export function usePalette() {
  const [palette, setPaletteState] = useState<PaletteId>(() => getStoredPalette());

  useEffect(() => {
    applyPalette(palette);
    try {
      localStorage.setItem(PALETTE_STORAGE_KEY, palette);
    } catch { /* ignore */ }
  }, [palette]);

  // Keep in sync if changed from another tab
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === PALETTE_STORAGE_KEY && e.newValue) {
        setPaletteState(getStoredPalette());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setPalette = useCallback((id: PaletteId) => setPaletteState(id), []);

  return { palette, setPalette };
}
