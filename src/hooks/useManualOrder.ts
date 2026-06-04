import { useCallback, useState } from 'react';

/**
 * Persists a user-defined ordering of item ids in localStorage.
 * Used by the "arraste para rankear" feature in Receitas/Despesas.
 *
 * - `order`: the saved id sequence (may include stale ids; filtered on apply)
 * - `setOrder`: replace the whole sequence (called after a drag)
 * - `applyOrder`: sort a list by the saved order; items not yet ordered are
 *   kept at the TOP (newest-first stays visible), then the manually-ranked ones.
 * - `active`: whether a manual order exists (so the UI can show "ordenação manual")
 */
export function useManualOrder(key: string) {
  const storageKey = `financaspro_order_${key}`;
  const [order, setOrderState] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
    } catch {
      return [];
    }
  });

  const setOrder = useCallback((ids: string[]) => {
    setOrderState(ids);
    try { localStorage.setItem(storageKey, JSON.stringify(ids)); } catch { /* ignore */ }
  }, [storageKey]);

  const clearOrder = useCallback(() => {
    setOrderState([]);
    try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
  }, [storageKey]);

  const applyOrder = useCallback(<T,>(items: T[], getId: (t: T) => string): T[] => {
    if (order.length === 0) return items;
    const indexOf = new Map(order.map((id, i) => [id, i]));
    const known: T[] = [];
    const unknown: T[] = [];
    for (const it of items) {
      (indexOf.has(getId(it)) ? known : unknown).push(it);
    }
    known.sort((a, b) => (indexOf.get(getId(a)) ?? 0) - (indexOf.get(getId(b)) ?? 0));
    return [...unknown, ...known];
  }, [order]);

  return { order, setOrder, clearOrder, applyOrder, active: order.length > 0 };
}
