import { Wallet, Moon, Sun, Download } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useEffect, useRef, useState } from 'react';

export default function MobileHeader() {
  const { theme, toggleTheme } = useTheme();
  const deferredPrompt = useRef<any>(null);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e;
      setCanInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    // Se já está instalado como PWA, não mostrar
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setCanInstall(false);
    }
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt.current) return;
    deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    if (outcome === 'accepted') {
      setCanInstall(false);
      deferredPrompt.current = null;
    }
  };

  return (
    <header className="lg:hidden sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b border-border/50 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md shadow-primary/25">
          <Wallet className="w-4 h-4 text-primary-foreground" />
        </div>
        <span className="font-bold text-sm tracking-tight">FinançasPro</span>
      </div>
      <div className="flex items-center gap-1">
        {canInstall && (
          <button
            onClick={handleInstall}
            className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-sm shadow-primary/20"
          >
            <Download className="w-3.5 h-3.5" />
            Instalar
          </button>
        )}
        <button
          onClick={toggleTheme}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          aria-label="Alternar tema"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
}
