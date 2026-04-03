import { Wallet, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

export default function MobileHeader() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="lg:hidden sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b border-border/50 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md shadow-primary/25">
          <Wallet className="w-4 h-4 text-primary-foreground" />
        </div>
        <span className="font-bold text-sm tracking-tight">FinançasPro</span>
      </div>
      <button
        onClick={toggleTheme}
        className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
        aria-label="Alternar tema"
      >
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>
    </header>
  );
}
