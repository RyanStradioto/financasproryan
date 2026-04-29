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

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);

  useEffect(() => {
    const isRecoveryUrl = () => {
      const hash = window.location.hash;
      const search = window.location.search;
      return hash.includes('type=recovery') || search.includes('type=recovery');
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsRecoveryMode(isRecoveryUrl());
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryMode(true);
      }
      if (event === 'SIGNED_OUT') {
        setIsRecoveryMode(false);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const exitRecoveryMode = () => {
    setIsRecoveryMode(false);
    const cleanUrl = `${window.location.origin}${window.location.pathname}`;
    window.history.replaceState({}, document.title, cleanUrl);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setIsRecoveryMode(false);
  };

  return (
    <AuthCtx.Provider value={{ user, session, loading, isRecoveryMode, exitRecoveryMode, signOut }}>
      {children}
    </AuthCtx.Provider>
  );
};

export const useAuth = () => useContext(AuthCtx);
