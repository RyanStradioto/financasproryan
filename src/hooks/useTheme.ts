import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

type Theme = 'light' | 'dark';

export function useTheme() {
  const { user } = useAuth();
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as Theme) || 'dark';
    }
    return 'dark';
  });
  const syncedFromServer = useRef(false);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Adopt the server-saved theme on session load (cross-device sync)
  useEffect(() => {
    if (!user || syncedFromServer.current) return;
    const remote = (user.user_metadata as Record<string, unknown> | undefined)?.app_theme;
    if ((remote === 'light' || remote === 'dark') && remote !== theme) {
      setThemeState(remote);
    }
    syncedFromServer.current = true;
  }, [user, theme]);

  const setTheme = (next: Theme) => {
    setThemeState(next);
    supabase.auth.updateUser({ data: { app_theme: next } }).catch(() => { /* offline ok */ });
  };

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  return { theme, setTheme, toggleTheme };
}
