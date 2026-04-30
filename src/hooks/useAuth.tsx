import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

type AuthContext = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isRecoveryMode: boolean;
  exitRecoveryMode: () => void;
  signOut: () => Promise<void>;
};

const AuthCtx = createContext<AuthContext>({
  user: null,
  session: null,
  loading: true,
  isRecoveryMode: false,
  exitRecoveryMode: () => {},
  signOut: async () => {},
});

const RECOVERY_KEY = 'financaspro_recovery_mode';

const checkIsRecoveryUrl = () => {
  const hash = window.location.hash;
  const search = window.location.search;
  return hash.includes('type=recovery') || search.includes('type=recovery');
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Checar URL de forma síncrona no momento da inicialização (antes que o
  // hash seja limpo pelo Supabase) e persistir no sessionStorage como fallback.
  const [isRecoveryMode, setIsRecoveryMode] = useState(() => {
    const fromUrl = checkIsRecoveryUrl();
    if (fromUrl) sessionStorage.setItem(RECOVERY_KEY, '1');
    return fromUrl || sessionStorage.getItem(RECOVERY_KEY) === '1';
  });

  useEffect(() => {
    // Registrar listener ANTES de getSession para não perder eventos
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (event === 'PASSWORD_RECOVERY') {
        sessionStorage.setItem(RECOVERY_KEY, '1');
        setIsRecoveryMode(true);
      }
      if (event === 'SIGNED_IN' && checkIsRecoveryUrl()) {
        sessionStorage.setItem(RECOVERY_KEY, '1');
        setIsRecoveryMode(true);
      }
      if (event === 'SIGNED_OUT') {
        sessionStorage.removeItem(RECOVERY_KEY);
        setIsRecoveryMode(false);
      }

      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const exitRecoveryMode = () => {
    sessionStorage.removeItem(RECOVERY_KEY);
    setIsRecoveryMode(false);
    const cleanUrl = `${window.location.origin}${window.location.pathname}`;
    window.history.replaceState({}, document.title, cleanUrl);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    sessionStorage.removeItem(RECOVERY_KEY);
    setIsRecoveryMode(false);
  };

  return (
    <AuthCtx.Provider value={{ user, session, loading, isRecoveryMode, exitRecoveryMode, signOut }}>
      {children}
    </AuthCtx.Provider>
  );
};

export const useAuth = () => useContext(AuthCtx);
