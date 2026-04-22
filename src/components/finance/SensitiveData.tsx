import { createContext, useContext, useMemo, useState } from 'react';

type SensitiveDataContextValue = {
  isVisible: boolean;
  toggleVisibility: () => void;
  maskCurrency: (value: string) => string;
  maskText: (value: string) => string;
};

const STORAGE_KEY = 'financaspro:sensitive-data-visible';
const SensitiveDataContext = createContext<SensitiveDataContextValue | null>(null);

export function SensitiveDataProvider({ children }: { children: React.ReactNode }) {
  const [isVisible, setIsVisible] = useState(() => localStorage.getItem(STORAGE_KEY) !== 'hidden');

  const value = useMemo<SensitiveDataContextValue>(() => ({
    isVisible,
    toggleVisibility: () => {
      setIsVisible((current) => {
        const next = !current;
        localStorage.setItem(STORAGE_KEY, next ? 'visible' : 'hidden');
        return next;
      });
    },
    maskCurrency: (value: string) => (isVisible ? value : 'R$ •••••'),
    maskText: (value: string) => (isVisible ? value : '•••••'),
  }), [isVisible]);

  return (
    <SensitiveDataContext.Provider value={value}>
      {children}
    </SensitiveDataContext.Provider>
  );
}

export function useSensitiveData() {
  const context = useContext(SensitiveDataContext);
  if (!context) {
    throw new Error('useSensitiveData must be used within SensitiveDataProvider');
  }
  return context;
}
